# Stufe 1b – Katalog-Inhalte (Zutaten, Preise, ca. 100 Rezepte) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Startkatalog füllen: ca. 100 eigene, an seriösen Quellen orientierte Rezepte (Schwerpunkt Mealprep) mit BLS-Nährwerten, nachvollziehbaren Aldi-Süd-Richtpreisen und belegter Haltbarkeit.

**Architecture:** Ein kleines Werkzeug (`npm run catalog:report`) macht Nährwerte, Preise und Verteilung aller Rezepte sichtbar; der Build wird um drei Prüfungen erweitert (Quellenfeld, nur BLS-Zutaten in Startrezepten, falsche Dateiendung). Die Inhalte entstehen in Paketen je Rezeptgruppe; jedes Paket endet mit grünem Katalog-Build und Report-Kontrolle.

**Tech Stack:** wie Stufe 1a (TypeScript, tsx, zod, yaml, Vitest); Recherche per WebFetch/WebSearch.

**Spec:** `docs/superpowers/specs/2026-09-26-mealprep-planer-design.md` (§4 Datenquellen, §5.1 Katalog, §8 Katalog-Pipeline, §14 Rechtliches)

**Vorgänger:** Plan `2026-09-26-stufe1a-kern-und-katalog.md` (Branch `stufe1a-kern`). Dieser Plan arbeitet auf Branch `stufe1b-inhalte`, abgezweigt von `stufe1a-kern`.

## Global Constraints

- **Urheberrecht:** Zubereitungstexte, Beschreibungen und Titel werden selbst formuliert; aus fremden Rezepten werden nur Zutaten, Mengenverhältnisse und Garzeiten übernommen (nicht schutzfähig). Keine Bilder, keine Textpassagen kopieren. Jede Orientierungsquelle kommt als URL in `sources` des Rezepts.
- **Rezeptquellen (seriös, abrufbar):** eatsmarter.de, kitchenstories.com/de, lecker.de, essen-und-trinken.de, bzfe.de, dge.de, verbraucherzentrale.de. chefkoch.de ist für WebFetch gesperrt und wird nicht genutzt.
- **Nährwerte:** ausschließlich aus BLS (`blsCode` Pflicht für jede Zutat eines Startrezepts). Fehlt ein Lebensmittel im BLS, wird der nächstliegende BLS-Eintrag gewählt (z. B. „Skyr“ → Magerquark-Eintrag, wenn kein Skyr vorhanden) und das im Zutatennamen nicht verschleiert.
- **Plausibilitätsabgleich:** Nennt die Quelle kcal pro Portion, darf der berechnete Wert höchstens ±25 % abweichen; sonst Mengen/Portionen prüfen und die Abweichung im Commit erklären.
- **Preise:** Richtpreise aus dem Online-Sortiment von Aldi Süd (Kategorieseiten, Stand = Abrufdatum). Jede übernommene Preisangabe steht mit URL und Datum in `catalog/prices/2026-09-aldi-sued.csv`. Für Produkte ohne Online-Preis (v. a. frisches Obst/Gemüse): Schätzung auf Discounter-Niveau, in der Preisliste mit `quelle=schaetzung` markiert. Keine REWE/Kaufland/Netto-Abfragen (blockiert, 403).
- **Haltbarkeit (Quelle: Verbraucherzentrale „Meal Prep: Vorkochen und Abfälle vermeiden“ – max. 3–4 Tage; Fisch und rohe Salate 1–2 Tage):**
  | Gericht | storage |
  |---|---|
  | Eintopf, Suppe, Curry, Chili, Sauce, Gulasch, Auflauf ohne Fisch | `prep`, `fridgeDays: 4`, `freezable: true` |
  | Gerichte mit gekochtem Reis oder Nudeln, Geflügel-Gerichte | `prep`, `fridgeDays: 3` (freezable je nach Gericht) |
  | Fisch- und Meeresfrüchte-Gerichte, Salate mit rohem Gemüse (Dressing separat) | `prep`, `fridgeDays: 2`, `freezable: false` – oder `fresh` |
  | Overnight Oats, Chia-Pudding, Bircher | `prep`, `fridgeDays: 2`, `freezable: false` |
  | Hartgekochte Eier (ungeschält) | `prep`, `fridgeDays: 5`, `freezable: false` |
  | Rührei, Omelett, Pfannengerichte zum Sofortessen, Salat mit Dressing | `fresh` |
