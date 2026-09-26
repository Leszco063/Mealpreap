# Stufe 1a – Kern & Katalog-Pipeline – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Projektgerüst, die komplette UI-freie Rechenlogik (Einheiten, Nährwerte, Ernährungsform, Preise/Packungen, Einkaufsliste, Regeln, Ziel-Rechner) und die geprüfte Katalog-Pipeline (BLS → `public/catalog.json`) mit einem kleinen Beispielkatalog.

**Architecture:** Reine TypeScript-Module unter `src/domain/` ohne Abhängigkeit zu React oder Datenbank, jeweils mit Vitest-Tests. Node-Skripte unter `tools/` (per `tsx`) erzeugen aus BLS-Daten, `catalog/ingredients.csv` und `catalog/recipes/*.yaml` den validierten Katalog. Ein minimales React/Vite/Tailwind-Gerüst stellt sicher, dass Build und CI von Anfang an laufen.

**Tech Stack:** Node 24, npm, TypeScript (strict), Vite, React, Tailwind CSS v4 (`@tailwindcss/vite`), Vitest, ESLint (typescript-eslint), tsx, zod, yaml, exceljs.

**Spec:** `docs/superpowers/specs/2026-09-26-mealprep-planer-design.md`

**Folgepläne:** Stufe 1b (Katalog-Inhalte: Zutaten mit Richtpreisen, ca. 100 Rezepte) und Stufe 1c (App: RxDB, Bildschirme, PWA, Deploy) werden nach Abschluss dieses Plans geschrieben.

## Global Constraints

- Sprache: Oberflächentexte, Fehlermeldungen und Kommentare auf Deutsch; Bezeichner im Code auf Englisch.
- Intern werden alle Mengen in **Gramm** gerechnet; ml/EL/TL über `densityGPerMl`, Stück über `pieceWeightG` (EL = 15 ml, TL = 5 ml).
- Nährwerte, Preise, Ernährungsform und Einkaufsliste werden **aus den Zutaten abgeleitet** und nie in Haushaltsdaten gespeichert.
- IDs von Zutaten und Rezepten: nur `a-z`, `0-9`, Bindestrich; einmal vergeben, nie ändern; Entfernen nur über `catalog/retired-ids.txt`.
- Datumswerte sind Strings `YYYY-MM-DD`; Datumsrechnung ausschließlich in UTC.
- Geldbeträge werden beim Summieren in ganzen Cent gerechnet.
- Plausibilität: |kcal − (4·Protein + 4·KH + 9·Fett + 2·Ballaststoffe)| ≤ max(15 % der kcal, 10 kcal); kcal pro Portion 50–1.500; `fridgeDays` 1–5.
- Datenquellen: nur BLS 4.0 (CC BY 4.0) für Nährwerte; Quellenangabe: „Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0“.
- Keine laufenden Kosten, keine Supermarkt-Scraper.
- Git: Befehle über das Bash-Tool; Identität ist im Repo bereits gesetzt (`Leszco063`, noreply-Adresse). Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Arbeitsverzeichnis für alle Befehle: `C:\Users\leand\Desktop\Mealprep` (Bash: `/c/Users/leand/Desktop/Mealprep`).

## Review Focus

- **Sommerzeit/Zeitzone:** Datumsrechnung über den 29.03./25.10. hinweg und in deutscher Zeitzone darf keinen Tag verschieben → Test in Task 2 (`addDays` über Zeitumstellung).
- **Woche ohne Kochtag oder erster Tag kein Kochtag:** Einkaufs-Zeiträume dürfen keine Tage verlieren → Tests in Task 2 (`cookDayRanges`).
- **Excel-typische CSV-Werte:** Dezimalkomma („0,92“), Umlaute, BOM, CRLF-Zeilenenden in `ingredients.csv` → Test in Task 11.
- **Mahlzeit mit 0 Portionen, unbekannter Person oder gelöschtem Rezept/Zutat:** Einkaufsliste und Regelprüfung dürfen nicht abstürzen, sondern warnen → Tests in Task 7 und Task 8.
- **Cent-Rundung:** Summen aus Kommapreisen (z. B. 0,79 + 1,29 + …) müssen exakt auf den Cent stimmen → Test in Task 6/7 (ganzzahlige Cent).

---

## Dateistruktur (Ergebnis dieses Plans)

```
Mealprep/
├─ package.json, package-lock.json, tsconfig.json, vite.config.ts, eslint.config.js
├─ .gitignore, .gitattributes, index.html
├─ src/
│  ├─ main.tsx, App.tsx, index.css            – minimales UI-Gerüst
│  └─ domain/
│     ├─ types.ts        – alle Domänentypen + Konstantenlisten
│     ├─ labels.ts       – deutsche Bezeichnungen
│     ├─ dates.ts        – ISO-Datumsrechnung, Kochtag-Zeiträume
│     ├─ units.ts        – Umrechnung in Gramm
│     ├─ recipe.ts       – Lookup, Grammliste eines Rezepts
│     ├─ nutrition.ts    – Nährwerte, Plausibilität
│     ├─ diet.ts         – Flags/Allergene/Ernährungsform ableiten
│     ├─ pricing.ts      – Preis pro Gramm/Portion, Packungswahl
│     ├─ shopping.ts     – Einkaufsliste
│     ├─ rules.ts        – harte Regeln
│     ├─ targets.ts      – Ziel-Rechner
│     ├─ fixtures.test-data.ts – gemeinsame Testdaten
│     └─ *.test.ts
├─ tools/
│  ├─ bls/parse.ts (+ .test.ts)     – BLS-Zeilen → BlsEntry
│  ├─ bls/search.ts (+ .test.ts)    – Namenssuche
│  ├─ catalog/schema.ts             – zod-Schemas
│  ├─ catalog/csv.ts (+ .test.ts)   – ingredients.csv lesen
│  ├─ catalog/build.ts (+ .test.ts) – Katalog bauen + validieren
│  ├─ bls-extract.ts, bls-search.ts, build-catalog.ts – CLIs
├─ catalog/
│  ├─ README.md, bls-slim.json, ingredients.csv, ids.lock, retired-ids.txt
│  └─ recipes/chili-con-carne.yaml, overnight-oats.yaml
├─ public/catalog.json
├─ data/bls/…  (nicht im Repo)
└─ .github/workflows/ci.yml
```

---

### Task 1: Projektgerüst

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.gitignore`, `.gitattributes`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: –
- Produces: npm-Skripte `dev`, `build`, `typecheck`, `lint`, `test`; Vitest findet `src/**/*.test.ts` und `tools/**/*.test.ts`.

- [ ] **Step 1: `.gitignore` und `.gitattributes` anlegen**

`.gitignore`:
```
node_modules/
dist/
data/
*.local
.DS_Store
```

`.gitattributes`:
```
* text=auto eol=lf
*.xlsx binary
```

- [ ] **Step 2: `package.json` anlegen**

```json
{
  "name": "mealprep-planer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Abhängigkeiten installieren**

```bash
cd /c/Users/leand/Desktop/Mealprep
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node vitest tailwindcss @tailwindcss/vite tsx zod yaml exceljs eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals
```
Expected: `added … packages`, keine Fehler.

- [ ] **Step 4: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tools", "vite.config.ts"]
}
```

- [ ] **Step 5: `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative Pfade, damit die App später unter https://<name>.github.io/<repo>/ läuft
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: `eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'data', 'public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
);
```

- [ ] **Step 7: Minimales UI-Gerüst**

`index.html`:
```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mealprep-Planer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:
```css
@import 'tailwindcss';
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Element #root fehlt in index.html');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 p-4 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <h1 className="text-2xl font-semibold">Mealprep-Planer</h1>
    </main>
  );
}
```

- [ ] **Step 8: Prüfen**

```bash
npm run typecheck && npm run lint && npm run build && npx vitest run --passWithNoTests
```
Expected: alle vier Befehle ohne Fehler; `dist/index.html` existiert.

- [ ] **Step 9: Commit**

```bash
git add .gitignore .gitattributes package.json package-lock.json tsconfig.json vite.config.ts eslint.config.js index.html src
git commit -m "chore: Projektgerüst mit Vite, React, Tailwind, Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Typen, Bezeichnungen, Datumsrechnung

**Files:**
- Create: `src/domain/types.ts`, `src/domain/labels.ts`, `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

**Interfaces:**
- Consumes: –
- Produces:
  - Konstanten `NUTRIENT_KEYS`, `UNITS`, `CATEGORIES`, `FLAGS`, `ALLERGENS`, `MEAL_TYPES`, `DIETS` und die Typen `NutrientKey`, `Nutrients`, `Unit`, `Category`, `Flag`, `Allergen`, `MealType`, `Diet`, `IsoDate`, `Package`, `Ingredient`, `Storage`, `RecipeIngredient`, `Recipe`, `Targets`, `Person`, `Meal`, `Catalog`
  - `DIET_LABEL`, `MEAL_TYPE_LABEL`, `ALLERGEN_LABEL`, `CATEGORY_LABEL`
  - `addDays(d: IsoDate, n: number): IsoDate`, `diffDays(from: IsoDate, to: IsoDate): number`, `isoWeekday(d: IsoDate): number` (1 = Mo … 7 = So), `weekDates(weekStart: IsoDate): IsoDate[]`, `interface CookDayRange { cookDate: IsoDate | null; from: IsoDate; to: IsoDate }`, `cookDayRanges(weekStart: IsoDate, cookWeekdays: readonly number[]): CookDayRange[]`

- [ ] **Step 1: `src/domain/types.ts`**

```ts
export const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'salt'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
/** Nährwerte; kcal in kcal, alles andere in Gramm */
export type Nutrients = Record<NutrientKey, number>;

export const UNITS = ['g', 'ml', 'stk', 'el', 'tl'] as const;
export type Unit = (typeof UNITS)[number];

/** Reihenfolge = Sortierung der Einkaufsliste */
export const CATEGORIES = [
  'obst-gemuese',
  'backwaren',
  'fleisch-fisch',
  'kuehlregal',
  'tiefkuehl',
  'trockenware',
  'konserven',
  'gewuerze-oele',
  'getraenke',
  'sonstiges',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FLAGS = ['animal', 'meat', 'pork', 'fish', 'dairy', 'egg', 'honey'] as const;
export type Flag = (typeof FLAGS)[number];

/** Die 14 EU-Hauptallergene */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'egg',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const DIETS = ['omnivore', 'pescetarian', 'vegetarian', 'vegan'] as const;
export type Diet = (typeof DIETS)[number];

/** Datum als 'YYYY-MM-DD' */
export type IsoDate = string;

export interface Package {
  sizeG: number;
  priceEur: number;
}

export interface Ingredient {
  id: string;
  name: string;
  blsCode: string | null;
  category: Category;
  per100g: Nutrients;
  densityGPerMl?: number;
  pieceWeightG?: number;
  packages: Package[];
  priceAsOf: string;
  flags: Flag[];
  allergens: Allergen[];
  pantryStaple: boolean;
}

export type Storage = { kind: 'prep'; fridgeDays: number; freezable: boolean } | { kind: 'fresh' };

export interface RecipeIngredient {
  ingredientId: string;
  amount: number;
  unit: Unit;
  note?: string;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  prepMinutes: number;
  cookMinutes: number;
  mealTypes: MealType[];
  storage: Storage;
  tags: string[];
  source: 'starter' | 'own' | 'import';
  url?: string;
  basedOn?: string;
  version: number;
}

export interface Targets {
  kcal: number;
  proteinMin: number;
  fatMin?: number;
  fatMax?: number;
  carbsMin?: number;
  carbsMax?: number;
}

export interface Person {
  id: string;
  name: string;
  userId?: string;
  targets: Targets;
  mealSlots: MealType[];
  diet: Diet;
  noPork: boolean;
  allergies: Allergen[];
  dislikedIngredientIds: string[];
  maxMinutesWeekday: number;
  maxMinutesCookDay: number;
}

export interface Meal {
  id: string;
  date: IsoDate;
  slot: MealType;
  recipeId: string;
  /** Tag der Zubereitung; bei frischen Gerichten = date */
  cookDate: IsoDate;
  /** personId → Portionsfaktor, z. B. { a: 1.4, b: 0.9 } */
  portions: Record<string, number>;
  pinned: boolean;
}

export interface Catalog {
  version: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
}
```

- [ ] **Step 2: `src/domain/labels.ts`**

```ts
import type { Allergen, Category, Diet, MealType } from './types';

export const DIET_LABEL: Record<Diet, string> = {
  omnivore: 'alles',
  pescetarian: 'pescetarisch',
  vegetarian: 'vegetarisch',
  vegan: 'vegan',
};

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
};

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: 'Gluten',
  crustaceans: 'Krebstiere',
  egg: 'Ei',
  fish: 'Fisch',
  peanuts: 'Erdnüsse',
  soy: 'Soja',
  milk: 'Milch',
  nuts: 'Schalenfrüchte',
  celery: 'Sellerie',
  mustard: 'Senf',
  sesame: 'Sesam',
  sulphites: 'Sulfite',
  lupin: 'Lupinen',
  molluscs: 'Weichtiere',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  'obst-gemuese': 'Obst & Gemüse',
  backwaren: 'Backwaren',
  'fleisch-fisch': 'Fleisch & Fisch',
  kuehlregal: 'Kühlregal',
  tiefkuehl: 'Tiefkühl',
  trockenware: 'Trockenware',
  konserven: 'Konserven',
  'gewuerze-oele': 'Gewürze & Öle',
  getraenke: 'Getränke',
  sonstiges: 'Sonstiges',
};
```

- [ ] **Step 3: Failing Test `src/domain/dates.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { addDays, cookDayRanges, diffDays, isoWeekday, weekDates } from './dates';

