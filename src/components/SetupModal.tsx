import React, { useState, useEffect } from 'react';
import { extractTextFromPDF } from '../lib/pdf';
import { getStoredData } from '../lib/store';
import { Settings, Upload, Briefcase, Building, Key, UserCheck, Code2, LayoutDashboard, Brain, Layers, ChevronRight } from 'lucide-react';
import type { InterviewType, InterviewConfig } from '../types/interview';
import { getTranslation } from '../lib/i18n';

export type { InterviewType, InterviewConfig };


interface SetupModalProps {
  onStart: (config: InterviewConfig) => void;
}

const interviewTypes: {
  id: InterviewType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  stages: string[];
}[] = [
    {
      id: 'hr_screening',
      title: 'HR Screening',
      subtitle: 'Culture fit & motivation',
      description: 'Initial screening call focusing on your background, motivation, salary expectations, and cultural fit.',
      icon: <UserCheck className="w-6 h-6" />,
      gradient: 'from-emerald-500 to-teal-600',
      stages: ['Introduction', 'Background', 'Motivation', 'Q&A'],
    },
    {
      id: 'technical',
      title: 'Technical Interview',
      subtitle: 'Deep dive into skills',
      description: 'In-depth technical questions about your stack, algorithms, code design, and problem-solving approach.',
      icon: <Code2 className="w-6 h-6" />,
      gradient: 'from-blue-500 to-indigo-600',
      stages: ['Warmup', 'Core Skills', 'Problem Solving', 'Deep Dive'],
    },
    {
      id: 'system_design',
      title: 'System Design',
      subtitle: 'Architecture & scalability',
      description: 'Design large-scale systems, discuss trade-offs, scalability patterns, and architectural decisions.',
      icon: <LayoutDashboard className="w-6 h-6" />,
      gradient: 'from-purple-500 to-violet-600',
      stages: ['Requirements', 'High-Level Design', 'Deep Dive', 'Trade-offs'],
    },
    {
      id: 'behavioral',
      title: 'Behavioral (STAR)',
      subtitle: 'Situation, Task, Action, Result',
      description: 'Tell stories about past experiences using the STAR method. Leadership, teamwork, conflict resolution.',
      icon: <Brain className="w-6 h-6" />,
      gradient: 'from-amber-500 to-orange-600',
      stages: ['Teamwork', 'Leadership', 'Conflict', 'Growth'],
    },
    {
      id: 'full_loop',
      title: 'Full Interview Loop',
      subtitle: 'Complete simulation',
      description: 'A realistic full interview combining all stages: HR screening, technical, behavioral, and wrap-up.',
      icon: <Layers className="w-6 h-6" />,
      gradient: 'from-rose-500 to-pink-600',
      stages: ['HR Screen', 'Technical', 'Behavioral', 'Wrap-up'],
    },
  ];

