import { addDays, startOfWeek, todayLocal } from '../domain/dates';
import { fmtDay } from './format';

export function WeekNav({ weekStart, onChange }: { weekStart: string; onChange: (weekStart: string) => void }) {
  const isCurrent = weekStart === startOfWeek(todayLocal());
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 text-sm shadow-sm dark:bg-stone-900">
      <button type="button" className="rounded-xl px-3 py-1" aria-label="Vorige Woche" onClick={() => onChange(addDays(weekStart, -7))}>
        ‹
      </button>
      <button type="button" className="font-medium" onClick={() => onChange(startOfWeek(todayLocal()))}>
        {fmtDay(weekStart)} – {fmtDay(addDays(weekStart, 6))}
        {isCurrent ? ' · diese Woche' : ''}
      </button>
      <button type="button" className="rounded-xl px-3 py-1" aria-label="Nächste Woche" onClick={() => onChange(addDays(weekStart, 7))}>
        ›
      </button>
    </div>
  );
}