describe('dates', () => {
  it('addDays über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('addDays über die Zeitumstellung verschiebt keinen Tag', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('diffDays', () => {
    expect(diffDays('2026-09-27', '2026-10-01')).toBe(4);
    expect(diffDays('2026-10-01', '2026-09-27')).toBe(-4);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('isoWeekday: Montag = 1, Sonntag = 7', () => {
    expect(isoWeekday('2026-09-28')).toBe(1);
    expect(isoWeekday('2026-09-26')).toBe(6);
    expect(isoWeekday('2026-09-27')).toBe(7);
  });

  it('lehnt ungültige Daten ab', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Ungültiges Datum');
    expect(() => addDays('26-9-1', 1)).toThrow('Ungültiges Datum');
  });

  it('weekDates liefert 7 Tage', () => {
    expect(weekDates('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('cookDayRanges: erster Tag kein Kochtag → Vorlauf-Zeitraum ohne Kochtag', () => {
    // Woche Mo 28.09. – So 04.10., Kochtage Mi (3) und So (7)
    expect(cookDayRanges('2026-09-28', [3, 7])).toEqual([
      { cookDate: null, from: '2026-09-28', to: '2026-09-29' },
      { cookDate: '2026-09-30', from: '2026-09-30', to: '2026-10-03' },
      { cookDate: '2026-10-04', from: '2026-10-04', to: '2026-10-04' },
    ]);
  });

  it('cookDayRanges: Kochtag am Wochenstart', () => {
    expect(cookDayRanges('2026-09-28', [1, 4])).toEqual([
      { cookDate: '2026-09-28', from: '2026-09-28', to: '2026-09-30' },
      { cookDate: '2026-10-01', from: '2026-10-01', to: '2026-10-04' },
    ]);
  });

  it('cookDayRanges: ohne Kochtage ein Zeitraum für die ganze Woche', () => {
    expect(cookDayRanges('2026-09-28', [])).toEqual([
      { cookDate: null, from: '2026-09-28', to: '2026-10-04' },
    ]);
  });
});
```

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/domain/dates.test.ts`
Expected: FAIL – `Failed to resolve import "./dates"`

- [ ] **Step 5: `src/domain/dates.ts`**

```ts
import type { IsoDate } from './types';

/*
 * Datumswerte sind immer 'YYYY-MM-DD' ohne Uhrzeit.
 * Gerechnet wird in UTC, damit die Zeitumstellung keinen Tag verschiebt.
 */

const DAY_MS = 86_400_000;

function fromUtc(t: number): IsoDate {
  return new Date(t).toISOString().slice(0, 10);
}

function toUtc(d: IsoDate): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Ungültiges Datum: ${d}`);
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Date.UTC rollt 30.02. still auf den 02.03. – das fangen wir ab
  if (fromUtc(t) !== d) throw new Error(`Ungültiges Datum: ${d}`);
  return t;
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtc(toUtc(d) + n * DAY_MS);
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 1 = Montag … 7 = Sonntag */
export function isoWeekday(d: IsoDate): number {
  const w = new Date(toUtc(d)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export interface CookDayRange {
  /** null = Tage vor dem ersten Kochtag der Woche */
  cookDate: IsoDate | null;
  from: IsoDate;
  to: IsoDate;
}

/**
 * Teilt die Woche in Einkaufs-Zeiträume: jeder Kochtag bis vor den nächsten Kochtag.
 * Tage vor dem ersten Kochtag bilden einen eigenen Zeitraum ohne Kochtag.
 */
export function cookDayRanges(weekStart: IsoDate, cookWeekdays: readonly number[]): CookDayRange[] {
  const weekEnd = addDays(weekStart, 6);
  const starts = weekDates(weekStart).filter((d) => cookWeekdays.includes(isoWeekday(d)));
  const ranges: CookDayRange[] = [];
  const first = starts[0];
  if (first === undefined) return [{ cookDate: null, from: weekStart, to: weekEnd }];
  if (first !== weekStart) ranges.push({ cookDate: null, from: weekStart, to: addDays(first, -1) });
  starts.forEach((start, i) => {
    const next = starts[i + 1];
    ranges.push({ cookDate: start, from: start, to: next ? addDays(next, -1) : weekEnd });
  });
  return ranges;
}
```

- [ ] **Step 6: Test ausführen**

Run: `npx vitest run src/domain/dates.test.ts && npm run typecheck`
Expected: PASS (9 Tests), Typecheck ohne Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/labels.ts src/domain/dates.ts src/domain/dates.test.ts
git commit -m "feat: Domänentypen, Bezeichnungen und Datumsrechnung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Einheiten, Rezept-Grammliste, Testdaten

**Files:**
- Create: `src/domain/units.ts`, `src/domain/recipe.ts`, `src/domain/fixtures.test-data.ts`
- Test: `src/domain/units.test.ts`

**Interfaces:**
- Consumes: Typen aus Task 2.
- Produces:
  - `ML_PER_UNIT = { ml: 1, el: 15, tl: 5 }`, `class UnitError extends Error`, `toGrams(amount: number, unit: Unit, ing: Pick<Ingredient, 'name' | 'densityGPerMl' | 'pieceWeightG'>): number`, `canConvert(unit: Unit, ing: Pick<Ingredient, 'densityGPerMl' | 'pieceWeightG'>): boolean`
  - `type IngredientLookup = (id: string) => Ingredient | undefined`, `makeLookup<T extends { id: string }>(items: readonly T[]): (id: string) => T | undefined`, `class MissingIngredientError extends Error { recipeId: string; ingredientId: string }`, `interface GramEntry { ingredient: Ingredient; grams: number }`, `recipeGrams(recipe: Recipe, lookup: IngredientLookup, opts?: { includeOptional?: boolean }): GramEntry[]`
  - Testdaten: `haferflocken`, `magerquark`, `milch`, `rinderhack`, `schweinehack`, `zwiebel`, `olivenoel`, `salz`, `lachs`, `allIngredients`, `overnightOats`, `chili`, `lachsPfanne`, `allRecipes`

- [ ] **Step 1: Testdaten `src/domain/fixtures.test-data.ts`**

```ts
import type { Ingredient, Recipe } from './types';

// Testdaten für alle Domänen-Tests. Werte an BLS angelehnt, bewusst gerundet.

export const haferflocken: Ingredient = {
  id: 'haferflocken',
  name: 'Haferflocken',
  blsCode: 'C133000',
  category: 'trockenware',
  per100g: { kcal: 348, protein: 13.2, fat: 6.7, carbs: 53.3, fiber: 11, sugar: 1, salt: 0 },
  packages: [{ sizeG: 500, priceEur: 0.69 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: ['gluten'],
  pantryStaple: false,
};

export const magerquark: Ingredient = {
  id: 'magerquark',
  name: 'Magerquark',
  blsCode: 'M713100',
  category: 'kuehlregal',
  per100g: { kcal: 66, protein: 11.9, fat: 0.2, carbs: 3.7, fiber: 0, sugar: 3.7, salt: 0.1 },
  packages: [
    { sizeG: 250, priceEur: 0.79 },
    { sizeG: 500, priceEur: 1.29 },
  ],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'dairy'],
  allergens: ['milk'],
  pantryStaple: false,
};

export const milch: Ingredient = {
  id: 'milch',
  name: 'Milch 1,5 %',
  blsCode: 'M111200',
  category: 'kuehlregal',
  per100g: { kcal: 44, protein: 3.5, fat: 1.5, carbs: 3.9, fiber: 0, sugar: 3.9, salt: 0.1 },
  densityGPerMl: 1.03,
  packages: [{ sizeG: 1030, priceEur: 0.99 }],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'dairy'],
  allergens: ['milk'],
  pantryStaple: false,
};

export const rinderhack: Ingredient = {
  id: 'rinderhack',
  name: 'Rinderhackfleisch',
  blsCode: 'U010100',
  category: 'fleisch-fisch',
  per100g: { kcal: 224, protein: 19.1, fat: 16.4, carbs: 0, fiber: 0, sugar: 0, salt: 0.1 },
  packages: [{ sizeG: 500, priceEur: 4.99 }],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'meat'],
  allergens: [],
  pantryStaple: false,
};

export const schweinehack: Ingredient = {
  id: 'schweinehack',
  name: 'Schweinehackfleisch',
  blsCode: 'U020100',
  category: 'fleisch-fisch',
  per100g: { kcal: 271, protein: 17.9, fat: 22.1, carbs: 0, fiber: 0, sugar: 0, salt: 0.1 },
  packages: [{ sizeG: 500, priceEur: 3.99 }],
  priceAsOf: '2026-09-26',
  // bewusst ohne 'meat' und 'animal': diet.ts muss beides aus 'pork' ableiten
  flags: ['pork'],
  allergens: [],
  pantryStaple: false,
};

export const zwiebel: Ingredient = {
  id: 'zwiebel',
  name: 'Zwiebel',
  blsCode: 'G480100',
  category: 'obst-gemuese',
  per100g: { kcal: 34, protein: 1.2, fat: 0.2, carbs: 6, fiber: 1.4, sugar: 6, salt: 0 },
  pieceWeightG: 80,
  packages: [{ sizeG: 1000, priceEur: 1.29 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: [],
  pantryStaple: false,
};

export const olivenoel: Ingredient = {
  id: 'olivenoel',
  name: 'Olivenöl',
  blsCode: 'Q120000',
  category: 'gewuerze-oele',
  per100g: { kcal: 899, protein: 0, fat: 99.9, carbs: 0, fiber: 0, sugar: 0, salt: 0 },
  densityGPerMl: 0.92,
  packages: [{ sizeG: 690, priceEur: 6.49 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: [],
  pantryStaple: false,
};

export const salz: Ingredient = {
  id: 'salz',
  name: 'Salz',
  blsCode: 'R113000',
  category: 'gewuerze-oele',
  per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 95.4 },
  densityGPerMl: 1.2,
  packages: [{ sizeG: 500, priceEur: 0.29 }],
  priceAsOf: '2026-09-26',
  flags: [],
  allergens: [],
  pantryStaple: true,
};

export const lachs: Ingredient = {
  id: 'lachs',
  name: 'Lachsfilet',
  blsCode: null,
  category: 'fleisch-fisch',
  per100g: { kcal: 180, protein: 20, fat: 11, carbs: 0, fiber: 0, sugar: 0, salt: 0.1 },
  packages: [{ sizeG: 250, priceEur: 4.49 }],
  priceAsOf: '2026-09-26',
  flags: ['animal', 'fish'],
  allergens: ['fish'],
  pantryStaple: false,
};

export const allIngredients: Ingredient[] = [
  haferflocken,
  magerquark,
  milch,
  rinderhack,
  schweinehack,
  zwiebel,
  olivenoel,
  salz,
  lachs,
];

export const overnightOats: Recipe = {
  id: 'overnight-oats',
  title: 'Overnight Oats mit Quark',
  description: '',
  servings: 1,
  ingredients: [
    { ingredientId: 'haferflocken', amount: 50, unit: 'g' },
    { ingredientId: 'magerquark', amount: 150, unit: 'g' },
    { ingredientId: 'milch', amount: 100, unit: 'ml' },
  ],
  steps: ['Alles verrühren und über Nacht kühl stellen.'],
  prepMinutes: 5,
  cookMinutes: 0,
  mealTypes: ['breakfast'],
  storage: { kind: 'prep', fridgeDays: 2, freezable: false },
  tags: [],
  source: 'starter',
  version: 1,
};

export const chili: Recipe = {
  id: 'chili',
  title: 'Chili',
  description: '',
  servings: 4,
  ingredients: [
    { ingredientId: 'rinderhack', amount: 500, unit: 'g' },
    { ingredientId: 'zwiebel', amount: 1, unit: 'stk' },
    { ingredientId: 'olivenoel', amount: 1, unit: 'el' },
    { ingredientId: 'salz', amount: 1, unit: 'tl' },
    { ingredientId: 'magerquark', amount: 100, unit: 'g', optional: true, note: 'als Topping' },
  ],
  steps: ['Anbraten.', 'Köcheln.'],
  prepMinutes: 15,
  cookMinutes: 30,
  mealTypes: ['lunch', 'dinner'],
  storage: { kind: 'prep', fridgeDays: 4, freezable: true },
  tags: [],
  source: 'starter',
  version: 1,
};

export const lachsPfanne: Recipe = {
  id: 'lachs-pfanne',
  title: 'Lachs aus der Pfanne',
  description: '',
  servings: 2,
  ingredients: [
    { ingredientId: 'lachs', amount: 250, unit: 'g' },
    { ingredientId: 'olivenoel', amount: 1, unit: 'el' },
  ],
  steps: ['Braten.'],
  prepMinutes: 10,
  cookMinutes: 15,
  mealTypes: ['dinner'],
  storage: { kind: 'fresh' },
  tags: [],
  source: 'starter',
  version: 1,
};

export const allRecipes: Recipe[] = [overnightOats, chili, lachsPfanne];
```

- [ ] **Step 2: Failing Test `src/domain/units.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { canConvert, toGrams, UnitError } from './units';
import { makeLookup, MissingIngredientError, recipeGrams } from './recipe';
import { allIngredients, chili, milch, olivenoel, rinderhack, salz, zwiebel } from './fixtures.test-data';

describe('toGrams', () => {
  it('g bleibt g', () => {
    expect(toGrams(250, 'g', rinderhack)).toBe(250);
  });
  it('ml, EL, TL über Dichte', () => {
    expect(toGrams(100, 'ml', milch)).toBeCloseTo(103);
    expect(toGrams(1, 'el', olivenoel)).toBeCloseTo(13.8);
    expect(toGrams(1, 'tl', salz)).toBeCloseTo(6);
  });
  it('Stück über Stückgewicht', () => {
    expect(toGrams(2, 'stk', zwiebel)).toBe(160);
  });
  it('fehlendes Stückgewicht → UnitError', () => {
    expect(() => toGrams(1, 'stk', rinderhack)).toThrow(UnitError);
    expect(() => toGrams(1, 'stk', rinderhack)).toThrow('Stückgewicht fehlt');
  });
  it('fehlende Dichte → UnitError', () => {
    expect(() => toGrams(1, 'el', rinderhack)).toThrow('Dichte fehlt');
  });
  it('negative oder ungültige Mengen → UnitError', () => {
    expect(() => toGrams(-1, 'g', rinderhack)).toThrow(UnitError);
    expect(() => toGrams(Number.NaN, 'g', rinderhack)).toThrow(UnitError);
  });
  it('canConvert', () => {
    expect(canConvert('g', rinderhack)).toBe(true);
    expect(canConvert('stk', rinderhack)).toBe(false);
    expect(canConvert('stk', zwiebel)).toBe(true);
    expect(canConvert('ml', milch)).toBe(true);
    expect(canConvert('tl', zwiebel)).toBe(false);
  });
});

describe('recipeGrams', () => {
  const lookup = makeLookup(allIngredients);

  it('rechnet Rezeptzutaten in Gramm, ohne optionale', () => {
    const grams = recipeGrams(chili, lookup);
    expect(grams.map((g) => [g.ingredient.id, g.grams])).toEqual([
      ['rinderhack', 500],
      ['zwiebel', 80],
      ['olivenoel', expect.closeTo(13.8, 5)],
      ['salz', expect.closeTo(6, 5)],
    ]);
  });

  it('mit includeOptional auch optionale Zutaten', () => {
    const ids = recipeGrams(chili, lookup, { includeOptional: true }).map((g) => g.ingredient.id);
    expect(ids).toContain('magerquark');
  });

  it('fasst doppelte Zutaten zusammen', () => {
    const doppelt = {
      ...chili,
      ingredients: [
        { ingredientId: 'zwiebel', amount: 1, unit: 'stk' as const },
        { ingredientId: 'zwiebel', amount: 40, unit: 'g' as const },
      ],
    };
    expect(recipeGrams(doppelt, lookup)).toEqual([{ ingredient: zwiebel, grams: 120 }]);
  });

  it('unbekannte Zutat → MissingIngredientError', () => {
    const kaputt = { ...chili, ingredients: [{ ingredientId: 'gibts-nicht', amount: 1, unit: 'g' as const }] };
    expect(() => recipeGrams(kaputt, lookup)).toThrow(MissingIngredientError);
  });
});
```

- [ ] **Step 3: Test ausführen**

Run: `npx vitest run src/domain/units.test.ts`
Expected: FAIL – `Failed to resolve import "./units"`

- [ ] **Step 4: `src/domain/units.ts`**

```ts
import type { Ingredient, Unit } from './types';

export const ML_PER_UNIT = { ml: 1, el: 15, tl: 5 } as const;

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitError';
  }
}

type Convertible = Pick<Ingredient, 'densityGPerMl' | 'pieceWeightG'>;

export function canConvert(unit: Unit, ing: Convertible): boolean {
  if (unit === 'g') return true;
  if (unit === 'stk') return ing.pieceWeightG !== undefined;
  return ing.densityGPerMl !== undefined;
}

/** Rechnet eine Menge in Gramm um. */
export function toGrams(amount: number, unit: Unit, ing: Convertible & Pick<Ingredient, 'name'>): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new UnitError(`${ing.name}: ungültige Menge ${amount}`);
  }
  switch (unit) {
    case 'g':
      return amount;
    case 'stk':
      if (ing.pieceWeightG === undefined) throw new UnitError(`${ing.name}: Stückgewicht fehlt`);
      return amount * ing.pieceWeightG;
    case 'ml':
    case 'el':
    case 'tl':
      if (ing.densityGPerMl === undefined) throw new UnitError(`${ing.name}: Dichte fehlt für Einheit ${unit}`);
      return amount * ML_PER_UNIT[unit] * ing.densityGPerMl;
  }
}
```

- [ ] **Step 5: `src/domain/recipe.ts`**

```ts
import type { Ingredient, Recipe } from './types';
import { toGrams } from './units';

export type IngredientLookup = (id: string) => Ingredient | undefined;

export function makeLookup<T extends { id: string }>(items: readonly T[]): (id: string) => T | undefined {
  const map = new Map(items.map((item) => [item.id, item] as const));
  return (id) => map.get(id);
}

export class MissingIngredientError extends Error {
  readonly recipeId: string;
  readonly ingredientId: string;
  constructor(recipeId: string, ingredientId: string) {
    super(`Rezept ${recipeId}: Zutat ${ingredientId} ist nicht (mehr) verfügbar`);
    this.name = 'MissingIngredientError';
    this.recipeId = recipeId;
    this.ingredientId = ingredientId;
  }
}

export interface GramEntry {
  ingredient: Ingredient;
  grams: number;
}

/** Zutaten eines Rezepts in Gramm (für alle Grundportionen), doppelte Zutaten zusammengefasst. */
export function recipeGrams(
  recipe: Recipe,
  lookup: IngredientLookup,
  opts: { includeOptional?: boolean } = {},
): GramEntry[] {
  const byId = new Map<string, GramEntry>();
  for (const ri of recipe.ingredients) {
    if (ri.optional && !opts.includeOptional) continue;
    const ingredient = lookup(ri.ingredientId);
    if (!ingredient) throw new MissingIngredientError(recipe.id, ri.ingredientId);
    const grams = toGrams(ri.amount, ri.unit, ingredient);
    const entry = byId.get(ingredient.id);
    if (entry) entry.grams += grams;
    else byId.set(ingredient.id, { ingredient, grams });
  }
  return [...byId.values()];
}
```

- [ ] **Step 6: Test ausführen**

Run: `npx vitest run src/domain/units.test.ts && npm run typecheck`
Expected: PASS (11 Tests).

- [ ] **Step 7: Commit**

```bash
git add src/domain/units.ts src/domain/recipe.ts src/domain/fixtures.test-data.ts src/domain/units.test.ts
git commit -m "feat: Einheiten-Umrechnung und Grammliste pro Rezept

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Nährwerte & Plausibilität

**Files:**
- Create: `src/domain/nutrition.ts`
- Test: `src/domain/nutrition.test.ts`

**Interfaces:**
- Consumes: `recipeGrams`, `IngredientLookup`, `makeLookup` (Task 3); `NUTRIENT_KEYS`, `Nutrients`, `Recipe` (Task 2).
- Produces: `ZERO: Nutrients`, `addNutrients(a, b): Nutrients`, `scaleNutrients(n, factor): Nutrients`, `recipeTotals(recipe, lookup): Nutrients`, `perPortion(recipe, lookup): Nutrients`, `computedKcal(n: Nutrients): number`, `isPlausible(n: Nutrients): boolean`

- [ ] **Step 1: Failing Test `src/domain/nutrition.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { computedKcal, isPlausible, perPortion, recipeTotals } from './nutrition';
import { makeLookup } from './recipe';
import { allIngredients, chili, overnightOats } from './fixtures.test-data';

const lookup = makeLookup(allIngredients);

describe('nutrition', () => {
  it('summiert Nährwerte eines Rezepts (ml über Dichte)', () => {
    const n = recipeTotals(overnightOats, lookup);
    expect(n.kcal).toBeCloseTo(318.32, 2);
    expect(n.protein).toBeCloseTo(28.055, 3);
    expect(n.fat).toBeCloseTo(5.195, 3);
    expect(n.carbs).toBeCloseTo(36.217, 3);
    expect(n.fiber).toBeCloseTo(5.5, 3);
    expect(n.sugar).toBeCloseTo(10.067, 3);
    expect(n.salt).toBeCloseTo(0.253, 3);
  });

  it('pro Portion, optionale Zutaten zählen nicht', () => {
    const n = perPortion(chili, lookup);
    expect(n.kcal).toBeCloseTo(317.8155, 3);
    expect(n.protein).toBeCloseTo(24.115, 3);
    expect(n.fat).toBeCloseTo(23.9865, 3);
    expect(n.salt).toBeCloseTo(1.556, 3);
  });

  it('computedKcal nach BLS-Formel inkl. Ballaststoffe', () => {
    expect(computedKcal({ kcal: 0, protein: 10, fat: 10, carbs: 10, fiber: 10, sugar: 0, salt: 0 })).toBe(190);
  });

  it('isPlausible', () => {
    expect(isPlausible(recipeTotals(overnightOats, lookup))).toBe(true);
    expect(isPlausible({ kcal: 100, protein: 20, fat: 10, carbs: 20, fiber: 0, sugar: 0, salt: 0 })).toBe(false);
    // kleine Werte: 10 kcal Toleranz
    expect(isPlausible({ kcal: 8, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 0 })).toBe(true);
    expect(isPlausible({ kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 95 })).toBe(true);
  });
});
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run src/domain/nutrition.test.ts`
Expected: FAIL – `Failed to resolve import "./nutrition"`

- [ ] **Step 3: `src/domain/nutrition.ts`**

```ts
import { NUTRIENT_KEYS, type Nutrients, type Recipe } from './types';
import { recipeGrams, type IngredientLookup } from './recipe';

export const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 0 };

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const r = { ...ZERO };
  for (const k of NUTRIENT_KEYS) r[k] = a[k] + b[k];
  return r;
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const r = { ...ZERO };
  for (const k of NUTRIENT_KEYS) r[k] = n[k] * factor;
  return r;
}

/** Nährwerte des ganzen Rezepts (alle Grundportionen), ohne optionale Zutaten. */
export function recipeTotals(recipe: Recipe, lookup: IngredientLookup): Nutrients {
  let total = ZERO;
  for (const { ingredient, grams } of recipeGrams(recipe, lookup)) {
    total = addNutrients(total, scaleNutrients(ingredient.per100g, grams / 100));
  }
  return total;
}

export function perPortion(recipe: Recipe, lookup: IngredientLookup): Nutrients {
  return scaleNutrients(recipeTotals(recipe, lookup), 1 / recipe.servings);
}

/** Energie aus Makros nach BLS-Formel (ohne Alkohol, org. Säuren, Zuckeralkohole). */
export function computedKcal(n: Nutrients): number {
  return 4 * n.protein + 4 * n.carbs + 9 * n.fat + 2 * n.fiber;
}

export function isPlausible(n: Nutrients): boolean {
  return Math.abs(n.kcal - computedKcal(n)) <= Math.max(0.15 * n.kcal, 10);
}
```

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/domain/nutrition.test.ts && npm run typecheck`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/nutrition.ts src/domain/nutrition.test.ts
git commit -m "feat: Nährwertberechnung und Plausibilitätsprüfung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ernährungsform & Allergene ableiten

**Files:**
- Create: `src/domain/diet.ts`
- Test: `src/domain/diet.test.ts`

**Interfaces:**
- Consumes: `IngredientLookup`, `MissingIngredientError`, `makeLookup` (Task 3); `DIETS`, `Diet`, `Flag`, `Allergen`, `Recipe` (Task 2).
- Produces: `interface RecipeProfile { flags: ReadonlySet<Flag>; allergens: ReadonlySet<Allergen>; ingredientIds: ReadonlySet<string> }`, `recipeProfile(recipe, lookup): RecipeProfile` (berücksichtigt **auch optionale** Zutaten), `fitsDiet(diet: Diet, flags: ReadonlySet<Flag>): boolean`, `dietsOf(flags: ReadonlySet<Flag>): Diet[]`

- [ ] **Step 1: Failing Test `src/domain/diet.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { dietsOf, fitsDiet, recipeProfile } from './diet';
import { makeLookup, MissingIngredientError } from './recipe';
import { allIngredients, chili, lachsPfanne, overnightOats } from './fixtures.test-data';
import type { Recipe } from './types';

const lookup = makeLookup(allIngredients);

describe('diet', () => {
  it('vegetarisches Rezept mit Milch', () => {
    const p = recipeProfile(overnightOats, lookup);
    expect(dietsOf(p.flags)).toEqual(['omnivore', 'pescetarian', 'vegetarian']);
    expect([...p.allergens].sort()).toEqual(['gluten', 'milk']);
  });

  it('Fleischgericht passt nur zu omnivore; optionale Zutaten zählen für Allergene', () => {
    const p = recipeProfile(chili, lookup);
    expect(dietsOf(p.flags)).toEqual(['omnivore']);
    expect(p.allergens.has('milk')).toBe(true);
    expect(p.ingredientIds.has('magerquark')).toBe(true);
  });

  it('Fisch ist pescetarisch, nicht vegetarisch', () => {
    const p = recipeProfile(lachsPfanne, lookup);
    expect(fitsDiet('pescetarian', p.flags)).toBe(true);
    expect(fitsDiet('vegetarian', p.flags)).toBe(false);
  });

  it('pork impliziert meat und animal', () => {
    const r: Recipe = { ...chili, ingredients: [{ ingredientId: 'schweinehack', amount: 500, unit: 'g' }] };
    const p = recipeProfile(r, lookup);
    expect(p.flags.has('meat')).toBe(true);
    expect(p.flags.has('animal')).toBe(true);
    expect(fitsDiet('pescetarian', p.flags)).toBe(false);
  });

  it('rein pflanzlich ist vegan', () => {
    const r: Recipe = {
      ...chili,
      ingredients: [
        { ingredientId: 'haferflocken', amount: 50, unit: 'g' },
        { ingredientId: 'olivenoel', amount: 1, unit: 'el' },
      ],
    };
    expect(dietsOf(recipeProfile(r, lookup).flags)).toEqual(['omnivore', 'pescetarian', 'vegetarian', 'vegan']);
  });

  it('unbekannte Zutat → MissingIngredientError', () => {
    const r: Recipe = { ...chili, ingredients: [{ ingredientId: 'weg', amount: 1, unit: 'g' }] };
    expect(() => recipeProfile(r, lookup)).toThrow(MissingIngredientError);
  });
});
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run src/domain/diet.test.ts`
Expected: FAIL – `Failed to resolve import "./diet"`

- [ ] **Step 3: `src/domain/diet.ts`**

```ts
import { DIETS, type Allergen, type Diet, type Flag, type Recipe } from './types';
import { MissingIngredientError, type IngredientLookup } from './recipe';

const ANIMAL_FLAGS: readonly Flag[] = ['meat', 'pork', 'fish', 'dairy', 'egg', 'honey'];

export interface RecipeProfile {
  flags: ReadonlySet<Flag>;
  allergens: ReadonlySet<Allergen>;
  ingredientIds: ReadonlySet<string>;
}

/**
 * Eigenschaften eines Rezepts aus seinen Zutaten.
 * Optionale Zutaten zählen mit – bei Allergien und Ernährungsform gilt Sicherheit vor Bequemlichkeit.
 */
export function recipeProfile(recipe: Recipe, lookup: IngredientLookup): RecipeProfile {
  const flags = new Set<Flag>();
  const allergens = new Set<Allergen>();
  const ingredientIds = new Set<string>();
  for (const ri of recipe.ingredients) {
    const ing = lookup(ri.ingredientId);
    if (!ing) throw new MissingIngredientError(recipe.id, ri.ingredientId);
    ingredientIds.add(ing.id);
    for (const f of ing.flags) flags.add(f);
    for (const a of ing.allergens) allergens.add(a);
  }
  if (flags.has('pork')) flags.add('meat');
  if (ANIMAL_FLAGS.some((f) => flags.has(f))) flags.add('animal');
  return { flags, allergens, ingredientIds };
}

export function fitsDiet(diet: Diet, flags: ReadonlySet<Flag>): boolean {
  switch (diet) {
    case 'omnivore':
      return true;
    case 'pescetarian':
      return !flags.has('meat');
    case 'vegetarian':
      return !flags.has('meat') && !flags.has('fish');
    case 'vegan':
      return !flags.has('animal');
  }
}

export function dietsOf(flags: ReadonlySet<Flag>): Diet[] {
  return DIETS.filter((d) => fitsDiet(d, flags));
}
```

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/domain/diet.test.ts && npm run typecheck`
Expected: PASS (6 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/diet.ts src/domain/diet.test.ts
git commit -m "feat: Ernährungsform und Allergene aus Zutaten ableiten

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Preise & Packungswahl

**Files:**
- Create: `src/domain/pricing.ts`
- Test: `src/domain/pricing.test.ts`

**Interfaces:**
- Consumes: `recipeGrams`, `IngredientLookup`, `makeLookup` (Task 3); `Ingredient`, `Package`, `Recipe` (Task 2).
- Produces: `type PriceOverrides = ReadonlyMap<string, readonly Package[]>`, `packagesFor(ing, overrides?): readonly Package[]`, `pricePerGram(ing, overrides?): number | null`, `interface PackagePick { sizeG: number; priceEur: number; count: number }`, `interface PackageChoice { picks: PackagePick[]; totalG: number; totalEur: number }`, `choosePackages(neededG: number, packages: readonly Package[]): PackageChoice | null`, `interface CostResult { eur: number; missingPrices: string[] }`, `recipeCostPerPortion(recipe, lookup, overrides?): CostResult`

- [ ] **Step 1: Failing Test `src/domain/pricing.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { choosePackages, packagesFor, pricePerGram, recipeCostPerPortion } from './pricing';
import { makeLookup } from './recipe';
import { allIngredients, chili, magerquark, overnightOats, rinderhack } from './fixtures.test-data';

const lookup = makeLookup(allIngredients);

describe('choosePackages', () => {
  const quark = magerquark.packages; // 250 g à 0,79 €, 500 g à 1,29 €

  it('günstigste Kombination, die reicht', () => {
    expect(choosePackages(600, quark)).toEqual({
      picks: [
        { sizeG: 500, priceEur: 1.29, count: 1 },
        { sizeG: 250, priceEur: 0.79, count: 1 },
      ],
      totalG: 750,
      totalEur: 2.08,
    });
  });

  it('große Packung, wenn günstiger als zwei kleine', () => {
    expect(choosePackages(400, quark)).toEqual({
      picks: [{ sizeG: 500, priceEur: 1.29, count: 1 }],
      totalG: 500,
      totalEur: 1.29,
    });
  });

  it('kleine Menge → kleine Packung', () => {
    expect(choosePackages(200, quark)?.totalEur).toBe(0.79);
  });

  it('bei gleichem Preis weniger Rest', () => {
    const r = choosePackages(400, [
      { sizeG: 1000, priceEur: 1 },
      { sizeG: 500, priceEur: 1 },
    ]);
    expect(r?.totalG).toBe(500);
  });

  it('0 g → nichts kaufen; keine Packungen → null', () => {
    expect(choosePackages(0, quark)).toEqual({ picks: [], totalG: 0, totalEur: 0 });
    expect(choosePackages(100, [])).toBeNull();
  });

  it('Cent-genau ohne Rundungsfehler', () => {
    // 3 × 0,10 € ergibt als Float 0,30000000000000004
    expect(choosePackages(300, [{ sizeG: 100, priceEur: 0.1 }])?.totalEur).toBe(0.3);
  });
});

describe('Preis pro Gramm / Portion', () => {
  it('günstigster €/g-Wert', () => {
    expect(pricePerGram(magerquark)).toBeCloseTo(1.29 / 500, 10);
  });

  it('eigene Preise ersetzen Richtpreise, leere Liste nicht', () => {
    const overrides = new Map([['rinderhack', [{ sizeG: 500, priceEur: 3.99 }]]]);
    expect(packagesFor(rinderhack, overrides)).toEqual([{ sizeG: 500, priceEur: 3.99 }]);
    expect(packagesFor(rinderhack, new Map([['rinderhack', []]]))).toBe(rinderhack.packages);
  });

  it('Kosten pro Portion ohne Grundvorrat (Salz)', () => {
    expect(recipeCostPerPortion(overnightOats, lookup).eur).toBeCloseTo(0.555, 3);
    expect(recipeCostPerPortion(chili, lookup).eur).toBeCloseTo(1.30575, 4);
  });

  it('Kosten mit eigenem Preis', () => {
    const overrides = new Map([['rinderhack', [{ sizeG: 500, priceEur: 3.99 }]]]);
    expect(recipeCostPerPortion(chili, lookup, overrides).eur).toBeCloseTo(1.05575, 4);
  });

  it('fehlende Preise werden gemeldet', () => {
    const ohnePreis = makeLookup(allIngredients.map((i) => (i.id === 'zwiebel' ? { ...i, packages: [] } : i)));
    expect(recipeCostPerPortion(chili, ohnePreis).missingPrices).toEqual(['zwiebel']);
  });
});
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run src/domain/pricing.test.ts`
Expected: FAIL – `Failed to resolve import "./pricing"`

- [ ] **Step 3: `src/domain/pricing.ts`**

```ts
import type { Ingredient, Package, Recipe } from './types';
import { recipeGrams, type IngredientLookup } from './recipe';

/** Eigene Preise des Haushalts: ingredientId → Packungen */
export type PriceOverrides = ReadonlyMap<string, readonly Package[]>;

export function packagesFor(ing: Ingredient, overrides?: PriceOverrides): readonly Package[] {
  const own = overrides?.get(ing.id);
  return own && own.length > 0 ? own : ing.packages;
}

export function pricePerGram(ing: Ingredient, overrides?: PriceOverrides): number | null {
  let best: number | null = null;
  for (const p of packagesFor(ing, overrides)) {
    if (p.sizeG <= 0) continue;
    const perGram = p.priceEur / p.sizeG;
    if (best === null || perGram < best) best = perGram;
  }
  return best;
}

export interface PackagePick {
  sizeG: number;
  priceEur: number;
  count: number;
}

export interface PackageChoice {
  picks: PackagePick[];
  totalG: number;
  totalEur: number;
}

/**
 * Günstigste Packungskombination mit mindestens neededG Gramm.
 * Bei gleichem Preis gewinnt die Kombination mit weniger Rest.
 * Rechnet intern in ganzen Gramm und ganzen Cent (dynamische Programmierung).
 */
export function choosePackages(neededG: number, packages: readonly Package[]): PackageChoice | null {
  const usable = packages
    .filter((p) => p.sizeG > 0 && p.priceEur >= 0)
    .map((p) => ({ size: Math.round(p.sizeG), cents: Math.round(p.priceEur * 100), pkg: p }))
    .filter((u) => u.size > 0);
  if (usable.length === 0) return null;
  const needed = Math.max(0, Math.ceil(neededG - 1e-9));
  if (needed === 0) return { picks: [], totalG: 0, totalEur: 0 };

  const limit = needed + Math.max(...usable.map((u) => u.size));
  const cost = new Array<number>(limit + 1).fill(Infinity);
  const via = new Array<number>(limit + 1).fill(-1);
  cost[0] = 0;
  for (let a = 1; a <= limit; a++) {
    for (const [i, u] of usable.entries()) {
      if (u.size > a) continue;
      const candidate = (cost[a - u.size] ?? Infinity) + u.cents;
      if (candidate < (cost[a] ?? Infinity)) {
        cost[a] = candidate;
        via[a] = i;
      }
    }
  }

  let best = -1;
  for (let a = needed; a <= limit; a++) {
    const c = cost[a] ?? Infinity;
    if (c !== Infinity && (best === -1 || c < (cost[best] ?? Infinity))) best = a;
  }
  if (best === -1) return null;

  const counts = new Map<number, number>();
  for (let a = best; a > 0; ) {
    const i = via[a] ?? -1;
    const u = usable[i];
    if (!u) break;
    counts.set(i, (counts.get(i) ?? 0) + 1);
    a -= u.size;
  }
  const picks: PackagePick[] = [];
  for (const [i, u] of usable.entries()) {
    const count = counts.get(i);
    if (count) picks.push({ sizeG: u.pkg.sizeG, priceEur: u.pkg.priceEur, count });
  }
  picks.sort((x, y) => y.sizeG - x.sizeG);
  return { picks, totalG: best, totalEur: (cost[best] ?? 0) / 100 };
}

export interface CostResult {
  /** anteiliger Warenwert pro Portion (ohne Grundvorrat, ohne Packungsreste) */
  eur: number;
  missingPrices: string[];
}

export function recipeCostPerPortion(
  recipe: Recipe,
  lookup: IngredientLookup,
  overrides?: PriceOverrides,
): CostResult {
  let eur = 0;
  const missingPrices: string[] = [];
  for (const { ingredient, grams } of recipeGrams(recipe, lookup)) {
    if (ingredient.pantryStaple) continue;
    const perGram = pricePerGram(ingredient, overrides);
    if (perGram === null) {
      missingPrices.push(ingredient.id);
      continue;
    }
    eur += perGram * grams;
  }
  return { eur: eur / recipe.servings, missingPrices };
}
```

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/domain/pricing.test.ts && npm run typecheck`
Expected: PASS (11 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pricing.ts src/domain/pricing.test.ts
git commit -m "feat: Preise pro Portion und günstigste Packungswahl

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Einkaufsliste

**Files:**
- Create: `src/domain/shopping.ts`
- Test: `src/domain/shopping.test.ts`

**Interfaces:**
- Consumes: `toGrams`, `UnitError` (Task 3); `IngredientLookup`, `makeLookup` (Task 3); `choosePackages`, `packagesFor`, `PackageChoice`, `PriceOverrides` (Task 6); `CATEGORIES`, `Category`, `Ingredient`, `IsoDate`, `Meal`, `Recipe` (Task 2).
- Produces: `interface ShoppingContext { lookupIngredient: IngredientLookup; lookupRecipe: (id: string) => Recipe | undefined; overrides?: PriceOverrides }`, `interface DateRange { from: IsoDate; to: IsoDate }`, `interface ShoppingItem { ingredientId: string; name: string; category: Category; neededG: number; pantryStaple: boolean; choice: PackageChoice | null; priceEur: number | null }`, `interface ShoppingList { items: ShoppingItem[]; totalEur: number; warnings: string[] }`, `buildShoppingList(meals: readonly Meal[], ctx: ShoppingContext, range: DateRange): ShoppingList`

Maßgeblich ist `meal.cookDate` (Tag der Zubereitung), nicht `meal.date`.

- [ ] **Step 1: Failing Test `src/domain/shopping.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildShoppingList, type ShoppingContext } from './shopping';
import { makeLookup } from './recipe';
import { allIngredients, allRecipes } from './fixtures.test-data';
import type { Meal } from './types';

const ctx: ShoppingContext = {
  lookupIngredient: makeLookup(allIngredients),
  lookupRecipe: makeLookup(allRecipes),
};

function meal(part: Partial<Meal>): Meal {
  return {
    id: 'm',
    date: '2026-09-28',
    slot: 'lunch',
    recipeId: 'chili',
    cookDate: '2026-09-27',
    portions: { a: 1, b: 1 },
    pinned: false,
    ...part,
  };
}

const woche = { from: '2026-09-27', to: '2026-10-03' };

describe('buildShoppingList', () => {
  it('fasst Mahlzeiten zusammen, rundet auf Packungen, sortiert nach Bereich', () => {
    const list = buildShoppingList(
      [meal({ id: '1', portions: { a: 1.4, b: 0.9 } }), meal({ id: '2', date: '2026-09-29' })],
      ctx,
      woche,
    );
    // Faktor (2,3 + 2) / 4 = 1,075
    expect(list.items.map((i) => i.ingredientId)).toEqual(['zwiebel', 'rinderhack', 'olivenoel', 'salz']);
    const hack = list.items.find((i) => i.ingredientId === 'rinderhack');
    expect(hack?.neededG).toBeCloseTo(537.5, 5);
    expect(hack?.choice?.picks).toEqual([{ sizeG: 500, priceEur: 4.99, count: 2 }]);
    expect(hack?.priceEur).toBe(9.98);
    const salzItem = list.items.find((i) => i.ingredientId === 'salz');
    expect(salzItem?.pantryStaple).toBe(true);
    expect(salzItem?.priceEur).toBeNull();
    expect(list.totalEur).toBe(17.76);
    expect(list.warnings).toEqual([]);
  });

  it('optionale Zutaten stehen nicht auf der Liste', () => {
    const list = buildShoppingList([meal({})], ctx, woche);
    expect(list.items.some((i) => i.ingredientId === 'magerquark')).toBe(false);
  });

  it('filtert nach Kochtag, nicht nach Esstag', () => {
    const list = buildShoppingList(
      [meal({ date: '2026-09-28', cookDate: '2026-09-26' })],
      ctx,
      { from: '2026-09-27', to: '2026-09-27' },
    );
    expect(list.items).toEqual([]);
  });

  it('0 Portionen oder negative Werte zählen nicht', () => {
    const list = buildShoppingList([meal({ portions: { a: 0, b: -1 } })], ctx, woche);
    expect(list.items).toEqual([]);
    expect(list.totalEur).toBe(0);
  });

  it('gelöschtes Rezept oder gelöschte Zutat → Warnung statt Absturz', () => {
    const ohneZwiebel: ShoppingContext = {
      ...ctx,
      lookupIngredient: makeLookup(allIngredients.filter((i) => i.id !== 'zwiebel')),
    };
    const list = buildShoppingList([meal({ recipeId: 'weg' }), meal({ id: '2' })], ohneZwiebel, woche);
    expect(list.warnings).toEqual([
      'Rezept weg ist nicht mehr verfügbar (2026-09-28)',
      'Chili: Zutat zwiebel ist nicht mehr verfügbar',
    ]);
    expect(list.items.map((i) => i.ingredientId)).toEqual(['rinderhack', 'olivenoel', 'salz']);
  });

  it('Zutat ohne Preis → Warnung, Summe ohne diese Zutat', () => {
    const ohnePreis: ShoppingContext = {
      ...ctx,
      lookupIngredient: makeLookup(allIngredients.map((i) => (i.id === 'olivenoel' ? { ...i, packages: [] } : i))),
    };
    const list = buildShoppingList([meal({})], ohnePreis, woche);
    expect(list.warnings).toEqual(['Kein Preis für Olivenöl hinterlegt']);
    expect(list.items.find((i) => i.ingredientId === 'olivenoel')?.priceEur).toBeNull();
  });
});
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run src/domain/shopping.test.ts`
Expected: FAIL – `Failed to resolve import "./shopping"`

- [ ] **Step 3: `src/domain/shopping.ts`**

```ts
import { CATEGORIES, type Category, type Ingredient, type IsoDate, type Meal, type Recipe } from './types';
import type { IngredientLookup } from './recipe';
import { toGrams, UnitError } from './units';
import { choosePackages, packagesFor, type PackageChoice, type PriceOverrides } from './pricing';

export interface ShoppingContext {
  lookupIngredient: IngredientLookup;
  lookupRecipe: (id: string) => Recipe | undefined;
  overrides?: PriceOverrides;
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export interface ShoppingItem {
  ingredientId: string;
  name: string;
  category: Category;
  neededG: number;
  pantryStaple: boolean;
  choice: PackageChoice | null;
  priceEur: number | null;
}

export interface ShoppingList {
  items: ShoppingItem[];
  totalEur: number;
  warnings: string[];
}

/** Einkaufsliste für alle Mahlzeiten, deren Kochtag im Zeitraum liegt (Grenzen inklusive). */
export function buildShoppingList(meals: readonly Meal[], ctx: ShoppingContext, range: DateRange): ShoppingList {
  const needed = new Map<string, { ingredient: Ingredient; grams: number }>();
  const warnings: string[] = [];

  for (const meal of meals) {
    if (meal.cookDate < range.from || meal.cookDate > range.to) continue;
    const recipe = ctx.lookupRecipe(meal.recipeId);
    if (!recipe) {
      warnings.push(`Rezept ${meal.recipeId} ist nicht mehr verfügbar (${meal.date})`);
      continue;
    }
    const portions = Object.values(meal.portions).reduce((sum, p) => sum + Math.max(0, p), 0);
    if (portions === 0) continue;
    const factor = portions / recipe.servings;

    for (const ri of recipe.ingredients) {
      if (ri.optional) continue;
      const ingredient = ctx.lookupIngredient(ri.ingredientId);
      if (!ingredient) {
        warnings.push(`${recipe.title}: Zutat ${ri.ingredientId} ist nicht mehr verfügbar`);
        continue;
      }
      let grams: number;
      try {
        grams = toGrams(ri.amount, ri.unit, ingredient) * factor;
      } catch (e) {
        if (!(e instanceof UnitError)) throw e;
        warnings.push(`${recipe.title}: ${e.message}`);
        continue;
      }
      const entry = needed.get(ingredient.id);
      if (entry) entry.grams += grams;
      else needed.set(ingredient.id, { ingredient, grams });
    }
  }

  const items: ShoppingItem[] = [];
  for (const { ingredient, grams } of needed.values()) {
    const base = {
      ingredientId: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      neededG: grams,
      pantryStaple: ingredient.pantryStaple,
    };
    if (ingredient.pantryStaple) {
      items.push({ ...base, choice: null, priceEur: null });
      continue;
    }
    const choice = choosePackages(grams, packagesFor(ingredient, ctx.overrides));
    if (!choice) warnings.push(`Kein Preis für ${ingredient.name} hinterlegt`);
    items.push({ ...base, choice, priceEur: choice ? choice.totalEur : null });
  }

  items.sort(
    (a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name, 'de'),
  );
  const totalCents = items.reduce((sum, i) => sum + Math.round((i.priceEur ?? 0) * 100), 0);
  return { items, totalEur: totalCents / 100, warnings };
}
```

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/domain/shopping.test.ts && npm run typecheck`
Expected: PASS (6 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/shopping.ts src/domain/shopping.test.ts
git commit -m "feat: Einkaufsliste mit Packungsrundung und Warnungen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Harte Regeln

**Files:**
- Create: `src/domain/rules.ts`
- Test: `src/domain/rules.test.ts`

**Interfaces:**
- Consumes: `recipeProfile`, `fitsDiet` (Task 5); `MissingIngredientError`, `IngredientLookup`, `makeLookup` (Task 3); `diffDays`, `isoWeekday` (Task 2); `ALLERGEN_LABEL`, `DIET_LABEL`, `MEAL_TYPE_LABEL` (Task 2); `Meal`, `MealType`, `Person`, `Recipe` (Task 2).
- Produces: `type ViolationCode = 'diet' | 'pork' | 'allergen' | 'disliked' | 'slot' | 'storage' | 'time' | 'missing'`, `interface Violation { code: ViolationCode; personId?: string; message: string }`, `checkRecipeForPerson(recipe, person, lookup): Violation[]`, `checkSlot(recipe, slot: MealType): Violation[]`, `checkStorage(meal: Pick<Meal, 'date' | 'cookDate'>, recipe): Violation[]`, `checkTime(recipe, person, isCookDay: boolean): Violation[]`, `interface MealCheckContext { lookupIngredient: IngredientLookup; lookupRecipe: (id: string) => Recipe | undefined; persons: readonly Person[]; cookWeekdays: readonly number[] }`, `checkMeal(meal: Meal, ctx: MealCheckContext): Violation[]`

- [ ] **Step 1: Failing Test `src/domain/rules.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { checkMeal, checkRecipeForPerson, checkSlot, checkStorage, checkTime, type MealCheckContext } from './rules';
import { makeLookup } from './recipe';
import { allIngredients, allRecipes, chili, lachsPfanne, overnightOats } from './fixtures.test-data';
import type { Meal, Person, Recipe } from './types';

const lookup = makeLookup(allIngredients);

function person(part: Partial<Person>): Person {
  return {
    id: 'a',
    name: 'Alex',
    targets: { kcal: 2500, proteinMin: 150 },
    mealSlots: ['breakfast', 'lunch', 'dinner'],
    diet: 'omnivore',
    noPork: false,
    allergies: [],
    dislikedIngredientIds: [],
    maxMinutesWeekday: 30,
    maxMinutesCookDay: 120,
    ...part,
  };
}

describe('checkRecipeForPerson', () => {
  it('passt → keine Verstöße', () => {
    expect(checkRecipeForPerson(chili, person({}), lookup)).toEqual([]);
  });

  it('Ernährungsform', () => {
    const v = checkRecipeForPerson(chili, person({ diet: 'vegetarian' }), lookup);
    expect(v).toEqual([
      { code: 'diet', personId: 'a', message: 'Chili passt nicht zur Ernährungsform von Alex (vegetarisch)' },
    ]);
  });

  it('kein Schwein', () => {
    const r: Recipe = { ...chili, title: 'Frikadellen', ingredients: [{ ingredientId: 'schweinehack', amount: 500, unit: 'g' }] };
    expect(checkRecipeForPerson(r, person({ noPork: true }), lookup).map((v) => v.code)).toEqual(['pork']);
  });

  it('Allergie – auch über optionale Zutaten', () => {
    const v = checkRecipeForPerson(chili, person({ allergies: ['milk'] }), lookup);
    expect(v).toEqual([
      { code: 'allergen', personId: 'a', message: 'Chili enthält Milch – Allergie/Unverträglichkeit von Alex' },
    ]);
  });

  it('abgelehnte Zutat', () => {
    const v = checkRecipeForPerson(chili, person({ dislikedIngredientIds: ['zwiebel'] }), lookup);
    expect(v).toEqual([{ code: 'disliked', personId: 'a', message: 'Chili enthält Zwiebel – mag Alex nicht' }]);
  });
});

describe('checkSlot / checkStorage / checkTime', () => {
  it('Slot', () => {
    expect(checkSlot(chili, 'dinner')).toEqual([]);
    expect(checkSlot(chili, 'breakfast')).toEqual([{ code: 'slot', message: 'Chili ist nicht als Frühstück gedacht' }]);
  });

  it('vorgekocht: innerhalb der Haltbarkeit ok, danach Verstoß', () => {
    expect(checkStorage({ cookDate: '2026-09-27', date: '2026-10-01' }, chili)).toEqual([]);
    expect(checkStorage({ cookDate: '2026-09-27', date: '2026-10-02' }, chili)).toEqual([
      { code: 'storage', message: 'Chili hält nur 4 Tage im Kühlschrank (hier 5 Tage)' },
    ]);
  });

  it('frisch: nur am selben Tag', () => {
    expect(checkStorage({ cookDate: '2026-09-28', date: '2026-09-28' }, lachsPfanne)).toEqual([]);
    expect(checkStorage({ cookDate: '2026-09-28', date: '2026-09-29' }, lachsPfanne)).toEqual([
      { code: 'storage', message: 'Lachs aus der Pfanne sollte am Tag der Zubereitung gegessen werden' },
    ]);
  });

  it('gegessen vor dem Kochen', () => {
    expect(checkStorage({ cookDate: '2026-09-28', date: '2026-09-27' }, overnightOats)).toEqual([
      { code: 'storage', message: 'Overnight Oats mit Quark wird gegessen, bevor es gekocht ist' },
    ]);
  });

  it('Zeitlimit werktags vs. Kochtag', () => {
    const p = person({ maxMinutesWeekday: 20, maxMinutesCookDay: 120 });
    expect(checkTime(lachsPfanne, p, false)).toEqual([
      { code: 'time', personId: 'a', message: 'Lachs aus der Pfanne dauert 25 Min. – Alex hat an diesem Tag max. 20 Min.' },
    ]);
    expect(checkTime(lachsPfanne, p, true)).toEqual([]);
  });
});

describe('checkMeal', () => {
  const persons = [person({ id: 'a', name: 'Alex' }), person({ id: 'b', name: 'Bea', diet: 'vegetarian' })];
  const ctx: MealCheckContext = {
    lookupIngredient: lookup,
    lookupRecipe: makeLookup(allRecipes),
    persons,
    cookWeekdays: [7],
  };
  const base: Meal = {
    id: 'm1',
    date: '2026-09-28',
    slot: 'lunch',
    recipeId: 'chili',
    cookDate: '2026-09-27',
    portions: { a: 1.4, b: 0.9 },
    pinned: false,
  };

  it('prüft jede essende Person', () => {
    expect(checkMeal(base, ctx).map((v) => [v.code, v.personId])).toEqual([['diet', 'b']]);
  });

  it('Personen mit 0 Portionen oder unbekannte IDs werden ignoriert', () => {
    expect(checkMeal({ ...base, portions: { a: 1, b: 0, x: 1 } }, ctx)).toEqual([]);
  });

  it('Kochtag-Zeitlimit gilt am Kochtag (Sonntag)', () => {
    const lang: Recipe = { ...chili, id: 'lang', cookMinutes: 90 };
    const c = { ...ctx, lookupRecipe: makeLookup([...allRecipes, lang]) };
    expect(checkMeal({ ...base, recipeId: 'lang', portions: { a: 1 } }, c)).toEqual([]);
    expect(
      checkMeal({ ...base, recipeId: 'lang', portions: { a: 1 }, cookDate: '2026-09-28' }, c).map((v) => v.code),
    ).toEqual(['time']);
  });

  it('fehlendes Rezept oder fehlende Zutat → missing statt Absturz', () => {
    expect(checkMeal({ ...base, recipeId: 'weg' }, ctx)).toEqual([
      { code: 'missing', message: 'Rezept weg ist nicht mehr verfügbar' },
    ]);
    const ohneZwiebel = { ...ctx, lookupIngredient: makeLookup(allIngredients.filter((i) => i.id !== 'zwiebel')) };
    expect(checkMeal({ ...base, portions: { a: 1 } }, ohneZwiebel).map((v) => v.code)).toEqual(['missing']);
  });
});
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run src/domain/rules.test.ts`
Expected: FAIL – `Failed to resolve import "./rules"`

- [ ] **Step 3: `src/domain/rules.ts`**

```ts
import type { Meal, MealType, Person, Recipe } from './types';
import { ALLERGEN_LABEL, DIET_LABEL, MEAL_TYPE_LABEL } from './labels';
import { fitsDiet, recipeProfile } from './diet';
import { MissingIngredientError, type IngredientLookup } from './recipe';
import { diffDays, isoWeekday } from './dates';

export type ViolationCode = 'diet' | 'pork' | 'allergen' | 'disliked' | 'slot' | 'storage' | 'time' | 'missing';

export interface Violation {
  code: ViolationCode;
  personId?: string;
  message: string;
}

export function checkRecipeForPerson(recipe: Recipe, person: Person, lookup: IngredientLookup): Violation[] {
  const profile = recipeProfile(recipe, lookup);
  const v: Violation[] = [];
  const personId = person.id;
  if (!fitsDiet(person.diet, profile.flags)) {
    v.push({
      code: 'diet',
      personId,
      message: `${recipe.title} passt nicht zur Ernährungsform von ${person.name} (${DIET_LABEL[person.diet]})`,
    });
  }
  if (person.noPork && profile.flags.has('pork')) {
    v.push({ code: 'pork', personId, message: `${recipe.title} enthält Schweinefleisch – ${person.name} isst kein Schwein` });
  }
  for (const allergen of person.allergies) {
    if (profile.allergens.has(allergen)) {
      v.push({
        code: 'allergen',
        personId,
        message: `${recipe.title} enthält ${ALLERGEN_LABEL[allergen]} – Allergie/Unverträglichkeit von ${person.name}`,
      });
    }
  }
  for (const id of person.dislikedIngredientIds) {
    if (profile.ingredientIds.has(id)) {
      const name = lookup(id)?.name ?? id;
      v.push({ code: 'disliked', personId, message: `${recipe.title} enthält ${name} – mag ${person.name} nicht` });
    }
  }
  return v;
}

export function checkSlot(recipe: Recipe, slot: MealType): Violation[] {
  if (recipe.mealTypes.includes(slot)) return [];
  return [{ code: 'slot', message: `${recipe.title} ist nicht als ${MEAL_TYPE_LABEL[slot]} gedacht` }];
}

export function checkStorage(meal: Pick<Meal, 'date' | 'cookDate'>, recipe: Recipe): Violation[] {
  const days = diffDays(meal.cookDate, meal.date);
  if (days < 0) {
    return [{ code: 'storage', message: `${recipe.title} wird gegessen, bevor es gekocht ist` }];
  }
  if (recipe.storage.kind === 'fresh') {
    if (days === 0) return [];
    return [{ code: 'storage', message: `${recipe.title} sollte am Tag der Zubereitung gegessen werden` }];
  }
  if (days <= recipe.storage.fridgeDays) return [];
  return [
    {
      code: 'storage',
      message: `${recipe.title} hält nur ${recipe.storage.fridgeDays} Tage im Kühlschrank (hier ${days} Tage)`,
    },
  ];
}

export function checkTime(recipe: Recipe, person: Person, isCookDay: boolean): Violation[] {
  const minutes = recipe.prepMinutes + recipe.cookMinutes;
  const limit = isCookDay ? person.maxMinutesCookDay : person.maxMinutesWeekday;
  if (minutes <= limit) return [];
  return [
    {
      code: 'time',
      personId: person.id,
      message: `${recipe.title} dauert ${minutes} Min. – ${person.name} hat ${isCookDay ? 'am Kochtag' : 'an diesem Tag'} max. ${limit} Min.`,
    },
  ];
}

export interface MealCheckContext {
  lookupIngredient: IngredientLookup;
  lookupRecipe: (id: string) => Recipe | undefined;
  persons: readonly Person[];
  /** 1 = Montag … 7 = Sonntag */
  cookWeekdays: readonly number[];
}

/** Alle harten Regeln für eine Mahlzeit im Plan. */
export function checkMeal(meal: Meal, ctx: MealCheckContext): Violation[] {
  const recipe = ctx.lookupRecipe(meal.recipeId);
  if (!recipe) return [{ code: 'missing', message: `Rezept ${meal.recipeId} ist nicht mehr verfügbar` }];
  const eaters = ctx.persons.filter((p) => (meal.portions[p.id] ?? 0) > 0);
  const isCookDay = ctx.cookWeekdays.includes(isoWeekday(meal.cookDate));
  try {
    const v: Violation[] = [...checkSlot(recipe, meal.slot), ...checkStorage(meal, recipe)];
    for (const p of eaters) {
      v.push(...checkRecipeForPerson(recipe, p, ctx.lookupIngredient), ...checkTime(recipe, p, isCookDay));
    }
    return v;
  } catch (e) {
    if (e instanceof MissingIngredientError) return [{ code: 'missing', message: e.message }];
    throw e;
  }
}
```

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/domain/rules.test.ts && npm run typecheck`
Expected: PASS (14 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/rules.ts src/domain/rules.test.ts
git commit -m "feat: harte Regeln für Mahlzeiten (Ernährung, Allergene, Haltbarkeit, Zeit)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Ziel-Rechner

**Files:**
- Create: `src/domain/targets.ts`
- Test: `src/domain/targets.test.ts`

**Interfaces:**
- Consumes: `Targets` (Task 2).
- Produces: `type Sex = 'male' | 'female'`, `type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'`, `type Goal = 'lose' | 'maintain' | 'gain'`, `interface BodyData { weightKg: number; heightCm: number; ageYears: number; sex: Sex; activity: Activity; goal: Goal }`, `ACTIVITY_FACTOR: Record<Activity, number>`, `bmr(b: BodyData): number`, `suggestTargets(b: BodyData): Required<Targets>`

Formel: Grundumsatz nach Mifflin-St-Jeor = 10·kg + 6,25·cm − 5·Jahre + (Mann +5 / Frau −161); × Aktivitätsfaktor; × Ziel (abnehmen 0,85 / halten 1,0 / aufbauen 1,1); auf 10 kcal gerundet. Protein g/kg: abnehmen 2,0 / halten 1,6 / aufbauen 1,8. Fett 25–35 % der kcal. Kohlenhydrate = Rest (Min. mit Fett-Max., Max. mit Fett-Min.).

- [ ] **Step 1: Failing Test `src/domain/targets.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { bmr, suggestTargets } from './targets';

describe('targets', () => {
  it('Grundumsatz Mifflin-St-Jeor', () => {
    expect(bmr({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male', activity: 'moderate', goal: 'maintain' })).toBe(1780);
    expect(
      bmr({ weightKg: 60, heightCm: 165, ageYears: 28, sex: 'female', activity: 'light', goal: 'lose' }),
    ).toBeCloseTo(1330.25, 2);
  });

  it('Mann, halten, moderat aktiv', () => {
    expect(
      suggestTargets({ weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male', activity: 'moderate', goal: 'maintain' }),
    ).toEqual({ kcal: 2760, proteinMin: 128, fatMin: 77, fatMax: 107, carbsMin: 321, carbsMax: 389 });
  });

  it('Frau, abnehmen, leicht aktiv', () => {
    expect(
      suggestTargets({ weightKg: 60, heightCm: 165, ageYears: 28, sex: 'female', activity: 'light', goal: 'lose' }),
    ).toEqual({ kcal: 1550, proteinMin: 120, fatMin: 43, fatMax: 60, carbsMin: 133, carbsMax: 171 });
  });

  it('unrealistische Eingaben werden abgelehnt', () => {
    const ok = { weightKg: 80, heightCm: 180, ageYears: 30, sex: 'male' as const, activity: 'moderate' as const, goal: 'maintain' as const };
    expect(() => suggestTargets({ ...ok, weightKg: 20 })).toThrow('Gewicht');
    expect(() => suggestTargets({ ...ok, heightCm: 300 })).toThrow('Größe');
    expect(() => suggestTargets({ ...ok, ageYears: 10 })).toThrow('Alter');
  });
});
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run src/domain/targets.test.ts`
Expected: FAIL – `Failed to resolve import "./targets"`

- [ ] **Step 3: `src/domain/targets.ts`**

```ts
import type { Targets } from './types';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

export interface BodyData {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activity: Activity;
  goal: Goal;
}

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_FACTOR: Record<Goal, number> = { lose: 0.85, maintain: 1, gain: 1.1 };
const PROTEIN_G_PER_KG: Record<Goal, number> = { lose: 2.0, maintain: 1.6, gain: 1.8 };

function assertRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} muss zwischen ${min} und ${max} liegen`);
  }
}

