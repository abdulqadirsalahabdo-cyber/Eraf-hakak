import React, { useMemo, useState } from 'react';
import { BookOpen, MessageSquare, Search } from 'lucide-react';
import type { LawArticle, LegalDomainId } from '../types/legal';

interface LawsDirectoryProps {
  articles: LawArticle[];
  loading: boolean;
  onAskAboutArticle: (article: LawArticle) => void;
}

const DOMAIN_FILTERS: Array<{ id: 'all' | LegalDomainId; label: string }> = [
  { id: 'all', label: 'جميع القوانين' },
  { id: 'labor', label: 'العمل' },
  { id: 'civil', label: 'المدني' },
  { id: 'penal', label: 'العقوبات' },
  { id: 'cyber', label: 'جرائم الإنترنت' },
  { id: 'family', label: 'الأحوال الشخصية' },
  { id: 'rent', label: 'الإيجارات' },
  { id: 'consumer', label: 'حماية المستهلك' },
  { id: 'criminal_proc', label: 'الإجراءات الجنائية' },
];

export const LawsDirectory: React.FC<LawsDirectoryProps> = ({
  articles,
  loading,
  onAskAboutArticle,
}) => {
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState<'all' | LegalDomainId>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (domain !== 'all' && a.domain !== domain) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.lawName.toLowerCase().includes(q) ||
        a.articleNumber.toLowerCase().includes(q) ||
        a.officialText.toLowerCase().includes(q) ||
        a.plainSummary.toLowerCase().includes(q)
      );
    });
  }, [articles, domain, search]);

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            قاعدة المعرفة التشريعية الموثقة (RAG Grounding Corpus)
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
            دليل نصوص القوانين المصرية السارية
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            تصفح النصوص الرسمية للمواد القانونية التي يعتمد عليها المستشار الذكي في التحقق من حقوقك وتجنب أي أخطاء أو تأليف.
          </p>
        </div>

        {/* Search & Segmented Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم المادة، اسم القانون، أو كلمة مفتاحية (مثل: فصل تعسفي، إيصال أمانة، نفقة)..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
            {DOMAIN_FILTERS.map((f) => {
              const active = domain === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDomain(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Articles List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              لم يتم العثور على مواد مطابقة لبحثك.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDomain('all');
              }}
              className="mt-3 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400"
            >
              إعادة عرض جميع المواد
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((art) => (
              <article
                key={art.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>{art.lawName}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{art.lawNumber}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-semibold text-teal-700 dark:text-teal-400">
                        {art.articleNumber}
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      {art.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAskAboutArticle(art)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-teal-600/40 hover:bg-teal-50/50 hover:text-teal-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-teal-950/30 dark:hover:text-teal-300 whitespace-nowrap shrink-0"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>اسأل المستشار عن هذه المادة</span>
                  </button>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                  «{art.officialText}»
                </div>

                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    ماذا تعني لك؟{' '}
                  </span>
                  {art.plainSummary}
                </p>

                {art.prescriptionPeriod && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    تنبيه المواعيد والتقادم: {art.prescriptionPeriod}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
