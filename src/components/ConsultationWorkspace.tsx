import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileDown,
  FileSearch,
  FileText,
  Globe,
  ImagePlus,
  Loader2,
  Mic,
  Phone,
  Send,
  ShieldCheck,
  Square,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { AttachmentPayload, ChatMessage } from '../types/legal';
import { BreathingAnchor } from './BreathingAnchor';
import { PdfReportModal } from './PdfReportModal';

interface ConsultationWorkspaceProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  maskPiiOnSend: boolean;
  onToggleMaskPii: () => void;
  onSendMessage: (
    text: string,
    attachment?: AttachmentPayload | null,
    options?: { startFresh?: boolean; useSearch?: boolean }
  ) => void;
  onQuickPrompt: (prompt: string) => void;
  onNavigateTab: (tab: 'scanner' | 'drafter' | 'calculator' | 'hub') => void;
  onSubmitFeedback: (
    messageId: string,
    domain: string,
    userQuery: string,
    isHelpful: boolean,
    correctionNote?: string
  ) => Promise<void>;
}

const STARTER_CARDS = [
  {
    kicker: 'قانون العمل · المادة 122',
    title: 'فصل تعسفي أو حجز مسوغات التعيين',
    prompt:
      'تم فصلي من الشركة فجأة بدون سبب أو إخطار ورفضوا صرف مستحقاتي، ما هي حلولي الواقعية في القانون المصري؟',
  },
  {
    kicker: 'جرائم الإنترنت · المادة 25',
    title: 'ابتزاز إلكتروني أو تهديد بنشر صور',
    prompt:
      'أنا مرعوبة، شخص يهددني بنشر صور ومحادثات خاصة على فيسبوك وواتساب، أتصرف إزاي خطوة بخطوة؟',
  },
  {
    kicker: 'العقوبات · المادة 341',
    title: 'مشكلة إيصال أمانة على بياض أو ضمان',
    prompt:
      'وقّعت إيصال أمانة على بياض كضمان أثناء الشغل والطرف الآخر يهددني به، كيف أحمي نفسي قانوناً؟',
  },
  {
    kicker: 'الأحوال الشخصية · قانون 1 لسنة 2000',
    title: 'النفقة وقائمة المنقولات ومسكن الحضانة',
    prompt:
      'أريد خطوات واقعية ومرتبة للحصول على النفقة والتمكين من مسكن الحضانة وقائمة المنقولات.',
  },
];