/** Grundumsatz nach Mifflin-St-Jeor in kcal */
export function bmr(b: BodyData): number {
  return 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.ageYears + (b.sex === 'male' ? 5 : -161);
}

export function suggestTargets(b: BodyData): Required<Targets> {
  assertRange(b.weightKg, 30, 300, 'Gewicht (kg)');
  assertRange(b.heightCm, 120, 230, 'Größe (cm)');
  assertRange(b.ageYears, 14, 100, 'Alter (Jahre)');

  const kcal = Math.round((bmr(b) * ACTIVITY_FACTOR[b.activity] * GOAL_FACTOR[b.goal]) / 10) * 10;
  const proteinMin = Math.round(b.weightKg * PROTEIN_G_PER_KG[b.goal]);
  const fatMin = Math.round((kcal * 0.25) / 9);
  const fatMax = Math.round((kcal * 0.35) / 9);
  const carbsMin = Math.max(0, Math.round((kcal - proteinMin * 4 - fatMax * 9) / 4));
  const carbsMax = Math.max(0, Math.round((kcal - proteinMin * 4 - fatMin * 9) / 4));
  return { kcal, proteinMin, fatMin, fatMax, carbsMin, carbsMax };
}
```

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/domain/targets.test.ts && npm run typecheck`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/targets.ts src/domain/targets.test.ts
git commit -m "feat: Ziel-Rechner nach Mifflin-St-Jeor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: BLS-Extraktion und Suche