- **Mengen:** Portionen realistisch für Erwachsene (Hauptgericht 450–800 kcal, Frühstück 300–550, Snack 100–300). Salz, Pfeffer, Gewürze als Grundvorrat (`pantryStaple: ja`) oder weglassen und im Schritt „nach Geschmack würzen“ nennen.
- **IDs:** kebab-case, sprechend (`haehnchen-curry-reis`), nie ändern.
- **Sprache:** Deutsch, Du-Form in den Schritten, kurze Sätze.
- Git über das Bash-Tool; Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Dublettenzutaten:** dieselbe Zutat zweimal im Katalog unter verschiedenen IDs (z. B. `zwiebel` und `zwiebel-gelb`) verzerrt Einkaufsliste und Preise → Task 2 legt die Namensregeln fest, Task 10 prüft per Report auf gleiche BLS-Codes.
- **Portionsgröße vs. Haltbarkeit:** vorkochbare Gerichte mit `servings` > `fridgeDays` × Personen sind unpraktisch → Report zeigt beides nebeneinander; Task 10 prüft.
- **Einheiten „stk“ bei Gemüse ohne realistisches Stückgewicht** → Stückgewichte in Task 2 aus BLS-/Handelsangaben festlegen.
- **Preise pro Portion ausreißend** (z. B. 0,05 € oder 12 €) → Report-Grenzen in Task 1 markieren (< 0,30 € oder > 5 € pro Portion).
- **Allergene vergessen** (Senf, Sellerie, Sesam in Saucen/Brühen) → Task 2 Checkliste pro Zutat.

---

## Dateistruktur (neu/geändert)

```
catalog/
├─ ingredients.csv           – wächst auf ca. 150–220 Zutaten
├─ prices/README.md          – wie Preise erhoben werden
├─ prices/2026-09-aldi-sued.csv – Rohdaten: Quelle, Datum, Produkt, Menge, Preis, Zutat-ID
├─ recipes/*.yaml            – ca. 100 Dateien
└─ REPORT.md                 – generiert von npm run catalog:report
src/domain/types.ts          – Recipe.sources
tools/catalog/schema.ts      – sources
tools/catalog/build.ts       – neue Prüfungen
tools/catalog/report.ts (+ .test.ts)
tools/catalog-report.ts      – CLI
```

---

### Task 1: Build-Prüfungen und Katalog-Report

**Files:**
- Modify: `src/domain/types.ts` (Recipe), `tools/catalog/schema.ts`, `tools/catalog/build.ts`, `tools/catalog/build.test.ts`, `tools/build-catalog.ts`, `package.json`
- Create: `tools/catalog/report.ts`, `tools/catalog/report.test.ts`, `tools/catalog-report.ts`

**Interfaces:**
- Consumes: `buildCatalog`, `BuildInput` (1a Task 12); `perPortion` (1a Task 4); `recipeCostPerPortion` (1a Task 6); `recipeProfile`, `dietsOf` (1a Task 5); `makeLookup` (1a Task 3).
- Produces: `Recipe.sources?: string[]`; YAML-Feld `sources` (Liste von URLs, Standard `[]`); Build-Fehler `Rezeptdateien müssen auf .yaml enden`, `<Zutat>: Startrezepte dürfen nur Zutaten mit BLS-Code verwenden`; `interface ReportRow { id: string; title: string; mealTypes: MealType[]; storage: string; servings: number; minutes: number; kcal: number; protein: number; fat: number; carbs: number; eurPerPortion: number; diets: Diet[]; flags: string[] }`, `recipeReport(catalog: Catalog): ReportRow[]`, `interface ReportSummary { recipes: number; byMealType: Record<MealType, number>; prep: number; fresh: number; vegetarian: number; vegan: number; flagged: number }`, `summarize(rows: ReportRow[]): ReportSummary`, `formatReport(rows: ReportRow[], summary: ReportSummary): string`; npm-Skript `catalog:report` schreibt `catalog/REPORT.md`.

