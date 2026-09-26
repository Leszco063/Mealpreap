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
  .filter((f) => !f.startsWith('.'))
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