**Files:**
- Create: `tools/bls/parse.ts`, `tools/bls/search.ts`, `tools/bls-extract.ts`, `tools/bls-search.ts`, `catalog/README.md`, `catalog/bls-slim.json` (generiert)
- Modify: `package.json` (Skripte `bls:extract`, `bls:search`)
- Test: `tools/bls/parse.test.ts`, `tools/bls/search.test.ts`

**Interfaces:**
- Consumes: `NUTRIENT_KEYS`, `Nutrients` (Task 2).
- Produces: `interface BlsEntry { code: string; name: string; nameEn: string; per100g: Nutrients; incomplete: boolean }`, `BLS_COLUMNS: Record<NutrientKey, string>`, `cellText(v: unknown): string`, `parseValue(v: unknown): number | null`, `parseRows(header: readonly unknown[], rows: readonly (readonly unknown[])[]): BlsEntry[]`, `searchBls(entries: readonly BlsEntry[], query: string, limit?: number): BlsEntry[]`; Datei `catalog/bls-slim.json` (Array von `BlsEntry`, nach `code` sortiert).

Voraussetzung: Die BLS-Datei liegt entpackt unter `data/bls/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx` (bereits vorhanden; nicht im Repo). Aufbau der Kopfzeile: Spalte „BLS Code“, „Lebensmittelbezeichnung“, „Food name“, danach je Nährstoff drei Spalten, z. B. „ENERCC Energie (Kilokalorien) [kcal/100g]“, „ENERCC Datenherkunft“, „ENERCC Referenz“. Werte sind Zahlen, `-` (fehlt), `<LOQ`/`<LOD` (unter Nachweisgrenze → 0).

