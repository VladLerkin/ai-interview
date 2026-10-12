import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from './llm';
import type { Provider } from '../types/interview';
import { type ParsedJob, parseRawJobText } from '../lib/jobParserCore';

const FORMAT_JOB_SYSTEM_PROMPT = `You are an expert HR and recruitment assistant.
Your task is to analyze and restructure the given job description into a standardized JSON format.

JSON Schema:
{
  "title": "Job title or role (e.g. Senior Frontend Engineer) or null if not identified",
  "company": "Company name or null if not identified",
  "sections": {
    "companyOverview": "About the company, team, mission, or culture (in original language) or null",
    "roleOverview": "High-level summary of the role, goals, or expectations (in original language) or null",
    "responsibilities": "Key responsibilities and day-to-day duties formatted with bullet points '• ' (in original language) or null",
    "requirements": "Required and preferred skills, tech stack, and qualifications formatted with bullet points '• ' (in original language) or null",
    "benefits": "Compensation, benefits, work format (remote/hybrid/office), and perks formatted with bullet points '• ' (in original language) or null"
  }
}

Rules:
1. Strictly preserve the original language and technical terms used in the job description. Do NOT translate into another language.
2. Remove HTML artifacts, boilerplate disclaimers, application form instructions, and recruitment ads.
3. Clean and normalize lists to use '• ' for bullets.
4. Output ONLY valid, parseable JSON matching the schema above. Do NOT include markdown code blocks (\`\`\`json) or extra text.`;

export interface ReformatJobOptions {
  timeoutMs?: number;
}

/**
 * Uses the selected LLM provider to intelligently analyze and restructure
 * a raw job description into standardized sections.
 * Falls back to local rule-based parsing if LLM is unavailable or fails.
 */
export async function reformatJobDescriptionWithAi(
  rawText: string,
  provider: Provider,
  apiKey: string,
  options: ReformatJobOptions = {},
): Promise<ParsedJob> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Job description is empty');
  }

  // If no apiKey provided, parse locally using rule-based parser immediately
  if (!apiKey.trim()) {
    return parseRawJobText(trimmed);
  }

  const timeoutMs = options.timeoutMs ?? 25000;
  const llm = createChatModel(provider, apiKey.trim(), 0);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI formatting timed out.')), timeoutMs);
  });

  try {
    const response = await Promise.race([
      llm.invoke([
        new SystemMessage(FORMAT_JOB_SYSTEM_PROMPT),
        new HumanMessage(trimmed.slice(0, 10000)),
      ]),
      timeoutPromise,
    ]);

    const content = response.text?.trim() || '';
    const cleanJson = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    interface LlmJobJson {
      title?: string | null;
      company?: string | null;
      sections?: {
        companyOverview?: string | null;
        roleOverview?: string | null;
        responsibilities?: string | null;
        requirements?: string | null;
        benefits?: string | null;
      };
    }

    let parsedJson: LlmJobJson;
    try {
      parsedJson = JSON.parse(cleanJson);
    } catch {
      const match = cleanJson.match(/\{[\s\S]*\}/);
      if (match) {
        parsedJson = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    const sections = parsedJson.sections || {};
    const hasAnySection = Boolean(
      sections.companyOverview ||
        sections.roleOverview ||
        sections.responsibilities ||
        sections.requirements ||
        sections.benefits,
    );

    if (!hasAnySection) {
      // Fallback to local rule-based extraction if AI returned empty sections
      const local = parseRawJobText(trimmed);
      return {
        title: parsedJson.title?.trim() || local.title,
        company: parsedJson.company?.trim() || local.company,
        description: trimmed,
        sections: local.sections,
      };
    }

    return {
      title: parsedJson.title?.trim() || undefined,
      company: parsedJson.company?.trim() || undefined,
      description: trimmed,
      sections: {
        companyOverview: sections.companyOverview?.trim() || undefined,
        roleOverview: sections.roleOverview?.trim() || undefined,
        responsibilities: sections.responsibilities?.trim() || undefined,
        requirements: sections.requirements?.trim() || undefined,
        benefits: sections.benefits?.trim() || undefined,
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
