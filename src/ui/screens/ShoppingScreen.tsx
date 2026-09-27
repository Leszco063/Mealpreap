import { useState } from 'react';
import { CATEGORIES } from '../../domain/types';
import { CATEGORY_LABEL } from '../../domain/labels';
import { addDays, cookDayRanges, startOfWeek, todayLocal, weekDates } from '../../domain/dates';
import { buildShoppingList } from '../../domain/shopping';
import { useChecks, useHousehold, useMeals } from '../../db/hooks';
import { setChecked } from '../../db/repo';
import { useApp } from '../context';
import { Card, Chip, Screen } from '../components';
import { fmtDay, fmtEur, fmtGram } from '../format';
import { WeekNav } from '../WeekNav';

type Mode = 'woche' | 'kochtag' | 'tag';

export function ShoppingScreen() {
  const { db, lookupRecipe, lookupIngredient } = useApp();
  const household = useHousehold(db);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocal()));
  const [mode, setMode] = useState<Mode>('woche');
  const [rangeIdx, setRangeIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  const weekEnd = addDays(weekStart, 6);
  // Mahlzeiten großzügig laden: gekocht in dieser Woche, gegessen ggf. danach
  const meals = useMeals(db, weekStart, addDays(weekEnd, 7));
  const checks = useChecks(db, weekStart);

  if (!household) return null;

  const ranges = cookDayRanges(weekStart, household.cookDays);
  const days = weekDates(weekStart);
  const selectedRange = ranges[Math.min(rangeIdx, ranges.length - 1)];
  const selectedDay = days[dayIdx] ?? weekStart;
  const range =
    mode === 'woche'
      ? { from: weekStart, to: weekEnd }
      : mode === 'kochtag' && selectedRange
        ? { from: selectedRange.from, to: selectedRange.to }
        : { from: selectedDay, to: selectedDay };

  const list = buildShoppingList(meals, { lookupIngredient, lookupRecipe }, range);
  const buy = list.items.filter((i) => !i.pantryStaple);
  const staples = list.items.filter((i) => i.pantryStaple);
  const openEur = buy.filter((i) => !checks.get(i.ingredientId)).reduce((s, i) => s + (i.priceEur ?? 0), 0);

  return (
    <Screen title="Einkauf">
      <WeekNav weekStart={weekStart} onChange={setWeekStart} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip active={mode === 'woche'} onClick={() => setMode('woche')}>
          ganze Woche
        </Chip>
        <Chip active={mode === 'kochtag'} onClick={() => setMode('kochtag')}>
          pro Kochtag
        </Chip>
        <Chip active={mode === 'tag'} onClick={() => setMode('tag')}>
          pro Tag
        </Chip>
      </div>
      {mode === 'kochtag' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {ranges.map((r, idx) => (
            <Chip key={r.from} active={idx === Math.min(rangeIdx, ranges.length - 1)} onClick={() => setRangeIdx(idx)}>
              {r.cookDate ? `Kochtag ${fmtDay(r.cookDate)}` : 'bis zum 1. Kochtag'} ({fmtDay(r.from)}–{fmtDay(r.to)})
            </Chip>
          ))}
        </div>
      )}
      {mode === 'tag' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {days.map((d, idx) => (
            <Chip key={d} active={idx === dayIdx} onClick={() => setDayIdx(idx)}>
              {fmtDay(d)}
            </Chip>
          ))}
        </div>
      )}

      <Card className="mt-3">
        <div className="flex justify-between text-sm">
          <span>Summe</span>
          <span className="font-semibold">{fmtEur(list.totalEur)}</span>
        </div>
        <div className="flex justify-between text-xs text-stone-500">
          <span>noch offen</span>
          <span>{fmtEur(openEur)}</span>
        </div>
      </Card>

      {list.items.length === 0 && (
        <p className="mt-4 text-sm text-stone-500">Für diesen Zeitraum ist nichts eingeplant. Plane zuerst Gerichte in der Woche.</p>
      )}

      {CATEGORIES.map((cat) => {
        const items = buy.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-stone-500">{CATEGORY_LABEL[cat]}</h2>
            <Card className="flex flex-col divide-y divide-stone-100 p-0 dark:divide-stone-800">
              {items.map((i) => {
                const done = checks.get(i.ingredientId) ?? false;
                return (
                  <label key={i.ingredientId} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-green-700"
                      checked={done}
                      onChange={(e) => void setChecked(db, weekStart, i.ingredientId, e.target.checked)}
                    />
                    <span className={`flex-1 ${done ? 'text-stone-400 line-through' : ''}`}>
                      {i.name}
                      <span className="block text-xs text-stone-500">
                        {i.choice
                          ? i.choice.picks.map((p) => `${p.count}× ${fmtGram(p.sizeG)}`).join(' + ')
                          : 'kein Preis hinterlegt'}{' '}
                        · benötigt {fmtGram(i.neededG)}
                      </span>
                    </span>
                    <span className="text-sm">{i.priceEur !== null ? fmtEur(i.priceEur) : '–'}</span>
                  </label>
                );
              })}
            </Card>
          </section>
        );
      })}

      {staples.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-stone-500">Grundvorrat prüfen</h2>
          <p className="text-sm">{staples.map((s) => s.name).join(', ')}</p>
        </section>
      )}

      {list.warnings.length > 0 && (
        <section className="mt-4 text-xs text-amber-700 dark:text-amber-400">
          {list.warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </section>
      )}
    </Screen>
  );
}
