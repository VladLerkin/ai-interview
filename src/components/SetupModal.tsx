import React, { useState, useEffect, useRef } from 'react';
import { extractTextFromPDF } from '../lib/pdf';
import { getStoredData, setStoredData } from '../lib/store';
import { Settings, Upload, Briefcase, Building, Key, UserCheck, Code2, LayoutDashboard, Brain, Layers, ChevronRight, AlertCircle, X, Link2, Loader2, CheckCircle2, Download } from 'lucide-react';
import type { InterviewType, InterviewConfig, Language } from '../types/interview';
import { LANGUAGES } from '../config/languages';
import { getTranslation } from '../lib/i18n';
import { fetchJobFromUrl, formatJobText } from '../lib/jobParser';
import { PREDEFINED_AVATARS, CUSTOM_AVATAR_ID, REMOTE_GLB_AVATAR_URL, DEFAULT_AVATAR_ID } from '../config/avatars';
import { testLlmConnection, type LlmTestResult } from '../agent/testLlm';

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



export const SetupModal: React.FC<SetupModalProps> = ({ onStart }) => {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [interviewType, setInterviewType] = useState<InterviewType>('hr_screening');
  const [language, setLanguage] = useState<Language>('en-GB');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'gemini' | 'deepseek'>('gemini');
  const [apiKey, setApiKey] = useState(localStorage.getItem('interview_apikey') || '');
  const [jobUrl, setJobUrl] = useState('');
  const [isImportingJob, setIsImportingJob] = useState(false);
  const [jobImportStatus, setJobImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [jobDesc, setJobDesc] = useState('');
  const [company, setCompany] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(REMOTE_GLB_AVATAR_URL);
  const [avatarFileName, setAvatarFileName] = useState('');
  const [errors, setErrors] = useState<{ apiKey?: string; jobDesc?: string; resume?: string }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<LlmTestResult | null>(null);

  const handleTestLlm = async () => {
    if (!apiKey.trim()) {
      setLlmTestResult({ ok: false, model: '', message: getTranslation(language, 'apiKeyRequired'), latencyMs: 0 });
      apiKeyRef.current?.focus();
      return;
    }
    setIsTestingLlm(true);
    setLlmTestResult(null);
    setLlmTestResult(await testLlmConnection(provider, apiKey.trim()));
    setIsTestingLlm(false);
  };

  const resumeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const jobDescRef = useRef<HTMLTextAreaElement>(null);

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key);

  useEffect(() => {
    getStoredData('interviewConfig').then((data) => {
      if (data) {
        if (data.provider) setProvider(data.provider);
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.jobUrl) setJobUrl(data.jobUrl);
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

  const handleImportJob = async () => {
    const trimmed = jobUrl.trim();
    if (!trimmed) {
      setJobImportStatus({ type: 'error', message: t('jobUrlPlaceholder') });
      return;
    }
    setIsImportingJob(true);
    setJobImportStatus(null);
    try {
      const parsed = await fetchJobFromUrl(trimmed);
      const formatted = formatJobText(parsed);
      setJobDesc(formatted);
      if (parsed.company && !company.trim()) {
        setCompany(parsed.company);
      }
      setErrors((prev) => ({ ...prev, jobDesc: undefined }));
      setErrorMessage(null);
      setJobImportStatus({
        type: 'success',
        message: t('importJobSuccess'),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('importJobError');
      setJobImportStatus({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsImportingJob(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const text = await extractTextFromPDF(file);
      setResumeText(text);
      setErrors((prev) => ({ ...prev, resume: undefined }));
      setErrorMessage(null);
    } catch (err) {
      console.error(err);
      alert('Failed to parse PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveResume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFileName('');
    setResumeText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    try {
      const stored = await getStoredData('interviewConfig');
      if (stored) {
        await setStoredData('interviewConfig', {
          ...stored,
          resumeText: '',
          resumeFileName: undefined,
        });
      }
    } catch (err) {
      console.warn('Failed to clear stored resume:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { apiKey?: string; jobDesc?: string; resume?: string } = {};
    if (!apiKey.trim()) newErrors.apiKey = t('apiKeyRequired');
    if (!jobDesc.trim()) newErrors.jobDesc = t('jobDescRequired');
    if (!resumeText.trim()) newErrors.resume = t('resumeRequired');

    if (newErrors.apiKey || newErrors.jobDesc || newErrors.resume) {
      setErrors(newErrors);
      const firstMsg = newErrors.resume || newErrors.apiKey || newErrors.jobDesc || '';
      setErrorMessage(firstMsg);

      if (newErrors.resume) {
        resumeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (newErrors.apiKey) {
        apiKeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        apiKeyRef.current?.focus();
      } else if (newErrors.jobDesc) {
        jobDescRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        jobDescRef.current?.focus();
      }
      return;
    }

    setErrors({});
    setErrorMessage(null);
    localStorage.setItem('interview_apikey', apiKey);
    const selectedAvatar = PREDEFINED_AVATARS.find(a => a.id === selectedAvatarId);

    onStart({
      provider,
      apiKey,
      resumeText,
      jobDescription: jobDesc,
      jobUrl: jobUrl.trim() || undefined,
      companyInfo: company,
      interviewType,
      language,
      avatarUrl,
      resumeFileName: fileName,
      interviewerGender: selectedAvatar?.gender || 'female',
    });
  };

  const selectedType = interviewTypes.find((t) => t.id === interviewType)!;

  return (
    <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl animate-in fade-in zoom-in duration-500">
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 p-6 text-center relative">
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
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
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
          <form noValidate onSubmit={handleSubmit} className="p-8 space-y-6">
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
                    onChange={(e) => {
                      setProvider(e.target.value as any);
                      setLlmTestResult(null);
                    }}
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
                    ref={apiKeyRef}
                    type="password"
                    className={`w-full bg-dark-800 border rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all ${
                      errors.apiKey ? 'border-red-500 ring-2 ring-red-500/40' : 'border-gray-700'
                    }`}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setLlmTestResult(null);
                      if (errors.apiKey) {
                        setErrors((prev) => ({ ...prev, apiKey: undefined }));
                        setErrorMessage(null);
                      }
                    }}
                  />
                  {errors.apiKey ? (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.apiKey}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">Stored locally in your browser.</p>
                  )}

                  <button
                    type="button"
                    id="test-llm-button"
                    onClick={handleTestLlm}
                    disabled={isTestingLlm}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-dark-800 text-sm font-medium text-gray-200 hover:border-primary-500 hover:text-white transition-colors disabled:opacity-60"
                  >
                    {isTestingLlm ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-primary-400" />}
                    {isTestingLlm ? 'Testing...' : 'Test LLM connection'}
                  </button>
                  {llmTestResult && (
                    <p
                      className={`text-xs mt-2 flex items-start gap-1 break-words ${llmTestResult.ok ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {llmTestResult.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      )}
                      <span>
                        {llmTestResult.ok
                          ? `OK — ${llmTestResult.model} replied "${llmTestResult.message}" in ${llmTestResult.latencyMs} ms`
                          : `${llmTestResult.model ? `${llmTestResult.model}: ` : ''}${llmTestResult.message}`}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Context Setup */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary-500" /> Interview Context
                </h2>

                {/* Vacancy URL Import */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-primary-400" /> {t('jobUrl')}
                    </label>
                    <span className="text-xs text-gray-500">Auto-import</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                      <input
                        type="url"
                        className="w-full bg-dark-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm"
                        placeholder={t('jobUrlPlaceholder')}
                        value={jobUrl}
                        onChange={(e) => {
                          setJobUrl(e.target.value);
                          if (jobImportStatus) setJobImportStatus(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleImportJob();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleImportJob}
                      disabled={isImportingJob || !jobUrl.trim()}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap shadow-sm ${
                        isImportingJob || !jobUrl.trim()
                          ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                          : 'bg-primary-600 hover:bg-primary-500 text-white hover:shadow-primary-600/25 active:scale-95 cursor-pointer'
                      }`}
                    >
                      {isImportingJob ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>{t('importingJob')}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>{t('importJob')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  {jobImportStatus && (
                    <div
                      className={`text-xs mt-1.5 flex items-center gap-1.5 transition-all ${
                        jobImportStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {jobImportStatus.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{jobImportStatus.message}</span>
                    </div>
                  )}
                </div>

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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-400">{t('jobDesc')}</label>
                    <span className="text-xs text-gray-500">Editable before start</span>
                  </div>
                  <textarea
                    ref={jobDescRef}
                    rows={4}
                    className={`w-full bg-dark-800 border rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-y ${
                      errors.jobDesc ? 'border-red-500 ring-2 ring-red-500/40' : 'border-gray-700'
                    }`}
                    placeholder={t('jobDescPlaceholder')}
                    value={jobDesc}
                    onChange={(e) => {
                      setJobDesc(e.target.value);
                      if (errors.jobDesc) {
                        setErrors((prev) => ({ ...prev, jobDesc: undefined }));
                        setErrorMessage(null);
                      }
                    }}
                  />
                  {errors.jobDesc && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {errors.jobDesc}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('uploadResume')}</label>
              <div
                ref={resumeRef}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer relative ${
                  errors.resume
                    ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/10 ring-2 ring-red-500/40'
                    : 'border-gray-700 hover:bg-dark-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                />

                {fileName && !loading && (
                  <button
                    type="button"
                    onClick={handleRemoveResume}
                    className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-dark-800/90 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-500/40 transition-all shadow-md flex items-center justify-center group/del"
                    title="Remove resume"
                    aria-label="Remove resume"
                  >
                    <X className="w-4 h-4 transition-transform group-hover/del:scale-110" />
                  </button>
                )}

                <Upload className={`w-8 h-8 mx-auto mb-2 ${errors.resume ? 'text-red-400' : 'text-gray-500'}`} />
                {loading ? (
                  <p className="text-primary-400 animate-pulse">Parsing PDF...</p>
                ) : fileName ? (
                  <div className="flex flex-col items-center gap-1 px-6">
                    <p className="text-green-400 font-medium break-all">{fileName} extracted successfully.</p>
                    <span className="text-xs text-gray-500 hover:text-gray-400 transition-colors">Click or drag a new PDF to replace</span>
                  </div>
                ) : (
                  <p className={errors.resume ? 'text-red-300 font-medium' : 'text-gray-400'}>
                    Click or drag your CV here
                  </p>
                )}
              </div>
              {errors.resume && (
                <div className="mt-2.5 flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-sm animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="font-medium">{errors.resume}</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 pt-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Interviewer Avatar</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {PREDEFINED_AVATARS.map((avatar) => (
                  <div
                    key={avatar.id}
                    onClick={() => {
                      setSelectedAvatarId(avatar.id);
                      if (avatar.id !== CUSTOM_AVATAR_ID) {
                        setAvatarUrl(avatar.url || undefined);
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

              {selectedAvatarId === CUSTOM_AVATAR_ID && (
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

            {errorMessage && (
              <div className="bg-red-500/15 border border-red-500/40 text-red-300 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span className="text-sm font-medium">{errorMessage}</span>
              </div>
            )}

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
