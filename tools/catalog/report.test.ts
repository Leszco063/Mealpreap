import { describe, expect, it } from 'vitest';
import { formatReport, recipeReport, summarize } from './report';
import { allIngredients, chili, lachsPfanne, overnightOats } from '../../src/domain/fixtures.test-data';
import type { Catalog } from '../../src/domain/types';

const catalog: Catalog = { version: 'test', ingredients: allIngredients, recipes: [overnightOats, chili, lachsPfanne] };

describe('recipeReport', () => {
  const rows = recipeReport(catalog);

  it('eine Zeile pro Rezept mit Nährwerten und Preis', () => {
    const oats = rows.find((r) => r.id === 'overnight-oats');
    expect(oats).toMatchObject({
      title: 'Overnight Oats mit Quark',
      storage: 'prep 2 T.',
      servings: 1,
      minutes: 5,
      diets: ['omnivore', 'pescetarian', 'vegetarian'],
    });
    expect(oats?.kcal).toBeCloseTo(318.32, 1);
    expect(oats?.eurPerPortion).toBeCloseTo(0.555, 3);
  });

  it('markiert Ausreißer', () => {
    // Chili-Fixture: 318 kcal pro Portion als Mittag-/Abendessen → unter 450
    expect(rows.find((r) => r.id === 'chili')?.flags).toEqual(['kcal<Ziel']);
    // Lachs: (250 g × 1,80 + 13,8 g Öl × 8,99) / 2 = 287 kcal → unter 450; 2,31 €/Portion unauffällig
    expect(rows.find((r) => r.id === 'lachs-pfanne')?.flags).toEqual(['kcal<Ziel']);
    // Oats: 318 kcal im Frühstücksbereich, 0,56 €, 1 Portion bei 2 Tagen → keine Hinweise
    expect(rows.find((r) => r.id === 'overnight-oats')?.flags).toEqual([]);
  });

  it('Zusammenfassung', () => {
    expect(summarize(rows)).toEqual({
      recipes: 3,
      byMealType: { breakfast: 1, lunch: 1, dinner: 2, snack: 0 },
      prep: 2,
      fresh: 1,
      vegetarian: 1,
      vegan: 0,
      flagged: 2,
    });
  });

  it('Markdown-Tabelle enthält Kopf und eine Zeile pro Rezept', () => {
    const md = formatReport(rows, summarize(rows));
    expect(md).toContain('| Rezept | Mahlzeit | Lagerung | Port. | Min. | kcal | P | F | KH | €/Port. | Hinweise |');
    expect(md).toContain('| Overnight Oats mit Quark | Frühstück | prep 2 T. | 1 | 5 | 318 | 28,1 | 5,2 | 36,2 | 0,56 |  |');
    expect(md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Rezept') && !l.startsWith('| ---'))).toHaveLength(3);
  });
});
