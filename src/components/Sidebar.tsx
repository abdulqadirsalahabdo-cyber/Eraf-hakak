import React from 'react';
import {
  BookOpen,
  Calculator,
  Eraser,
  FileSearch,
  FileText,
  Lock,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  Trash2,
  Wind,
  X,
} from 'lucide-react';
import type { AutoDeleteOption, EmailUserProfile, SavedConsultation } from '../types/legal';
import type { WorkspaceTab } from './TopBar';

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  savedConsultations: SavedConsultation[];
  activeConsultationId: string | null;
  onLoadConsultation: (consultation: SavedConsultation) => void;
  onDeleteConsultation: (id: string) => void;
  onQuickPrompt: (prompt: string) => void;
  onOpenBreathing: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  autoDeleteOption: AutoDeleteOption;
  onChangeAutoDelete: (opt: AutoDeleteOption) => void;
  secondsUntilWipe: number | null;
  onInstantWipe: () => void;
  user: EmailUserProfile | null;
  authBusy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const QUICK_SCENARIOS = [
  {
    label: 'فصل تعسفي من العمل',
    prompt: 'تم فصلي من الشركة فجأة بدون سبب وبدون إخطار مسبق، ما هي حقوقي في قانون العمل المصري؟',
  },
  {
    label: 'نصب إلكتروني وتحويل فلوس',
    prompt: 'اتعرضت لنصب أونلاين وحولت فلوس على محفظة إلكترونية أو إنستاباي والشخص اختفى، أسترد حقي إزاي؟',
  },
  {
    label: 'تهديد بإيصال أمانة',
    prompt: 'أنا خايف جداً، شخص يهددني بإيصال أمانة وقّعته على بياض كضمان، ماذا أفعل الآن؟',
  },
  {
    label: 'ابتزاز أو تشهير إلكتروني',
    prompt: 'أتعرض للابتزاز والتهديد بنشر محادثات وصور خاصة على السوشيال ميديا، كيف أبلغ وأحمي نفسي؟',
  },
  {
    label: 'نزاع إيجار شقة',
    prompt: 'المالك يريد طردي من الشقة قبل انتهاء مدة عقد الإيجار ويرفض استلام الأجرة، ما الإجراء القانوني؟',
  },
  {
    label: 'نفقة وقائمة منقولات',
    prompt: 'ما هي خطوات رفع دعوى نفقة واسترداد قائمة المنقولات الزوجية أمام محكمة الأسرة؟',
  },
  {
    label: 'امتناع عن تسليم الميراث',
    prompt: 'أحد الورثة يمتنع عن تسليمي نصيبي الشرعي في الميراث ويخفي أوراق التركة، ما الحل القانوني في مصر؟',
  },
  {
    label: 'استرجاع منتج معيب',
    prompt: 'اشتريت جهازاً به عيب صناعة بعد 10 أيام والبائع يرفض الاسترجاع أو الاستبدال، ما حقي القانوني؟',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile,
  onCloseMobile,
  activeTab,
  onSelectTab,
  savedConsultations,
  activeConsultationId,
  onLoadConsultation,
  onDeleteConsultation,
  onQuickPrompt,
  onOpenBreathing,
  isDark,
  onToggleTheme,
  autoDeleteOption,
  onChangeAutoDelete,
  secondsUntilWipe,
  onInstantWipe,
  user,
  authBusy,
  onSignIn,
  onSignOut,
}) => {
  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const content = (
    <div className="flex h-full flex-col justify-between bg-[#FDFCFA] dark:bg-slate-900">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Account Card for Email OTP Profile */}
        <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/60">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                  {(user.displayName || user.email || 'م').slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                    {user.displayName || 'مستخدم مسجل'}
                  </div>
                  <div className="truncate text-[11px] text-teal-700 dark:text-teal-400" dir="ltr">
                    {user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                disabled={authBusy}
                aria-label="تسجيل الخروج"
                className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-slate-800 dark:hover:bg-teal-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>تسجيل الدخول بالبريد (OTP)</span>
            </button>
          )}
        </section>

        {/* Privacy & Auto-Delete Vault */}
        <section className="rounded-xl border border-teal-200/80 bg-teal-50/60 p-3.5 space-y-3 dark:border-teal-900/50 dark:bg-teal-950/25">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-teal-900 dark:text-teal-200">
              <Lock className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>بياناتك في أمان</span>
            </div>
            {secondsUntilWipe !== null && (
              <span className="font-mono tabular-nums text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                مسح خلال {formatCountdown(secondsUntilWipe)}
              </span>
            )}
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            خصوصية تامة: يمكنك تفعيل المسح التلقائي لجهازك في أي وقت أو حفظ استشاراتك عند تسجيل الدخول:
          </p>

          <select
            aria-label="توقيت المسح التلقائي للبيانات"
            value={autoDeleteOption}
            onChange={(e) => onChangeAutoDelete(e.target.value as AutoDeleteOption)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="15m">مسح تلقائي بعد 15 دقيقة</option>
            <option value="60m">مسح تلقائي بعد ساعة</option>
            <option value="close">مسح فوري عند إغلاق الصفحة</option>
            <option value="manual">حفظ الاستشارات (سحابي/محلي)</option>
          </select>

          <button
            type="button"
            onClick={onInstantWipe}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40 whitespace-nowrap"
          >
            <Eraser className="h-3.5 w-3.5 shrink-0" />
            <span>مسح فوري لكل البيانات الآن</span>
          </button>
        </section>

        {/* Mobile Navigation Links */}
        <div className="space-y-1 md:hidden">
          <p className="px-2 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            الأقسام والخدمات
          </p>
          {[
            { id: 'consult' as WorkspaceTab, label: 'المستشار القانوني', Icon: MessageSquare },
            { id: 'scanner' as WorkspaceTab, label: 'فاحص العقود', Icon: FileSearch },
            { id: 'drafter' as WorkspaceTab, label: 'محرر المستندات', Icon: FileText },
            { id: 'calculator' as WorkspaceTab, label: 'حاسبة الحقوق', Icon: Calculator },
            { id: 'hub' as WorkspaceTab, label: 'القوانين والطوارئ', Icon: BookOpen },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSelectTab(id);
                onCloseMobile();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Quick Egyptian Legal Starters */}
        <div>
          <h2 className="px-2 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            مشاكل واقعية متكررة في مصر
          </h2>
          <div className="space-y-1">
            {QUICK_SCENARIOS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onQuickPrompt(item.prompt);
                  onCloseMobile();
                }}
                className="w-full rounded-lg px-3 py-2 text-right text-sm text-slate-700 transition-colors hover:bg-teal-50/70 hover:text-teal-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 truncate"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Saved Consultations */}
        <div>
          <h2 className="px-2 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {user ? 'استشاراتي المحفوظة' : 'الجلسات الحالية'}
          </h2>
          {savedConsultations.length === 0 ? (
            <p className="px-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {user
                ? 'لا توجد استشارات محفوظة في حسابك بعد.'
                : autoDeleteOption === 'manual'
                ? 'لا توجد جلسات محفوظة بعد.'
                : 'وضع المسح التلقائي مفعّل؛ تُحذف الجلسات تلقائياً لحماية خصوصيتك.'}
            </p>
          ) : (
            <div className="space-y-1">
              {savedConsultations.map((item) => {
                const isActive = item.id === activeConsultationId;
                return (
                  <div
                    key={item.id}
                    className={`group flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 transition-colors ${
                      isActive
                        ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onLoadConsultation(item);
                        onCloseMobile();
                      }}
                      className="flex-1 text-right min-w-0"
                    >
                      <div className="truncate text-sm font-medium">{item.title}</div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {item.domain} · {new Date(item.updatedAt).toLocaleDateString('ar-EG')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConsultation(item.id);
                      }}
                      aria-label="حذف الاستشارة"
                      className="rounded p-1.5 text-slate-400 opacity-70 transition-opacity hover:bg-slate-200 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-700 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Workspace Controls */}
      <div className="border-t border-slate-200 p-3 space-y-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onOpenBreathing();
            onCloseMobile();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <Wind className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>تمرين تهدئة وتنفس</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <span>{isDark ? 'الوضع النهاري الفاتح' : 'الوضع الليلي الداكن'}</span>
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 text-slate-600 shrink-0" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="no-print hidden lg:block w-[278px] shrink-0 border-l border-amber-900/10 dark:border-slate-800">
        {content}
      </aside>

      {isOpenMobile && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-76 max-w-[85vw] flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <span className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                الأمان والقائمة
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="إغلاق القائمة"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{content}</div>
          </aside>
        </div>
      )}
    </>
  );
};