- [ ] **Step 1: Failing Tests**

`tools/bls/parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cellText, parseRows, parseValue } from './parse';

const header = [
  'BLS Code',
  'Lebensmittelbezeichnung',
  'Food name',
  'ENERCJ Energie (Kilojoule) [kJ/100g]',
  'ENERCC Energie (Kilokalorien) [kcal/100g]',
  'ENERCC Datenherkunft',
  'PROT625 Protein (Nx6,25) [g/100g]',
  'FAT Fett [g/100g]',
  'FASAT Fettsäuren, gesättigt, gesamt [g/100g]',
  'CHO Kohlenhydrate, verfügbar [g/100g]',
  'CHOCAL Vitamin D3 (Cholecalciferol) [µg/100g]',
  'FIBT Ballaststoffe, gesamt [g/100g]',
  'SUGAR Zucker (Mono- und Disaccharide), gesamt [g/100g]',
  'NACL Salz (Natriumchlorid) [g/100g]',
];

describe('BLS parse', () => {
  it('parseValue', () => {
    expect(parseValue(12.5)).toBe(12.5);
    expect(parseValue('3,5')).toBe(3.5);
    expect(parseValue('-')).toBeNull();
    expect(parseValue(undefined)).toBeNull();
    expect(parseValue('<LOQ')).toBe(0);
    expect(parseValue('<LOD')).toBe(0);
  });

  it('cellText mit Rich-Text', () => {
    expect(cellText({ richText: [{ text: 'Hafer ' }, { text: 'Flocken' }] })).toBe('Hafer Flocken');
    expect(cellText(null)).toBe('');
  });

  it('ordnet Spalten über Nährstoffcode zu (nicht FASAT/CHOCAL)', () => {
    const rows = [
      ['C133000', 'Hafer Flocken', 'Oat flakes', 1465, 348, 'Formel', 13.22, 6.65, 1.2, 53.3, 0, 10.983, 1.06, 0.0051],
      ['X000001', 'Unvollständig', 'Incomplete', 100, 50, 'x', '-', 1, 0, 2, 0, 0, 0, 0],
      [undefined, '', ''],
    ];
    expect(parseRows(header, rows)).toEqual([
      {
        code: 'C133000',
        name: 'Hafer Flocken',
        nameEn: 'Oat flakes',
        per100g: { kcal: 348, protein: 13.22, fat: 6.65, carbs: 53.3, fiber: 10.983, sugar: 1.06, salt: 0.005 },
        incomplete: false,
      },
      {
        code: 'X000001',
        name: 'Unvollständig',
        nameEn: 'Incomplete',
        per100g: { kcal: 50, protein: 0, fat: 1, carbs: 2, fiber: 0, sugar: 0, salt: 0 },
        incomplete: true,
      },
    ]);
  });

  it('fehlende Spalte → Fehler', () => {
    expect(() => parseRows(header.slice(0, 5), [])).toThrow('PROT625');
  });
});
```

