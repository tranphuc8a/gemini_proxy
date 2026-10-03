import { describe, expect, it } from 'vitest';
import en from './en';
import vi from './vi';

/** Every leaf key, dotted; plural variants (`_one`, `_other`, …) fold into their base key. */
const keysOf = (tree: unknown, prefix = ''): string[] => {
  if (!tree || typeof tree !== 'object') return [prefix.replace(/_(zero|one|two|few|many|other)$/, '')];
  return Object.entries(tree).flatMap(([key, value]) => keysOf(value, prefix ? `${prefix}.${key}` : key));
};

describe('translations', () => {
  it('has the same strings in English and Vietnamese', () => {
    const english = [...new Set(keysOf(en.translation))].sort();
    const vietnamese = [...new Set(keysOf(vi.translation))].sort();
    expect(vietnamese).toEqual(english);
  });
});
