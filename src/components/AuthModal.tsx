import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { EmailUserProfile, SavedConsultation } from '../types/legal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (
    user: EmailUserProfile,
    token: string,
    consultations: SavedConsultation[]
  ) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthenticated }) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'email' | 'instant'>('email');
  const [instantCode, setInstantCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const resp = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, displayName: displayName.trim() }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        email?: string;
        deliveryMode?: 'email' | 'instant';
        instantCode?: string;
        error?: string;
      };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || 'تعذر إرسال رمز التحقق، يرجى المحاولة مرة أخرى.');
      }

      setDeliveryMode(data.deliveryMode ?? 'email');
      setInstantCode(data.instantCode ?? null);
      setStep('otp');
      setNotice(
        data.deliveryMode === 'email'
          ? `تم إرسال رمز تأكيد مكوّن من 6 أرقام إلى ${cleanEmail}.`
          : 'تم توليد رمز التحقق الفوري لبريدك الإلكتروني بنجاح.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال رمز التحقق.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('يرجى إدخال رمز التحقق المكوّن من 6 أرقام.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const resp = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: cleanCode }),
      });
      const data = (await resp.json()) as {
        user?: EmailUserProfile;
        token?: string;
        consultations?: SavedConsultation[];
        error?: string;
      };

      if (!resp.ok || !data.user || !data.token) {
        throw new Error(data.error || 'رمز التحقق غير صحيح أو منتهي الصلاحية.');
      }

      onAuthenticated(data.user, data.token, data.consultations ?? []);
      setStep('email');
      setCode('');
      setInstantCode(null);
      setNotice(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحقق من الرمز.');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-auth-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-900/15 bg-[#FAF9F6] p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="email-auth-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                تسجيل الدخول بالبريد الإلكتروني
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                دخول آمن بدون نوافذ منبثقة لحفظ استشاراتك
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {notice && !error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
            <span>{notice}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label
                htmlFor="otp-email-input"
                className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                البريد الإلكتروني *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="otp-email-input"
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="otp-name-input"
                className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                الاسم (اختياري)
              </label>
              <input
                id="otp-name-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-colors hover:bg-teal-800 disabled:opacity-50"
            >
              <span>{busy ? 'جاري إرسال رمز التحقق...' : 'إرسال رمز التأكيد (OTP)'}</span>
              <ArrowRight className="h-4 w-4 rotate-180" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/70">
              <span className="truncate font-mono text-slate-700 dark:text-slate-200" dir="ltr">
                {email.trim().toLowerCase()}
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setInstantCode(null);
                  setError(null);
                  setNotice(null);
                }}
                className="font-semibold text-teal-700 hover:underline dark:text-teal-400"
              >
                تغيير البريد
              </button>
            </div>

            {deliveryMode === 'instant' && instantCode && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center dark:border-amber-800/60 dark:bg-amber-950/30">
                <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                  رمز التحقق الفوري الخاص بك (صالح لمدة 10 دقائق):
                </p>
                <div
                  dir="ltr"
                  className="my-1.5 font-mono text-2xl font-extrabold tracking-[0.3em] text-teal-800 dark:text-teal-300"
                >
                  {instantCode}
                </div>
                <button
                  type="button"
                  onClick={() => setCode(instantCode)}
                  className="rounded-lg bg-amber-700 px-3 py-1 text-[11px] font-bold text-white transition-colors hover:bg-amber-800"
                >
                  إدراج الرمز تلقائياً
                </button>
              </div>
            )}

            <div>
              <label
                htmlFor="otp-code-input"
                className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                أدخل رمز التحقق المكوّن من 6 أرقام *
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="otp-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-center font-mono text-lg font-bold tracking-[0.35em] text-slate-900 focus:border-teal-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRequestOtp()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>إعادة إرسال</span>
              </button>

              <button
                type="submit"
                disabled={busy || code.trim().length !== 6}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-colors hover:bg-teal-800 disabled:opacity-50"
              >
                <span>{busy ? 'جاري التحقق...' : 'تأكيد ودخول'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
