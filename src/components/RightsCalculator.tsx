import React, { useMemo, useState } from 'react';
import { Calculator, CalendarClock, MessageSquare, Scale } from 'lucide-react';

interface RightsCalculatorProps {
  onDiscussInChat: (prompt: string) => void;
}

type CalcMode = 'labor' | 'deadlines' | 'family';

const DEADLINE_RULES = [
  {
    id: 'labor-office',
    label: 'التقدم لمكتب العمل في الفصل التعسفي',
    days: 10,
    law: 'قانون العمل رقم 12 لسنة 2003 (مادة 70)',
    note: 'يفضل التقدم بطلب التسوية لمكتب العمل المختص خلال 10 أيام من قرار الفصل لضمان سرعة الإحالة للمحكمة العمالية.',
  },
  {
    id: 'consumer-14',
    label: 'استرجاع أو استبدال سلعة سليمة دون سبب',
    days: 14,
    law: 'قانون حماية المستهلك رقم 181 لسنة 2018 (مادة 17)',
    note: 'يحق لك استرداد ثمن السلعة كاملاً خلال 14 يوماً من تاريخ الاستلام بشرط وجود الفاتورة وسلامة المنتج.',
  },
  {
    id: 'consumer-30',
    label: 'استرجاع سلعة بها عيب صناعة أو غير مطابقة',
    days: 30,
    law: 'قانون حماية المستهلك رقم 181 لسنة 2018 (مادة 21)',
    note: 'في حال وجود عيب صناعة تمتد المهلة إلى 30 يوماً، مع حق الشكوى للخط الساخن 19588.',
  },
  {
    id: 'resignation-undo',
    label: 'العدول عن الاستقالة المكتوبة',
    days: 7,
    law: 'قانون العمل رقم 12 لسنة 2003 (مادة 119)',
    note: 'يجوز للعامل العدول كتابةً عن استقالته خلال 7 أيام من تاريخ إخطار صاحب العمل بقبولها.',
  },
  {
    id: 'labor-lawsuit',
    label: 'تقادم الدعوى العمالية (المطالبة بالتعويض)',
    days: 365,
    law: 'القانون المدني المصري (مادة 698)',
    note: 'تسقط الدعاوى الناشئة عن عقد العمل بانقضاء سنة من وقت انتهاء العقد.',
  },
];

