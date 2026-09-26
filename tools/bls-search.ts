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
