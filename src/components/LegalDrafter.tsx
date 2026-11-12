import React, { useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Loader2,
  MessageSquare,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import type { DraftedDocumentResult } from '../types/legal';

interface LegalDrafterProps {
  onDiscussInChat: (prompt: string) => void;
}

const TEMPLATES = [
  'إنذار رسمي على يد محضر بسداد مستحقات أو تنفيذ التزام',
  'شكوى فصل تعسفي أو حجز مستحقات لمكتب العمل',
  'بلاغ رسمي لمباحث الإنترنت عن ابتزاز أو تشهير إلكتروني',
  'شكوى لجهاز حماية المستهلك لاسترجاع منتج أو استرداد قيمة',
  'طلب تسوية منازعات أسرية (نفقة / تمكين / قائمة منقولات)',
  'محضر إثبات حالة في قسم الشرطة (تهديد / إكراه / امتناع)',
];

export const LegalDrafter: React.FC<LegalDrafterProps> = ({ onDiscussInChat }) => {
  const [templateType, setTemplateType] = useState(TEMPLATES[0]);
  const [senderRole, setSenderRole] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [facts, setFacts] = useState('');
  const [demands, setDemands] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftedDocumentResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facts.trim() || !demands.trim()) {
      setError('يرجى كتابة ملخص الواقعة وطلباتك بدقة لصياغة المحرر القانوني.');
      return;
    }

    setIsDrafting(true);
    setError(null);

    try {
      const resp = await fetch('/api/draft-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType,
          senderRole,
          recipientName,
          facts,
          demands,
        }),
      });
      const data = (await resp.json()) as {
        draft?: DraftedDocumentResult;
        error?: string;
      };
      if (!resp.ok || !data.draft) {
        throw new Error(data.error ?? 'تعذر صياغة المستند.');
      }
      setDraft(data.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الصياغة.');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleCopy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="no-print space-y-2">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            صياغة قانونية مصرية رسمية · حماية الخصوصية
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
            محرر الإنذارات والشكاوى الرسمية
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            جهّز مسودة إنذار على يد محضر أو شكوى رسمية بالصياغة المعتمدة أمام الجهات المصرية، مع ترك خانات البيانات الشخصية بين أقواس لتملأها بنفسك قبل الطباعة.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Form Column */}
          <form
            onSubmit={handleDraft}
            className="no-print lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-teal-200/80 bg-teal-50/60 p-3 text-xs leading-relaxed text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-200">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-teal-700 dark:text-teal-400" />
              <span>
                لا تكتب رقمك القومي أو عنوانك الحقيقي هنا؛ الصياغة ستترك أقواساً جاهزة تملؤها بنفسك بعد الطباعة.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                نوع المحرر المطلوب
              </label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  صفتك (اختياري)
                </label>
                <input
                  type="text"
                  value={senderRole}
                  onChange={(e) => setSenderRole(e.target.value)}
                  placeholder="مثال: موظف / مستأجر / مشترٍ"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  الجهة أو المشكو في حقه
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="مثال: الممثل القانوني لشركة..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ملخص الوقائع وما حدث بالتفصيل
              </label>
              <textarea
                rows={4}
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="مثال: التحقت بالعمل بتاريخ ... براتب ... وفي يوم ... تم منعي من دخول الشركة دون مبرر أو إخطار..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                طلباتك الختامية المحددة
              </label>
              <textarea
                rows={3}
                value={demands}
                onChange={(e) => setDemands(e.target.value)}
                placeholder="مثال: صرف راتب شهر ... وتعويض الفصل التعسفي ومقابل رصيد الإجازات وتسليم مسوغات التعيين."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isDrafting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {isDrafting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري صياغة المحرر الرسمي...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>صياغة المحرر القانوني الآن</span>
                </>
              )}
            </button>
          </form>

          {/* Draft Preview Column */}
          <section className="print-container lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            {!draft && !isDrafting && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <h2 className="mt-4 font-display text-base font-semibold text-slate-800 dark:text-slate-200">
                  مسودة المحرر القانوني ستظهر هنا
                </h2>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  ستحصل على صيغة كاملة منسقة للطباعة مع قائمة المستندات المرفقة والخطوات العملية لتسليمها للجهة المختصة.
                </p>
              </div>
            )}

            {isDrafting && (
              <div className="space-y-4 py-10">
                <div className="flex items-center gap-3 text-sm font-medium text-teal-700 dark:text-teal-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>يتم الآن إعداد الديباجة والأسانيد القانونية المصرية...</span>
                </div>
                <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              </div>
            )}

            {draft && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      الجهة المختصة: {draft.targetAuthority}
                    </div>
                    <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                      {draft.documentTitle}
                    </h2>
                  </div>

                  <div className="no-print flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>نسخ النص</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>طباعة / PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDiscussInChat(
                          `جهّزت مسودة "${draft.documentTitle}" الموجهة إلى "${draft.targetAuthority}". ما النصائح العملية قبل تقديمها رسمياً؟`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>اسأل المستشار</span>
                    </button>
                  </div>
                </div>

                {/* Legal Document Stationery Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-sm leading-loose text-slate-900 whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 print:border-slate-300 print:bg-white print:text-slate-900">
                  {draft.fullText}
                </div>

                <div className="text-xs font-medium text-teal-800 dark:text-teal-300">
                  السند التشريعي: {draft.legalBasis}
                </div>

                <div className="no-print grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-slate-800">
                  {draft.requiredAttachments?.length > 0 && (
                    <div>
                      <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-100">
                        المستندات المطلوب إرفاقها
                      </h3>
                      <ul className="mt-2 list-disc space-y-1.5 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        {draft.requiredAttachments.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {draft.filingSteps?.length > 0 && (
                    <div>
                      <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-100">
                        خطوات التقديم الرسمية
                      </h3>
                      <ol className="mt-2 list-decimal space-y-1.5 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        {draft.filingSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