Flags im Report: `preis<0,30`, `preis>5`, `kcal<Ziel`, `kcal>Ziel` (Zielbereiche siehe Global Constraints je erster Mahlzeit in `mealTypes`: breakfast 300–550, lunch/dinner 450–800, snack 100–300), `portionen>tage` (bei `prep`: `servings > fridgeDays * 2`).

- [ ] **Step 1: Failing Tests für die Build-Erweiterungen** – in `tools/catalog/build.test.ts`:

  1. Im Array `bls` einen Eintrag für Banane ergänzen:
  ```ts
  {
    code: 'F503100',
    name: 'Banane roh',
    nameEn: 'Banana raw',
    per100g: { kcal: 93, protein: 1.2, fat: 0.2, carbs: 20, fiber: 2, sugar: 17, salt: 0 },
    incomplete: false,
  },
  ```
  2. In `csv` die Bananen-Zeile ersetzen durch:
  ```ts
  'banane;Banane;F503100;obst-gemuese;;120;1000:1,69;2026-09-26;;;;;;;;;;',
  ```
  3. Neue Tests am Ende von `describe('buildCatalog', …)`:
  ```ts
  it('Quellen-URLs werden übernommen, ungültige abgelehnt', () => {
    const withSources = oats.replace('steps:', 'sources:\n  - https://eatsmarter.de/rezepte/haferbrei\nsteps:');
    expect(buildCatalog(input({ recipeFiles: [{ fileName: 'haferbrei.yaml', text: withSources }] })).catalog?.recipes[0]?.sources).toEqual([
      'https://eatsmarter.de/rezepte/haferbrei',
    ]);
    const bad = oats.replace('steps:', 'sources:\n  - keine-url\nsteps:');
    expect(buildCatalog(input({ recipeFiles: [{ fileName: 'haferbrei.yaml', text: bad }] })).errors[0]).toMatch(
      /^haferbrei\.yaml: sources\.0 – /,
    );
  });

  it('Startrezepte nur mit BLS-Zutaten', () => {
    const manualCsv = csv.replace('banane;Banane;F503100;obst-gemuese;;120;1000:1,69;2026-09-26;;;;;;;;;;', 'banane;Banane;;obst-gemuese;;120;1000:1,69;2026-09-26;;;;93;1,2;0,2;20;2;17;0');
    expect(buildCatalog(input({ ingredientsCsv: manualCsv })).errors).toEqual([
      'haferbrei.yaml: Banane: Startrezepte dürfen nur Zutaten mit BLS-Code verwenden',
    ]);
  });

  it('falsche Dateiendung', () => {
    expect(buildCatalog(input({ recipeFiles: [{ fileName: 'haferbrei.yml', text: oats }] })).errors).toEqual([
      'haferbrei.yml: Rezeptdateien müssen auf .yaml enden',
    ]);
  });
  ```

- [ ] **Step 2: Tests ausführen** – `npx vitest run tools/catalog/build.test.ts` → Expected: FAIL in den drei neuen Tests (sources unbekannt wegen `strictObject`, keine BLS-Pflicht, keine Endungsprüfung).

- [ ] **Step 3: Implementieren**

  `src/domain/types.ts` – in `interface Recipe` nach `url?: string;` ergänzen:
  ```ts
  /** Quellen, an denen sich das Rezept orientiert (nur Startrezepte) */
  sources?: string[];
  ```

  `tools/catalog/schema.ts` – in `recipeFileSchema` nach `version: …` ergänzen:
  ```ts
  sources: z.array(z.url()).default([]),
  ```

  `tools/catalog/build.ts`:
  - In `validateRecipe` nach der `canConvert`-Prüfung innerhalb der Schleife:
  ```ts
    if (ing.blsCode === null) {
      errors.push(`${ing.name}: Startrezepte dürfen nur Zutaten mit BLS-Code verwenden`);
    }
  ```
  - In der Rezeptschleife als erste Anweisung:
  ```ts
    if (!file.fileName.endsWith('.yaml')) {
      errors.push(`${file.fileName}: Rezeptdateien müssen auf .yaml enden`);
      continue;
    }
  ```
  - Beim Anlegen von `recipe` nach `version: f.version,` ergänzen: `sources: f.sources,`

  `tools/build-catalog.ts` – Filter so ändern, dass alle Dateien außer versteckten übergeben werden (damit `.yml` erkannt wird):
  ```ts
  const recipeFiles = readdirSync(recipeDir)
    .filter((f) => !f.startsWith('.'))
    .sort()
    .map((fileName) => ({ fileName, text: read(join(recipeDir, fileName)) }));
  ```