const PREDEFINED_AVATARS = [
  { id: 'default', name: 'Standard AI', url: '/avatar.vrm', img: 'https://api.dicebear.com/7.x/bottts/svg?seed=ai&backgroundColor=1f2937' },
  { id: 'realistic', name: 'Business Woman', url: '/avatar.glb', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica&backgroundColor=1f2937' },
  { id: 'tech', name: 'Tech Lead', url: '/avatar.vrm', img: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=1f2937' },
  { id: 'custom', name: 'Custom Upload', url: 'custom', img: 'https://api.dicebear.com/7.x/identicon/svg?seed=custom&backgroundColor=374151' }
];

export const SetupModal: React.FC<SetupModalProps> = ({ onStart }) => {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [interviewType, setInterviewType] = useState<InterviewType>('hr_screening');
  const [language, setLanguage] = useState<'en-US' | 'en-GB' | 'ru-RU' | 'de-DE'>('en-GB');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'gemini' | 'deepseek'>('gemini');
  const [apiKey, setApiKey] = useState(localStorage.getItem('interview_apikey') || '');
  const [jobDesc, setJobDesc] = useState('');
  const [company, setCompany] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState('realistic');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>('https://raw.githubusercontent.com/VladLerkin/ai-interview/75a4105/public/avatar.glb');
  const [avatarFileName, setAvatarFileName] = useState('');

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key);

  useEffect(() => {
    getStoredData('interviewConfig').then((data: InterviewConfig) => {
      if (data) {
        if (data.provider) setProvider(data.provider);
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.jobDescription) setJobDesc(data.jobDescription);
        if (data.companyInfo) setCompany(data.companyInfo);
        if (data.interviewType) setInterviewType(data.interviewType);
        if (data.language) setLanguage(data.language);
        if (data.resumeText) {
          setResumeText(data.resumeText);
          setFileName(data.resumeFileName || 'Saved Resume');
        }
      }
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const text = await extractTextFromPDF(file);
      setResumeText(text);
    } catch (err) {
      console.error(err);
      alert('Failed to parse PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !resumeText || !jobDesc) {
      alert('Please provide API key, resume, and job description.');
      return;
    }
    
    localStorage.setItem('interview_apikey', apiKey);
    onStart({
      provider,
      apiKey,
      resumeText,
      jobDescription: jobDesc,
      companyInfo: company,
      interviewType,
      language,
      avatarUrl,
      resumeFileName: fileName,
    });
  };

  const selectedType = interviewTypes.find((t) => t.id === interviewType)!;

  return (
    <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl animate-in fade-in zoom-in duration-500">
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 p-6 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">AI Interview Simulator</h1>
          <p className="text-primary-100 opacity-90">Prepare for your next big role with real-time feedback.</p>
        </div>

        {step === 'type' ? (
          /* ──────── Step 1: Choose Interview Type ──────── */
          <div className="p-8">
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('language')}</label>
              <select
                className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-medium"
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
              >
                <option value="en-US">English (American)</option>
                <option value="en-GB">English (British)</option>
                <option value="ru-RU">Russian (Русский)</option>
                <option value="de-DE">German (Deutsch)</option>
              </select>
            </div>

            <h2 className="text-lg font-semibold text-white mb-6 text-center">{t('selectType')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {interviewTypes.map((type) => {
                const isSelected = interviewType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setInterviewType(type.id)}
                    className={`group relative text-left p-5 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 ${isSelected
                        ? 'border-white/40 bg-white/10 shadow-lg shadow-white/5'
                        : 'border-gray-700/50 bg-dark-800/50 hover:border-gray-600 hover:bg-dark-800'
                      }`}
                  >
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse-slow" />
                    )}

                    {/* Icon */}
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center text-white mb-3 shadow-lg transition-transform group-hover:scale-110`}
                    >
                      {type.icon}
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-white text-sm mb-0.5">{type.title}</h3>
                    <p className="text-xs text-gray-400 mb-2">{type.subtitle}</p>

                    {/* Description */}
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{type.description}</p>

                    {/* Stages pills */}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {type.stages.map((stage) => (
                        <span
                          key={stage}
                          className={`text-[10px] px-2 py-0.5 rounded-full ${isSelected
                              ? 'bg-white/15 text-white/80'
                              : 'bg-gray-800 text-gray-500'
                            } transition-colors`}
                        >
                          {stage}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setStep('details')}
              className="w-full mt-6 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold rounded-xl py-4 shadow-lg shadow-primary-500/30 transform transition-all hover:-translate-y-1 active:translate-y-0 text-lg flex items-center justify-center gap-2"
            >
              {t('continue')} {selectedType.title} <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          /* ──────── Step 2: Details Form ──────── */
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Selected type badge */}
            <button
              type="button"
              onClick={() => setStep('type')}
              className="flex items-center gap-3 bg-dark-800/80 rounded-xl px-4 py-3 border border-gray-700/50 hover:border-gray-600 transition-colors w-full text-left group"
            >
              <div
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${selectedType.gradient} flex items-center justify-center text-white flex-shrink-0`}
              >
                {selectedType.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{selectedType.title}</p>
                <p className="text-xs text-gray-400 truncate">{selectedType.subtitle}</p>
              </div>
              <span className="text-xs text-gray-500 group-hover:text-primary-400 transition-colors">Change ›</span>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* API Settings */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary-500" /> {t('apiSettings')}
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t('provider')}</label>
                  <select
                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as any)}
                  >
                    <option value="gemini">Google Gemini (Gemini 3.8 Flash)</option>
                    <option value="openai">OpenAI (GPT-4o-Mini)</option>
                    <option value="anthropic">Anthropic (Claude 3 Haiku)</option>
                    <option value="deepseek">DeepSeek (DeepSeek Chat)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
                    <Key className="w-4 h-4" /> {t('apiKey')}
                  </label>
                  <input
                    type="password"
                    required
                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Stored locally in your browser.</p>
                </div>
              </div>

              {/* Context Setup */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary-500" /> Interview Context
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t('companyInfo')}</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                    <input
                      type="text"
                      className="w-full bg-dark-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                      placeholder={t('companyPlaceholder')}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t('jobDesc')}</label>
                  <textarea
                    required
                    rows={2}
                    className="w-full bg-dark-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none"
                    placeholder={t('jobDescPlaceholder')}
                    value={jobDesc}
                    onChange={(e) => setJobDesc(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('uploadResume')}</label>
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:bg-dark-800/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="application/pdf"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                />
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                {loading ? (
                  <p className="text-primary-400 animate-pulse">Parsing PDF...</p>
                ) : fileName ? (
                  <p className="text-green-400 font-medium">{fileName} extracted successfully.</p>
                ) : (
                  <p className="text-gray-400">Click or drag your CV here</p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Interviewer Avatar</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {PREDEFINED_AVATARS.map((avatar) => (
                  <div
                    key={avatar.id}
                    onClick={() => {
                      setSelectedAvatarId(avatar.id);
                      if (avatar.url !== 'custom') {
                        setAvatarUrl(avatar.url);
                        setAvatarFileName('');
                      }
                    }}
                    className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all flex flex-col items-center bg-dark-800/50 hover:bg-dark-800 ${selectedAvatarId === avatar.id ? 'border-primary-500 shadow-lg shadow-primary-500/20' : 'border-gray-800 hover:border-gray-700'
                      }`}
                  >
                    <img src={avatar.img} alt={avatar.name} className="w-full h-24 object-cover opacity-80 mix-blend-screen" />
                    <div className="p-2 w-full text-center bg-dark-900/80">
                      <p className="text-xs font-semibold text-white truncate">{avatar.name}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedAvatarId === 'custom' && (
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:bg-dark-800/50 transition-colors cursor-pointer relative animate-in fade-in slide-in-from-top-2">
                  <input
                    type="file"
                    accept=".vrm,.glb,.gltf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.vroid')) {
                          alert('This file is a ZIP archive or VRoid project. Please extract/export it first and upload the actual .vrm file.');
                          return;
                        }
                        // Check magic bytes for ZIP (PK)
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const arr = new Uint8Array(event.target?.result as ArrayBuffer);
                          if (arr.length >= 2 && arr[0] === 0x50 && arr[1] === 0x4b) {
                            alert('This file appears to be a ZIP archive. You need to unzip it first and upload the .vrm file inside.');
                            return;
                          }
                          setAvatarUrl(URL.createObjectURL(file));
                          setAvatarFileName(file.name);
                        };
                        reader.readAsArrayBuffer(file.slice(0, 4));
                      }
                    }}
                  />
                  <UserCheck className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  {avatarFileName ? (
                    <p className="text-primary-400 font-medium">{avatarFileName} selected.</p>
                  ) : (
                    <p className="text-gray-400">Click or drag a .vrm file here</p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold rounded-xl py-4 shadow-lg shadow-primary-500/30 transform transition-all hover:-translate-y-1 active:translate-y-0 text-lg"
            >
              {t('startInterview')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
