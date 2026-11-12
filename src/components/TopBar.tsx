import React from 'react';
import { LogIn, LogOut, Menu, Plus } from 'lucide-react';
import type { User } from 'firebase/auth';

export type WorkspaceTab = 'consult' | 'scanner' | 'drafter' | 'calculator' | 'hub';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onNewConsultation: () => void;
  onOpenMobileSidebar: () => void;
  user: User | null;
  authBusy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'consult', label: 'المستشار القانوني' },
  { id: 'scanner', label: 'فاحص العقود' },
  { id: 'drafter', label: 'محرر المستندات' },
  { id: 'calculator', label: 'حاسبة الحقوق' },
  { id: 'hub', label: 'القوانين والطوارئ' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onNewConsultation,
  onOpenMobileSidebar,
  user,
  authBusy,
  onSignIn,
  onSignOut,
}) => {
  const firstName = user?.displayName?.split(' ')[0] || 'حسابي';

  return (
    <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-amber-900/10 bg-[#FAF9F6]/95 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
      {/* Zone 1: Brand wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="فتح القائمة الجانبية"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('consult')}
          className="flex items-center gap-2.5 text-right whitespace-nowrap shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className="h-8 w-8 text-teal-700 dark:text-teal-400 shrink-0"
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
              stroke="#B45309"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-2xl font-bold tracking-normal text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0">
            اعرف حقك
          </span>
        </button>
      </div>

      {/* Zone 2: 5 concise single-line navigation links */}
      <nav className="hidden md:flex items-center gap-6" aria-label="التنقل الرئيسي">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-2 text-[15px] font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-teal-600 ${
                isActive
                  ? 'text-teal-800 dark:text-teal-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-gradient-to-l from-amber-600 to-teal-700 dark:from-amber-400 dark:to-teal-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Primary action + Google Sign-In / Sign-Out */}
      <div className="flex items-center gap-2.5 shrink-0">
        {user ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'صورة المستخدم'}
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                {firstName.slice(0, 1)}
              </span>
            )}
            <span className="hidden sm:inline text-sm font-semibold text-slate-800 dark:text-slate-100 max-w-[100px] truncate">
              {firstName}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              disabled={authBusy}
              title="تسجيل الخروج"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            disabled={authBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700/40 hover:bg-teal-50/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <LogIn className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <span>دخول بجوجل</span>
          </button>
        )}

        <button
          type="button"
          onClick={onNewConsultation}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">استشارة جديدة</span>
        </button>
      </div>
    </header>
  );
};