- [ ] **Step 4: Tests ausführen** – `npx vitest run tools/catalog/build.test.ts` → Expected: PASS (10 Tests).

- [ ] **Step 5: Failing Test `tools/catalog/report.test.ts`**

```ts
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
```

- [ ] **Step 6: Test ausführen** – `npx vitest run tools/catalog/report.test.ts` → Expected: FAIL (`Cannot find module './report'`).

- [ ] **Step 7: `tools/catalog/report.ts`**

```ts
import type { Catalog, Diet, MealType } from '../../src/domain/types';
import { MEAL_TYPES } from '../../src/domain/types';
import { MEAL_TYPE_LABEL } from '../../src/domain/labels';
import { makeLookup } from '../../src/domain/recipe';
import { perPortion } from '../../src/domain/nutrition';
import { recipeCostPerPortion } from '../../src/domain/pricing';
import { dietsOf, recipeProfile } from '../../src/domain/diet';

export interface ReportRow {
  id: string;
  title: string;
  mealTypes: MealType[];
  storage: string;
  servings: number;
  minutes: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  eurPerPortion: number;
  diets: Diet[];
  flags: string[];
}

/** Zielbereich kcal pro Portion je Mahlzeit (siehe Plan 1b, Global Constraints) */
const KCAL_RANGE: Record<MealType, [number, number]> = {
  breakfast: [300, 550],
  lunch: [450, 800],
  dinner: [450, 800],
  snack: [100, 300],
};

export function recipeReport(catalog: Catalog): ReportRow[] {
  const lookup = makeLookup(catalog.ingredients);
  return catalog.recipes.map((r) => {
    const n = perPortion(r, lookup);
    const eur = recipeCostPerPortion(r, lookup).eur;
    const flags: string[] = [];
    const main = r.mealTypes[0] ?? 'lunch';
    const [min, max] = KCAL_RANGE[main];
    if (n.kcal < min) flags.push('kcal<Ziel');
    if (n.kcal > max) flags.push('kcal>Ziel');
    if (eur < 0.3) flags.push('preis<0,30');
    if (eur > 5) flags.push('preis>5');
    if (r.storage.kind === 'prep' && r.servings > r.storage.fridgeDays * 2) flags.push('portionen>tage');
    return {
      id: r.id,
      title: r.title,
      mealTypes: r.mealTypes,
      storage: r.storage.kind === 'prep' ? `prep ${r.storage.fridgeDays} T.${r.storage.freezable ? ' ❄' : ''}` : 'frisch',
      servings: r.servings,
      minutes: r.prepMinutes + r.cookMinutes,
      kcal: n.kcal,
      protein: n.protein,
      fat: n.fat,
      carbs: n.carbs,
      eurPerPortion: eur,
      diets: dietsOf(recipeProfile(r, lookup).flags),
      flags,
    };
  });
}

export interface ReportSummary {
  recipes: number;
  byMealType: Record<MealType, number>;
  prep: number;
  fresh: number;
  vegetarian: number;
  vegan: number;
  flagged: number;
}

export function summarize(rows: ReportRow[]): ReportSummary {
  const byMealType = Object.fromEntries(MEAL_TYPES.map((m) => [m, 0])) as Record<MealType, number>;
  for (const r of rows) for (const m of r.mealTypes) byMealType[m] += 1;
  return {
    recipes: rows.length,
    byMealType,
    prep: rows.filter((r) => r.storage.startsWith('prep')).length,
    fresh: rows.filter((r) => r.storage === 'frisch').length,
    vegetarian: rows.filter((r) => r.diets.includes('vegetarian')).length,
    vegan: rows.filter((r) => r.diets.includes('vegan')).length,
    flagged: rows.filter((r) => r.flags.length > 0).length,
  };
}

const de1 = (n: number) => n.toFixed(1).replace('.', ',');
const de2 = (n: number) => n.toFixed(2).replace('.', ',');

export function formatReport(rows: ReportRow[], s: ReportSummary): string {
  const lines = [
    '# Katalog-Report',
    '',
    `${s.recipes} Rezepte · vorkochbar ${s.prep} · frisch ${s.fresh} · vegetarisch ${s.vegetarian} · vegan ${s.vegan} · mit Hinweisen ${s.flagged}`,
    '',
    MEAL_TYPES.map((m) => `${MEAL_TYPE_LABEL[m]}: ${s.byMealType[m]}`).join(' · '),
    '',
    '| Rezept | Mahlzeit | Lagerung | Port. | Min. | kcal | P | F | KH | €/Port. | Hinweise |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of [...rows].sort((a, b) => a.title.localeCompare(b.title, 'de'))) {
    lines.push(
      `| ${r.title} | ${r.mealTypes.map((m) => MEAL_TYPE_LABEL[m]).join(', ')} | ${r.storage} | ${r.servings} | ${r.minutes} | ${Math.round(r.kcal)} | ${de1(r.protein)} | ${de1(r.fat)} | ${de1(r.carbs)} | ${de2(r.eurPerPortion)} | ${r.flags.join(', ')} |`,
    );
  }
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 8: Test ausführen** – `npx vitest run tools/catalog/report.test.ts && npm run typecheck` → Expected: PASS (4 Tests). Achtung: Overnight Oats hat `mealTypes: ['breakfast']` → Zeile `Frühstück`; Lagerung ohne ❄, weil `freezable: false`.

- [ ] **Step 9: CLI `tools/catalog-report.ts` + Skript**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import type { Catalog } from '../src/domain/types';
import { formatReport, recipeReport, summarize } from './catalog/report';

// npm run catalog:report → catalog/REPORT.md (vorher npm run catalog)
const catalog = JSON.parse(readFileSync('public/catalog.json', 'utf8')) as Catalog;
const rows = recipeReport(catalog);
const summary = summarize(rows);
writeFileSync('catalog/REPORT.md', formatReport(rows, summary));
console.log(
  `catalog/REPORT.md: ${summary.recipes} Rezepte, ${summary.flagged} mit Hinweisen (${rows
    .filter((r) => r.flags.length)
    .map((r) => `${r.id}: ${r.flags.join('/')}`)
    .join('; ')})`,
);
```
`package.json` → `"catalog:report": "tsx tools/catalog-report.ts"`

