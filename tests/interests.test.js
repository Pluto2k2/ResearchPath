import { describe, it, expect } from 'vitest';
import {
  PRESET_CATEGORIES,
  STORAGE_KEY,
  addKeyword,
  loadInterests,
  normaliseInterests,
  removeKeyword,
  saveInterests,
  toggleCategory,
} from '../public/interests.js';

const EMPTY = { categories: [], keywords: [] };

function memoryStorage(initial) {
  const data = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}
const withKeywords = (keywords) => ({ categories: [], keywords });

describe('US-04 interests: categories', () => {
  it('offers the five preset categories', () => {
    expect(PRESET_CATEGORIES).toEqual(['cs.AI', 'cs.LG', 'cs.SE', 'cs.CL', 'cs.CV']);
  });

  it('toggles a category on and off', () => {
    const on = toggleCategory(EMPTY, 'cs.LG');
    expect(on.categories).toEqual(['cs.LG']);
    expect(toggleCategory(on, 'cs.LG').categories).toEqual([]);
  });

  it('ignores an unknown category', () => {
    expect(toggleCategory(EMPTY, 'cs.XX')).toEqual(EMPTY);
  });

  it('does not mutate its input', () => {
    toggleCategory(EMPTY, 'cs.AI');
    expect(EMPTY).toEqual({ categories: [], keywords: [] });
  });
});

describe('US-04 interests: keywords', () => {
  it('adds a keyword, trimmed', () => {
    expect(addKeyword(EMPTY, '  diffusion  ')).toEqual({ interests: withKeywords(['diffusion']) });
  });

  it('ignores an empty or blank keyword without an error', () => {
    expect(addKeyword(EMPTY, '')).toEqual({ interests: EMPTY });
    expect(addKeyword(EMPTY, '   ')).toEqual({ interests: EMPTY });
  });

  it('rejects a duplicate, case-insensitively', () => {
    expect(addKeyword(withKeywords(['Diffusion']), 'diffusion')).toEqual({
      error: 'This keyword is already in your list.',
    });
  });

  it('accepts 50 characters and rejects 51', () => {
    expect(addKeyword(EMPTY, 'a'.repeat(50)).interests.keywords).toEqual(['a'.repeat(50)]);
    expect(addKeyword(EMPTY, 'a'.repeat(51))).toEqual({ error: 'Keywords can be at most 50 characters.' });
  });

  it('accepts 5 keywords and rejects the 6th', () => {
    let interests = EMPTY;
    for (const k of ['a', 'b', 'c', 'd', 'e']) interests = addKeyword(interests, k).interests;
    expect(interests.keywords).toHaveLength(5);
    expect(addKeyword(interests, 'f')).toEqual({ error: 'You can add at most 5 keywords.' });
  });

  it('allows exactly 100 characters in total and rejects more', () => {
    const a = 'a'.repeat(50);
    const b = 'b'.repeat(49); // 50 + comma + 49 = 100
    const ok = addKeyword(withKeywords([a]), b);
    expect(ok.interests.keywords).toEqual([a, b]);
    expect(addKeyword(withKeywords([a]), 'b'.repeat(50))).toEqual({
      error: 'Your keywords can use at most 100 characters in total.',
    });
  });

  it('rejects a keyword containing a comma', () => {
    expect(addKeyword(EMPTY, 'a, b')).toEqual({ error: 'Keywords cannot contain commas.' });
  });

  it('removes a keyword', () => {
    expect(removeKeyword(withKeywords(['a', 'b']), 'a').keywords).toEqual(['b']);
  });

  it('removing an unknown keyword changes nothing', () => {
    expect(removeKeyword(withKeywords(['a']), 'z').keywords).toEqual(['a']);
  });
});

describe('US-04 interests: storage', () => {
  it('round-trips through storage under the versioned key', () => {
    const storage = memoryStorage();
    const interests = { categories: ['cs.LG'], keywords: ['diffusion'] };
    expect(saveInterests(storage, interests)).toBe(true);
    expect(JSON.parse(storage.getItem('researchpath.interests.v1'))).toEqual(interests);
    expect(loadInterests(storage)).toEqual(interests);
  });

  it('returns empty interests when nothing is stored', () => {
    expect(loadInterests(memoryStorage())).toEqual(EMPTY);
  });

  it('returns empty interests for invalid JSON without throwing', () => {
    expect(loadInterests(memoryStorage('{not json'))).toEqual(EMPTY);
  });

  it('returns empty interests for JSON of the wrong shape', () => {
    for (const text of ['null', '42', '"x"', '[]']) {
      expect(loadInterests(memoryStorage(text))).toEqual(EMPTY);
    }
  });

  it('returns empty interests when getItem throws', () => {
    const storage = {
      getItem() {
        throw new Error('blocked');
      },
    };
    expect(loadInterests(storage)).toEqual(EMPTY);
  });

  it('does not throw when setItem throws', () => {
    const storage = {
      setItem() {
        throw new Error('quota');
      },
    };
    expect(() => saveInterests(storage, EMPTY)).not.toThrow();
    expect(saveInterests(storage, EMPTY)).toBe(false);
  });

  it('works without any storage (global localStorage missing in node)', () => {
    expect(loadInterests()).toEqual(EMPTY);
    expect(() => saveInterests(undefined, EMPTY)).not.toThrow();
  });

  it('drops unknown stored categories and bad keywords', () => {
    const storage = memoryStorage(
      JSON.stringify({ categories: ['cs.AI', 'cs.XX', 'cs.ai'], keywords: ['ok', 42, '', 'OK', 'a'.repeat(51)] }),
    );
    expect(loadInterests(storage)).toEqual({ categories: ['cs.AI'], keywords: ['ok'] });
  });

  it('normaliseInterests limits stored keywords to 5', () => {
    const keywords = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(normaliseInterests({ categories: [], keywords }).keywords).toHaveLength(5);
  });
});
