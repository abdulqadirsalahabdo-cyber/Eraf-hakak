import React, { useState } from 'react';
import { Check, Copy, PhoneCall } from 'lucide-react';
import type { HotlineEntry } from '../types/legal';

interface HotlinesDirectoryProps {
  hotlines: HotlineEntry[];
  loading: boolean;
}

export const HotlinesDirectory: React.FC<HotlinesDirectoryProps> = ({
  hotlines,
  loading,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            الجهات الرسمية المعتمدة في جمهورية مصر العربية
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
            الخطوط الساخنة وجهات الشكاوى والطوارئ
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            أرقام مختصرة رسمية للتواصل الفوري مع جهات التحقيق، مباحث الإنترنت، حماية المستهلك، والدعم النفسي والمجتمعي في مصر.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {hotlines.map((hl) => (
                <div
                  key={hl.id}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>{hl.categoryAr}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{hl.availability}</span>
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      {hl.agency}
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {hl.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(hl.id, hl.number)}
                      aria-label={`نسخ رقم ${hl.agency}`}
                      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      {copiedId === hl.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>نُسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`tel:${hl.number}`}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
                    >
                      <PhoneCall className="h-4 w-4" />
                      <span className="font-mono tabular-nums">{hl.number}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
