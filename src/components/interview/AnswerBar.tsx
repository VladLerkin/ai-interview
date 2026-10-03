import { Mic, MicOff, Send } from 'lucide-react';
import type { Translator } from '../../lib/i18n';

interface AnswerBarProps {
  value: string;
  onChange: (value: string) => void;
  isListening: boolean;
  /** Input is locked while the interviewer is speaking or the answer is being evaluated. */
  disabled: boolean;
  canSubmit: boolean;
  onToggleMic: () => void;
  onSubmit: () => void;
  t: Translator;
}

export const AnswerBar: React.FC<AnswerBarProps> = ({
  value,
  onChange,
  isListening,
  disabled,
  canSubmit,
  onToggleMic,
  onSubmit,
  t,
}) => (
  <>
    <div className="flex-1 h-full relative">
      <textarea
        className="w-full h-full bg-dark-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none transition-all text-lg custom-scrollbar"
        placeholder={isListening ? t('listening') : t('typeAnswer')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>

    <div className="flex flex-col gap-2 h-full justify-center w-32 shrink-0">
      <button
        onClick={onToggleMic}
        disabled={disabled}
        className={`flex-1 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-white ${
          isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-primary-600 hover:bg-primary-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />} {t('mic')}
      </button>

      <button
        onClick={onSubmit}
        disabled={disabled || !canSubmit}
        className="flex-1 bg-white text-dark-900 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('submit')} <Send className="w-4 h-4" />
      </button>
    </div>
  </>
);

interface InterviewCompletedProps {
  onReturn: () => void;
  t: Translator;
}

export const InterviewCompleted: React.FC<InterviewCompletedProps> = ({ onReturn, t }) => (
  <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in">
    <h3 className="text-xl font-bold text-green-400 mb-2">{t('interviewCompleted')}</h3>
    <button onClick={onReturn} className="btn-gradient px-6 py-2 font-bold">
      {t('returnToSetup')}
    </button>
  </div>
);
