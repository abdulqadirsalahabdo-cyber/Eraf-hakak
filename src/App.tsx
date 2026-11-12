import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  AttachmentPayload,
  AutoDeleteOption,
  ChatMessage,
  ConsultationMeta,
  EmailUserProfile,
  HotlineEntry,
  LawArticle,
  PlatformInsights,
  SavedConsultation,
} from './types/legal';
import './firebase';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { ConsultationWorkspace } from './components/ConsultationWorkspace';
import { ContractScanner } from './components/ContractScanner';
import { LegalDrafter } from './components/LegalDrafter';
import { RightsCalculator } from './components/RightsCalculator';
import { KnowledgeAndEmergencyHub } from './components/KnowledgeAndEmergencyHub';
import { BreathingAnchor } from './components/BreathingAnchor';
import { AuthModal } from './components/AuthModal';

const STORAGE_KEY = 'e3raf_ha2ak_consultations_v1';
const THEME_KEY = 'e3raf_ha2ak_theme';
const PRIVACY_KEY = 'e3raf_ha2ak_privacy_mode';
const SESSION_TOKEN_KEY = 'e3raf_ha2ak_session_token';

function scrubClientPII(text: string): string {
  return text
    .replace(/\b\d{14}\b/g, '[رقم قومي محمي]')
    .replace(/\b(?:\+?2)?01[0125]\d{8}\b/g, '[رقم هاتف محمي]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[بريد محمي]');
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('consult');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showBreathingModal, setShowBreathingModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Popup-free Email OTP Auth state
  const [user, setUser] = useState<EmailUserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Privacy & Auto-Delete Vault
  const [autoDeleteOption, setAutoDeleteOption] = useState<AutoDeleteOption>(() => {
    try {
      const saved = localStorage.getItem(PRIVACY_KEY) as AutoDeleteOption | null;
      if (saved === 'close' || saved === '15m' || saved === '60m' || saved === 'manual') {
        return saved;
      }
    } catch {
      // Ignore storage failures
    }
    return '15m';
  });
  const [maskPiiOnSend, setMaskPiiOnSend] = useState<boolean>(true);
  const [secondsUntilWipe, setSecondsUntilWipe] = useState<number | null>(null);
  const [wipeNotice, setWipeNotice] = useState<string | null>(null);

  // Light / Dark Mode synced with document.documentElement
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      // Ignore storage failures
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage failures
    }
  }, [isDark]);

  // Consultation State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [savedConsultations, setSavedConsultations] = useState<SavedConsultation[]>(() => {
    try {
      const mode = localStorage.getItem(PRIVACY_KEY);
      if (mode === 'manual') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as SavedConsultation[];
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore parse failures
    }
    return [];
  });

  // Restore Email OTP Session on Mount
  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const headers: Record<string, string> = {};
        if (sessionToken) {
          headers.Authorization = `Bearer ${sessionToken}`;
        }
        const resp = await fetch('/api/auth/session', { headers });
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          user?: EmailUserProfile | null;
          consultations?: SavedConsultation[];
        };
        if (!active) return;
        if (data.user) {
          setUser(data.user);
          if (Array.isArray(data.consultations) && data.consultations.length > 0) {
            setSavedConsultations(data.consultations);
          }
        } else if (sessionToken) {
          setSessionToken(null);
          try {
            localStorage.removeItem(SESSION_TOKEN_KEY);
          } catch {
            // Ignore storage errors
          }
        }
      } catch {
        // Non-fatal session restore failure
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, [sessionToken]);

  const handleOpenSignInModal = () => {
    setShowAuthModal(true);
  };

  const handleAuthenticated = (
    signedUser: EmailUserProfile,
    token: string,
    serverConsultations: SavedConsultation[]
  ) => {
    setUser(signedUser);
    setSessionToken(token);
    try {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch {
      // Ignore storage errors
    }
    if (serverConsultations.length > 0) {
      setSavedConsultations(serverConsultations);
    }
    setAuthNotice(
      `مرحباً بك يا ${signedUser.displayName} (${signedUser.email}) — تم تأكيد حسابك وتسجيل الدخول بنجاح.`
    );
    window.setTimeout(() => setAuthNotice(null), 5000);
  };

  const handleSignOut = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Proceed cleanly with local signout
    } finally {
      setUser(null);
      setSessionToken(null);
      setSavedConsultations([]);
      setMessages([]);
      setActiveConsultationId(null);
      try {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      setAuthNotice('تم تسجيل الخروج بنجاح، وحماية خصوصيتك.');
      window.setTimeout(() => setAuthNotice(null), 4000);
      setAuthBusy(false);
    }
  };

  // Reference Corpus, Hotlines, & Self-Learning Insights
  const [laws, setLaws] = useState<LawArticle[]>([]);
  const [hotlines, setHotlines] = useState<HotlineEntry[]>([]);
  const [insights, setInsights] = useState<PlatformInsights | null>(null);
  const [refLoading, setRefLoading] = useState(true);

  const loadInsights = useCallback(async () => {
    try {
      const resp = await fetch('/api/insights');
      const data = (await resp.json()) as { insights?: PlatformInsights };
      if (data.insights) setInsights(data.insights);
    } catch {
      // Ignore network errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadReferenceData() {
      try {
        const [lawsResp, hotlinesResp, insightsResp] = await Promise.all([
          fetch('/api/laws'),
          fetch('/api/hotlines'),
          fetch('/api/insights'),
        ]);
        const lawsData = (await lawsResp.json()) as { articles?: LawArticle[] };
        const hotlinesData = (await hotlinesResp.json()) as { hotlines?: HotlineEntry[] };
        const insightsData = (await insightsResp.json()) as { insights?: PlatformInsights };
        if (active) {
          setLaws(lawsData.articles ?? []);
          setHotlines(hotlinesData.hotlines ?? []);
          setInsights(insightsData.insights ?? null);
        }
      } catch {
        // Keep graceful defaults
      } finally {
        if (active) setRefLoading(false);
      }
    }
    loadReferenceData();
    return () => {
      active = false;
    };
  }, []);

  const handleWipeAllData = useCallback((reason?: string) => {
    setMessages([]);
    setActiveConsultationId(null);
    setSavedConsultations([]);
    setSecondsUntilWipe(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    if (reason) {
      setWipeNotice(reason);
      window.setTimeout(() => setWipeNotice(null), 5000);
    }
  }, []);

  // Auto-delete countdown timer
  useEffect(() => {
    if (autoDeleteOption !== '15m' && autoDeleteOption !== '60m') {
      setSecondsUntilWipe(null);
      return;
    }
    if (messages.length === 0 && !user && savedConsultations.length === 0) {
      setSecondsUntilWipe(null);
      return;
    }
    const targetSeconds = autoDeleteOption === '15m' ? 15 * 60 : 60 * 60;
    setSecondsUntilWipe(targetSeconds);

    const interval = window.setInterval(() => {
      setSecondsUntilWipe((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          handleWipeAllData('تم مسح بيانات الجلسة تلقائياً انتهاءً لمؤقت الخصوصية.');
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [autoDeleteOption, messages.length, savedConsultations.length, user, handleWipeAllData]);

  // Clear localStorage immediately if user switches away from manual save
  const handleChangeAutoDelete = (opt: AutoDeleteOption) => {
    setAutoDeleteOption(opt);
    try {
      localStorage.setItem(PRIVACY_KEY, opt);
      if (opt !== 'manual') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const persistConsultation = useCallback(
    (consultationId: string, updatedMessages: ChatMessage[]) => {
      if (updatedMessages.length === 0) return;
      const firstUserMsg = updatedMessages.find((m) => m.role === 'user')?.content ?? 'استشارة جديدة';
      const firstMeta = updatedMessages.find((m) => m.meta)?.meta;
      const title = firstUserMsg.slice(0, 48) + (firstUserMsg.length > 48 ? '...' : '');
      const domain = firstMeta?.matchedDomain ?? 'استشارة قانونية';

      const lightMessages = updatedMessages.map((m) => ({
        ...m,
        isStreaming: false,
        attachment: m.attachment
          ? { name: m.attachment.name, mimeType: m.attachment.mimeType }
          : undefined,
      }));

      const newEntry: SavedConsultation = {
        id: consultationId,
        title,
        domain,
        updatedAt: new Date().toISOString(),
        messages: lightMessages,
      };

      setSavedConsultations((prev) => {
        const filtered = prev.filter((c) => c.id !== consultationId);
        const next: SavedConsultation[] = [newEntry, ...filtered].slice(0, 20);
        if (autoDeleteOption === 'manual' || user) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Ignore quota errors
          }
        }
        return next;
      });

      if (user) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
        void fetch('/api/user/consultations', {
          method: 'POST',
          headers,
          body: JSON.stringify({ consultation: newEntry }),
        }).catch(() => {});
      }
    },
    [autoDeleteOption, sessionToken, user]
  );

  const handleNewConsultation = () => {
    if (isStreaming) return;
    setMessages([]);
    setActiveConsultationId(null);
    setActiveTab('consult');
  };

  const handleSendMessage = async (
    rawText: string,
    attachment?: AttachmentPayload | null,
    options?: { startFresh?: boolean; useSearch?: boolean }
  ) => {
    if ((!rawText.trim() && !attachment) || isStreaming) return;

    const startFresh = Boolean(options?.startFresh);
    const useSearch = Boolean(options?.useSearch);
    const text = maskPiiOnSend ? scrubClientPII(rawText) : rawText;

    const consultationId =
      startFresh || !activeConsultationId ? `consult_${Date.now()}` : activeConsultationId;
    setActiveConsultationId(consultationId);

    const priorMessages = startFresh ? [] : messages;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text || 'مرفق مستند للفحص القانوني',
      timestamp: new Date().toISOString(),
      attachment: attachment
        ? {
            name: attachment.name,
            mimeType: attachment.mimeType,
            previewUrl: attachment.previewUrl,
          }
        : undefined,
    };

    const assistantId = `a_${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    const historyPayload = priorMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const baseMessages = [...priorMessages, userMsg, assistantMsg];
    setMessages(baseMessages);
    setIsStreaming(true);

    let accumulatedText = '';
    let latestMeta: ConsultationMeta | undefined;
    let latestSuggestions: string[] | undefined;

    try {
      const payloadBody = JSON.stringify({
        message: text,
        history: historyPayload,
        attachment: attachment ?? null,
        useSearch,
      });

      let response = await fetch('/api/consult/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadBody,
      });

      // Fallback alias endpoint if primary stream path is missing or misrouted
      if (response.status === 404 || response.status === 405) {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadBody,
        });
      }

      if (!response.ok || !response.body) {
        const contentType = response.headers.get('content-type') || '';
        const errBody = await response.text();
        if (response.status === 404 || contentType.includes('text/html')) {
          throw new Error(
            'مسار الخادم (/api/consult/stream) غير متاح (404). يرجى التحقق من ملف vercel.json وإعدادات النشر.'
          );
        }
        throw new Error(errBody || 'تعذر الاتصال بخادم الاستشارات القانونية.');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const jsonFallback = (await response.json()) as {
          reply?: string;
          text?: string;
          error?: string;
        };
        if (jsonFallback.error) throw new Error(jsonFallback.error);
        accumulatedText = jsonFallback.reply || jsonFallback.text || '';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulatedText, isStreaming: false } : m
          )
        );
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let sseBuffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const events = sseBuffer.split('\n\n');
          sseBuffer = events.pop() ?? '';

          for (const rawEvent of events) {
            const lines = rawEvent.split('\n');
            let eventName = 'message';
            let dataLine = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLine += line.slice(5).trim();
              }
            }

            if (!dataLine) continue;
            const payload = JSON.parse(dataLine) as Record<string, unknown>;

            if (eventName === 'meta') {
              latestMeta = payload as unknown as ConsultationMeta;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, meta: latestMeta } : m))
              );
            } else if (eventName === 'chunk') {
              const chunkText = String(payload.text ?? '');
              accumulatedText += chunkText;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulatedText } : m
                )
              );
            } else if (eventName === 'suggestions') {
              latestSuggestions = (payload.suggestions as string[]) ?? [];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, proactiveSuggestions: latestSuggestions }
                    : m
                )
              );
            } else if (eventName === 'error') {
              throw new Error(String(payload.error ?? 'حدث خطأ أثناء المعالجة.'));
            }
          }
        }
      }

      const finalMessages = baseMessages.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              content: accumulatedText,
              meta: latestMeta,
              proactiveSuggestions: latestSuggestions,
              isStreaming: false,
            }
          : m
      );

      setMessages(finalMessages);
      persistConsultation(consultationId, finalMessages);
      loadInsights();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'تعذر إكمال الاستشارة، يرجى المحاولة مجدداً.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false, error: errorMsg } : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmitFeedback = async (
    messageId: string,
    domain: string,
    userQuery: string,
    isHelpful: boolean,
    correctionNote?: string
  ) => {
    const resp = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        userQuery,
        isHelpful,
        correctionNote,
      }),
    });
    const data = (await resp.json()) as { insights?: PlatformInsights };
    if (data.insights) setInsights(data.insights);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, feedbackGiven: isHelpful ? 'helpful' : 'corrected' }
          : m
      )
    );
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isStreaming) return;
    setActiveTab('consult');
    void handleSendMessage(prompt, null, { startFresh: true });
  };

  const handleLoadConsultation = (consultation: SavedConsultation) => {
    if (isStreaming) return;
    setMessages(consultation.messages);
    setActiveConsultationId(consultation.id);
    setActiveTab('consult');
  };

  const handleDeleteConsultation = (id: string) => {
    setSavedConsultations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (autoDeleteOption === 'manual' || user) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
      }
      return next;
    });
    if (user) {
      const headers: Record<string, string> = {};
      if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
      void fetch(`/api/user/consultations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      }).catch(() => {});
    }
    if (activeConsultationId === id) {
      setMessages([]);
      setActiveConsultationId(null);
    }
  };

  const handleAskAboutArticle = (article: LawArticle) => {
    const prompt = `أريد فهم حقوقي وفق ${article.articleNumber} من ${article.lawName} (${article.lawNumber}) بخصوص "${article.title}". كيف أستفيد من هذه المادة عملياً؟`;
    setActiveTab('consult');
    void handleSendMessage(prompt, null, { startFresh: true });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FAF9F6] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewConsultation={handleNewConsultation}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        user={user}
        authBusy={authBusy}
        onSignIn={handleOpenSignInModal}
        onSignOut={handleSignOut}
      />

      {(wipeNotice || authNotice) && (
        <div className="no-print border-b border-teal-200 bg-teal-50 px-4 py-2 text-center text-xs font-semibold text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/50 dark:text-teal-200">
          {authNotice || wipeNotice}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          savedConsultations={savedConsultations}
          activeConsultationId={activeConsultationId}
          onLoadConsultation={handleLoadConsultation}
          onDeleteConsultation={handleDeleteConsultation}
          onQuickPrompt={handleQuickPrompt}
          onOpenBreathing={() => setShowBreathingModal(true)}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          autoDeleteOption={autoDeleteOption}
          onChangeAutoDelete={handleChangeAutoDelete}
          secondsUntilWipe={secondsUntilWipe}
          onInstantWipe={() =>
            handleWipeAllData('تم مسح جميع بيانات الجلسة والمرفقات من جهازك فوراً.')
          }
          user={user}
          authBusy={authBusy}
          onSignIn={handleOpenSignInModal}
          onSignOut={handleSignOut}
        />

        <main className="flex-1 overflow-hidden">
          {activeTab === 'consult' && (
            <ConsultationWorkspace
              messages={messages}
              isStreaming={isStreaming}
              maskPiiOnSend={maskPiiOnSend}
              onToggleMaskPii={() => setMaskPiiOnSend((v) => !v)}
              onSendMessage={handleSendMessage}
              onQuickPrompt={handleQuickPrompt}
              onNavigateTab={(t) => setActiveTab(t)}
              onSubmitFeedback={handleSubmitFeedback}
            />
          )}

          {activeTab === 'scanner' && (
            <ContractScanner
              onDiscussInChat={(summaryPrompt) => handleQuickPrompt(summaryPrompt)}
            />
          )}

          {activeTab === 'drafter' && (
            <LegalDrafter
              onDiscussInChat={(prompt) => handleQuickPrompt(prompt)}
            />
          )}

          {activeTab === 'calculator' && (
            <RightsCalculator
              onDiscussInChat={(prompt) => handleQuickPrompt(prompt)}
            />
          )}

          {activeTab === 'hub' && (
            <KnowledgeAndEmergencyHub
              articles={laws}
              hotlines={hotlines}
              insights={insights}
              loading={refLoading}
              onAskAboutArticle={handleAskAboutArticle}
            />
          )}
        </main>
      </div>

      {/* Popup-Free Email OTP Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthenticated}
      />

      {/* On-Demand Calm Breathing Modal */}
      {showBreathingModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                لحظة هدوء واستعادة توازن
              </h2>
              <button
                type="button"
                onClick={() => setShowBreathingModal(false)}
                aria-label="إغلاق"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <BreathingAnchor onClose={() => setShowBreathingModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