- [ ] **Step 10: Ausführen** – `npm run catalog && npm run catalog:report && npm run verify` → Expected: `catalog/REPORT.md: 2 Rezepte, …`, verify grün.

- [ ] **Step 11: Commit** – alle geänderten/neuen Dateien inkl. `catalog/REPORT.md`, Nachricht `feat: Katalog-Report, Quellenfeld und strengere Build-Prüfungen`.

---

### Task 2: Preis-Grundstock (Aldi Süd) und Zutaten-Regeln

**Files:**
- Create: `catalog/prices/README.md`, `catalog/prices/2026-09-aldi-sued.csv`
- Modify: `catalog/ingredients.csv` (bestehende 12 Zutaten mit echten Preisen)

**Interfaces:**
- Produces: Preisliste mit Spalten `quelle;abgerufen;kategorie;produkt;menge_g;preis_eur;zutat_id` (`quelle` = URL oder `schaetzung`); Namens-/ID-Regeln für Zutaten, die alle folgenden Tasks einhalten.

- [ ] **Step 1: `catalog/prices/README.md`** mit genau diesen Regeln:
  - Quelle: Aldi-Süd-Kategorieseiten (Liste unten), jeweils alle Unterseiten (`?page=2` …), Abrufdatum eintragen.
  - Pro Zutat gilt die **günstigste reguläre Eigenmarke** (keine Aktionspreise „Spare x %“, keine Bio-/Premium-Linie, außer es gibt nur diese).
  - Mengen in Gramm; Flüssigkeiten: ml × Dichte der Zutat (Dichte steht in `ingredients.csv`).
  - Mehrere Packungsgrößen derselben Eigenmarke → alle übernehmen (die App wählt die günstigste Kombination).
  - Kein Online-Preis → `quelle=schaetzung`, Wert auf Discounter-Niveau, im Commit begründen.
  - Kategorieseiten:
    - https://www.aldi-sued.de/produkte/fleisch-fisch/k/1588161425467052
    - https://www.aldi-sued.de/produkte/milchprodukte-eier/k/1588161425467093
    - https://www.aldi-sued.de/produkte/kaese/k/1588161425467083
    - https://www.aldi-sued.de/produkte/backwaren-aufstriche-cerealien/k/1588161425467101
    - https://www.aldi-sued.de/produkte/nudeln-reis-huelsenfruechte/k/1588161425467115
    - https://www.aldi-sued.de/produkte/saucen-oele-gewuerze/k/1588161425467121
    - https://www.aldi-sued.de/produkte/konserven-fertiggerichte/k/1588161425467133
    - https://www.aldi-sued.de/produkte/tiefkuehlung/k/1588161425467141
  - Zutaten-Regeln: eine ID pro Lebensmittel im Zustand, in dem es gekauft wird (roh, getrocknet, Konserve abgetropft); ID ohne Marke; Name so, wie er auf dem Einkaufszettel stehen soll („Hähnchenbrustfilet“, „Kidneybohnen (Dose, abgetropft)“); Allergene je Zutat nach den 14 EU-Hauptallergenen prüfen (Brühe/Saucen: Sellerie, Senf; Brot/Nudeln: Gluten; Pesto: Nüsse/Milch).

