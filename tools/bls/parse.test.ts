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
