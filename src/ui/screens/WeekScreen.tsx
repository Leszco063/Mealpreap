import { useState } from 'react';
import { MEAL_TYPES, type IsoDate, type MealType } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { addDays, isoWeekday, startOfWeek, todayLocal, weekDates } from '../../domain/dates';
import { dayNutrition } from '../../domain/plan';
import { checkMeal } from '../../domain/rules';
import { buildShoppingList } from '../../domain/shopping';
import { useHousehold, useMeals, usePersons } from '../../db/hooks';
import { deleteMeal, saveMeal } from '../../db/repo';
import type { HouseholdDoc, MealDoc, PersonDoc } from '../../db/types';
import { useApp } from '../context';
import { go } from '../router';
import { Badge, Button, Card, ProgressBar, Screen } from '../components';
import { fmtDay, fmtEur, fmtNum } from '../format';
import { WeekNav } from '../WeekNav';
import { MealPicker } from './MealPicker';

function MealRow({ meal, persons, household }: { meal: MealDoc; persons: PersonDoc[]; household: HouseholdDoc }) {
  const { db, lookupRecipe, lookupIngredient } = useApp();
  const recipe = lookupRecipe(meal.recipeId);
  const violations = checkMeal(meal, { lookupIngredient, lookupRecipe, persons, cookWeekdays: household.cookDays });

  const changePortion = (personId: string, delta: number) => {
    const next = Math.max(0, Math.round(((meal.portions[personId] ?? 0) + delta) * 4) / 4);
    const portions = { ...meal.portions, [personId]: next };
    if (next === 0) delete portions[personId];
    void saveMeal(db, { ...meal, portions });
  };

  return (
    <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="text-left font-medium hover:underline" onClick={() => go(`rezepte/${meal.recipeId}`)}>
          {recipe?.title ?? 'Rezept nicht mehr verfügbar'}
        </button>
        <button type="button" aria-label="Mahlzeit entfernen" className="text-stone-400 hover:text-red-600" onClick={() => void deleteMeal(db, meal.id)}>
          ✕
        </button>
      </div>
      {meal.cookDate !== meal.date && <p className="text-xs text-stone-500">vorgekocht am {fmtDay(meal.cookDate)}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {persons.map((p) => (
          <div key={p.id} className="flex items-center gap-1 text-sm">
            <span className="text-stone-600 dark:text-stone-400">{p.name}</span>
            <button type="button" className="h-7 w-7 rounded-full border" aria-label={`${p.name} weniger`} onClick={() => changePortion(p.id, -0.25)}>
              −
            </button>
            <span className="w-9 text-center">{fmtNum(meal.portions[p.id] ?? 0)}</span>
            <button type="button" className="h-7 w-7 rounded-full border" aria-label={`${p.name} mehr`} onClick={() => changePortion(p.id, 0.25)}>
              +
            </button>
          </div>
        ))}
      </div>
      {violations.map((v, idx) => (
        <p key={idx} className="mt-1 text-xs text-red-700 dark:text-red-400">
          ⚠ {v.message}
        </p>
      ))}
    </div>
  );
}

export function WeekScreen() {
  const { db, lookupRecipe, lookupIngredient } = useApp();
  const household = useHousehold(db);
  const persons = usePersons(db);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocal()));
  const weekEnd = addDays(weekStart, 6);
  const meals = useMeals(db, weekStart, weekEnd);
  const [picker, setPicker] = useState<{ date: IsoDate; slot: MealType } | null>(null);

  if (!household) return null;

  if (persons.length === 0) {
    return (
      <Screen title="Woche">
        <Card>
          <p>Lege zuerst im Bereich „Haushalt“ mindestens eine Person mit ihren Zielen an.</p>
          <div className="mt-3">
            <Button onClick={() => go('haushalt')}>Zum Haushalt</Button>
          </div>
        </Card>
      </Screen>
    );
  }

  const slots = MEAL_TYPES.filter((m) => persons.some((p) => p.mealSlots.includes(m)));
  const shopping = buildShoppingList(meals, { lookupIngredient, lookupRecipe }, { from: weekStart, to: weekEnd });
  const budgetOk = shopping.totalEur <= household.weeklyBudgetEur;

  return (
    <Screen title="Woche">
      <WeekNav weekStart={weekStart} onChange={setWeekStart} />

      <Card className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <span>Einkauf diese Woche</span>
          <span className={budgetOk ? '' : 'font-semibold text-amber-700 dark:text-amber-400'}>
            {fmtEur(shopping.totalEur)} von {fmtEur(household.weeklyBudgetEur)}
          </span>
        </div>
      </Card>

      <div className="mt-3 flex flex-col gap-3">
        {weekDates(weekStart).map((date) => {
          const isCookDay = household.cookDays.includes(isoWeekday(date));
          return (
            <Card key={date}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-semibold">{fmtDay(date)}</h2>
                {isCookDay && <Badge tone="green">Kochtag</Badge>}
                {date === todayLocal() && <Badge>heute</Badge>}
              </div>
              <div className="flex flex-col gap-3">
                {slots.map((slot) => (
                  <div key={slot}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm text-stone-500">{MEAL_TYPE_LABEL[slot]}</h3>
                      <button type="button" className="text-sm text-green-700 dark:text-green-400" onClick={() => setPicker({ date, slot })}>
                        + Gericht
                      </button>
                    </div>
                    <div className="mt-1 flex flex-col gap-2">
                      {meals
                        .filter((m) => m.date === date && m.slot === slot)
                        .map((m) => (
                          <MealRow key={m.id} meal={m} persons={persons} household={household} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 border-t border-stone-100 pt-3 dark:border-stone-800 sm:grid-cols-2">
                {persons.map((p) => {
                  const n = dayNutrition(meals, date, p.id, { lookupRecipe, lookupIngredient });
                  return (
                    <div key={p.id} className="flex flex-col gap-1">
                      <span className="text-xs font-medium">{p.name}</span>
                      <ProgressBar label="kcal" value={n.kcal} min={p.targets.kcal * 0.9} max={p.targets.kcal * 1.1} />
                      <ProgressBar label="Protein (g)" value={n.protein} min={p.targets.proteinMin} />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {picker && (
        <MealPicker date={picker.date} slot={picker.slot} persons={persons} cookDays={household.cookDays} onClose={() => setPicker(null)} />
      )}
    </Screen>
  );
}
