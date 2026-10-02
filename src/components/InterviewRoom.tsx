import { useEffect, useState, useRef, useCallback } from 'react';
import { AvatarCanvas, type AvatarEmotion } from './AvatarCanvas';
import type { InterviewConfig } from '../types/interview';

import { createInterviewAgent } from '../agent/interviewGraph';
import { Mic, MicOff, Send, Brain, CheckCircle2, AlertTriangle, MessageSquare, Volume2, Lightbulb, Square } from 'lucide-react';

import { getStoredData, setStoredData } from '../lib/store';

interface InterviewRoomProps {
  config: InterviewConfig;
  onReset: () => void;
}

export const InterviewRoom: React.FC<InterviewRoomProps> = ({ config, onReset }) => {
  const [graph, setGraph] = useState<any>(null);
  const [state, setState] = useState<any>({
    history: [],
    interviewStage: 'warmup',
    nextInterviewerSpeech: '',
    latestFeedback: null,
  });
  
  const [threadId] = useState(() => crypto.randomUUID());
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const initCalledRef = useRef(false);
  const speechCancelledRef = useRef(false);
  
  // Model readiness tracking — speech waits for the 3D model to load
  const modelReadyRef = useRef(false);
  const pendingSpeechRef = useRef<string | null>(null);

  const handleModelReady = useCallback(() => {
    modelReadyRef.current = true;
    // If LLM already responded while model was loading, speak now
    if (pendingSpeechRef.current) {
      const text = pendingSpeechRef.current;
      pendingSpeechRef.current = null;
      // Greeting pause — avatar smiles before speaking
      setTimeout(() => speak(text), 1500);
    }
  }, []);

  // Initialize Agent
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    const init = async () => {
      const g = await createInterviewAgent(config.provider, config.apiKey);
      setGraph(g);
      
      // Start initial run
      const initialState = {
        resumeText: config.resumeText,
        jobDescription: config.jobDescription,
        companyInfo: config.companyInfo,
        interviewType: config.interviewType || 'full_loop',
        interviewStage: 'warmup',
        history: [],
      };
      
      try {
        const savedState = await getStoredData('interviewState');
        const configObj = { configurable: { thread_id: threadId } };
        
        if (savedState) {
          setState(savedState);
          // Do NOT auto-speak on restore, as browser will block TTS without a user gesture,
          // which causes isSpeaking to be stuck at true forever.
        } else {
          const finalState = await g.invoke(initialState, configObj);
          setState((prev: any) => ({ ...prev, ...finalState }));
          await setStoredData('interviewState', finalState);
          
          if (finalState.nextInterviewerSpeech) {
            if (modelReadyRef.current) {
              // Model already loaded — greeting pause then speak
              setTimeout(() => speak(finalState.nextInterviewerSpeech), 1500);
            } else {
              // Model still loading — store speech, will be triggered by handleModelReady
              pendingSpeechRef.current = finalState.nextInterviewerSpeech;
            }
          }
        }
      } catch (err: any) {
        console.error('Agent execution failed:', err);
        setState((prev: any) => ({
          ...prev,
          nextInterviewerSpeech: `Error starting interview. Please check your API key and connection. (${err.message})`
        }));
      }
    };
    init();
  }, [config, threadId]);

  const [interimTranscript, setInterimTranscript] = useState('');

  // Setup Web Speech API STT
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      const isAndroid = /Android/i.test(navigator.userAgent);
      recognition.continuous = !isAndroid; // continuous mode is extremely buggy on Android
      recognition.interimResults = true;
      recognition.lang = window.navigator.language || 'en-US'; // Use system language
      
      recognition.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }
        if (finalTrans) {
          setTranscript((prev) => prev + (prev ? ' ' : '') + finalTrans);
        }
        setInterimTranscript(interimTrans);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        // Ignore expected errors like aborting manually or silence timeout
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setTranscript((prev) => prev + ` [Mic Error: ${event.error}]`);
        }
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
        // On Android, manual stop causes abort which dumps interim results. Let's save them.
        setInterimTranscript((prevInterim) => {
          if (prevInterim.trim()) {
            setTranscript((prevTranscript) => prevTranscript + (prevTranscript ? ' ' : '') + prevInterim);
          }
          return '';
        });
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setInterimTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Mic start error", err);
      }
    }
  };

  const speak = (text: string) => {
    if (!text) return;
    
    const synth = synthesisRef.current;
    speechCancelledRef.current = false;

    const doSpeak = () => {
      setIsSpeaking(true);

      const voices = synth.getVoices();
      const isRussian = /[А-Яа-яЁё]/.test(text);
      const langPrefix = isRussian ? 'ru' : 'en';

      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith(langPrefix) &&
          (v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('karen') ||
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('milena') ||
            v.name.toLowerCase().includes('google'))
      ) || voices.find((v) => v.lang.startsWith(langPrefix));

      // Safer sentence split that works on older Safari (no lookbehind)
      const sentences = text.match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter((s) => s.length > 0) || [text];

      if (sentences.length === 0) {
        setIsSpeaking(false);
        return;
      }

      sentences.forEach((sentence, index) => {
        const isQuestion = sentence.endsWith('?');
        const isExclamation = sentence.endsWith('!');
        const isShort = sentence.split(/\s+/).length <= 5;
        const isLong = sentence.split(/\s+/).length > 20;
        const isFirst = index === 0;
        const isLast = index === sentences.length - 1;

        let pitch = 1.0 + (Math.random() - 0.5) * 0.1;
        let rate = 0.95 + (Math.random() - 0.5) * 0.06;

        if (isQuestion) {
          pitch += 0.12; rate -= 0.03;
        } else if (isExclamation) {
          pitch += 0.08; rate += 0.05;
        }

        if (isFirst) {
          pitch += 0.03; rate -= 0.02;
        }
        if (isLast && !isQuestion) {
          pitch -= 0.05; rate -= 0.03;
        }

        if (isShort) rate -= 0.04;
        else if (isLong) rate += 0.03;

        pitch = Math.max(0.8, Math.min(1.3, pitch));
        rate = Math.max(0.8, Math.min(1.15, rate));

        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = isRussian ? 'ru-RU' : 'en-US';
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.pitch = pitch;
        utterance.rate = rate;
        utterance.volume = 1.0;

        if (isLast) {
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
        }

        synth.speak(utterance);
      });
    };

    // Voices may not be loaded yet (async in Chrome)
    if (synth.getVoices().length > 0) {
      doSpeak();
    } else {
      synth.addEventListener('voiceschanged', doSpeak, { once: true });
      setTimeout(() => {
        if (synth.getVoices().length === 0) {
          doSpeak();
        }
      }, 1000);
    }
  };

  const submitAnswer = async () => {
    if (!transcript.trim() || !graph) return;
    
    // Stop listening
    if (isListening) toggleListen();
    setIsEvaluating(true);
    
    const configObj = { configurable: { thread_id: threadId } };
    
    // Push candidate answer
    const nextState = {
      lastCandidateAnswer: transcript.trim(),
      history: [
        ...state.history,
        { role: 'interviewer', content: state.nextInterviewerSpeech },
        { role: 'candidate', content: transcript.trim() }
      ]
    };
    
    try {
      const result = await graph.invoke(nextState, configObj);
      
      setState((prev: any) => ({ ...prev, ...result }));
      await setStoredData('interviewState', result);
      
      setTranscript('');
      setIsEvaluating(false);
      
      if (result.nextInterviewerSpeech) {
        speak(result.nextInterviewerSpeech);
      }
    } catch (err: any) {
      console.error('Agent execution failed:', err);
      setIsEvaluating(false);
      setState((prev: any) => ({
        ...prev,
        nextInterviewerSpeech: `Error communicating with AI. (${err.message})`
      }));
    }
  };

  // Determine avatar emotion based on state
  let currentEmotion: AvatarEmotion = 'neutral';
  if (isEvaluating) {
    // "Услышав мой ответ, улыбнулась"
    currentEmotion = 'happy';
  } else if (!isSpeaking && state.nextInterviewerSpeech) {
    // "Закончила говорить, улыбнулась мило"
    currentEmotion = 'happy';
  } else if (isSpeaking) {
    // While speaking, match the stage tone
    switch (state.interviewStage) {
      case 'warmup':
      case 'introduction':
        currentEmotion = 'greeting';
        break;
      case 'technical_deepdive':
      case 'system_design':
      case 'problem_solving':
        currentEmotion = 'thinking';
        break;
      case 'wrapup':
        currentEmotion = 'happy';
        break;
      default:
        currentEmotion = 'neutral';
    }
  }

  return (
    <div className="min-h-[100dvh] md:h-screen w-full flex flex-col md:flex-row bg-dark-900 p-2 md:p-4 gap-2 md:gap-4 overflow-y-auto overflow-x-hidden">
      
      {/* Left Panel: Suggested Answer */}
      <div className="flex w-full lg:w-80 flex-col gap-4 order-3 lg:order-1 min-h-[400px] lg:min-h-0 shrink-0">
        <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col overflow-hidden border border-emerald-900/30">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Lightbulb className="text-emerald-400 w-6 h-6" /> Suggested Answer
          </h2>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {state.latestFeedback?.suggestedAnswer ? (
              <div className="text-lg text-emerald-100 bg-emerald-900/20 p-5 rounded-xl border border-emerald-800/40 leading-relaxed italic animate-in fade-in slide-in-from-left-4">
                "{state.latestFeedback.suggestedAnswer}"
              </div>
            ) : (
              <p className="text-gray-400 text-lg text-center mt-10">
                Answer a question to see an ideal response here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Center Stage: 3D Avatar */}
      <div className="flex-1 flex flex-col gap-2 md:gap-4 relative order-1 lg:order-2 shrink-0">
        <div className="h-[55vh] md:h-auto md:flex-1 relative rounded-3xl overflow-hidden border border-gray-800 shadow-2xl bg-dark-900/50 shrink-0">
          <AvatarCanvas speaking={isSpeaking} emotion={currentEmotion} avatarUrl={config.avatarUrl} onModelReady={handleModelReady} />
          
          {/* Subtitles / Speech Bubble */}
          <div className="absolute bottom-2 md:bottom-10 left-1/2 -translate-x-1/2 w-[95%] md:w-[90%] max-w-2xl text-center z-10">
            <div className="glass-panel p-3 md:p-4 rounded-2xl animate-in slide-in-from-bottom-4">
              <div className="text-base md:text-xl font-medium text-white drop-shadow-md leading-snug">
                {isEvaluating ? (
                  <span className="flex items-center justify-center gap-2 text-primary-400">
                    <Brain className="w-5 h-5 animate-pulse" /> Evaluating your response...
                  </span>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <p>{state.nextInterviewerSpeech || 'Preparing interview...'}</p>
                    {state.nextInterviewerSpeech && (
                      <div className="flex gap-2 shrink-0">
                        {isSpeaking && (
                          <button
                            onClick={() => {
                              speechCancelledRef.current = true;
                              window.speechSynthesis.cancel();
                              setIsSpeaking(false);
                            }}
                            className="p-2 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                            title="Stop Speaking"
                          >
                            <Square className="w-5 h-5 fill-current" />
                          </button>
                        )}
                        <button
                          onClick={() => speak(state.nextInterviewerSpeech)}
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
                Stage: {(state.interviewStage || 'warmup').replace('_', ' ')}
              </span>
            </div>
            
            <button 
              onClick={onReset}
              className="md:hidden glass-panel text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/50 px-4 py-2 rounded-xl pointer-events-auto transition-colors border border-gray-700/50"
            >
              End
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="h-32 glass-panel rounded-2xl flex items-center p-4 gap-4">
          {state.isCompleted ? (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in">
              <h3 className="text-xl font-bold text-green-400 mb-2">Interview Completed!</h3>
              <button 
                onClick={onReset}
                className="px-6 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/30"
              >
                Return to Setup
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 h-full relative">
                <textarea 
                  className="w-full h-full bg-dark-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none transition-all text-lg custom-scrollbar"
                  placeholder={isListening ? "Listening..." : "Type your answer or use microphone..."}
                  value={transcript + (interimTranscript ? ' ' + interimTranscript : '')}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    setInterimTranscript(''); // Clear interim if user manually types
                  }}
                  disabled={isEvaluating || isSpeaking}
                />
              </div>

              <div className="flex flex-col gap-2 h-full justify-center w-32 shrink-0">
                <button 
                  onClick={toggleListen}
                  disabled={isEvaluating || isSpeaking}
                  className={`flex-1 rounded-xl flex items-center justify-center gap-2 transition-all font-bold ${
                    isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse text-white' : 'bg-primary-600 hover:bg-primary-500 text-white'
                  } ${isEvaluating || isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />} Mic
                </button>
                
                <button 
                  onClick={submitAnswer}
                  disabled={!transcript.trim() || isEvaluating || isSpeaking}
                  className="flex-1 bg-white text-dark-900 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel: HUD & Feedback */}
      <div className="flex w-full md:w-96 flex-col gap-4 order-4 md:order-3 min-h-[400px] md:min-h-0 shrink-0">
        <div className="flex-1 glass-panel rounded-3xl p-6 flex flex-col overflow-hidden relative">
          <button 
            onClick={onReset} 
            className="absolute top-4 right-4 text-xs bg-dark-800 hover:bg-red-600/80 text-gray-400 hover:text-white px-3 py-1 rounded-lg transition-colors border border-gray-700"
          >
            End Interview
          </button>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-green-500 w-6 h-6" /> Live Feedback
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
            {!state.latestFeedback ? (
              <p className="text-gray-400 text-lg text-center mt-10">
                Answer the first question to receive AI feedback.
              </p>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4 space-y-4">
                
                <div className="bg-dark-800/80 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-semibold text-gray-400">Score</span>
                    <span className={`text-2xl font-bold ${
                      (state.latestFeedback?.contentScore ?? 0) >= 8 ? 'text-green-400' : 
                      (state.latestFeedback?.contentScore ?? 0) >= 5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {state.latestFeedback?.contentScore ?? 0}/10
                    </span>
                  </div>
                  <p className="text-white text-lg">{state.latestFeedback?.comment || ''}</p>
                </div>

                {(state.latestFeedback?.grammarCorrections?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-5 h-5" /> Grammar Issues
                    </h3>
                    <ul className="space-y-3">
                      {(state.latestFeedback?.grammarCorrections ?? []).map((g: string, i: number) => (
                         <li key={i} className="text-base text-red-200 bg-red-900/20 p-4 rounded-xl border border-red-900/30">{g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(state.latestFeedback?.vocabularySuggestions?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-primary-400 flex items-center gap-2 mb-3">
                      <MessageSquare className="w-5 h-5" /> Better Vocab
                    </h3>
                    <ul className="space-y-3">
                      {(state.latestFeedback?.vocabularySuggestions ?? []).map((v: string, i: number) => (
                         <li key={i} className="text-base text-primary-200 bg-primary-900/20 p-4 rounded-xl border border-primary-900/30">{v}</li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            )}
            
            <div className="pt-6 mt-6 border-t border-gray-800">
              <h3 className="text-lg font-semibold text-gray-400 mb-4">Interview History</h3>
              <div className="space-y-4">
                {(state.history || []).map((h: any, i: number) => (
                  <div key={i} className={`p-5 rounded-2xl text-lg leading-relaxed ${
                    h.role === 'interviewer' 
                      ? 'bg-primary-900/20 text-primary-100 border border-primary-800/50' 
                      : 'bg-dark-800 text-gray-300 border border-gray-700'
                  }`}>
                    <span className="font-bold block mb-2 opacity-50 text-sm uppercase tracking-wider">
                      {h.role}
                    </span>
                    {h.content}
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};
