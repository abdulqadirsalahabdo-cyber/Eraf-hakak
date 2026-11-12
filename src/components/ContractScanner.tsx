import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  MessageSquare,
  Printer,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import type { ContractAuditResult } from '../types/legal';

interface ContractScannerProps {
  onDiscussInChat: (summaryPrompt: string) => void;
}

const DOC_TYPES = [
  'عقد عمل (قطاع خاص)',
  'عقد إيجار شقة أو محل',
  'إيصال أمانة أو شيك ضمان',
  'عقد بيع ابتدائي / سيارة / شقة',
  'إقرار تنازل أو مخالصة مالية',
  'محضر شرطة أو إنذار على يد محضر',
];

export const ContractScanner: React.FC<ContractScannerProps> = ({ onDiscussInChat }) => {
  const [selectedType, setSelectedType] = useState(DOC_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<ContractAuditResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('يرجى رفع صورة واضحة للمستند (JPG, PNG, WEBP).');
      return;
    }
    setError(null);
    setAudit(null);
    setFileName(file.name);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      setImagePreview(result);
      setImageBase64(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imageBase64) {
      setError('يرجى اختيار صورة العقد أو المستند أولاً.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const resp = await fetch('/api/scan-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          documentType: selectedType,
          notes,
        }),
      });
      const data = (await resp.json()) as { audit?: ContractAuditResult; error?: string };
      if (!resp.ok || !data.audit) {
        throw new Error(data.error ?? 'تعذر تحليل المستند.');
      }
      setAudit(data.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الفحص.');
    } finally {
      setIsScanning(false);
    }
  };

  const getSeverityStyle = (severity: string) => {
    if (severity === 'critical') {
      return {
        label: 'ثغرة خطيرة / بند باطل',
        icon: ShieldAlert,
        classes: 'border-red-200 bg-red-50/70 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200',
        badge: 'text-red-700 dark:text-red-400',
      };
    }
    if (severity === 'warning') {
      return {
        label: 'بند يحتاج تعديلاً أو توضيحاً',
        icon: AlertTriangle,
        classes: 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
        badge: 'text-amber-700 dark:text-amber-400',
      };
    }
    return {
      label: 'بند سليم ومتوازن',
      icon: CheckCircle2,
      classes: 'border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-200',
      badge: 'text-emerald-700 dark:text-emerald-400',
    };
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="no-print space-y-2">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            الفحص الذكي للعقود والمحررات · القانون المصري
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
            فاحص العقود والمستندات القانونية الفوري
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            صوّر أي عقد عمل، عقد إيجار، أو إيصال أمانة قبل التوقيع عليه أو بعده، وسيكشف لك المستشار الذكي البنود الباطلة والثغرات التي قد تهدر حقك مع التعديل القانوني المقترح.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Upload & Configuration Column */}
          <section className="no-print lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                نوع المستند المرفوع
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="hidden"
              />

              {imagePreview ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="relative bg-slate-100 dark:bg-slate-950">
                    <img
                      src={imagePreview}
                      alt={fileName}
                      className="max-h-64 w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageBase64(null);
                        setAudit(null);
                      }}
                      aria-label="إزالة الصورة"
                      className="absolute top-2 left-2 rounded-lg bg-slate-900/75 p-1.5 text-white hover:bg-slate-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 truncate">
                    {fileName}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-4 py-10 text-center transition-colors hover:border-teal-600 hover:bg-teal-50/30 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-teal-500 dark:hover:bg-teal-950/20"
                >
                  <Upload className="h-8 w-8 text-teal-700 dark:text-teal-400" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      اضغط لاختيار صورة العقد أو اسحبها هنا
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      تأكد أن الإضاءة واضحة ونص البنود مقروء
                    </div>
                  </div>
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                ملاحظاتك أو البند الذي يقلقك (اختياري)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: هل الشرط الجزائي في البند الرابع قانوني؟ أو هل التوقيع على استمارة 6 سليم؟"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning || !imageBase64}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري فحص البنود وفق القانون المصري...</span>
                </>
              ) : (
                <>
                  <FileSearch className="h-4 w-4" />
                  <span>بدء الفحص القانوني الفوري</span>
                </>
              )}
            </button>
          </section>

          {/* Audit Result Column */}
          <section className="print-container lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            {!audit && !isScanning && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <FileSearch className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <h2 className="mt-4 font-display text-base font-semibold text-slate-800 dark:text-slate-200">
                  تقرير الفحص سيظهر هنا فور تحليل المستند
                </h2>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  نقوم بتحليل كل بند على حدة وتحديد درجة الخطورة، السند القانوني في التشريع المصري، والصياغة البديلة التي تحمي حقوقك.
                </p>
              </div>
            )}

            {isScanning && (
              <div className="space-y-4 py-8">
                <div className="flex items-center gap-3 text-sm font-medium text-teal-700 dark:text-teal-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>يقرأ المستشار الذكي بنود المستند ويطابقها مع القانون المصري...</span>
                </div>
                <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              </div>
            )}

            {audit && (
              <div className="space-y-6">
                {/* Summary Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {audit.documentType} · التقييم العام للمخاطر:{' '}
                      <span
                        className={`font-semibold ${
                          audit.overallRisk === 'high'
                            ? 'text-red-700 dark:text-red-400'
                            : audit.overallRisk === 'medium'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {audit.overallRiskAr}
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                      نتيجة الفحص القانوني للمستند
                    </h2>
                  </div>

                  <div className="no-print flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>حفظ PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDiscussInChat(
                          `قمت بفحص "${audit.documentType}" وكانت النتيجة: ${audit.executiveSummary}. ما الخطوة القانونية الأنسب لي الآن؟`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>ناقش مع المستشار</span>
                    </button>
                  </div>
                </div>

                {/* Executive Summary */}
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {audit.executiveSummary}
                </p>

                {/* Clause-by-Clause Findings */}
                {audit.findings && audit.findings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      تحليل البنود والثغرات المكتشفة
                    </h3>
                    {audit.findings.map((finding, i) => {
                      const st = getSeverityStyle(finding.severity);
                      const Icon = st.icon;
                      return (
                        <div
                          key={`${finding.clauseTitle}-${i}`}
                          className={`rounded-xl border p-4 space-y-2 ${st.classes}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-display text-sm font-bold">
                              {finding.clauseTitle}
                            </h4>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${st.badge}`}>
                              <Icon className="h-3.5 w-3.5" />
                              <span>{finding.severityAr || st.label}</span>
                            </span>
                          </div>
                          <div className="text-xs font-medium opacity-85">
                            السند القانوني: {finding.legalBasis}
                          </div>
                          <p className="text-xs leading-relaxed opacity-95">
                            {finding.explanation}
                          </p>
                          {finding.recommendedEdit && (
                            <div className="border-t border-current/15 pt-2 text-xs">
                              <span className="font-semibold">التعديل المقترح لحمايتك: </span>
                              <span>{finding.recommendedEdit}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Missing Protections & Next Steps */}
                <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-slate-800">
                  {audit.missingProtections?.length > 0 && (
                    <div>
                      <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-100">
                        ضمانات غائبة يُنصح بإضافتها
                      </h3>
                      <ul className="mt-2 list-disc space-y-1.5 pr-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {audit.missingProtections.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {audit.nextSteps?.length > 0 && (
                    <div>
                      <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-100">
                        خطوات عملية مقترحة
                      </h3>
                      <ol className="mt-2 list-decimal space-y-1.5 pr-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {audit.nextSteps.map((step, idx) => (
                          <li key={idx}>{step}</li>
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
