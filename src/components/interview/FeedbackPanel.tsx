import { AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import type { Translator } from '../../lib/i18n';
import type { HistoryEntry, InterviewFeedback } from '../../types/interview';

const scoreColor = (score: number) => {
  if (score >= 8) return 'text-green-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
};

interface SuggestionListProps {
  title: string;
  items: string[];
  icon: React.ReactNode;
  headingClass: string;
  itemClass: string;
}

const SuggestionList: React.FC<SuggestionListProps> = ({ title, items, icon, headingClass, itemClass }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className={`text-lg font-semibold flex items-center gap-2 mb-3 ${headingClass}`}>
        {icon} {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className={`text-base p-4 rounded-xl border ${itemClass}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

const FeedbackDetails: React.FC<{ feedback: InterviewFeedback; t: Translator }> = ({ feedback, t }) => {
  const score = feedback.contentScore ?? 0;
  return (
    <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
      <div className="bg-dark-800/80 rounded-xl p-4 border border-gray-700/50">
        <div className="flex justify-between items-center mb-2">
          <span className="text-lg font-semibold text-gray-400">{t('score')}</span>
          <span className={`text-2xl font-bold ${scoreColor(score)}`}>{score}/10</span>
        </div>
        <p className="text-white text-lg">{feedback.comment || ''}</p>
      </div>

      <SuggestionList
        title={t('grammar')}
        items={feedback.grammarCorrections ?? []}
        icon={<AlertTriangle className="w-5 h-5" />}
        headingClass="text-red-400"
        itemClass="text-red-200 bg-red-900/20 border-red-900/30"
      />
      <SuggestionList
        title={t('vocabulary')}
        items={feedback.vocabularySuggestions ?? []}
        icon={<MessageSquare className="w-5 h-5" />}
        headingClass="text-primary-400"
        itemClass="text-primary-200 bg-primary-900/20 border-primary-900/30"
      />
    </div>
  );
};

const HistoryList: React.FC<{ history: HistoryEntry[]; t: Translator }> = ({ history, t }) => (
  <div className="pt-6 mt-6 border-t border-gray-800">
    <h3 className="text-lg font-semibold text-gray-400 mb-4">{t('interviewHistory')}</h3>
    <div className="space-y-4">
      {history.map((entry, i) => (
        <div
          key={i}
          className={`p-5 rounded-2xl text-lg leading-relaxed ${
            entry.role === 'interviewer'
              ? 'bg-primary-900/20 text-primary-100 border border-primary-800/50'
              : 'bg-dark-800 text-gray-300 border border-gray-700'
          }`}
        >
          <span className="font-bold block mb-2 opacity-50 text-sm uppercase tracking-wider">{entry.role}</span>
          {entry.content}
        </div>
      ))}
    </div>
  </div>
);

interface FeedbackPanelProps {
  feedback: InterviewFeedback | null;
  history: HistoryEntry[];
  onEnd: () => void;
  t: Translator;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ feedback, history, onEnd, t }) => (
  <div className="flex w-full md:w-96 flex-col gap-4 order-4 md:order-3 min-h-[400px] md:min-h-0 shrink-0">
    <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col overflow-hidden relative">
      <button
        onClick={onEnd}
        className="absolute top-4 right-4 text-xs bg-dark-800 hover:bg-red-600/80 text-gray-400 hover:text-white px-3 py-1 rounded-lg transition-colors border border-gray-700"
      >
        {t('end')}
      </button>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <CheckCircle2 className="text-green-500 w-6 h-6" /> {t('liveFeedback')}
      </h2>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
        {feedback ? (
          <FeedbackDetails feedback={feedback} t={t} />
        ) : (
          <p className="text-gray-400 text-lg text-center mt-10">{t('noFeedback')}</p>
        )}
        <HistoryList history={history} t={t} />
      </div>
    </div>
  </div>
);
