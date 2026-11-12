import React, { useState } from 'react';
import { BookOpen, BrainCircuit, PhoneCall, ShieldCheck } from 'lucide-react';
import type { HotlineEntry, LawArticle, PlatformInsights } from '../types/legal';
import { LawsDirectory } from './LawsDirectory';
import { HotlinesDirectory } from './HotlinesDirectory';

interface KnowledgeAndEmergencyHubProps {
  articles: LawArticle[];
  hotlines: HotlineEntry[];
  insights: PlatformInsights | null;
  loading: boolean;
  onAskAboutArticle: (article: LawArticle) => void;
}

type SubTab = 'laws' | 'hotlines' | 'learning';

export const KnowledgeAndEmergencyHub: React.FC<KnowledgeAndEmergencyHubProps> = ({
  articles,
  hotlines,
  insights,
  loading,
  onAskAboutArticle,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('laws');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sub-navigation bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setSubTab('laws')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'laws'
                  ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>دليل القوانين المصرية</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('hotlines')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'hotlines'
                  ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>الخطوط الساخنة والطوارئ</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('learning')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'learning'
                  ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              <span>سجل التعلّم ومنع الأخطاء</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Sub-View */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'laws' && (
          <LawsDirectory
            articles={articles}
            loading={loading}
            onAskAboutArticle={onAskAboutArticle}
          />
        )}

        {subTab === 'hotlines' && (
          <HotlinesDirectory hotlines={hotlines} loading={loading} />
        )}

        {subTab === 'learning' && (
          <div className="h-full overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                  التحسين المستمر دون المساس بالخصوصية
                </p>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
                  كيف تتعلّم المنصة من القضايا وتمنع تكرار الأخطاء؟
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  كل تصحيح أو ملاحظة يضيفها المستخدمون تُنقّح آلياً من أي أسماء أو أرقام هواتف أو أرقام قومية، وتتحول إلى «قاعدة وقاية قانونية» يسترشد بها المستشار في كل استشارة جديدة.
                </p>
              </div>

              {insights && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        استشارات تم تأكيد دقتها
                      </div>
                      <div className="mt-2 font-mono tabular-nums text-3xl font-bold text-teal-700 dark:text-teal-400">
                        {insights.totalVerifiedCases}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        قواعد وقاية متعلّمة من تصحيحات
                      </div>
                      <div className="mt-2 font-mono tabular-nums text-3xl font-bold text-amber-700 dark:text-amber-400">
                        {insights.totalCorrectionsLearned}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        حماية البيانات الشخصية
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                        <ShieldCheck className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                        <span>حذف تلقائي للهوية</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      أحدث قواعد الوقاية المطبّقة تلقائياً في الردود
                    </h2>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {insights.activeRules.map((rule) => (
                        <div key={rule.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div>
                              <span className="font-semibold text-teal-700 dark:text-teal-400">
                                {rule.domain}
                              </span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>
                                {rule.type === 'correction' ? 'قاعدة منع تكرار خطأ' : 'خبرة عملية موثقة'}
                              </span>
                            </div>
                            <span className="font-mono tabular-nums">
                              استُخدمت في {rule.hits} حالة
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {rule.patternSummary}
                          </div>
                          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {rule.preventionRule}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
