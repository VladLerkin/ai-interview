import { Brain, Code2, Layers, LayoutDashboard, UserCheck, type LucideIcon } from 'lucide-react';
import type { InterviewType } from '../types/interview';

/** Presentation metadata for the interview-type picker. Agent stages live in `agent/stages.ts`. */
export interface InterviewTypeOption {
  id: InterviewType;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  /** Short stage labels shown as pills in the picker. */
  stages: string[];
}

export const INTERVIEW_TYPES: InterviewTypeOption[] = [
  {
    id: 'hr_screening',
    title: 'HR Screening',
    subtitle: 'Culture fit & motivation',
    description: 'Initial screening call focusing on your background, motivation, salary expectations, and cultural fit.',
    icon: UserCheck,
    gradient: 'from-emerald-500 to-teal-600',
    stages: ['Introduction', 'Background', 'Motivation', 'Q&A'],
  },
  {
    id: 'technical',
    title: 'Technical Interview',
    subtitle: 'Deep dive into skills',
    description: 'In-depth technical questions about your stack, algorithms, code design, and problem-solving approach.',
    icon: Code2,
    gradient: 'from-blue-500 to-indigo-600',
    stages: ['Warmup', 'Core Skills', 'Problem Solving', 'Deep Dive'],
  },
  {
    id: 'system_design',
    title: 'System Design',
    subtitle: 'Architecture & scalability',
    description: 'Design large-scale systems, discuss trade-offs, scalability patterns, and architectural decisions.',
    icon: LayoutDashboard,
    gradient: 'from-purple-500 to-violet-600',
    stages: ['Requirements', 'High-Level Design', 'Deep Dive', 'Trade-offs'],
  },
  {
    id: 'behavioral',
    title: 'Behavioral (STAR)',
    subtitle: 'Situation, Task, Action, Result',
    description: 'Tell stories about past experiences using the STAR method. Leadership, teamwork, conflict resolution.',
    icon: Brain,
    gradient: 'from-amber-500 to-orange-600',
    stages: ['Teamwork', 'Leadership', 'Conflict', 'Growth'],
  },
  {
    id: 'full_loop',
    title: 'Full Interview Loop',
    subtitle: 'Complete simulation',
    description: 'A realistic full interview combining all stages: HR screening, technical, behavioral, and wrap-up.',
    icon: Layers,
    gradient: 'from-rose-500 to-pink-600',
    stages: ['HR Screen', 'Technical', 'Behavioral', 'Wrap-up'],
  },
];

export const DEFAULT_INTERVIEW_TYPE: InterviewType = 'hr_screening';

export const getInterviewTypeOption = (id: InterviewType): InterviewTypeOption =>
  INTERVIEW_TYPES.find((t) => t.id === id) ?? INTERVIEW_TYPES[0];
