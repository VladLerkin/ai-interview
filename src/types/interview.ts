export type InterviewType = 'hr_screening' | 'technical' | 'system_design' | 'behavioral' | 'full_loop';

export interface InterviewConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKey: string;
  resumeText: string;
  jobDescription: string;
  companyInfo: string;
  interviewType: InterviewType;
  avatarUrl?: string;
  resumeFileName?: string;
}