- [ ] **Step 2: Preise erheben** – jede Kategorieseite inkl. Unterseiten per WebFetch abrufen (Prompt: „Liste alle Produkte mit Name, Packungsgröße, Preis, Grundpreis; Aktionspreise kennzeichnen“) und die Grundnahrungsmittel (Fleisch, Fisch, Milchprodukte, Eier, Käse, Brot, Haferflocken, Nudeln, Reis, Hülsenfrüchte, Öle, Konserven, TK-Gemüse) in `2026-09-aldi-sued.csv` eintragen; Kopfzeile `quelle;abgerufen;kategorie;produkt;menge_g;preis_eur;zutat_id`. `zutat_id` bleibt leer, bis die Zutat in `ingredients.csv` existiert.

- [ ] **Step 3: Bestehende 12 Zutaten auf echte Preise umstellen** – `packages` und `priceAsOf` in `ingredients.csv` aus der Preisliste übernehmen, `zutat_id` in der Preisliste setzen. Frisches Gemüse (Zwiebel, Paprika, Knoblauch) → Schätzung, in der Preisliste als `schaetzung` markieren.

- [ ] **Step 4: Prüfen** – `npm run catalog && npm run catalog:report && npm run verify` → Expected: grün; Report zeigt neue €/Portion für Chili und Oats.

- [ ] **Step 5: Commit** – `data: Aldi-Süd-Preisliste 09/2026 und echte Richtpreise für Basiszutaten`.

---

### Rezeptpakete (Tasks 3–9) – gemeinsamer Ablauf

Jedes Paket folgt exakt diesen Schritten; die Pakete unterscheiden sich nur in der Rezeptliste.

- [ ] **Step A: Quellen sammeln** – pro Rezept 1–2 Quellen der erlaubten Seiten per WebSearch/WebFetch finden (Prompt: „Titel, Portionen, Zutaten mit Mengen, Garzeiten, kcal/Protein pro Portion falls angegeben“). Nur Zutaten/Mengen/Zeiten notieren.
- [ ] **Step B: Zutaten ergänzen** – für jede neue Zutat: `npm run bls:search -- <begriffe>` → passenden **rohen/unverarbeiteten** Eintrag wählen (nicht „gebraten“, „gekocht“, außer Konserve); Zeile in `ingredients.csv` mit Kategorie, Dichte/Stückgewicht (falls in Rezepten in ml/EL/TL/Stück verwendet), Packungen aus der Preisliste, Flags, Allergenen.
- [ ] **Step C: Rezept schreiben** – `catalog/recipes/<id>.yaml` mit eigener Beschreibung (1 Satz), eigenen Schritten (3–8), `sources`, `storage` nach Tabelle, `tags` (z. B. `high-protein`, `one-pot`, `ofen`, `schnell`, `vegetarisch`).
- [ ] **Step D: Bauen** – `npm run catalog` → Expected: `public/catalog.json geschrieben (…)`. Fehler beheben, nicht umgehen.
- [ ] **Step E: Report prüfen** – `npm run catalog:report`; jede neue Zeile: kcal im Zielbereich? Abweichung zur Quellen-kcal ≤ 25 %? Preis plausibel? Hinweise entweder beheben (Mengen/Portionen) oder im Commit begründen.
- [ ] **Step F: Gesamtprüfung** – `npm run verify` → grün.
- [ ] **Step G: Commit** – `data: <Paketname> (<n> Rezepte)`; im Text: Quellen-Domains, begründete Report-Hinweise, Schätzpreise.

