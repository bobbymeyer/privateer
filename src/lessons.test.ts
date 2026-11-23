/** The fight taught: the hints in order, each once, remembered in the browser. Run with `npm test`. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LESSONS, TAUGHT_KEY, allTaught, everyLesson, loadTaught, nextLesson, saveTaught, withLesson } from './lessons.ts';
import { encounterWith } from './setup.ts';

/** A browser's storage, in a map. */
const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

test('the hints come in order, each when the fight has come far enough for it', () => {
  const f = encounterWith('merchant', 1);
  assert.equal(nextLesson(f, [])?.key, 'range');
  assert.equal(nextLesson(f, ['range'])?.key, 'intent');
  assert.equal(nextLesson(f, ['range', 'intent'])?.key, 'keep');
  // The chain waits for the second round, what it costs for the third.
  assert.equal(nextLesson(f, ['range', 'intent', 'keep']), null);
  assert.equal(nextLesson({ ...f, round: 2 }, ['range', 'intent', 'keep'])?.key, 'chain');
  assert.equal(nextLesson({ ...f, round: 3 }, ['range', 'intent', 'keep', 'chain'])?.key, 'cost');
  assert.equal(nextLesson({ ...f, round: 9 }, everyLesson()), null);
});

test('read once, remembered: a player who has read them all is not taught again', () => {
  const s = store();
  assert.deepEqual(loadTaught(s), []);
  let read = withLesson([], 'range');
  read = withLesson(read, 'range');
  assert.deepEqual(read, ['range']);
  saveTaught(read, s);
  assert.deepEqual(loadTaught(s), ['range']);
  assert.ok(!allTaught(loadTaught(s)));
  saveTaught(everyLesson(), s);
  assert.ok(allTaught(loadTaught(s)));
  assert.equal(everyLesson().length, LESSONS.length);
});

test('a browser that refuses, or a key full of nonsense, teaches again rather than failing', () => {
  const refusing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  assert.deepEqual(loadTaught(refusing), []);
  assert.doesNotThrow(() => saveTaught(['range'], refusing));
  const s = store();
  s.setItem(TAUGHT_KEY, '{"not": "a list"}');
  assert.deepEqual(loadTaught(s), []);
  s.setItem(TAUGHT_KEY, '["range", "flying", 3]');
  assert.deepEqual(loadTaught(s), ['range']);
  assert.deepEqual(loadTaught(null), []);
});
