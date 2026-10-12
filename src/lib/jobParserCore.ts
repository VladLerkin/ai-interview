export interface ParsedJob {
  title?: string;
  company?: string;
  description: string;
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number(dec));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

export function cleanText(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim());
}

/**
 * Extracts the inner content of an HTML element matching the given tag name,
 * correctly handling arbitrarily nested tags of the same type.
 */
export function extractBalancedElement(html: string, startIndex: number, tagName: string): string | null {
  const firstClose = html.indexOf('>', startIndex);
  if (firstClose === -1) return null;

  const contentStart = firstClose + 1;
  let depth = 1;
  const tagLower = tagName.toLowerCase();

  const tagRegex = new RegExp(`</?${tagLower}(?:[\\s>/]|$)`, 'gi');
  tagRegex.lastIndex = contentStart;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html)) !== null) {
    const matchedText = match[0].toLowerCase();
    if (matchedText.startsWith(`</${tagLower}`)) {
      depth--;
      if (depth === 0) {
        return html.slice(contentStart, match.index);
      }
    } else if (matchedText.startsWith(`<${tagLower}`)) {
      const closingBracket = html.indexOf('>', match.index);
      if (closingBracket !== -1 && html[closingBracket - 1] === '/') {
        tagRegex.lastIndex = closingBracket + 1;
        continue;
      }
      depth++;
    }
  }
  return null;
}

/**
 * Strips script tags, styles, SVG, noscripts, and especially forms/application sections.
 */
export function stripUnwantedHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(
      /<(?:div|section|aside)[^>]*(?:id|class)=["'][^"']*(?:application[-_]?form|apply[-_]?(?:form|section|container)|job[-_]?application|application--form)[^"']*["'][\s\S]*?<\/(?:div|section|aside)>/gi,
      '',
    )
    .replace(/<(?:input|textarea|select|button)[^>]*>[\s\S]*?<\/(?:textarea|select|button)>/gi, '')
    .replace(/<(?:input|textarea|select|button)[^>]*\/?>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '');
}

/**
 * Cuts off any application form text if it was included in the markup outside standard form tags.
 */
export function cleanApplicationFormText(text: string): string {
  const cutoffRegex =
    /\n\s*(?:Apply for this job|Submit application|Autofill my application|Application Form|Откликнуться на вакансию|Откликнуться)\b[\s\S]*$/i;
  return text.replace(cutoffRegex, '').trim();
}

export function htmlToText(html: string): string {
  let text = stripUnwantedHtml(html)
    .replace(/<br\s*[/]?>/gi, '\n')
    .replace(/<\/(p|div|section|article)>/gi, '\n\n')
    .replace(/<\/(h[1-6])>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/(tr|table)>/gi, '\n')
    .replace(/<hr\s*[/]?>/gi, '\n---\n')
    .replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);

  const lines = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  const result = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleanApplicationFormText(result);
}

/**
 * Extracts job posting title, company name, and clean text description from page HTML.
 */
export function parseJobHtml(html: string, url?: string): ParsedJob {
  let title = '';
  let company = '';
  let description = '';

  // 1. JSON-LD structured data (Schema.org JobPosting)
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsedJson = JSON.parse(match[1].trim());
      const items = Array.isArray(parsedJson)
        ? parsedJson
        : Array.isArray(parsedJson?.['@graph'])
          ? parsedJson['@graph']
          : [parsedJson];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const type = item['@type'];
        const isJobPosting =
          type === 'JobPosting' ||
          (Array.isArray(type) && type.includes('JobPosting'));

        if (isJobPosting) {
          if (item.title && !title) title = cleanText(String(item.title));
          if (item.hiringOrganization?.name && !company) {
            company = cleanText(String(item.hiringOrganization.name));
          }
          if (item.description) {
            const parsedDesc = htmlToText(String(item.description));
            if (parsedDesc.length > description.length) {
              description = parsedDesc;
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in malformed script tags
    }
  }

  // 2. Targeted vacancy containers (Greenhouse, Lever, HeadHunter, Habr Career, etc.)
  if (!description) {
    const containerMatch = html.match(
      /<(div|section|article)[^>]*(?:class|id|data-qa)=["'][^"']*(?:job__description|job[-_]?description|vacancy[-_]?description|posting[-_]?description|job[-_]?details|description__text|vacancy-section|g-user-content)[^"']*["'][^>]*>/i,
    );
    if (containerMatch && containerMatch.index !== undefined) {
      const balanced = extractBalancedElement(html, containerMatch.index, containerMatch[1]);
      if (balanced) {
        const parsedDesc = htmlToText(balanced);
        if (parsedDesc.length > 30) {
          description = parsedDesc;
        }
      }
    }
  }

  // 3. Fallback: Parse body (with forms and applications cleanly stripped)
  if (!description || description.length < 50) {
    let strippedBody = stripUnwantedHtml(html);
    const bodyMatch = strippedBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      strippedBody = bodyMatch[1];
    }
    const bodyText = htmlToText(strippedBody);
    if (bodyText.length > description.length) {
      description = bodyText;
    }
  }

  // 4. Title and company extraction
  const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const metaTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)?.[1] || '';
  const fullTitle = cleanText(rawTitle || metaTitle);

  if (!company) {
    const atMatch = fullTitle.match(/\bat\s+([A-Z0-9][A-Za-z0-9\s&.,'-]+?)(?:\s*[|•\-–—]|$)/i);
    if (atMatch) {
      company = atMatch[1].trim();
    } else {
      const metaSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i)?.[1];
      if (metaSite) {
        company = cleanText(metaSite);
      } else if (url) {
        const urlMatch = url.match(/(?:greenhouse\.io|lever\.co|workable\.com)\/([^/]+)/i);
        if (urlMatch) {
          company = urlMatch[1].charAt(0).toUpperCase() + urlMatch[1].slice(1);
        }
      }
    }
  }

  if (!title) {
    const h1Match = html.match(
      /<(?:h1|div)[^>]*(?:class|data-qa)=["'][^"']*(?:job__title|vacancy-title|posting-headline|job-title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:h1|div)>/i,
    );
    if (h1Match) {
      title = cleanText(h1Match[1]);
    } else if (metaTitle && !metaTitle.toLowerCase().startsWith('job application')) {
      title = cleanText(metaTitle);
    } else if (fullTitle) {
      title = fullTitle
        .replace(/^(?:Job Application for|Apply for|Opening for|Hiring:?|Careers at)\s+/i, '')
        .replace(/\s+at\s+[A-Za-z0-9\s&.,'-]+$/i, '')
        .replace(/\s*[-|•–—]\s*[A-Za-z0-9\s&.,'-]+$/i, '')
        .trim();
    }
  }

  // Limit length to avoid overloading LLM prompt (approx 8000 characters)
  if (description.length > 8000) {
    description = description.slice(0, 8000) + '\n\n[... truncated ...]';
  }

  return {
    title: title || undefined,
    company: company || undefined,
    description: description.trim(),
  };
}

/**
 * Formats parsed vacancy data into a coherent string suitable for LLM prompt and user textarea.
 */
export function formatJobText(parsed: ParsedJob): string {
  const parts: string[] = [];
  if (parsed.title) {
    parts.push(`Target Role: ${parsed.title}`);
  }
  if (parsed.company) {
    parts.push(`Company: ${parsed.company}`);
  }
  if (parts.length > 0) {
    parts.push('\n---\n');
  }
  parts.push(parsed.description);
  return parts.join('\n').trim();
}