export const ConsultationWorkspace: React.FC<ConsultationWorkspaceProps> = ({
  messages,
  isStreaming,
  maskPiiOnSend,
  onToggleMaskPii,
  onSendMessage,
  onQuickPrompt,
  onNavigateTab,
  onSubmitFeedback,
}) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<AttachmentPayload | null>(null);
  const [useSearch, setUseSearch] = useState(false);
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pdfTarget, setPdfTarget] = useState<{
    question: string;
    message: ChatMessage;
  } | null>(null);

  // Hero Image Fallback state
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Self-learning correction box state
  const [correctionOpenId, setCorrectionOpenId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [feedbackSubmittingId, setFeedbackSubmittingId] = useState<string | null>(null);

  // Voice recording state (Gemini 3.5 Transcribe)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Text-to-Speech state (Gemini 3.8 Flash Lite TTS)
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setVoiceError('يرجى اختيار صورة واضحة للعقد أو المستند (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.split(',')[1] ?? '';
      setAttachment({
        name: file.name,
        mimeType: file.type,
        base64Data: base64,
        previewUrl: result,
      });
      setVoiceError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isStreaming) return;
    onSendMessage(input.trim(), attachment, { useSearch });
    setInput('');
    setAttachment(null);
    setVoiceError(null);
  };

  const startRecording = async () => {
    setVoiceError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('متصفحك لا يدعم التسجيل الصوتي المباشر.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 400) {
          setVoiceError('التسجيل قصير جداً، يرجى المحاولة مرة أخرى.');
          return;
        }
        setIsTranscribing(true);
        try {
          const base64Audio = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const resStr = String(reader.result ?? '');
              resolve(resStr.split(',')[1] ?? '');
            };
            reader.readAsDataURL(blob);
          });

          const resp = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: base64Audio, mimeType }),
          });
          const data = (await resp.json()) as { transcript?: string; error?: string };
          if (!resp.ok || !data.transcript) {
            throw new Error(data.error ?? 'تعذر تحويل الصوت إلى نص.');
          }
          setInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript ?? ''));
        } catch (err) {
          setVoiceError(
            err instanceof Error ? err.message : 'حدث خطأ أثناء تفريغ التسجيل الصوتي.'
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordSeconds(0);
      setIsRecording(true);
    } catch {
      setVoiceError('يرجى السماح بالوصول إلى الميكروفون للتحدث بصوتك.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleToggleTts = async (msg: ChatMessage) => {
    if (ttsPlayingId === msg.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setTtsPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setTtsPlayingId(null);
    }

    setTtsLoadingId(msg.id);
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content }),
      });
      const data = (await resp.json()) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!resp.ok || !data.audioBase64) {
        throw new Error(data.error ?? 'تعذر تشغيل القراءة الصوتية.');
      }

      const audio = new Audio(`data:${data.mimeType ?? 'audio/wav'};base64,${data.audioBase64}`);
      audio.onended = () => {
        setTtsPlayingId(null);
        audioRef.current = null;
      };
      audioRef.current = audio;
      setTtsPlayingId(msg.id);
      await audio.play();
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'تعذر تشغيل الصوت.');
    } finally {
      setTtsLoadingId(null);
    }
  };

  const handleCopy = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const getPrecedingQuestion = (index: number): string => {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') return messages[i].content;
    }
    return 'استشارة قانونية عامة';
  };

  const handleConfirmHelpful = async (msg: ChatMessage, idx: number) => {
    setFeedbackSubmittingId(msg.id);
    try {
      await onSubmitFeedback(
        msg.id,
        msg.meta?.matchedDomain ?? 'استشارة قانونية عامة',
        getPrecedingQuestion(idx),
        true
      );
    } finally {
      setFeedbackSubmittingId(null);
    }
  };

  const handleSendCorrection = async (msg: ChatMessage, idx: number) => {
    if (correctionText.trim().length < 5) return;
    setFeedbackSubmittingId(msg.id);
    try {
      await onSubmitFeedback(
        msg.id,
        msg.meta?.matchedDomain ?? 'استشارة قانونية عامة',
        getPrecedingQuestion(idx),
        false,
        correctionText.trim()
      );
      setCorrectionOpenId(null);
      setCorrectionText('');
    } finally {
      setFeedbackSubmittingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable Conversation Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          {messages.length === 0 ? (
            /* Editorial Split Welcome Hero + Integrated Legal-Tech Suite */
            <div className="space-y-8 py-2 sm:py-4">
              <section className="overflow-hidden rounded-2xl border border-amber-900/15 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid items-stretch lg:grid-cols-12">
                  {/* Right Side: Editorial Copy & Privacy Guarantee */}
                  <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-7 space-y-6">
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-teal-800 dark:text-teal-400">
                        منصة مجانية بالكامل · الدعم النفسي والتوجيه القانوني المصري · مسح تلقائي للبيانات
                      </p>
                      <h1 className="font-display text-3xl font-bold leading-snug text-slate-900 dark:text-slate-50 sm:text-4xl">
                        احكِ مشكلتك بأمان.. حقك محفوظ بالقانون
                      </h1>
                      <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
                        لا تحمل همّك وحدك. اكتب أو تكلّم باللهجة المصرية أو صوّر أي عقد أو إيصال، وسنهدّئ روعك أولاً ثم نمنحك إجابة صريحة وحلولاً عملية شاملة مستندة إلى القوانين المصرية، مع تعلّم مستمر يمنع تكرار الأخطاء.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-amber-900/10 pt-5 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('scanner')}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#FAF9F6] px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-600/50 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap"
                      >
                        <FileSearch className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                        <span>فحص عقد أو إيصال</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigateTab('drafter')}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#FAF9F6] px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-600/50 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap"
                      >
                        <FileText className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                        <span>صياغة إنذار أو شكوى</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigateTab('calculator')}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#FAF9F6] px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-600/50 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 whitespace-nowrap"
                      >
                        <Calculator className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                        <span>احسب تعويضك أو ميعادك</span>
                      </button>
                    </div>
                  </div>

                  {/* Left Side: Warm Egyptian Justice Courtyard Artwork */}
                  <div className="relative min-h-[240px] lg:col-span-5 bg-slate-900">
                    {!heroImgFailed ? (
                      <img
                        src="/src/assets/images/egyptian_justice_warm_hero_1794510352553.jpg"
                        alt="ميزان العدالة المصرية في فناء معماري مصري هادئ بإضاءة دافئة"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-8 text-center text-teal-100">
                        <span className="font-display text-xl font-bold">
                          العدالة المصرية · طمأنة وحق مؤصل
                        </span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        <span>خدمة مجانية بالكامل · خصوصية مشفرة وحفظ آمن</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* 4-Column Feature Guarantees Strip */}
              <div className="grid gap-6 border-y border-slate-200 py-5 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    01. بياناتك في أمان تام
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    إخفاء تلقائي للرقم القومي والهواتف، ومسح تلقائي للجلسة وفق مؤقتك.
                  </p>
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    02. 3 مسارات حلول واقعية
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    حل ودي تفاوضي، مسار إداري ومحاضر، ومسار قضائي حاسم بالمواعيد.
                  </p>
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    03. تعلّم ذاتي يمنع الأخطاء
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    يستفيد النظام من كل تصحيح في قاعدة وقائية تمنع تكرار الخطأ مستقبلاً.
                  </p>
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    04. صوت وعقود وتصدير PDF
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    تحدّث باللهجة المصرية، افحص صور العقود، واحفظ استشارتك كملف رسمي.
                  </p>
                </div>
              </div>

              {/* Quick Starter Scenarios */}
              <div className="space-y-3">
                <h2 className="font-display text-sm font-semibold text-slate-800 dark:text-slate-200">
                  ابدأ باختيار مشكلة واقعية أو احكِ قصتك بالأسفل
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STARTER_CARDS.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => onQuickPrompt(card.prompt)}
                      className="group rounded-xl border border-slate-200 bg-white p-4 text-right transition-colors hover:border-teal-600/50 hover:bg-teal-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-500/40 dark:hover:bg-teal-950/20"
                    >
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {card.kicker}
                      </div>
                      <div className="mt-1 font-display text-sm font-semibold text-slate-900 group-hover:text-teal-800 dark:text-slate-100 dark:group-hover:text-teal-300">
                        {card.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Conversation Thread */
            <div className="mx-auto max-w-4xl space-y-8">
              {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                        {msg.attachment?.previewUrl && (
                          <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                            <img
                              src={msg.attachment.previewUrl}
                              alt={msg.attachment.name}
                              className="max-h-56 w-full object-contain bg-slate-100 dark:bg-slate-950"
                            />
                            <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                              مرفق للفحص: {msg.attachment.name}
                            </div>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                          {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const isLastMessage = idx === messages.length - 1;
                const isRefsOpen = Boolean(expandedRefs[msg.id]);

                return (
                  <article
                    key={msg.id}
                    className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
                  >
                    {/* Clean Unboxed Metadata Line */}
                    {msg.meta && (
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <span className="font-semibold text-teal-700 dark:text-teal-400">
                          {msg.meta.matchedDomain}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{msg.meta.sentiment.labelAr}</span>
                        {msg.meta.appliedLessonsCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums text-amber-700 dark:text-amber-400">
                              مُحصّن بـ {msg.meta.appliedLessonsCount} قاعدة وقاية من حالات سابقة
                            </span>
                          </>
                        )}
                        {msg.meta.fromCache && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>استرجاع فوري</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Inline Grounding Exercise when high distress detected */}
                    {msg.meta?.sentiment.needsGroundingExercise && (
                      <BreathingAnchor compact />
                    )}

                    {msg.error ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        {msg.error}
                      </div>
                    ) : (
                      <div className="prose prose-slate max-w-none text-[15.5px] sm:text-base leading-[1.9] text-slate-800 dark:prose-invert dark:text-slate-200 prose-headings:font-display prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-strong:text-slate-950 dark:prose-strong:text-white prose-li:my-1">
                        {msg.content ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          <div className="flex items-center gap-2.5 py-2 text-slate-500 dark:text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin text-teal-700 dark:text-teal-400" />
                            <span>جاري مراجعة القوانين المصرية وقواعد الوقاية لصياغة الحلول...</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grounded Legal Articles Drawer */}
                    {!msg.isStreaming &&
                      msg.meta?.retrievedArticles &&
                      msg.meta.retrievedArticles.length > 0 && (
                        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRefs((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                          >
                            <span className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                              <span>
                                النصوص القانونية الرسمية المستند إليها (
                                <span className="tabular-nums">
                                  {msg.meta.retrievedArticles.length}
                                </span>{' '}
                                مواد)
                              </span>
                            </span>
                            {isRefsOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          {isRefsOpen && (
                            <div className="mt-2 space-y-2.5">
                              {msg.meta.retrievedArticles.map((art) => (
                                <div
                                  key={art.id}
                                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950/60"
                                >
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {art.lawName} ({art.lawNumber}) · {art.articleNumber}
                                  </div>
                                  <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                                    {art.title}
                                  </div>
                                  <p className="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">
                                    «{art.officialText}»
                                  </p>
                                  {art.prescriptionPeriod && (
                                    <p className="mt-2 font-medium text-amber-700 dark:text-amber-400">
                                      المواعيد والتقادم: {art.prescriptionPeriod}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    {/* Recommended Egyptian Hotlines */}
                    {!msg.isStreaming &&
                      msg.meta?.recommendedHotlines &&
                      msg.meta.recommendedHotlines.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                          <span className="font-semibold text-slate-600 dark:text-slate-400">
                            جهات مساعدة:
                          </span>
                          {msg.meta.recommendedHotlines.map((hl) => (
                            <a
                              key={hl.id}
                              href={`tel:${hl.number}`}
                              className="inline-flex items-center gap-1.5 font-medium text-teal-700 hover:underline dark:text-teal-400"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              <span>{hl.agency}:</span>
                              <span className="font-mono tabular-nums font-semibold">
                                {hl.number}
                              </span>
                            </a>
                          ))}
                        </div>
                      )}

                    {/* Action Toolbar + Self-Learning Feedback */}
                    {!msg.isStreaming && msg.content && (
                      <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleTts(msg)}
                              disabled={ttsLoadingId === msg.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                            >
                              {ttsLoadingId === msg.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : ttsPlayingId === msg.id ? (
                                <VolumeX className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                              ) : (
                                <Volume2 className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                              )}
                              <span>
                                {ttsLoadingId === msg.id
                                  ? 'جاري تجهيز الصوت...'
                                  : ttsPlayingId === msg.id
                                  ? 'إيقاف القراءة'
                                  : 'استماع صوتي'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setPdfTarget({
                                  question: getPrecedingQuestion(idx),
                                  message: msg,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                            >
                              <FileDown className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                              <span>تصدير PDF رسمي</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopy(msg)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>تم النسخ</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>نسخ</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Self-Learning Quality Loop */}
                          {msg.feedbackGiven ? (
                            <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                              {msg.feedbackGiven === 'helpful'
                                ? 'تم تأكيد دقة التوجيه وتعلمت المنصة منه'
                                : 'تم حفظ قاعدة التصحيح — لن يتكرر هذا الخطأ'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={feedbackSubmittingId === msg.id}
                                onClick={() => handleConfirmHelpful(msg, idx)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-emerald-950/30 whitespace-nowrap"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                                <span>دقيق ومفيد</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCorrectionOpenId(
                                    correctionOpenId === msg.id ? null : msg.id
                                  );
                                  setCorrectionText('');
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-amber-950/30 whitespace-nowrap"
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span>صحّح خطأً</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Inline Error-Correction Learning Box */}
                        {correctionOpenId === msg.id && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2.5 dark:border-amber-900/50 dark:bg-amber-950/25">
                            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                              ساعد «اعرف حقك» على التطور (تُحذف أي بيانات شخصية تلقائياً قبل الحفظ):
                            </div>
                            <textarea
                              rows={2}
                              value={correctionText}
                              onChange={(e) => setCorrectionText(e.target.value)}
                              placeholder="اكتب الخطأ القانوني أو التفصيل الواقعي الذي يجب الانتباه إليه في القضايا المشابهة..."
                              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setCorrectionOpenId(null)}
                                className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                disabled={
                                  correctionText.trim().length < 5 ||
                                  feedbackSubmittingId === msg.id
                                }
                                onClick={() => handleSendCorrection(msg, idx)}
                                className="rounded-lg bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-600"
                              >
                                حفظ كقاعدة منع خطأ
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Proactive Next-Step Suggester */}
                    {isLastMessage &&
                      !msg.isStreaming &&
                      msg.proactiveSuggestions &&
                      msg.proactiveSuggestions.length > 0 && (
                        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                          <div className="mb-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                            خطوات استباقية مقترحة لك الآن:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {msg.proactiveSuggestions.map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => onSendMessage(sug)}
                                disabled={isStreaming}
                                className="rounded-lg border border-teal-700/25 bg-teal-50/70 px-3.5 py-2 text-right text-xs font-medium text-teal-900 transition-colors hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-950/70"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </article>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Smart Composer with PII Guard */}
      <div className="no-print border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={maskPiiOnSend}
                  onChange={onToggleMaskPii}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>إخفاء الرقم القومي والهواتف تلقائياً</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useSearch}
                  onChange={(e) => setUseSearch(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <Globe className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                <span>تعزيز بالبحث الرسمي المباشر</span>
              </label>
            </div>
            <span>مجانية بالكامل · خصوصية تامة</span>
          </div>

          {voiceError && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              <span>{voiceError}</span>
              <button
                type="button"
                onClick={() => setVoiceError(null)}
                aria-label="إغلاق التنبيه"
                className="p-0.5 hover:opacity-75"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {attachment && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                {attachment.previewUrl && (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="h-9 w-9 rounded object-cover border border-slate-200 dark:border-slate-700"
                  />
                )}
                <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                  مرفق جاهز للفحص: {attachment.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="إزالة المرفق"
                className="rounded p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title="إرفاق صورة عقد أو إيصال أمانة"
              aria-label="إرفاق صورة مستند"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ImagePlus className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isStreaming || isTranscribing}
              title={isRecording ? 'إيقاف التسجيل وتفريغ الكلام' : 'احكِ مشكلتك بصوتك'}
              aria-label={isRecording ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
              className={`flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 transition-colors disabled:opacity-50 ${
                isRecording
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRecording ? (
                <>
                  <Square className="h-4 w-4 fill-current" />
                  <span className="font-mono tabular-nums text-xs font-semibold">
                    {Math.floor(recordSeconds / 60)}:
                    {String(recordSeconds % 60).padStart(2, '0')}
                  </span>
                </>
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                isTranscribing
                  ? 'جاري تحويل صوتك إلى نص مصري...'
                  : 'احكِ مشكلتك هنا بأمان وبدون قلق أو ارفع صورة العقد...'
              }
              className="max-h-36 min-h-[44px] flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-500 dark:focus:bg-slate-800"
            />

            <button
              type="submit"
              disabled={isStreaming || (!input.trim() && !attachment)}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </div>
        </form>
      </div>

      {pdfTarget && (
        <PdfReportModal
          userQuestion={pdfTarget.question}
          assistantMessage={pdfTarget.message}
          onClose={() => setPdfTarget(null)}
        />
      )}
    </div>
  );
};
