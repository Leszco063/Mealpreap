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
