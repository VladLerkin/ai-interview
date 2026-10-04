import { Mic, MicOff, Send, Square } from 'lucide-react';
import type { Translator } from '../../lib/i18n';

interface AnswerBarProps {
  value: string;
  onChange: (value: string) => void;
  isListening: boolean;
  /** Input is locked while the interviewer is speaking or the answer is being evaluated. */
  disabled: boolean;
  canSubmit: boolean;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
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
  isSpeaking,
  onStopSpeaking,
  onToggleMic,
  onSubmit,
  t,
}) => (
  <>
    <div className="flex-1 h-full relative">
      <textarea
        className="w-full h-full bg-dark-800/50 border border-gray-700 rounded-xl px-3.5 py-2.5 md:px-4 md:py-3 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none transition-all text-base md:text-lg custom-scrollbar placeholder:text-gray-400"
        placeholder={isListening ? t('listening') : t('typeAnswer')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>

    <div className="flex flex-col gap-2 h-full justify-center w-28 md:w-36 shrink-0">
      {isSpeaking ? (
        <button
          onClick={onStopSpeaking}
          className="flex-1 rounded-xl flex items-center justify-center gap-1.5 md:gap-2 transition-all font-bold text-xs md:text-sm text-white bg-red-500 hover:bg-red-600 animate-pulse"
        >
          <Square className="w-4 h-4 md:w-5 md:h-5 fill-current" /> {t('stop')}
        </button>
      ) : (
        <button
          onClick={onToggleMic}
          disabled={disabled}
          className={`flex-1 rounded-xl flex items-center justify-center gap-1.5 md:gap-2 transition-all font-bold text-xs md:text-sm text-white ${
            isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-primary-600 hover:bg-primary-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isListening ? <MicOff className="w-4 h-4 md:w-5 md:h-5" /> : <Mic className="w-4 h-4 md:w-5 md:h-5" />} {t('mic')}
        </button>
      )}

      <button
        onClick={onSubmit}
        disabled={disabled || !canSubmit}
        className="flex-1 bg-white text-dark-900 font-bold rounded-xl flex items-center justify-center gap-1.5 md:gap-2 hover:bg-gray-200 transition-all text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t('submit')} <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
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