Ein Rezept der Liste darf durch ein gleichwertiges ersetzt werden, wenn sich keine brauchbare Quelle findet – als Ruling im Ledger festhalten.

### Task 3: Frühstück (15 Rezepte, davon 1 vorhanden)

Overnight Oats mit Quark *(vorhanden)* · Overnight Oats Apfel-Zimt · Chia-Pudding mit Beeren · Bircher Müsli · Protein-Pancakes (prep 3 ❄) · Frühstücks-Muffins mit Ei und Gemüse (prep 3 ❄) · Frühstücks-Burrito mit Ei und Bohnen (prep 3 ❄) · Rührei mit Vollkornbrot (frisch) · Omelett mit Spinat und Feta (frisch) · Porridge mit Banane und Erdnussmus (frisch) · Skyr-Bowl mit Beeren und Haferflocken (frisch) · Quarkbrot mit Radieschen und Schnittlauch (frisch) · Hüttenkäse-Brot mit Tomate (frisch) · Joghurt mit Apfel, Nüssen und Haferflocken (frisch) · Herzhafte Frühstücks-Wraps mit Pute und Frischkäse (prep 2)

### Task 4: Snacks (10 Rezepte)

Hummus mit Gemüsesticks (prep 4) · Hartgekochte Eier (prep 5) · Energy Balls mit Hafer und Datteln (prep 5 ❄) · Geröstete Kichererbsen (prep 5) · Thunfisch-Dip mit Gurke (prep 2) · Magerquark mit Beeren (frisch) · Protein-Shake mit Banane und Haferflocken (frisch) · Hüttenkäse mit Paprika (frisch) · Apfel mit Erdnussmus (frisch) · Bananen-Hafer-Riegel (prep 4 ❄)

### Task 5: Mealprep Geflügel (12 Rezepte)

Hähnchen-Reis-Bowl mit Brokkoli · Hähnchen-Curry mit Reis · Teriyaki-Hähnchen mit Gemüse und Reis · Hähnchen-Fajita-Bowl · Hähnchen mit Süßkartoffeln vom Blech · Putengeschnetzeltes mit Nudeln · Hähnchen-Pasta mit Tomate und Spinat · Butter Chicken (leichte Variante) mit Reis · Hähnchen-Gemüse-Pfanne mit Couscous · Pute mit Paprika-Reis · Griechisches Zitronen-Hähnchen mit Kartoffeln · Hähnchen-Nudelsalat mit Pesto (prep 2)

### Task 6: Mealprep Rind, Schwein, Hack (12 Rezepte, davon 1 vorhanden)

Chili con Carne mit Reis *(vorhanden – storage auf `fridgeDays: 3` senken, Reis!)* · Spaghetti Bolognese · Hackfleisch-Reis-Pfanne mit Gemüse · Rindergulasch mit Kartoffeln · Lasagne · Burrito-Bowl mit Hack · Gefüllte Paprika mit Reis und Hack · Kartoffel-Hack-Auflauf · Schweinefilet mit Gemüse und Reis · Kofta-Frikadellen mit Bulgur · Asia-Nudeln mit Rinderstreifen · Frikadellen mit Kartoffeln und Gurkensalat (Salat separat)

### Task 7: Vegetarisch & vegan (16 Rezepte)

