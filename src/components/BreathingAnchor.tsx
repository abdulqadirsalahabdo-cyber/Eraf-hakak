import React, { useEffect, useState } from 'react';
import { Wind, X } from 'lucide-react';

interface BreathingAnchorProps {
  onClose?: () => void;
  compact?: boolean;
}

type Phase = 'inhale' | 'hold' | 'exhale';

const PHASE_CONFIG: Record<Phase, { label: string; seconds: number; next: Phase; hint: string }> = {
  inhale: {
    label: 'شهيق عميق من الأنف',
    seconds: 4,
    next: 'hold',
    hint: 'املأ رئتيك بالهواء بهدوء',
  },
  hold: {
    label: 'احتباس هادئ للنفس',
    seconds: 7,
    next: 'exhale',
    hint: 'أرخِ كتفيك ولا تتعجل',
  },
  exhale: {
    label: 'زفير بطيء من الفم',
    seconds: 8,
    next: 'inhale',
    hint: 'اترك التوتر يخرج مع الزفير',
  },
};

export const BreathingAnchor: React.FC<BreathingAnchorProps> = ({ onClose, compact = false }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        setPhase((currentPhase) => {
          const nextPhase = PHASE_CONFIG[currentPhase].next;
          setSecondsLeft(PHASE_CONFIG[nextPhase].seconds);
          return nextPhase;
        });
        return 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const current = PHASE_CONFIG[phase];

  const handleToggle = () => {
    if (isRunning) {
      setIsRunning(false);
      setPhase('inhale');
      setSecondsLeft(4);
    } else {
      setPhase('inhale');
      setSecondsLeft(4);
      setIsRunning(true);
    }
  };

  return (
    <div
      className={`rounded-xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900/60 dark:bg-teal-950/30 ${
        compact ? '' : 'shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              خذ نفساً عميقاً قبل قراءة الخطوات القانونية
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              عند التوتر أو الخوف يصبح التفكير أصعب. تمرين التنفس (4-7-8) يساعدك على استعادة هدوئك خلال ثوانٍ.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق التمرين"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-teal-200/70 pt-3 dark:border-teal-900/50">
        {isRunning ? (
          <div className="flex items-center gap-3">
            <span className="font-mono tabular-nums text-2xl font-bold text-teal-700 dark:text-teal-300">
              {secondsLeft}s
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {current.label}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">{current.hint}</div>
            </div>
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            دورة تنفس هادئة لمدة 19 ثانية
          </span>
        )}

        <button
          type="button"
          onClick={handleToggle}
          className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap"
        >
          {isRunning ? 'إيقاف التمرين' : 'ابدأ التنفس الآن'}
        </button>
      </div>
    </div>
  );
};
