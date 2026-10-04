import { useMemo } from 'react';
import { useInterviewSession } from '../../hooks/useInterviewSession';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { createTranslator } from '../../lib/i18n';
import type { InterviewConfig } from '../../types/interview';
import { AnswerBar, InterviewCompleted } from './AnswerBar';
import { FeedbackPanel } from './FeedbackPanel';
import { getAvatarEmotion } from './getAvatarEmotion';
import { InterviewerStage } from './InterviewerStage';
import { SuggestedAnswerPanel } from './SuggestedAnswerPanel';

interface InterviewRoomProps {
  config: InterviewConfig;
  onReset: () => void;
}

export const InterviewRoom: React.FC<InterviewRoomProps> = ({ config, onReset }) => {
  const t = useMemo(() => createTranslator(config.language), [config.language]);

  const tts = useSpeechSynthesis(config.language);
  const stt = useSpeechRecognition(config.language);
  const { snapshot, isEvaluating, submitAnswer, handleModelReady } = useInterviewSession(config, tts.speak);

  const speech = snapshot.nextInterviewerSpeech;
  const inputLocked = isEvaluating || tts.isSpeaking;

  const handleSubmit = async () => {
    if (stt.isListening) stt.stop();
    if (await submitAnswer(stt.transcript)) stt.clearTranscript();
  };

  const emotion = getAvatarEmotion({
    isEvaluating,
    isSpeaking: tts.isSpeaking,
    hasSpeech: Boolean(speech),
    stage: snapshot.interviewStage,
  });

  return (
    <div className="h-[100dvh] lg:h-screen w-full flex flex-col lg:flex-row bg-dark-900 p-2 lg:p-4 gap-2 lg:gap-4 overflow-y-auto overflow-x-hidden">
      {/* Left Panel: Suggested Answer */}
      <SuggestedAnswerPanel suggestedAnswer={snapshot.latestFeedback?.suggestedAnswer} t={t} />

      {/* Center Stage: 3D Avatar */}
      <div className="flex-1 flex flex-col gap-2 lg:gap-4 relative order-1 lg:order-2 shrink-0 min-h-[85dvh] lg:min-h-0">
        <InterviewerStage
          avatarUrl={config.avatarUrl}
          emotion={emotion}
          speech={speech}
          stage={snapshot.interviewStage}
          isSpeaking={tts.isSpeaking}
          isEvaluating={isEvaluating}
          onModelReady={handleModelReady}
          onReplay={() => tts.speak(speech)}
          onStopSpeaking={tts.stop}
          onEnd={onReset}
          t={t}
        />

        {/* Action Bar */}
        <div className="h-32 glass-panel rounded-2xl flex items-center p-4 gap-4">
          {snapshot.isCompleted ? (
            <InterviewCompleted onReturn={onReset} t={t} />
          ) : (
            <AnswerBar
              value={stt.transcript + (stt.interimTranscript ? ' ' + stt.interimTranscript : '')}
              onChange={stt.setTranscript}
              isListening={stt.isListening}
              disabled={inputLocked}
              canSubmit={Boolean(stt.transcript.trim())}
              onToggleMic={stt.toggle}
              onSubmit={handleSubmit}
              t={t}
            />
          )}
        </div>
      </div>

      {/* Right Panel: HUD & Feedback */}
      <FeedbackPanel feedback={snapshot.latestFeedback} history={snapshot.history ?? []} onEnd={onReset} t={t} />
    </div>
  );
};