Linsen-Dal mit Reis · Kichererbsen-Curry · Chili sin Carne · Gemüse-Lasagne · Tofu-Gemüse-Pfanne mit Reis · Bohnen-Quinoa-Bowl · Linsen-Bolognese · Süßkartoffel-Kichererbsen-Blech mit Joghurtdip · Spinat-Feta-Nudelauflauf · Gemüse-Frittata · Falafel-Bowl mit Hummus · Couscous-Salat mit Kichererbsen und Feta (prep 3, Dressing separat) · Quinoa-Salat mit Gemüse (prep 3) · Shakshuka (frisch) · Pilz-Risotto (frisch) · Gnocchi-Pfanne mit Tomaten und Mozzarella (frisch)

### Task 8: Fisch & schnelle Frischgerichte (18 Rezepte)

Fisch: Lachs mit Ofengemüse (frisch) · Lachs-Reis-Bowl (prep 2) · Thunfisch-Nudelsalat (prep 2) · Seelachs mit Kartoffeln und Spinat (frisch) · Garnelen-Knoblauch-Nudeln (frisch) · Fischcurry mit Seelachs (prep 2) · Thunfisch-Wrap (frisch) · Ofenlachs mit Süßkartoffel (frisch)
Schnell (≤ 20 Min., frisch): Gebratener Reis mit Ei und Gemüse · Quesadillas mit Bohnen und Käse · Spaghetti Carbonara (leichte Variante) · Tortellini in Tomatensauce · Bauernfrühstück · Couscous mit Gemüse und Feta · Hähnchen-Wraps · Tomaten-Mozzarella-Salat mit Vollkornbrot · Eiernudeln mit Gemüse und Sojasauce · Ofenkartoffel mit Kräuterquark

### Task 9: Suppen & Eintöpfe (10 Rezepte, alle prep 4 ❄)

Rote-Linsen-Suppe · Kartoffelsuppe mit Würstchen · Minestrone · Hühnersuppe mit Nudeln (prep 3) · Erbsensuppe · Kürbissuppe · Gemüseeintopf mit Rindfleisch · Tomatensuppe mit Reis (prep 3) · Linseneintopf · Brokkoli-Kartoffel-Suppe

---

### Task 10: Gesamtkontrolle des Katalogs

**Files:**
- Modify: nach Befund `catalog/ingredients.csv`, `catalog/recipes/*.yaml`
- Create: –

- [ ] **Step 1: Report** – `npm run catalog && npm run catalog:report`; Expected: ca. 100 Rezepte; mind. 50 % vorkochbar; mind. 25 vegetarisch; jede Mahlzeit mind. 10 Rezepte; höchstens 10 Rezepte mit Hinweisen, jeder begründet.
- [ ] **Step 2: Dubletten** – Skript-Einzeiler `node -e` über `public/catalog.json`: Zutaten mit gleichem `blsCode` auflisten; echte Dubletten zusammenführen (ID behalten, die in mehr Rezepten vorkommt; die andere in `retired-ids.txt`, falls sie schon in `ids.lock` stand).
- [ ] **Step 3: Allergene Stichprobe** – alle Zutaten der Kategorien `gewuerze-oele`, `konserven`, `backwaren` gegen die Regeln aus Task 2 prüfen.
- [ ] **Step 4: Quellen** – jedes Startrezept hat ≥ 1 `sources`-Eintrag (`node -e` über `public/catalog.json`).
- [ ] **Step 5: `npm run verify`** → grün.
- [ ] **Step 6: Commit** – `data: Katalog-Gesamtkontrolle`.

---

## Abdeckung der Spec

| Spec | Task |
|---|---|
| §4 Datenquellen (BLS, Richtpreise mit Stand, eigene Texte) | 1 (BLS-Pflicht), 2, 3–9 |
| §5.1 Rezept: Lagerung, Mahlzeiten, Zeiten, Tags | 3–9 |
| §8 Startpaket ca. 100 Rezepte, hoher Anteil vorkochbar, vegetarische Optionen, Haltbarkeiten nach Empfehlungen | 3–10 |
| §8 Nährwerte ausschließlich aus BLS | 1 |
| §14 Richtpreise als Schätzung mit Stand gekennzeichnet | 2 |
