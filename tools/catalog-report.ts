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
