export type InterviewType = 'hr_screening' | 'technical' | 'system_design' | 'behavioral' | 'full_loop';
export type Language =
  | 'en-US'
  | 'en-GB'
  | 'ru-RU'
  | 'es-ES'
  | 'de-DE'
  | 'fr-FR'
  | 'zh-CN'
  | 'ja-JP'
  | 'ka-GE';
export type Provider = 'openai' | 'anthropic' | 'gemini' | 'deepseek';

export interface InterviewConfig {
  provider: Provider;
  apiKey: string;
  resumeText: string;
  jobDescription: string;
  companyInfo: string;
  interviewType: InterviewType;
  language: Language;
  avatarUrl?: string;
  resumeFileName?: string;
  interviewerGender?: 'male' | 'female';
}

export type SpeakerRole = 'candidate' | 'interviewer';

export interface HistoryEntry {
  role: SpeakerRole;
  content: string;
}

export interface InterviewFeedback {
  grammarCorrections: string[];
  vocabularySuggestions: string[];
  contentScore: number;
  comment: string;
  suggestedAnswer: string;
}

/** The subset of agent state that the UI renders and persists between reloads. */
export interface InterviewSnapshot {
  history: HistoryEntry[];
  interviewStage: string;
  nextInterviewerSpeech: string;
  latestFeedback: InterviewFeedback | null;
  isCompleted?: boolean;
}