`tools/bls/search.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { searchBls } from './search';
import type { BlsEntry } from './parse';

const zero = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, salt: 0 };
const entries: BlsEntry[] = [
  { code: 'V416100', name: 'Hähnchen Brustfilet, roh', nameEn: 'Chicken breast fillet, raw', per100g: zero, incomplete: false },
  { code: 'V416132', name: 'Hähnchen Brustfilet, gekocht', nameEn: 'Chicken breast fillet, boiled', per100g: zero, incomplete: false },
  { code: 'C133000', name: 'Hafer Flocken', nameEn: 'Oat flakes', per100g: zero, incomplete: false },
];

describe('searchBls', () => {
  it('alle Wörter müssen vorkommen, Groß/Klein egal', () => {
    expect(searchBls(entries, 'hähnchen ROH').map((e) => e.code)).toEqual(['V416100']);
  });
  it('sucht auch im englischen Namen', () => {
    expect(searchBls(entries, 'oat').map((e) => e.code)).toEqual(['C133000']);
  });
  it('Limit', () => {
    expect(searchBls(entries, 'hähnchen', 1)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Tests ausführen**

Run: `npx vitest run tools/bls`
Expected: FAIL – `Failed to resolve import "./parse"` / `"./search"`

- [ ] **Step 3: `tools/bls/parse.ts`**

```ts
import { NUTRIENT_KEYS, type NutrientKey, type Nutrients } from '../../src/domain/types';

export interface BlsEntry {
  code: string;
  name: string;
  nameEn: string;
  per100g: Nutrients;
  /** true, wenn mindestens ein Wert im BLS fehlt ('-'); fehlende Werte stehen als 0 drin */
  incomplete: boolean;
}

/** BLS-Nährstoffcodes, siehe BLS_4_0_Components_DE_EN.xlsx */
export const BLS_COLUMNS: Record<NutrientKey, string> = {
  kcal: 'ENERCC',
  protein: 'PROT625',
  fat: 'FAT',
  carbs: 'CHO',
  fiber: 'FIBT',
  sugar: 'SUGAR',
  salt: 'NACL',
};

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in v && Array.isArray(v.richText)) {
    return v.richText.map((part: { text?: string }) => part.text ?? '').join('');
  }
  return String(v);
}