export const RightsCalculator: React.FC<RightsCalculatorProps> = ({ onDiscussInChat }) => {
  const [mode, setMode] = useState<CalcMode>('labor');

  // 1. Labor Compensation Inputs
  const [monthlySalary, setMonthlySalary] = useState<string>('12000');
  const [serviceYears, setServiceYears] = useState<string>('4');
  const [unusedLeaveDays, setUnusedLeaveDays] = useState<string>('18');
  const [noticeGiven, setNoticeGiven] = useState<boolean>(false);

  // 2. Deadlines Inputs
  const [deadlineId, setDeadlineId] = useState(DEADLINE_RULES[0].id);
  const [incidentDate, setIncidentDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  });

  // 3. Family Alimony Guide Inputs
  const [fatherIncome, setFatherIncome] = useState<string>('15000');
  const [childrenCount, setChildrenCount] = useState<string>('2');
  const [includesRent, setIncludesRent] = useState<boolean>(true);

  const laborCalc = useMemo(() => {
    const salary = Math.max(0, Number(monthlySalary) || 0);
    const years = Math.max(0, Number(serviceYears) || 0);
    const leaveDays = Math.max(0, Number(unusedLeaveDays) || 0);

    // Art. 122: minimum 2 months gross salary per year of service
    const wrongfulTerminationMin = salary * 2 * years;
    // Art. 111: 2 months notice if <= 10 years, 3 months if > 10 years
    const requiredNoticeMonths = years > 10 ? 3 : 2;
    const noticeCompensation = noticeGiven ? 0 : salary * requiredNoticeMonths;
    // Art. 48: daily wage = salary / 30
    const leaveCompensation = Math.round((salary / 30) * leaveDays);
    const total = wrongfulTerminationMin + noticeCompensation + leaveCompensation;

    return {
      wrongfulTerminationMin,
      requiredNoticeMonths,
      noticeCompensation,
      leaveCompensation,
      total,
    };
  }, [monthlySalary, serviceYears, unusedLeaveDays, noticeGiven]);

  const deadlineCalc = useMemo(() => {
    const rule = DEADLINE_RULES.find((r) => r.id === deadlineId) ?? DEADLINE_RULES[0];
    const start = new Date(incidentDate);
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + rule.days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { rule, expiry, diffDays };
  }, [deadlineId, incidentDate]);

  const familyCalc = useMemo(() => {
    const income = Math.max(0, Number(fatherIncome) || 0);
    const kids = Math.max(0, Number(childrenCount) || 0);
    // Practical Egyptian family court guide: ~25%-40% of net verified income depending on dependents + housing
    const baseRatio = Math.min(0.45, 0.22 + kids * 0.06);
    const estimatedMonthlyAlimony = Math.round(income * baseRatio);
    const estimatedHousingAllowance = includesRent ? Math.round(income * 0.12) : 0;
    return {
      estimatedMonthlyAlimony,
      estimatedHousingAllowance,
      totalMonthly: estimatedMonthlyAlimony + estimatedHousingAllowance,
    };
  }, [fatherIncome, childrenCount, includesRent]);

  const formatEgp = (val: number) =>
    `${new Intl.NumberFormat('ar-EG').format(Math.round(val))} ج.م`;

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            حاسبات رقمية وفق التشريعات المصرية السارية
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
            حاسبة الحقوق والمستحقات والمواعيد القانونية
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            احسب تقديراً فورياً لتعويض الفصل التعسفي، رصيد الإجازات، الأيام المتبقية في المواعيد القانونية الحرجة، أو مؤشر النفقة الشهرية.
          </p>
        </div>

        {/* Segmented Calculator Mode Switcher */}
        <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMode('labor')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'labor'
                ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>تعويض الفصل التعسفي</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('deadlines')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'deadlines'
                ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <CalendarClock className="h-4 w-4" />
            <span>حاسبة المواعيد والتقادم</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('family')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'family'
                ? 'bg-white text-teal-800 shadow-xs dark:bg-slate-800 dark:text-teal-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Scale className="h-4 w-4" />
            <span>مؤشر النفقة الاسترشادي</span>
          </button>
        </div>

        {/* 1. Labor Compensation Calculator */}
        {mode === 'labor' && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                بيانات علاقة العمل
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  الأجر الشامل الشهري (جنيه مصري)
                </label>
                <input
                  type="number"
                  min={0}
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  className="font-mono tabular-nums w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    سنوات الخدمة
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={serviceYears}
                    onChange={(e) => setServiceYears(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    رصيد الإجازات المتبقي (أيام)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={unusedLeaveDays}
                    onChange={(e) => setUnusedLeaveDays(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noticeGiven}
                  onChange={(e) => setNoticeGiven(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>تم إخطاري مسبقاً بمهلة الإخطار القانونية ({laborCalc.requiredNoticeMonths} أشهر)</span>
              </label>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    قانون العمل المصري رقم 12 لسنة 2003
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    إجمالي المستحقات التقديرية (الحد الأدنى)
                  </h2>
                </div>
                <div className="font-mono tabular-nums text-2xl font-bold text-teal-700 dark:text-teal-400">
                  {formatEgp(laborCalc.total)}
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      تعويض الفصل التعسفي (مادة 122)
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      بواقع أجر شهرين شاملين عن كل سنة خدمة كحد أدنى
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {formatEgp(laborCalc.wrongfulTerminationMin)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      بدل مهلة الإخطار (مادة 111)
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {noticeGiven
                        ? 'تم استيفاء مهلة الإخطار'
                        : `يعادل ${laborCalc.requiredNoticeMonths} أشهر أجر كامل`}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {formatEgp(laborCalc.noticeCompensation)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      مقابل رصيد الإجازات (مادة 48)
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      محتسب على أساس الأجر اليومي لعدد {unusedLeaveDays || 0} يوماً
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {formatEgp(laborCalc.leaveCompensation)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onDiscussInChat(
                      `حساباتي التقديرية في قانون العمل هي: راتب شامل ${monthlySalary} جنيه، مدة خدمة ${serviceYears} سنوات، ورصيد إجازات ${unusedLeaveDays} يوماً (إجمالي تقديري ${formatEgp(laborCalc.total)}). كيف أطالب بهذه المستحقات رسمياً؟`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>اطلب خطة المطالبة بهذه المستحقات</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Deadlines & Prescription Calculator */}
        {mode === 'deadlines' && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                اختر الإجراء وتاريخ الواقعة
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  الموعد القانوني المطلوب حسابه
                </label>
                <select
                  value={deadlineId}
                  onChange={(e) => setDeadlineId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {DEADLINE_RULES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.days} يوم)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاريخ حدوث الواقعة / الاستلام / الفصل
                </label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="font-mono tabular-nums w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {deadlineCalc.rule.law}
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    {deadlineCalc.rule.label}
                  </h2>
                </div>
                <div
                  className={`font-mono tabular-nums text-xl font-bold ${
                    deadlineCalc.diffDays < 0
                      ? 'text-red-700 dark:text-red-400'
                      : deadlineCalc.diffDays <= 5
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-teal-700 dark:text-teal-400'
                  }`}
                >
                  {deadlineCalc.diffDays < 0
                    ? `انتهت المهلة منذ ${Math.abs(deadlineCalc.diffDays)} يوماً`
                    : deadlineCalc.diffDays === 0
                    ? 'اليوم هو آخر موعد قانوني'
                    : `متبقي ${deadlineCalc.diffDays} يوماً`}
                </div>
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-300">
                آخر تاريخ مسموح به وفق القاعدة:{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {deadlineCalc.expiry.toLocaleDateString('ar-EG', {
                    dateStyle: 'full',
                  })}
                </strong>
              </div>

              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {deadlineCalc.rule.note}
              </p>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onDiscussInChat(
                      `بخصوص "${deadlineCalc.rule.label}" بتاريخ واقعة ${incidentDate}، ماذا أفعل عملياً الآن للحفاظ على حقي؟`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>اسأل المستشار عن هذا الموعد</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Family Alimony Guide */}
        {mode === 'family' && (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                مؤشرات الدخل والأسرة
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  صافي الدخل الشهري التقديري للزوج/الأب (جنيه)
                </label>
                <input
                  type="number"
                  min={0}
                  value={fatherIncome}
                  onChange={(e) => setFatherIncome(e.target.value)}
                  className="font-mono tabular-nums w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  عدد الأبناء في الحضانة
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(e.target.value)}
                  className="font-mono tabular-nums w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includesRent}
                  onChange={(e) => setIncludesRent(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>إضافة تقدير أجر مسكن حضانة (في حال عدم وجود تمكين)</span>
              </label>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    تقدير استرشادي وفق العرف القضائي بمحاكم الأسرة المصرية
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    متوسط النفقة الشهرية المتوقع
                  </h2>
                </div>
                <div className="font-mono tabular-nums text-2xl font-bold text-teal-700 dark:text-teal-400">
                  {formatEgp(familyCalc.totalMonthly)}
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-700 dark:text-slate-300">
                    نفقة المأكل والملبس (زوجية + صغار)
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatEgp(familyCalc.estimatedMonthlyAlimony)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-slate-700 dark:text-slate-300">
                    تقدير أجر مسكن الحضانة
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatEgp(familyCalc.estimatedHousingAllowance)}
                  </span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ملاحظة واقعية: التقدير النهائي يخضع لسلطة قاضي محكمة الأسرة بناءً على التحري الرسمي عن الدخل ومفردات المرتب، ويُضاف إليه مصروفات التعليم والعلاج بدعاوى مستقلة.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
