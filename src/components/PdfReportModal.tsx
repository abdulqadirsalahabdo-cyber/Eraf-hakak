import React from 'react';
import { Printer, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types/legal';

interface PdfReportModalProps {
  userQuestion: string;
  assistantMessage: ChatMessage;
  onClose: () => void;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  userQuestion,
  assistantMessage,
  onClose,
}) => {
  const formattedDate = new Date(assistantMessage.timestamp).toLocaleString('ar-EG', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs print:static print:block print:bg-white print:p-0">
      <div className="print-container flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 print:max-h-none print:rounded-none print:border-0 print:shadow-none">
        {/* Modal Toolbar (hidden in print) */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="font-display text-base font-bold">
              معاينة تقرير الاستشارة القانونية (PDF)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تقرير منسق باللغة العربية جاهز للطباعة أو الحفظ بصيغة PDF
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              <span>حفظ PDF / طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق المعاينة"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 print:overflow-visible print:p-0">
          {/* Official Letterhead */}
          <div className="flex items-start justify-between border-b border-slate-300 pb-5 dark:border-slate-700 print:border-slate-300">
            <div className="flex items-center gap-3">
              <svg
                viewBox="0 0 32 32"
                fill="none"
                className="h-9 w-9 text-teal-700 dark:text-teal-400 print:text-teal-800"
                aria-hidden="true"
              >
                <path
                  d="M16 4V26M10 26H22M6 10H26"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M6 10L3.5 17.5C4.8 18.8 7.2 18.8 8.5 17.5L6 10ZM26 10L23.5 17.5C24.8 18.8 27.2 18.8 28.5 17.5L26 10Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <h1 className="font-display text-xl font-bold">
                  منصة اعرف حقك — تقرير استشارة قانونية
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 print:text-slate-600">
                  التشريعات والقوانين السارية في جمهورية مصر العربية
                </p>
              </div>
            </div>
            <div className="text-left text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
              <div>تاريخ الإصدار: {formattedDate}</div>
              {assistantMessage.meta?.matchedDomain && (
                <div className="mt-1 font-medium text-teal-700 dark:text-teal-400 print:text-teal-800">
                  التصنيف: {assistantMessage.meta.matchedDomain}
                </div>
              )}
            </div>
          </div>

          {/* User Query Summary */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 print:border-slate-200 print:bg-slate-50">
            <h3 className="font-display text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600">
              ملخص الواقعة / الاستفسار
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-900 dark:text-slate-100 print:text-slate-900">
              {userQuestion}
            </p>
          </section>

          {/* AI Legal Consultation Body */}
          <section className="prose prose-slate max-w-none text-sm leading-loose dark:prose-invert print:prose-slate">
            <ReactMarkdown>{assistantMessage.content}</ReactMarkdown>
          </section>

          {/* Grounded Statutory Citations */}
          {assistantMessage.meta?.retrievedArticles &&
            assistantMessage.meta.retrievedArticles.length > 0 && (
              <section className="border-t border-slate-200 pt-5 dark:border-slate-800 print:border-slate-300">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
                  النصوص القانونية المصرية المرجعية المستند إليها
                </h3>
                <div className="mt-3 space-y-3">
                  {assistantMessage.meta.retrievedArticles.map((art) => (
                    <div
                      key={art.id}
                      className="rounded-lg border border-slate-200 p-3.5 text-xs dark:border-slate-800 print:border-slate-300"
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">
                        {art.lawName} ({art.lawNumber}) · {art.articleNumber} — {art.title}
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-700 dark:text-slate-300 print:text-slate-700">
                        «{art.officialText}»
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Footer Disclaimer */}
          <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 print:border-slate-300 print:text-slate-600">
            تم إعداد هذا التقرير عبر منصة «اعرف حقك» لأغراض التوعية والتوجيه القانوني وفق القوانين المصرية السارية، ولا يغني عن الاستعانة بمحامٍ مقيد أمام المحاكم المختصة لمباشرة الإجراءات القضائية الفعلية.
          </footer>
        </div>
      </div>
    </div>
  );
};