export function parseValue(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = cellText(v).trim();
  if (s === '' || s === '-') return null;
  if (s.startsWith('<')) return 0; // unter Nachweis-/Bestimmungsgrenze
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function findColumn(header: readonly unknown[], match: (h: string) => boolean, label: string): number {
  const i = header.findIndex((h) => match(cellText(h).trim()));
  if (i === -1) throw new Error(`BLS-Kopfzeile: Spalte ${label} nicht gefunden`);
  return i;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function parseRows(header: readonly unknown[], rows: readonly (readonly unknown[])[]): BlsEntry[] {
  const codeCol = findColumn(header, (h) => h === 'BLS Code', 'BLS Code');
  const nameCol = findColumn(header, (h) => h === 'Lebensmittelbezeichnung', 'Lebensmittelbezeichnung');
  const nameEnCol = findColumn(header, (h) => h === 'Food name', 'Food name');
  const nutrientCols = {} as Record<NutrientKey, number>;
  for (const key of NUTRIENT_KEYS) {
    const code = BLS_COLUMNS[key];
    nutrientCols[key] = findColumn(header, (h) => h.startsWith(`${code} `) && h.includes('['), code);
  }

  const entries: BlsEntry[] = [];
  for (const row of rows) {
    const code = cellText(row[codeCol]).trim();
    if (!code) continue;
    let incomplete = false;
    const per100g = {} as Nutrients;
    for (const key of NUTRIENT_KEYS) {
      const value = parseValue(row[nutrientCols[key]]);
      if (value === null) incomplete = true;
      per100g[key] = round3(value ?? 0);
    }
    entries.push({
      code,
      name: cellText(row[nameCol]).trim(),
      nameEn: cellText(row[nameEnCol]).trim(),
      per100g,
      incomplete,
    });
  }
  return entries;
}
```

- [ ] **Step 4: `tools/bls/search.ts`**

```ts
import type { BlsEntry } from './parse';

/** Findet Einträge, deren deutscher oder englischer Name alle Suchwörter enthält. */
export function searchBls(entries: readonly BlsEntry[], query: string, limit = 25): BlsEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: BlsEntry[] = [];
  for (const e of entries) {
    const hay = `${e.name} ${e.nameEn}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) {
      hits.push(e);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}
```

- [ ] **Step 5: Tests ausführen**

Run: `npx vitest run tools/bls && npm run typecheck`
Expected: PASS (7 Tests).

- [ ] **Step 6: CLIs `tools/bls-extract.ts` und `tools/bls-search.ts`**

`tools/bls-extract.ts`:
```ts
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';
import { parseRows } from './bls/parse';

// Liest die BLS-Excel-Datei (nicht im Repo) und schreibt catalog/bls-slim.json.
const input = process.argv[2] ?? 'data/bls/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx';
const output = 'catalog/bls-slim.json';

async function main(): Promise<void> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(input, {
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
    worksheets: 'emit',
  });
  let header: unknown[] | null = null;
  const rows: unknown[][] = [];
  for await (const sheet of reader) {
    for await (const row of sheet) {
      // exceljs: row.values ist 1-basiert, Index 0 bleibt leer
      const values = Array.from(row.values as unknown[]).slice(1);
      if (header === null) header = values;
      else rows.push(values);
    }
  }
  if (header === null) throw new Error(`${input}: keine Daten gefunden`);
  const entries = parseRows(header, rows).sort((a, b) => a.code.localeCompare(b.code));
  writeFileSync(output, JSON.stringify(entries) + '\n');
  const incomplete = entries.filter((e) => e.incomplete).length;
  console.log(`${output}: ${entries.length} Lebensmittel (${incomplete} unvollständig)`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
```

`tools/bls-search.ts`:
```ts
import { readFileSync } from 'node:fs';
import type { BlsEntry } from './bls/parse';
import { searchBls } from './bls/search';

// Aufruf: npm run bls:search -- hähnchen brust roh
const query = process.argv.slice(2).join(' ');
if (!query) {
  console.error('Aufruf: npm run bls:search -- <Suchwörter>');
  process.exit(1);
}
const entries = JSON.parse(readFileSync('catalog/bls-slim.json', 'utf8')) as BlsEntry[];
for (const e of searchBls(entries, query)) {
  const n = e.per100g;
  console.log(
    `${e.code} | ${e.name} | ${n.kcal} kcal · P ${n.protein} · F ${n.fat} · KH ${n.carbs} · Bst ${n.fiber}${e.incomplete ? ' | unvollständig' : ''}`,
  );
}
```

`package.json` → `scripts` ergänzen:
```json
    "bls:extract": "tsx tools/bls-extract.ts",
    "bls:search": "tsx tools/bls-search.ts"
```

- [ ] **Step 7: `catalog/README.md`**

```markdown
# Katalog

- `bls-slim.json` – Auszug aus dem Bundeslebensmittelschlüssel (Code, Name, kcal, Protein, Fett, Kohlenhydrate, Ballaststoffe, Zucker, Salz pro 100 g). Erzeugt mit `npm run bls:extract` aus der offiziellen Excel-Datei.
- `ingredients.csv` – Zutaten der App (Trennzeichen `;`, Dezimalkomma erlaubt).
- `recipes/*.yaml` – ein Rezept pro Datei, Dateiname = Rezept-ID.
- `ids.lock` – alle je vergebenen IDs (wird von `npm run catalog` gepflegt, nicht von Hand ändern).
- `retired-ids.txt` – bewusst entfernte IDs, eine pro Zeile.

## Quelle und Lizenz der Nährwerte

Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0. Lizenz: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Die Daten wurden auf sieben Nährwerte reduziert und gerundet.
```

- [ ] **Step 8: Extraktion ausführen und prüfen**

```bash
npm run bls:extract
npm run bls:search -- hafer flocken
```
Expected: `catalog/bls-slim.json: 7140 Lebensmittel (… unvollständig)`; die Suche zeigt eine Zeile, die mit `C133000 | Hafer Flocken | 348 kcal` beginnt.

- [ ] **Step 9: Commit**

```bash
git add tools/bls tools/bls-extract.ts tools/bls-search.ts catalog/README.md catalog/bls-slim.json package.json
git commit -m "feat: BLS-Extraktion und Suche

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Katalog-Schemas und CSV-Parser

**Files:**
- Create: `tools/catalog/schema.ts`, `tools/catalog/csv.ts`
- Test: `tools/catalog/csv.test.ts`

**Interfaces:**
- Consumes: `ALLERGENS`, `CATEGORIES`, `FLAGS`, `MEAL_TYPES`, `UNITS`, `NUTRIENT_KEYS`, `Nutrients`, `Package` (Task 2).
- Produces:
  - `idSchema`, `ingredientRowSchema`, `recipeFileSchema` (zod), `type RecipeFile = z.infer<typeof recipeFileSchema>`
  - `CSV_COLUMNS` (18 Spalten), `interface IngredientRow { line: number; id: string; name: string; blsCode: string | null; category: Category; densityGPerMl?: number; pieceWeightG?: number; packages: Package[]; priceAsOf: string; flags: Flag[]; allergens: Allergen[]; pantryStaple: boolean; manual: Partial<Nutrients> }`, `parseNumber(s: string): number | undefined`, `parseIngredientsCsv(text: string): { rows: IngredientRow[]; errors: string[] }`

CSV-Format (`;`-getrennt, erste Zeile = Kopfzeile, `#`-Zeilen und Leerzeilen werden ignoriert):
`id;name;blsCode;category;densityGPerMl;pieceWeightG;packages;priceAsOf;flags;allergens;pantryStaple;kcal;protein;fat;carbs;fiber;sugar;salt`
- `packages`: `500:1,29|1000:2,39` (Gramm:Euro, mehrere mit `|`)
- `flags`, `allergens`: mit `|` getrennt
- `pantryStaple`: `ja`, `nein` oder leer
- Zahlen mit Punkt oder Komma

- [ ] **Step 1: Failing Test `tools/catalog/csv.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, parseIngredientsCsv, parseNumber } from './csv';

const HEADER = CSV_COLUMNS.join(';');

describe('parseNumber', () => {
  it('Punkt, Komma, leer, ungültig', () => {
    expect(parseNumber('0,92')).toBe(0.92);
    expect(parseNumber(' 1.5 ')).toBe(1.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeNaN();
  });
});

describe('parseIngredientsCsv', () => {
  it('liest Excel-typische Datei mit BOM, CRLF, Dezimalkomma, Umlauten', () => {
    const text =
      '\uFEFF' +
      [
        HEADER,
        '# Kommentar',
        'olivenoel;Olivenöl;Q120000;gewuerze-oele;0,92;;690:6,49;2026-09-26;;;;;;;;;;',
        'salz;Salz;R113000;gewuerze-oele;1,2;;500:0,29;2026-09-26;;;ja;;;;;;;',
        'skyr;Skyr natur;;kuehlregal;;;450:1,49|1000:2,99;2026-09-26;animal|dairy;milk;nein;63;11;0,2;4;0;4;0,1',
        '',
      ].join('\r\n');
    const { rows, errors } = parseIngredientsCsv(text);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        line: 3,
        id: 'olivenoel',
        name: 'Olivenöl',
        blsCode: 'Q120000',
        category: 'gewuerze-oele',
        densityGPerMl: 0.92,
        pieceWeightG: undefined,
        packages: [{ sizeG: 690, priceEur: 6.49 }],
        priceAsOf: '2026-09-26',
        flags: [],
        allergens: [],
        pantryStaple: false,
        manual: {},
      },
      {
        line: 4,
        id: 'salz',
        name: 'Salz',
        blsCode: 'R113000',
        category: 'gewuerze-oele',
        densityGPerMl: 1.2,
        pieceWeightG: undefined,
        packages: [{ sizeG: 500, priceEur: 0.29 }],
        priceAsOf: '2026-09-26',
        flags: [],
        allergens: [],
        pantryStaple: true,
        manual: {},
      },
      {
        line: 5,
        id: 'skyr',
        name: 'Skyr natur',
        blsCode: null,
        category: 'kuehlregal',
        densityGPerMl: undefined,
        pieceWeightG: undefined,
        packages: [
          { sizeG: 450, priceEur: 1.49 },
          { sizeG: 1000, priceEur: 2.99 },
        ],
        priceAsOf: '2026-09-26',
        flags: ['animal', 'dairy'],
        allergens: ['milk'],
        pantryStaple: false,
        manual: { kcal: 63, protein: 11, fat: 0.2, carbs: 4, fiber: 0, sugar: 4, salt: 0.1 },
      },
    ]);
  });

  it('falsche Kopfzeile', () => {
    expect(parseIngredientsCsv('id;name\n').errors[0]).toContain('Kopfzeile');
  });

  it('meldet Fehler mit Zeilennummer', () => {
    const text = [
      HEADER,
      'Falsche ID;X;;obst-gemuese;;;;2026-09-26;;;;;;;;;;',
      'zwiebel;Zwiebel;;gemuese;;;;2026-09-26;;;;;;;;;;',
      'zu-kurz;Zu kurz',
      'paket;Paket;;sonstiges;;;500:abc;2026-09-26;;;;;;;;;;',
      'staple;Staple;;sonstiges;;;;2026-09-26;;;vielleicht;;;;;;;',
    ].join('\n');
    const { rows, errors } = parseIngredientsCsv(text);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(5);
    expect(errors[0]).toMatch(/^Zeile 2 \(Falsche ID\): id/);
    expect(errors[1]).toMatch(/^Zeile 3 \(zwiebel\): category/);
    expect(errors[2]).toBe('Zeile 4: 2 Spalten statt 18');
    expect(errors[3]).toMatch(/^Zeile 5 \(paket\): packages/);
    expect(errors[4]).toBe('Zeile 6 (staple): pantryStaple muss "ja", "nein" oder leer sein');
  });
});
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run tools/catalog/csv.test.ts`
Expected: FAIL – `Failed to resolve import "./csv"`

- [ ] **Step 3: `tools/catalog/schema.ts`**

```ts
import { z } from 'zod';
import { ALLERGENS, CATEGORIES, FLAGS, MEAL_TYPES, UNITS } from '../../src/domain/types';

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'nur a-z, 0-9 und einzelne Bindestriche erlaubt');

const positive = z.number().positive();
const nonNegative = z.number().nonnegative();

export const ingredientRowSchema = z.strictObject({
  line: z.number().int(),
  id: idSchema,
  name: z.string().min(1),
  blsCode: z
    .string()
    .regex(/^[A-Z0-9]{7}$/, 'BLS-Code hat 7 Zeichen (z. B. C133000)')
    .nullable(),
  category: z.enum(CATEGORIES),
  densityGPerMl: positive.optional(),
  pieceWeightG: positive.optional(),
  packages: z.array(z.strictObject({ sizeG: positive, priceEur: nonNegative })),
  priceAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als JJJJ-MM-TT'),
  flags: z.array(z.enum(FLAGS)),
  allergens: z.array(z.enum(ALLERGENS)),
  pantryStaple: z.boolean(),
  manual: z.strictObject({
    kcal: nonNegative.optional(),
    protein: nonNegative.optional(),
    fat: nonNegative.optional(),
    carbs: nonNegative.optional(),
    fiber: nonNegative.optional(),
    sugar: nonNegative.optional(),
    salt: nonNegative.optional(),
  }),
});

export const recipeFileSchema = z.strictObject({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().default(''),
  servings: z.number().int().min(1),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  mealTypes: z.array(z.enum(MEAL_TYPES)).min(1),
  storage: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('prep'), fridgeDays: z.number().int().min(1).max(5), freezable: z.boolean() }),
    z.strictObject({ kind: z.literal('fresh') }),
  ]),
  tags: z.array(z.string()).default([]),
  version: z.number().int().min(1).default(1),
  ingredients: z
    .array(
      z.strictObject({
        ingredient: idSchema,
        amount: positive,
        unit: z.enum(UNITS),
        note: z.string().optional(),
        optional: z.boolean().optional(),
      }),
    )
    .min(1),
  steps: z.array(z.string().min(1)).min(1),
});

export type RecipeFile = z.infer<typeof recipeFileSchema>;
```

- [ ] **Step 4: `tools/catalog/csv.ts`**

```ts
import type { Allergen, Category, Flag, Nutrients, Package } from '../../src/domain/types';
import { NUTRIENT_KEYS } from '../../src/domain/types';
import { ingredientRowSchema } from './schema';

export const CSV_COLUMNS = [
  'id',
  'name',
  'blsCode',
  'category',
  'densityGPerMl',
  'pieceWeightG',
  'packages',
  'priceAsOf',
  'flags',
  'allergens',
  'pantryStaple',
  ...NUTRIENT_KEYS,
] as const;
type Column = (typeof CSV_COLUMNS)[number];

export interface IngredientRow {
  line: number;
  id: string;
  name: string;
  blsCode: string | null;
  category: Category;
  densityGPerMl?: number;
  pieceWeightG?: number;
  packages: Package[];
  priceAsOf: string;
  flags: Flag[];
  allergens: Allergen[];
  pantryStaple: boolean;
  manual: Partial<Nutrients>;
}

/** Leer → undefined, ungültig → NaN (wird vom Schema abgelehnt). Dezimalkomma erlaubt. */
export function parseNumber(s: string): number | undefined {
  const t = s.trim();
  if (t === '') return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : Number.NaN;
}

function splitList(s: string): string[] {
  return s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
}

function parsePackages(s: string): { sizeG: number; priceEur: number }[] {
  return splitList(s).map((part) => {
    const [size = '', price = ''] = part.split(':');
    return { sizeG: parseNumber(size) ?? Number.NaN, priceEur: parseNumber(price) ?? Number.NaN };
  });
}

export function parseIngredientsCsv(text: string): { rows: IngredientRow[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = (lines[0] ?? '').split(';').map((s) => s.trim());
  if (header.join(';') !== CSV_COLUMNS.join(';')) {
    return { rows: [], errors: [`ingredients.csv: Kopfzeile muss lauten: ${CSV_COLUMNS.join(';')}`] };
  }

  const rows: IngredientRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((raw, idx) => {
    const line = idx + 2;
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) return;
    const cells = raw.split(';');
    if (cells.length !== CSV_COLUMNS.length) {
      errors.push(`Zeile ${line}: ${cells.length} Spalten statt ${CSV_COLUMNS.length}`);
      return;
    }
    const get = (c: Column) => (cells[CSV_COLUMNS.indexOf(c)] ?? '').trim();
    const id = get('id');

    const staple = get('pantryStaple').toLowerCase();
    if (!['', 'ja', 'nein'].includes(staple)) {
      errors.push(`Zeile ${line} (${id || '?'}): pantryStaple muss "ja", "nein" oder leer sein`);
      return;
    }

    const manual: Partial<Nutrients> = {};
    for (const key of NUTRIENT_KEYS) {
      const value = parseNumber(get(key));
      if (value !== undefined) manual[key] = value;
    }

    const candidate = {
      line,
      id,
      name: get('name'),
      blsCode: get('blsCode') || null,
      category: get('category'),
      densityGPerMl: parseNumber(get('densityGPerMl')),
      pieceWeightG: parseNumber(get('pieceWeightG')),
      packages: parsePackages(get('packages')),
      priceAsOf: get('priceAsOf'),
      flags: splitList(get('flags')),
      allergens: splitList(get('allergens')),
      pantryStaple: staple === 'ja',
      manual,
    };
    const result = ingredientRowSchema.safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`Zeile ${line} (${id || '?'}): ${issue.path.join('.')} – ${issue.message}`);
      }
      return;
    }
    rows.push(result.data);
  });
  return { rows, errors };
}
```

Hinweis: Die Tests nutzen `toEqual`, das Schlüssel mit Wert `undefined` wie fehlende Schlüssel behandelt – egal ob zod `densityGPerMl: undefined` im Ergebnis behält oder weglässt. Die Fehlertests prüfen nur die selbst erzeugten Präfixe (`Zeile N (id): feld`), nicht den Wortlaut der zod-Meldungen.

- [ ] **Step 5: Test ausführen**

Run: `npx vitest run tools/catalog/csv.test.ts && npm run typecheck`
Expected: PASS (4 Tests).

- [ ] **Step 6: Commit**

```bash
git add tools/catalog/schema.ts tools/catalog/csv.ts tools/catalog/csv.test.ts
git commit -m "feat: Schemas und CSV-Parser für den Katalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Katalog bauen und validieren (+ Beispielkatalog)

**Files:**
- Create: `tools/catalog/build.ts`, `tools/build-catalog.ts`, `catalog/ingredients.csv`, `catalog/recipes/chili-con-carne.yaml`, `catalog/recipes/overnight-oats.yaml`, `catalog/retired-ids.txt`, `catalog/ids.lock` (generiert), `public/catalog.json` (generiert)
- Modify: `package.json` (Skripte `catalog`, `catalog:check`)
- Test: `tools/catalog/build.test.ts`

**Interfaces:**
- Consumes: `parseIngredientsCsv`, `IngredientRow` (Task 11); `recipeFileSchema` (Task 11); `BlsEntry` (Task 10); `makeLookup` (Task 3); `canConvert` (Task 3); `perPortion`, `isPlausible`, `computedKcal`, `ZERO` (Task 4); `Catalog`, `Ingredient`, `Recipe`, `NUTRIENT_KEYS`, `Nutrients` (Task 2).
- Produces: `interface BuildInput { bls: readonly BlsEntry[]; ingredientsCsv: string; recipeFiles: readonly { fileName: string; text: string }[]; lockedIds: readonly string[]; retiredIds: readonly string[] }`, `interface BuildResult { catalog: Catalog | null; errors: string[]; ids: string[] }`, `buildCatalog(input: BuildInput): BuildResult`. IDs im Lock/Retired-Format: `zutat:<id>` bzw. `rezept:<id>`. Datei `public/catalog.json` (`Catalog`), npm-Skripte `catalog` und `catalog:check`.

- [ ] **Step 1: Failing Test `tools/catalog/build.test.ts`**

```ts
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
```

- [ ] **Step 2: Test ausführen**

Run: `npx vitest run tools/catalog/build.test.ts`
Expected: FAIL – `Failed to resolve import "./build"`

- [ ] **Step 3: `tools/catalog/build.ts`**

