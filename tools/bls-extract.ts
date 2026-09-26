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
