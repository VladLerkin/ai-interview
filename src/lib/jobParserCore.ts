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

export function htmlToText(html: string): string {
  let text = html
    // Remove unwanted tags and their inner content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Replace structure tags with newlines
    .replace(/<br\s*[/]?>/gi, '\n')
    .replace(/<\/(p|div|section|article)>/gi, '\n\n')
    .replace(/<\/(h[1-6])>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/(tr|table)>/gi, '\n')
    .replace(/<hr\s*[/]?>/gi, '\n---\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ');

  text = decodeHtmlEntities(text);

  // Normalize whitespace: trim lines and remove excessive blank lines
  const lines = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts job posting title, company name, and clean text description from page HTML.
 */
export function parseJobHtml(html: string): ParsedJob {
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

  // 2. Specific selectors for HeadHunter (hh.ru)
  if (!description) {
    const hhDescMatch =
      html.match(/<div[^>]*data-qa=["']vacancy-description["'][^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<div[^>]*class=["'][^"']*g-user-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (hhDescMatch) {
      description = htmlToText(hhDescMatch[1]);
    }
  }

  if (!title) {
    const hhTitleMatch = html.match(/<h1[^>]*data-qa=["']vacancy-title["'][^>]*>([\s\S]*?)<\/h1>/i);
    if (hhTitleMatch) {
      title = cleanText(hhTitleMatch[1]);
    }
  }

  if (!company) {
    const hhCompanyMatch =
      html.match(/<a[^>]*data-qa=["']vacancy-company-name["'][^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/<span[^>]*data-qa=["']vacancy-company-name["'][^>]*>([\s\S]*?)<\/span>/i);
    if (hhCompanyMatch) {
      company = cleanText(hhCompanyMatch[1]);
    }
  }

  // 3. Common class/id names for job postings
  if (!description) {
    const commonSectionMatch = html.match(
      /<(?:div|section|article)[^>]*(?:class|id)=["'][^"']*(?:job[-_]?description|vacancy[-_]?description|posting[-_]?description|job[-_]?details|description__text)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
    );
    if (commonSectionMatch) {
      description = htmlToText(commonSectionMatch[1]);
    }
  }

  // 4. Fallback to OpenGraph / Twitter meta tags for metadata
  if (!title) {
    const metaTitle =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (metaTitle) {
      title = cleanText(metaTitle[1]);
    }
  }

  if (!company) {
    const metaSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i);
    if (metaSite) {
      company = cleanText(metaSite[1]);
    }
  }

  // 5. Fallback: Parse body if description is still empty or extremely short (< 15 chars)
  if (description.length < 15) {
    let strippedBody = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '');

    const bodyMatch = strippedBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      strippedBody = bodyMatch[1];
    }
    const bodyText = htmlToText(strippedBody);
    if (bodyText.length > description.length) {
      description = bodyText;
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
