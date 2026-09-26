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

  it('ungültige Menge (unendlich/NaN) → null statt Absturz', () => {
    expect(choosePackages(Infinity, quark)).toBeNull();
    expect(choosePackages(Number.NaN, quark)).toBeNull();
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
