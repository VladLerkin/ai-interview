import { Brain, Square, Volume2 } from 'lucide-react';
import { formatStageName } from '../../agent/stages';
import type { Translator } from '../../lib/i18n';
import { AvatarCanvas } from '../avatar/AvatarCanvas';
import type { AvatarEmotion } from '../avatar/emotions';

interface InterviewerStageProps {
  avatarUrl?: string;
  emotion: AvatarEmotion;
  speech: string;
  stage: string | undefined;
  isSpeaking: boolean;
  isEvaluating: boolean;
  onModelReady: () => void;
  onReplay: () => void;
  onStopSpeaking: () => void;
  onEnd: () => void;
  t: Translator;
}

/** 3D avatar with subtitles, the current-stage badge and the mobile "End" button overlaid on top. */
export const InterviewerStage: React.FC<InterviewerStageProps> = ({
  avatarUrl,
  emotion,
  speech,
  stage,
  isSpeaking,
  isEvaluating,
  onModelReady,
  onReplay,
  onStopSpeaking,
  onEnd,
  t,
}) => (
  <div className="h-[55vh] md:h-auto md:flex-1 relative rounded-3xl overflow-hidden border border-gray-800 shadow-2xl bg-dark-900/50 shrink-0">
    <AvatarCanvas speaking={isSpeaking} emotion={emotion} avatarUrl={avatarUrl} onModelReady={onModelReady} />

    {/* Subtitles / Speech Bubble */}
    <div className="absolute bottom-2 md:bottom-10 left-1/2 -translate-x-1/2 w-[95%] md:w-[90%] max-w-2xl text-center z-10">
      <div className="glass-panel p-3 md:p-4 rounded-2xl animate-in slide-in-from-bottom-4">
        <div className="text-base md:text-xl font-medium text-white drop-shadow-md leading-snug">
          {isEvaluating ? (
            <span className="flex items-center justify-center gap-2 text-primary-400">
              <Brain className="w-5 h-5 animate-pulse" /> {t('evaluating')}
            </span>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <p>{speech || t('preparing')}</p>
              {speech && (
                <div className="flex gap-2 shrink-0">
                  {isSpeaking && (
                    <button
                      onClick={onStopSpeaking}
                      className="p-2 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      title="Stop Speaking"
                    >
                      <Square className="w-5 h-5 fill-current" />
                    </button>
                  )}
                  <button
                    onClick={onReplay}
                    disabled={isSpeaking}
                    className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    title="Replay Audio"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Stage Badge & Mobile End Button */}
    <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
      <div className="glass-panel px-4 py-2 md:py-2 rounded-full flex items-center gap-2 pointer-events-auto">
        <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-slow"></div>
        <span className="text-xs md:text-sm font-semibold uppercase tracking-wider text-primary-100">
          {t('stage')}: {formatStageName(stage || 'warmup')}
        </span>
      </div>

      <button
        onClick={onEnd}
        className="md:hidden glass-panel text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/50 px-4 py-2 rounded-xl pointer-events-auto transition-colors border border-gray-700/50"
      >
        {t('end')}
      </button>
    </div>
  </div>
);
