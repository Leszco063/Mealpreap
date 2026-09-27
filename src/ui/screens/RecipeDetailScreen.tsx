import { useState } from 'react';
import { NUTRIENT_KEYS, type NutrientKey } from '../../domain/types';
import { MEAL_TYPE_LABEL } from '../../domain/labels';
import { recipeGrams } from '../../domain/recipe';
import { recipeTotals, scaleNutrients } from '../../domain/nutrition';
import { useApp } from '../context';
import { go } from '../router';
import { Badge, Button, Card, Screen } from '../components';
import { fmtAmount, fmtEur, fmtNum, fmtOne } from '../format';
import { StorageBadge } from './RecipesScreen';

const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  kcal: 'Energie (kcal)',
  protein: 'Eiweiß (g)',
  fat: 'Fett (g)',
  carbs: 'Kohlenhydrate (g)',
  fiber: 'Ballaststoffe (g)',
  sugar: 'davon Zucker (g)',
  salt: 'Salz (g)',
};

export function RecipeDetailScreen({ id }: { id: string }) {
  const { recipeInfos, lookupIngredient } = useApp();
  const info = recipeInfos.get(id);
  const [servings, setServings] = useState(info?.recipe.servings ?? 1);

  if (!info) {
    return (
      <Screen title="Rezept nicht gefunden">
        <Button onClick={() => go('rezepte')}>Zur Rezeptliste</Button>
      </Screen>
    );
  }

  const r = info.recipe;
  const factor = servings / r.servings;
  const totalGrams = recipeGrams(r, lookupIngredient).reduce((sum, g) => sum + g.grams, 0);
  const per100 = scaleNutrients(recipeTotals(r, lookupIngredient), totalGrams > 0 ? 100 / totalGrams : 0);

  return (
    <Screen
      title={r.title}
      actions={
        <Button variant="secondary" onClick={() => go('rezepte')}>
          Zurück
        </Button>
      }
    >
      <p className="text-stone-600 dark:text-stone-400">{r.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StorageBadge recipe={r} />
        <Badge>{info.minutes} Min.</Badge>
        <Badge>{fmtEur(info.eurPerPortion)} pro Portion</Badge>
        {r.mealTypes.map((m) => (
          <Badge key={m}>{MEAL_TYPE_LABEL[m]}</Badge>
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Zutaten</h2>
          <div className="flex items-center gap-2 text-sm">
            <button type="button" className="h-8 w-8 rounded-full border" aria-label="Weniger Portionen" onClick={() => setServings(Math.max(1, servings - 1))}>
              −
            </button>
            <span>{servings} Portionen</span>
            <button type="button" className="h-8 w-8 rounded-full border" aria-label="Mehr Portionen" onClick={() => setServings(servings + 1)}>
              +
            </button>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {r.ingredients.map((ri, idx) => {
            const ing = lookupIngredient(ri.ingredientId);
            return (
              <li key={idx} className="flex justify-between gap-2">
                <span>
                  {ing?.name ?? ri.ingredientId}
                  {ri.note ? <span className="text-stone-500"> ({ri.note})</span> : null}
                  {ri.optional ? <span className="text-stone-500"> – optional</span> : null}
                </span>
                <span className="shrink-0 text-stone-600 dark:text-stone-400">{fmtAmount(ri.amount * factor, ri.unit)}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">Zubereitung</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {r.steps.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ol>
      </Card>

      <Card className="mt-4">
        <h2 className="font-semibold">Nährwerte</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="font-normal"></th>
              <th className="text-right font-normal">pro Portion</th>
              <th className="text-right font-normal">pro 100 g</th>
            </tr>
          </thead>
          <tbody>
            {NUTRIENT_KEYS.map((k) => (
              <tr key={k} className="border-t border-stone-100 dark:border-stone-800">
                <td className="py-1">{NUTRIENT_LABEL[k]}</td>
                <td className="text-right">{k === 'kcal' ? Math.round(info.perPortion[k]) : fmtOne(info.perPortion[k])}</td>
                <td className="text-right">{k === 'kcal' ? Math.round(per100[k]) : fmtOne(per100[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-stone-500">
          Berechnet aus dem Bundeslebensmittelschlüssel; Portion = {fmtNum(totalGrams / r.servings)} g.
        </p>
      </Card>

      {r.sources && r.sources.length > 0 && (
        <p className="mt-4 text-xs text-stone-500">
          Inspiriert von:{' '}
          {r.sources.map((s, idx) => (
            <a key={s} href={s} target="_blank" rel="noreferrer" className="underline">
              {new URL(s).hostname.replace(/^www\./, '')}
              {idx < (r.sources?.length ?? 0) - 1 ? ', ' : ''}
            </a>
          ))}
        </p>
      )}
    </Screen>
  );
}
