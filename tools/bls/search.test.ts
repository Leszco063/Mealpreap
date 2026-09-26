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
