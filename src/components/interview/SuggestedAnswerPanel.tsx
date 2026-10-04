import { Lightbulb } from 'lucide-react';
import type { Translator } from '../../lib/i18n';

interface SuggestedAnswerPanelProps {
  suggestedAnswer?: string;
  t: Translator;
}

/** Sidebar on desktop, below the fold on mobile. */
export const SuggestedAnswerPanel: React.FC<SuggestedAnswerPanelProps> = ({ suggestedAnswer, t }) => (
  <div className="flex w-full lg:w-80 flex-col gap-4 order-3 lg:order-1 min-h-[350px] lg:min-h-0 shrink-0 mt-4 lg:mt-0">
    <div className="flex-1 glass-panel rounded-3xl p-5 md:p-6 flex flex-col overflow-hidden border border-emerald-900/30">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Lightbulb className="text-emerald-400 w-6 h-6" /> {t('suggestedAnswer')}
      </h2>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {suggestedAnswer ? (
          <div className="text-base md:text-lg text-emerald-100 bg-emerald-900/20 p-4 md:p-5 rounded-xl border border-emerald-800/40 leading-relaxed italic animate-in fade-in slide-in-from-left-4">
            "{suggestedAnswer}"
          </div>
        ) : (
          <p className="text-gray-400 text-base md:text-lg text-center mt-10">{t('awaitingAnswer')}</p>
        )}
      </div>
    </div>
  </div>
);
