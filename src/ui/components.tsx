import type { ReactNode } from 'react';

export function Screen({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 ${className}`}>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm ${
        active
          ? 'border-green-700 bg-green-700 text-white'
          : 'border-stone-300 text-stone-700 dark:border-stone-700 dark:text-stone-300'
      }`}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const styles = {
    primary: 'bg-green-700 text-white hover:bg-green-800',
    secondary:
      'border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800',
    danger:
      'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles}`}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-stone-600 dark:text-stone-400">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'rounded-xl border border-stone-300 bg-white px-3 py-2 text-base dark:border-stone-700 dark:bg-stone-950';

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={inputClass}
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

/** Balken für einen Zielwert: min allein = Mindestwert, min+max = Zielbereich */
export function ProgressBar({ label, value, min, max }: { label: string; value: number; min: number; max?: number }) {
  const target = max ?? min;
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const ok = value >= min && (max === undefined || value <= max);
  const goal = max !== undefined ? `${Math.round(min)}–${Math.round(max)}` : `≥ ${Math.round(min)}`;
  return (
    <div className="text-xs">
      <div className="flex justify-between">
        <span>{label}</span>
        <span>
          {Math.round(value)} / {goal}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-stone-200 dark:bg-stone-800">
        <div className={`h-2 rounded-full ${ok ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-stone-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'stone' }: { children: ReactNode; tone?: 'stone' | 'green' | 'amber' | 'red' }) {
  const t = {
    stone: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${t}`}>{children}</span>;
}
