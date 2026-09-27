import { useMemo, useState } from 'react';
import type { IsoDate, MealType, Person } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { checkRecipeForPerson } from '../../domain/rules';
import { defaultPortions, suggestCookDate } from '../../domain/plan';
import { newId, saveMeal } from '../../db/repo';
import { useApp } from '../context';
import { Badge, inputClass, Modal } from '../components';
import { fmtDay, fmtEur, fmtKcal, fmtOne } from '../format';
import { StorageBadge } from './RecipesScreen';

export function MealPicker({
  date,
  slot,
  persons,
  cookDays,
  onClose,
}: {
  date: IsoDate;
  slot: MealType;
  persons: Person[];
  cookDays: number[];
  onClose: () => void;
}) {
  const { db, recipeInfos, lookupIngredient } = useApp();
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const eaters = persons.filter((p) => p.mealSlots.includes(slot));
    return [...recipeInfos.values()]
      .filter((i) => i.recipe.mealTypes.includes(slot) && i.recipe.title.toLowerCase().includes(q))
      .map((i) => ({
        info: i,
        problems: eaters.flatMap((p) => checkRecipeForPerson(i.recipe, p, lookupIngredient)),
      }))
      .sort((a, b) => a.problems.length - b.problems.length || a.info.recipe.title.localeCompare(b.info.recipe.title, 'de'));
  }, [recipeInfos, slot, query, persons, lookupIngredient]);

  const choose = (recipeId: string) => {
    const recipe = recipeInfos.get(recipeId)?.recipe;
    if (!recipe) return;
    void saveMeal(db, {
      id: newId(),
      date,
      slot,
      recipeId,
      cookDate: suggestCookDate(date, recipe, cookDays),
      portions: defaultPortions(persons, slot),
      pinned: false,
    });
    onClose();
  };

  return (
    <Modal title={`${MEAL_TYPE_LABEL[slot]} am ${fmtDay(date)}`} onClose={onClose}>
      <input className={`${inputClass} w-full`} placeholder="Suchen …" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="mt-3 flex flex-col gap-2">
        {options.map(({ info, problems }) => (
          <li key={info.recipe.id}>
            <button
              type="button"
              onClick={() => choose(info.recipe.id)}
              className="w-full rounded-xl border border-stone-200 p-3 text-left hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{info.recipe.title}</span>
                <span className="text-sm text-stone-500">{fmtEur(info.eurPerPortion)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge>{fmtKcal(info.perPortion.kcal)}</Badge>
                <Badge>{fmtOne(info.perPortion.protein)} g P</Badge>
                <StorageBadge recipe={info.recipe} />
                {problems.length > 0 && <Badge tone="red">⚠ {problems[0]?.message}</Badge>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
