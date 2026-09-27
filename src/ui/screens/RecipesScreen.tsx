import { useMemo, useState } from 'react';
import { MEAL_TYPES, type MealType, type Recipe } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { useApp } from '../context';
import { go } from '../router';
import { Badge, Card, Chip, inputClass, Screen } from '../components';
import { fmtEur, fmtKcal, fmtOne } from '../format';
import type { RecipeInfo } from '../recipeInfo';

export function StorageBadge({ recipe }: { recipe: Recipe }) {
  if (recipe.storage.kind === 'fresh') return <Badge tone="amber">frisch essen</Badge>;
  return (
    <Badge tone="green">
      vorkochbar · {recipe.storage.fridgeDays} Tage{recipe.storage.freezable ? ' · ❄' : ''}
    </Badge>
  );
}

export function RecipeCard({ info, onClick }: { info: RecipeInfo; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium">{info.recipe.title}</h3>
          <span className="shrink-0 text-sm text-stone-500">{fmtEur(info.eurPerPortion)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{fmtKcal(info.perPortion.kcal)}</Badge>
          <Badge>{fmtOne(info.perPortion.protein)} g Protein</Badge>
          <Badge>{info.minutes} Min.</Badge>
          <StorageBadge recipe={info.recipe} />
        </div>
      </Card>
    </button>
  );
}

export function RecipesScreen() {
  const { recipeInfos } = useApp();
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState<MealType | null>(null);
  const [prepOnly, setPrepOnly] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...recipeInfos.values()]
      .filter(
        (i) =>
          (!meal || i.recipe.mealTypes.includes(meal)) &&
          (!prepOnly || i.recipe.storage.kind === 'prep') &&
          (!vegOnly || i.diets.includes('vegetarian')) &&
          i.recipe.title.toLowerCase().includes(q),
      )
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title, 'de'));
  }, [recipeInfos, query, meal, prepOnly, vegOnly]);

  return (
    <Screen title="Rezepte">
      <input
        className={`${inputClass} w-full`}
        placeholder="Rezept suchen …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {MEAL_TYPES.map((m) => (
          <Chip key={m} active={meal === m} onClick={() => setMeal(meal === m ? null : m)}>
            {MEAL_TYPE_LABEL[m]}
          </Chip>
        ))}
        <Chip active={prepOnly} onClick={() => setPrepOnly(!prepOnly)}>
          vorkochbar
        </Chip>
        <Chip active={vegOnly} onClick={() => setVegOnly(!vegOnly)}>
          vegetarisch
        </Chip>
      </div>
      <p className="mt-3 text-sm text-stone-500">
        {list.length} {list.length === 1 ? 'Rezept' : 'Rezepte'}
      </p>
      <ul className="mt-2 flex flex-col gap-3">
        {list.map((i) => (
          <li key={i.recipe.id}>
            <RecipeCard info={i} onClick={() => go(`rezepte/${i.recipe.id}`)} />
          </li>
        ))}
      </ul>
    </Screen>
  );
}
