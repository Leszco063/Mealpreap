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
      '﻿' +
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
