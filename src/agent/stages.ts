import type { InterviewType } from '../types/interview';

/** Ordered stages per interview type. The agent advances one stage per candidate answer. */
export const STAGES_BY_TYPE: Record<InterviewType, string[]> = {
  hr_screening: ['introduction', 'background', 'motivation', 'culture_fit', 'salary_expectations', 'candidate_questions'],
  technical: ['warmup', 'core_skills', 'problem_solving', 'technical_deepdive', 'edge_cases', 'wrapup'],
  system_design: ['requirements', 'high_level_design', 'detailed_design', 'tradeoffs', 'scalability', 'wrapup'],
  behavioral: ['introduction', 'teamwork_star', 'leadership_star', 'conflict_star', 'growth_star', 'wrapup'],
  full_loop: ['warmup', 'technical_deepdive', 'system_design', 'behavioral_star', 'wrapup'],
};

export const DEFAULT_AGENT_INTERVIEW_TYPE: InterviewType = 'full_loop';

export const getStages = (type: InterviewType | undefined): string[] =>
  STAGES_BY_TYPE[type ?? DEFAULT_AGENT_INTERVIEW_TYPE] ?? STAGES_BY_TYPE[DEFAULT_AGENT_INTERVIEW_TYPE];

/** `technical_deepdive` -> `technical deepdive` */
export const formatStageName = (stage: string): string => stage.replace(/_/g, ' ');

/**
 * Maps the number of answered questions to the current stage.
 * The interview is complete once every stage has received an answer.
 */
export const resolveStage = (type: InterviewType | undefined, answeredCount: number) => {
  const stages = getStages(type);
  const isCompleted = answeredCount >= stages.length;
  const stageIndex = Math.min(answeredCount, stages.length - 1);
  return { stage: stages[stageIndex], isCompleted };
};