```ts
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { NUTRIENT_KEYS, type Catalog, type Ingredient, type Nutrients, type Recipe } from '../../src/domain/types';
import { makeLookup, type IngredientLookup } from '../../src/domain/recipe';
import { canConvert } from '../../src/domain/units';
import { computedKcal, isPlausible, perPortion, ZERO } from '../../src/domain/nutrition';
import type { BlsEntry } from '../bls/parse';
import { parseIngredientsCsv, type IngredientRow } from './csv';
import { recipeFileSchema } from './schema';

export interface BuildInput {
  bls: readonly BlsEntry[];
  ingredientsCsv: string;
  recipeFiles: readonly { fileName: string; text: string }[];
  /** Inhalt von catalog/ids.lock */
  lockedIds: readonly string[];
  /** Inhalt von catalog/retired-ids.txt */
  retiredIds: readonly string[];
}

export interface BuildResult {
  catalog: Catalog | null;
  errors: string[];
  /** alle aktuell vergebenen IDs, z. B. 'zutat:haferflocken', 'rezept:chili-con-carne' */
  ids: string[];
}

function resolveNutrients(
  row: IngredientRow,
  blsByCode: ReadonlyMap<string, BlsEntry>,
  where: string,
  errors: string[],
): Nutrients | null {
  const manualCount = NUTRIENT_KEYS.filter((k) => row.manual[k] !== undefined).length;
  if (row.blsCode) {
    if (manualCount > 0) {
      errors.push(`${where}: entweder blsCode oder eigene Nährwerte angeben, nicht beides`);
      return null;
    }
    const entry = blsByCode.get(row.blsCode);
    if (!entry) {
      errors.push(`${where}: BLS-Code ${row.blsCode} unbekannt`);
      return null;
    }
    if (entry.incomplete) {
      errors.push(
        `${where}: BLS-Eintrag ${row.blsCode} ist unvollständig – anderen Code wählen oder Nährwerte selbst angeben`,
      );
      return null;
    }
    return { ...entry.per100g };
  }
  if (manualCount !== NUTRIENT_KEYS.length) {
    errors.push(`${where}: ohne blsCode müssen alle Nährwerte angegeben sein (${NUTRIENT_KEYS.join(', ')})`);
    return null;
  }
  const n: Nutrients = { ...ZERO };
  for (const k of NUTRIENT_KEYS) n[k] = row.manual[k] ?? 0;
  // BLS-Werte gelten als geprüft; nur eigene Werte werden auf Plausibilität kontrolliert
  if (!isPlausible(n)) {
    errors.push(`${where}: Nährwerte pro 100 g unplausibel (kcal ${n.kcal}, berechnet ${Math.round(computedKcal(n))})`);
    return null;
  }
  return n;
}

function validateRecipe(recipe: Recipe, lookup: IngredientLookup): string[] {
  const errors: string[] = [];
  for (const ri of recipe.ingredients) {
    const ing = lookup(ri.ingredientId);
    if (!ing) {
      errors.push(`Zutat ${ri.ingredientId} gibt es nicht in ingredients.csv`);
      continue;
    }
    if (!canConvert(ri.unit, ing)) {
      const missing = ri.unit === 'stk' ? 'pieceWeightG' : 'densityGPerMl';
      errors.push(`${ing.name}: Einheit ${ri.unit} nicht umrechenbar (${missing} fehlt)`);
    }
  }
  if (errors.length > 0) return errors;
  const n = perPortion(recipe, lookup);
  if (n.kcal < 50 || n.kcal > 1500) errors.push(`kcal pro Portion ${Math.round(n.kcal)} außerhalb 50–1500`);
  else if (!isPlausible(n)) {
    errors.push(`Nährwerte pro Portion unplausibel (kcal ${Math.round(n.kcal)}, berechnet ${Math.round(computedKcal(n))})`);
  }
  return errors;
}

export function buildCatalog(input: BuildInput): BuildResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  const blsByCode = new Map(input.bls.map((e) => [e.code, e] as const));

  // Zutaten
  const csv = parseIngredientsCsv(input.ingredientsCsv);
  errors.push(...csv.errors);
  const ingredients: Ingredient[] = [];
  for (const row of csv.rows) {
    const where = `ingredients.csv Zeile ${row.line} (${row.id})`;
    const key = `zutat:${row.id}`;
    if (seen.has(key)) {
      errors.push(`${where}: ID doppelt`);
      continue;
    }
    seen.add(key);
    const per100g = resolveNutrients(row, blsByCode, where, errors);
    if (!per100g) continue;
    if (!row.pantryStaple && row.packages.length === 0) {
      errors.push(`${where}: keine Packung mit Preis angegeben`);
      continue;
    }
    ingredients.push({
      id: row.id,
      name: row.name,
      blsCode: row.blsCode,
      category: row.category,
      per100g,
      densityGPerMl: row.densityGPerMl,
      pieceWeightG: row.pieceWeightG,
      packages: row.packages,
      priceAsOf: row.priceAsOf,
      flags: row.flags,
      allergens: row.allergens,
      pantryStaple: row.pantryStaple,
    });
  }

  // Rezepte
  const lookup = makeLookup(ingredients);
  const recipes: Recipe[] = [];
  for (const file of input.recipeFiles) {
    let data: unknown;
    try {
      data = parseYaml(file.text);
    } catch (e) {
      errors.push(`${file.fileName}: YAML-Fehler – ${(e as Error).message}`);
      continue;
    }
    const parsed = recipeFileSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${file.fileName}: ${issue.path.join('.')} – ${issue.message}`);
      }
      continue;
    }
    const f = parsed.data;
    if (file.fileName !== `${f.id}.yaml`) {
      errors.push(`${file.fileName}: Dateiname muss ${f.id}.yaml lauten`);
      continue;
    }
    const key = `rezept:${f.id}`;
    if (seen.has(key)) {
      errors.push(`${file.fileName}: ID doppelt`);
      continue;
    }
    seen.add(key);
    const recipe: Recipe = {
      id: f.id,
      title: f.title,
      description: f.description,
      servings: f.servings,
      ingredients: f.ingredients.map((i) => ({
        ingredientId: i.ingredient,
        amount: i.amount,
        unit: i.unit,
        note: i.note,
        optional: i.optional,
      })),
      steps: f.steps,
      prepMinutes: f.prepMinutes,
      cookMinutes: f.cookMinutes,
      mealTypes: f.mealTypes,
      storage: f.storage,
      tags: f.tags,
      source: 'starter',
      version: f.version,
    };
    const recipeErrors = validateRecipe(recipe, lookup);
    if (recipeErrors.length > 0) {
      errors.push(...recipeErrors.map((m) => `${file.fileName}: ${m}`));
      continue;
    }
    recipes.push(recipe);
  }

  // Stabile IDs
  const ids = [...seen].sort();
  const retired = new Set(input.retiredIds);
  for (const id of input.lockedIds) {
    if (!seen.has(id) && !retired.has(id)) {
      errors.push(`ID ${id} wurde entfernt – in catalog/retired-ids.txt eintragen, falls das Absicht ist`);
    }
  }
  for (const id of retired) {
    if (seen.has(id)) errors.push(`ID ${id} steht in retired-ids.txt, wird aber noch benutzt`);
  }

  if (errors.length > 0) return { catalog: null, errors, ids };

  ingredients.sort((a, b) => a.id.localeCompare(b.id));
  recipes.sort((a, b) => a.id.localeCompare(b.id));
  const body = { ingredients, recipes };
  const version = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  return { catalog: { version, ...body }, errors: [], ids };
}
```

Hinweis: Die Reihenfolge der Fehler im Test „unbekannte Zutat…“ entsteht, weil alle Zutatenfehler eines Rezepts gesammelt werden, bevor das nächste Rezept geprüft wird; `falsch.yaml` scheitert am Dateinamen, bevor Zutaten geprüft werden.

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run tools/catalog/build.test.ts && npm run typecheck`
Expected: PASS (7 Tests).

- [ ] **Step 5: CLI `tools/build-catalog.ts`**

```ts
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BlsEntry } from './bls/parse';
import { buildCatalog } from './catalog/build';

// npm run catalog        → baut public/catalog.json und aktualisiert catalog/ids.lock
// npm run catalog:check  → prüft nur, ob beide Dateien zum Quellstand passen (für CI)

const check = process.argv.includes('--check');
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const readLines = (path: string) =>
  existsSync(path)
    ? read(path)
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('#'))
    : [];

const recipeDir = 'catalog/recipes';
const recipeFiles = readdirSync(recipeDir)
  .filter((f) => f.endsWith('.yaml'))
  .sort()
  .map((fileName) => ({ fileName, text: read(join(recipeDir, fileName)) }));
const lockedIds = readLines('catalog/ids.lock');

const result = buildCatalog({
  bls: JSON.parse(read('catalog/bls-slim.json')) as BlsEntry[],
  ingredientsCsv: read('catalog/ingredients.csv'),
  recipeFiles,
  lockedIds,
  retiredIds: readLines('catalog/retired-ids.txt'),
});

if (!result.catalog) {
  console.error(`Katalog fehlerhaft (${result.errors.length} Fehler):`);
  for (const e of result.errors) console.error(`  – ${e}`);
  process.exit(1);
}

const catalogJson = JSON.stringify(result.catalog) + '\n';
const lockText = [...new Set([...lockedIds, ...result.ids])].sort().join('\n') + '\n';
const outFile = 'public/catalog.json';
const summary = `${result.catalog.ingredients.length} Zutaten, ${result.catalog.recipes.length} Rezepte, Version ${result.catalog.version}`;

if (check) {
  const upToDate =
    existsSync(outFile) &&
    read(outFile) === catalogJson &&
    existsSync('catalog/ids.lock') &&
    read('catalog/ids.lock') === lockText;
  if (!upToDate) {
    console.error('Katalog nicht aktuell – bitte "npm run catalog" ausführen und das Ergebnis committen.');
    process.exit(1);
  }
  console.log(`Katalog aktuell (${summary}).`);
} else {
  mkdirSync('public', { recursive: true });
  writeFileSync(outFile, catalogJson);
  writeFileSync('catalog/ids.lock', lockText);
  console.log(`public/catalog.json geschrieben (${summary}).`);
}
```

`package.json` → `scripts` ergänzen:
```json
    "catalog": "tsx tools/build-catalog.ts",
    "catalog:check": "tsx tools/build-catalog.ts --check"
```

- [ ] **Step 6: Beispielkatalog anlegen**

`catalog/ingredients.csv` (Preise = Beispielwerte, werden in Plan 1b geprüft und ersetzt):
```
id;name;blsCode;category;densityGPerMl;pieceWeightG;packages;priceAsOf;flags;allergens;pantryStaple;kcal;protein;fat;carbs;fiber;sugar;salt
haferflocken;Haferflocken;C133000;trockenware;;;500:0,69;2026-09-26;;gluten;;;;;;;;
magerquark;Magerquark;M713100;kuehlregal;;;250:0,79|500:1,29;2026-09-26;animal|dairy;milk;;;;;;;;
milch-fettarm;Milch 1,5 %;M111200;kuehlregal;1,03;;1030:0,99;2026-09-26;animal|dairy;milk;;;;;;;;
rinderhack;Rinderhackfleisch;U010100;fleisch-fisch;;;500:4,99;2026-09-26;animal|meat;;;;;;;;;
zwiebel;Zwiebel;G480100;obst-gemuese;;80;1000:1,29;2026-09-26;;;;;;;;;;
paprika-rot;Paprika rot;G543100;obst-gemuese;;150;500:1,99;2026-09-26;;;;;;;;;;
knoblauch;Knoblauch;G490100;obst-gemuese;;4;150:0,99;2026-09-26;;;;;;;;;;
tomaten-passiert;Passierte Tomaten;R161200;konserven;1,03;;500:0,79;2026-09-26;;;;;;;;;;
kidneybohnen;Kidneybohnen (abgetropft);H742902;konserven;;;250:0,79;2026-09-26;;;;;;;;;;
reis-parboiled;Reis parboiled;C359000;trockenware;;;1000:1,79;2026-09-26;;;;;;;;;;
olivenoel;Olivenöl;Q120000;gewuerze-oele;0,92;;690:6,49;2026-09-26;;;;;;;;;;
salz;Salz (jodiert);R113000;gewuerze-oele;1,2;;500:0,29;2026-09-26;;;ja;;;;;;;
```

`catalog/recipes/chili-con-carne.yaml`:
```yaml
id: chili-con-carne
title: Chili con Carne mit Reis
description: Klassiker fürs Mealprep – hält 4 Tage im Kühlschrank und lässt sich gut einfrieren.
servings: 4
prepMinutes: 15
cookMinutes: 35
mealTypes: [lunch, dinner]
storage: { kind: prep, fridgeDays: 4, freezable: true }
tags: [one-pot, high-protein]
ingredients:
  - { ingredient: rinderhack, amount: 500, unit: g }
  - { ingredient: zwiebel, amount: 1, unit: stk }
  - { ingredient: knoblauch, amount: 2, unit: stk, note: Zehen }
  - { ingredient: paprika-rot, amount: 2, unit: stk }
  - { ingredient: tomaten-passiert, amount: 500, unit: ml }
  - { ingredient: kidneybohnen, amount: 250, unit: g, note: abgetropft }
  - { ingredient: reis-parboiled, amount: 250, unit: g }
  - { ingredient: olivenoel, amount: 1, unit: el }
  - { ingredient: salz, amount: 1, unit: tl }
steps:
  - Reis nach Packungsangabe garen.
  - Zwiebel und Knoblauch fein würfeln, Paprika in mundgerechte Stücke schneiden.
  - Öl in einem großen Topf erhitzen und das Hackfleisch darin krümelig anbraten.
  - Zwiebel, Knoblauch und Paprika zugeben und 3 Minuten mitbraten.
  - Passierte Tomaten und Bohnen einrühren, salzen, nach Geschmack mit Chili und Kreuzkümmel würzen und 20 Minuten köcheln lassen.
  - Mit dem Reis auf Boxen verteilen, offen abkühlen lassen und dann verschlossen in den Kühlschrank stellen.
```

`catalog/recipes/overnight-oats.yaml`:
```yaml
id: overnight-oats
title: Overnight Oats mit Quark
description: Proteinreiches Frühstück, abends in 5 Minuten vorbereitet.
servings: 1
prepMinutes: 5
cookMinutes: 0
mealTypes: [breakfast, snack]
storage: { kind: prep, fridgeDays: 2, freezable: false }
tags: [ohne-kochen, high-protein]
ingredients:
  - { ingredient: haferflocken, amount: 50, unit: g }
  - { ingredient: magerquark, amount: 150, unit: g }
  - { ingredient: milch-fettarm, amount: 100, unit: ml }
steps:
  - Haferflocken, Quark und Milch in einem Glas mit Deckel glatt verrühren.
  - Verschlossen über Nacht in den Kühlschrank stellen.
  - Morgens nach Wunsch mit Obst toppen.
```

`catalog/retired-ids.txt`:
```
# Bewusst entfernte Katalog-IDs, eine pro Zeile (z. B. zutat:alte-id oder rezept:alte-id)
```

- [ ] **Step 7: Katalog bauen und prüfen**

```bash
npm run catalog
npm run catalog:check
```
Expected: `public/catalog.json geschrieben (12 Zutaten, 2 Rezepte, Version …)`, danach `Katalog aktuell (…)`. `catalog/ids.lock` enthält 14 Zeilen (`rezept:chili-con-carne`, `rezept:overnight-oats`, 12 × `zutat:…`).

- [ ] **Step 8: Gesamtprüfung**

```bash
npm run typecheck && npm run lint && npm test
```
Expected: alles grün.

- [ ] **Step 9: Commit**

```bash
git add tools/catalog/build.ts tools/catalog/build.test.ts tools/build-catalog.ts catalog/ingredients.csv catalog/recipes catalog/retired-ids.txt catalog/ids.lock public/catalog.json package.json
git commit -m "feat: Katalog-Build mit Validierung und Beispielkatalog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: CI-Workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (Skript `verify`)

**Interfaces:**
- Consumes: npm-Skripte aus Task 1, 10, 12.
- Produces: `npm run verify` (lokal alles in einem), GitHub-Actions-Workflow „CI“. (Ein GitHub-Repo wird erst in Plan 1c angelegt; der Workflow liegt bis dahin nur im Repo.)

- [ ] **Step 1: `package.json` → `scripts` ergänzen**

```json
    "verify": "npm run typecheck && npm run lint && npm test && npm run catalog:check && npm run build"
```

- [ ] **Step 2: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - name: Katalog aktuell?
        run: npm run catalog:check
      - run: npm run build
```

- [ ] **Step 3: Lokal prüfen**

Run: `npm run verify`
Expected: alle Schritte grün, am Ende `✓ built in …`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci: Typprüfung, Lint, Tests, Katalog-Check und Build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Abdeckung der Spec durch diesen Plan

| Spec-Abschnitt | Task |
|---|---|
| §3 Modulgrenzen `units`, `nutrition`, `pricing`, `shopping`, `rules`, `targets` | 3, 4, 6, 7, 8, 9 |
| §4 Datenquellen BLS + Quellenangabe | 10 |
| §5.1 Katalog-Datenmodell, abgeleitete Ernährungsform/Allergene | 2, 5, 12 |
| §5 Stabile IDs | 12 |
| §7 Einkauf Woche/Tag/Kochtag (Zeiträume nach `cookDate`) | 2 (`cookDayRanges`), 7 |
| §7 Ziel-Rechner | 9 |
| §8 Katalog-Pipeline und Validierung | 10, 11, 12 |
| §12 Fehlerbehandlung: entfernte Katalog-ID, fehlender Preis | 7, 8 |
| §13 Vitest, Katalog-Validierung in CI | alle, 13 |

Nicht in diesem Plan (folgen in 1b/1c): Katalog-Inhalte, RxDB-Schemas, Bildschirme, Export/Import, PWA, Deploy, Playwright.
