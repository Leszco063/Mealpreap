import { describe, expect, it } from 'vitest';
import { buildCatalog, type BuildInput } from './build';
import { CSV_COLUMNS } from './csv';
import type { BlsEntry } from '../bls/parse';

const bls: BlsEntry[] = [
  {
    code: 'C133000',
    name: 'Hafer Flocken',
    nameEn: 'Oat flakes',
    per100g: { kcal: 348, protein: 13.22, fat: 6.65, carbs: 53.3, fiber: 10.983, sugar: 1.06, salt: 0.005 },
    incomplete: false,
  },
  {
    code: 'M111200',
    name: 'Milch fettarm',
    nameEn: 'Milk',
    per100g: { kcal: 44, protein: 3.49, fat: 1.54, carbs: 3.86, fiber: 0, sugar: 3.86, salt: 0.088 },
    incomplete: false,
  },
  {
    code: 'X999999',
    name: 'Lückenhaft',
    nameEn: 'Gappy',
    per100g: { kcal: 10, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 0 },
    incomplete: true,
  },
];

const csv = [
  CSV_COLUMNS.join(';'),
  'haferflocken;Haferflocken;C133000;trockenware;;;500:0,69;2026-09-26;;gluten;;;;;;;;',
  'milch;Milch 1,5 %;M111200;kuehlregal;1,03;;1030:0,99;2026-09-26;animal|dairy;milk;;;;;;;;',
  'banane;Banane;;obst-gemuese;;120;1000:1,69;2026-09-26;;;;93;1,2;0,2;20;2;17;0',
].join('\n');

const oats = `
id: haferbrei
title: Haferbrei mit Banane
servings: 1
prepMinutes: 2
cookMinutes: 5
mealTypes: [breakfast]
storage: { kind: fresh }
ingredients:
  - { ingredient: haferflocken, amount: 60, unit: g }
  - { ingredient: milch, amount: 250, unit: ml }
  - { ingredient: banane, amount: 1, unit: stk }
steps:
  - Haferflocken in Milch aufkochen.
  - Banane in Scheiben darauf.
`;

function input(part: Partial<BuildInput> = {}): BuildInput {
  return {
    bls,
    ingredientsCsv: csv,
    recipeFiles: [{ fileName: 'haferbrei.yaml', text: oats }],
    lockedIds: [],
    retiredIds: [],
    ...part,
  };
}

