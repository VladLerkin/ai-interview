export interface JobSections {
  companyOverview?: string;
  roleOverview?: string;
  responsibilities?: string;
  requirements?: string;
  benefits?: string;
}

export interface ParsedJob {
  title?: string;
  company?: string;
  description: string;
  sections?: JobSections;
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

export const companyHeadingRegex =
  /(?:about\s+(?:the\s+)?(?:company|us|[a-z0-9_-]+)|who\s+we\s+are|company\s+overview|our\s+mission|о\s+компании|о\s+нас|о\s+команде|кто\s+мы|наша\s+миссия)/i;
export const respHeadingRegex =
  /(?:what\s+you(?:['’]ll|\s+will)\s+do|responsibilities|duties|tasks|day\s+to\s+day|key\s+responsibilities|your\s+role|обязанности|чем\s+предстоит\s+заниматься|задачи|что\s+предстоит\s+делать|зона\s+ответственности|ваша\s+роль)/i;
export const reqHeadingRegex =
  /(?:what\s+you(?:['’]ll|\s+will)\s+(?:need|bring)|requirements|qualifications|skills|tech\s+stack|technical\s+skills|what\s+we(?:['’]re|\s+are)\s+looking\s+for|we\s+expect|требования|что\s+мы\s+ждем|наши\s+ожидания|стек|навыки|требуемый\s+опыт|ожидания\s+от\s+кандидата)/i;
export const benHeadingRegex =
  /(?:why\s+join|benefits|perks|what\s+we\s+offer|compensation|we\s+offer|work\s+conditions|условия|что\s+мы\s+предлагаем|плюшки|бонусы|бенефиты|условия\s+работы|мы\s+предлагаем)/i;
export const roleHeadingRegex =
  /(?:role\s+overview|job\s+summary|about\s+the\s+role|what\s+success\s+looks\s+like|overview|position\s+summary|описание\s+вакансии|описание\s+роли)/i;

/**
 * Automatically detects sections (Company overview, Role, Duties, Tech stack requirements, Benefits)
 * and groups the text into structured semantic blocks.
 */
export function structureJobSections(rawText: string): JobSections {
  const blocks = rawText.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

  const isBoilerplate = (text: string) => {
    return (
      /^#LI-[A-Za-z0-9_-]+$/i.test(text) ||
      /(?:equal\s+opportunity\s+employer|recruitment\s+privacy\s+policy)/i.test(text)
    );
  };

  const categorized: Record<keyof JobSections, string[]> = {
    roleOverview: [],
    companyOverview: [],
    responsibilities: [],
    requirements: [],
    benefits: [],
  };

  let currentCategory: keyof JobSections = 'roleOverview';
  let matchedAnySection = false;

  for (const block of blocks) {
    if (isBoilerplate(block)) continue;

    const rawFirstLine = block.split('\n')[0].trim();
    const cleanHeading = rawFirstLine
      .replace(/^[#*_\s\-–—\p{Extended_Pictographic}]+/u, '')
      .replace(/[:?#*_\s]+$/, '')
      .trim();

    const isShortHeading =
      cleanHeading.length > 0 &&
      cleanHeading.length <= 60 &&
      !rawFirstLine.startsWith('•') &&
      !rawFirstLine.startsWith('- ') &&
      !rawFirstLine.startsWith('* ');

    if (isShortHeading) {
      if (companyHeadingRegex.test(cleanHeading)) {
        currentCategory = 'companyOverview';
        matchedAnySection = true;
        const rest = block.split('\n').slice(1).join('\n').trim();
        if (rest) categorized[currentCategory].push(rest);
        continue;
      } else if (respHeadingRegex.test(cleanHeading)) {
        currentCategory = 'responsibilities';
        matchedAnySection = true;
        const rest = block.split('\n').slice(1).join('\n').trim();
        if (rest) categorized[currentCategory].push(rest);
        continue;
      } else if (reqHeadingRegex.test(cleanHeading)) {
        currentCategory = 'requirements';
        matchedAnySection = true;
        const rest = block.split('\n').slice(1).join('\n').trim();
        if (rest) categorized[currentCategory].push(rest);
        continue;
      } else if (benHeadingRegex.test(cleanHeading)) {
        currentCategory = 'benefits';
        matchedAnySection = true;
        const rest = block.split('\n').slice(1).join('\n').trim();
        if (rest) categorized[currentCategory].push(rest);
        continue;
      } else if (roleHeadingRegex.test(cleanHeading)) {
        currentCategory = 'roleOverview';
        matchedAnySection = true;
        const rest = block.split('\n').slice(1).join('\n').trim();
        if (rest) categorized[currentCategory].push(rest);
        continue;
      }
    }

    categorized[currentCategory].push(block);
  }

  if (!matchedAnySection) {
    return {
      roleOverview: rawText,
    };
  }

  return {
    roleOverview: categorized.roleOverview.length > 0 ? categorized.roleOverview.join('\n\n') : undefined,
    companyOverview: categorized.companyOverview.length > 0 ? categorized.companyOverview.join('\n\n') : undefined,
    responsibilities: categorized.responsibilities.length > 0 ? categorized.responsibilities.join('\n\n') : undefined,
    requirements: categorized.requirements.length > 0 ? categorized.requirements.join('\n\n') : undefined,
    benefits: categorized.benefits.length > 0 ? categorized.benefits.join('\n\n') : undefined,
  };
}

/**
 * Parses user-pasted job description text (which may contain raw copy-paste, HTML, or markdown),
 * extracts potential title/company, and normalizes into structured JobSections.
 */
export function parseRawJobText(rawText: string): ParsedJob {
  let text = rawText.trim();
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = htmlToText(text);
  } else {
    text = decodeHtmlEntities(text);
  }

  let title: string | undefined;
  let company: string | undefined;

  // Check for Target Role / Company headers at top
  const titleMatch = text.match(/^(?:Target\s+Role|Role|Position|Title|Должность|Позиция|Вакансия)\s*:\s*([^\n]+)/im);
  if (titleMatch) {
    title = cleanText(titleMatch[1]);
  }

  const companyMatch = text.match(/^(?:Company|Компания|Организация)\s*:\s*([^\n]+)/im);
  if (companyMatch) {
    company = cleanText(companyMatch[1]);
  }

  // Pre-normalize text so single-line headings are separated by double newlines
  const lines = text.split('\n');
  const normalized: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    const candidate = trimmedLine
      .replace(/^[#*_\s\-–—\p{Extended_Pictographic}]+/u, '')
      .replace(/[:?#*_\s]+$/, '')
      .trim();

    if (
      candidate.length > 0 &&
      candidate.length <= 60 &&
      !trimmedLine.startsWith('•') &&
      !trimmedLine.startsWith('- ') &&
      !trimmedLine.startsWith('* ') &&
      (companyHeadingRegex.test(candidate) ||
        respHeadingRegex.test(candidate) ||
        reqHeadingRegex.test(candidate) ||
        benHeadingRegex.test(candidate) ||
        roleHeadingRegex.test(candidate))
    ) {
      normalized.push('');
      normalized.push(trimmedLine);
      normalized.push('');
    } else {
      normalized.push(line);
    }
  }

  const normalizedText = normalized.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // If title was not explicitly labeled, check if the first non-empty line looks like a title
  if (!title) {
    const firstLine = lines.find((l) => l.trim().length > 0)?.trim();
    if (
      firstLine &&
      firstLine.length <= 60 &&
      !firstLine.includes(':') &&
      !firstLine.startsWith('•') &&
      !firstLine.startsWith('- ') &&
      !firstLine.startsWith('* ')
    ) {
      const candidate = firstLine
        .replace(/^[#*_\s\-–—\p{Extended_Pictographic}]+/u, '')
        .trim();
      if (
        !companyHeadingRegex.test(candidate) &&
        !respHeadingRegex.test(candidate) &&
        !reqHeadingRegex.test(candidate) &&
        !benHeadingRegex.test(candidate) &&
        !roleHeadingRegex.test(candidate)
      ) {
        title = candidate;
      }
    }
  }

  const sections = structureJobSections(normalizedText);

  // If roleOverview only echoed the title or company metadata line, clean it up
  if (sections.roleOverview) {
    const cleanedRole = sections.roleOverview
      .replace(/^(?:Target\s+Role|Role|Position|Title|Должность|Позиция|Вакансия)\s*:\s*[^\n]+/gim, '')
      .replace(/^(?:Company|Компания|Организация)\s*:\s*[^\n]+/gim, '')
      .trim();
    sections.roleOverview = cleanedRole || undefined;
  }

  return {
    title,
    company,
    description: normalizedText,
    sections,
  };
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

  const sections = structureJobSections(description);

  return {
    title: title || undefined,
    company: company || undefined,
    description: description.trim(),
    sections,
  };
}

/**
 * Formats parsed vacancy data into a coherent, structured string suitable for LLM prompt and user textarea.
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
    parts.push('---');
  }

  const sections = parsed.sections;
  if (
    sections &&
    (sections.companyOverview || sections.responsibilities || sections.requirements || sections.benefits)
  ) {
    if (sections.companyOverview) {
      parts.push(`### 🏢 About the Company\n${sections.companyOverview}`);
    }
    if (sections.roleOverview) {
      parts.push(`### 💼 Role Overview & Goals\n${sections.roleOverview}`);
    }
    if (sections.responsibilities) {
      parts.push(`### 📋 Responsibilities & Duties\n${sections.responsibilities}`);
    }
    if (sections.requirements) {
      parts.push(`### 🛠️ Requirements & Qualifications\n${sections.requirements}`);
    }
    if (sections.benefits) {
      parts.push(`### 🎁 Work Conditions & Benefits\n${sections.benefits}`);
    }
  } else {
    parts.push(parsed.description);
  }

  return parts.join('\n\n').trim();
}