describe('buildCatalog', () => {
  it('baut gültigen Katalog mit stabiler Version', () => {
    const r = buildCatalog(input());
    expect(r.errors).toEqual([]);
    expect(r.ids).toEqual(['rezept:haferbrei', 'zutat:banane', 'zutat:haferflocken', 'zutat:milch']);
    expect(r.catalog?.ingredients.map((i) => i.id)).toEqual(['banane', 'haferflocken', 'milch']);
    expect(r.catalog?.ingredients.find((i) => i.id === 'milch')?.per100g.protein).toBe(3.49);
    const recipe = r.catalog?.recipes[0];
    expect(recipe?.source).toBe('starter');
    expect(recipe?.ingredients[2]).toEqual({ ingredientId: 'banane', amount: 1, unit: 'stk' });
    expect(r.catalog?.version).toMatch(/^[0-9a-f]{12}$/);
    expect(buildCatalog(input()).catalog?.version).toBe(r.catalog?.version);
  });

  it('unbekannte Zutat, fehlendes Stückgewicht, Dateiname', () => {
    const bad = oats
      .replace('haferflocken, amount: 60', 'hafer, amount: 60')
      .replace('ingredient: milch, amount: 250, unit: ml', 'ingredient: haferflocken, amount: 1, unit: stk');
    const r = buildCatalog(input({ recipeFiles: [{ fileName: 'haferbrei.yaml', text: bad }, { fileName: 'falsch.yaml', text: oats }] }));
    expect(r.catalog).toBeNull();
    expect(r.errors).toEqual([
      'haferbrei.yaml: Zutat hafer gibt es nicht in ingredients.csv',
      'haferbrei.yaml: Haferflocken: Einheit stk nicht umrechenbar (pieceWeightG fehlt)',
      'falsch.yaml: Dateiname muss haferbrei.yaml lauten',
    ]);
  });

  it('Haltbarkeit über 5 Tage und Schemafehler', () => {
    const r = buildCatalog(
      input({ recipeFiles: [{ fileName: 'haferbrei.yaml', text: oats.replace('{ kind: fresh }', '{ kind: prep, fridgeDays: 6, freezable: false }') }] }),
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^haferbrei\.yaml: storage\.fridgeDays – /);
  });

  it('unplausible kcal pro Portion', () => {
    const r = buildCatalog(input({ recipeFiles: [{ fileName: 'haferbrei.yaml', text: oats.replace('amount: 60', 'amount: 5000') }] }));
    // 5000 g Hafer 17400 + 257,5 g Milch 113,3 + 120 g Banane 111,6 = 17624,9
    expect(r.errors).toEqual(['haferbrei.yaml: kcal pro Portion 17625 außerhalb 50–1500']);
  });

  it('Zutat: BLS-Code unbekannt/unvollständig, beides angegeben, Nährwerte unvollständig oder unplausibel, kein Preis', () => {
    const r = buildCatalog(
      input({
        recipeFiles: [],
        ingredientsCsv: [
          CSV_COLUMNS.join(';'),
          'a;A;Z000000;sonstiges;;;100:1;2026-09-26;;;;;;;;;;',
          'b;B;X999999;sonstiges;;;100:1;2026-09-26;;;;;;;;;;',
          'c;C;C133000;sonstiges;;;100:1;2026-09-26;;;;100;;;;;;',
          'd;D;;sonstiges;;;100:1;2026-09-26;;;;100;1;;;;;',
          'e;E;;sonstiges;;;100:1;2026-09-26;;;;500;1;1;1;0;0;0',
          'f;F;C133000;sonstiges;;;;2026-09-26;;;;;;;;;;',
          'f;F2;C133000;sonstiges;;;100:1;2026-09-26;;;;;;;;;;',
        ].join('\n'),
      }),
    );
    expect(r.errors).toEqual([
      'ingredients.csv Zeile 2 (a): BLS-Code Z000000 unbekannt',
      'ingredients.csv Zeile 3 (b): BLS-Eintrag X999999 ist unvollständig – anderen Code wählen oder Nährwerte selbst angeben',
      'ingredients.csv Zeile 4 (c): entweder blsCode oder eigene Nährwerte angeben, nicht beides',
      'ingredients.csv Zeile 5 (d): ohne blsCode müssen alle Nährwerte angegeben sein (kcal, protein, fat, carbs, fiber, sugar, salt)',
      'ingredients.csv Zeile 6 (e): Nährwerte pro 100 g unplausibel (kcal 500, berechnet 17)',
      'ingredients.csv Zeile 7 (f): keine Packung mit Preis angegeben',
      'ingredients.csv Zeile 8 (f): ID doppelt',
    ]);
  });

  it('entfernte IDs nur über retired-ids.txt', () => {
    const locked = ['zutat:haferflocken', 'zutat:alt', 'rezept:haferbrei'];
    expect(buildCatalog(input({ lockedIds: locked })).errors).toEqual([
      'ID zutat:alt wurde entfernt – in catalog/retired-ids.txt eintragen, falls das Absicht ist',
    ]);
    expect(buildCatalog(input({ lockedIds: locked, retiredIds: ['zutat:alt'] })).errors).toEqual([]);
    expect(buildCatalog(input({ retiredIds: ['zutat:milch'] })).errors).toEqual([
      'ID zutat:milch steht in retired-ids.txt, wird aber noch benutzt',
    ]);
  });

  it('YAML-Syntaxfehler', () => {
    const r = buildCatalog(input({ recipeFiles: [{ fileName: 'x.yaml', text: 'id: [kaputt' }] }));
    expect(r.errors[0]).toMatch(/^x\.yaml: YAML-Fehler – /);
  });
});
