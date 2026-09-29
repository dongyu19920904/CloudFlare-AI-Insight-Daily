import test from 'node:test';
import assert from 'node:assert/strict';

import { capNewsItemsWithPublisherDiversity } from '../src/newsSourceDiversity.js';
import { getDailyPublisherKey } from '../src/dailyPromptSelection.js';

test('a fixed news cache preserves top-ranked items and reserves a few diverse slots', () => {
  const items = [
    ...Array.from({ length: 8 }, (_, index) => ({ url: `https://t.me/aigc1024/${index}` })),
    ...Array.from({ length: 3 }, (_, index) => ({ url: `https://x.com/dotey/status/${index}` })),
    { url: 'https://x.com/GeminiApp/status/1' },
    { url: 'https://x.com/AnthropicAI/status/1' },
  ];
  const capped = capNewsItemsWithPublisherDiversity(items, 5);

  assert.equal(capped.length, 5);
  assert.deepEqual(capped.map((item) => item.url), [
    'https://t.me/aigc1024/0',
    'https://t.me/aigc1024/1',
    'https://t.me/aigc1024/2',
    'https://t.me/aigc1024/3',
    'https://x.com/dotey/status/0',
  ]);
  assert.equal(new Set(capped.map(getDailyPublisherKey)).size, 2);
});

test('different Jike authors can each earn a cache slot', () => {
  const items = [
    { url: 'https://m.okjike.com/originalPosts/1', authors: '歸藏' },
    { url: 'https://m.okjike.com/originalPosts/2', authors: '歸藏' },
    { url: 'https://m.okjike.com/originalPosts/3', authors: '赵纯想' },
  ];
  assert.deepEqual(capNewsItemsWithPublisherDiversity(items, 2), [items[0], items[2]]);
});

test('a 50-item cache keeps the best-ranked 35 and adds up to 15 other publishers', () => {
  const items = [
    ...Array.from({ length: 55 }, (_, index) => ({ url: `https://t.me/aigc1024/${index}` })),
    ...Array.from({ length: 20 }, (_, index) => ({ url: `https://x.com/author${index}/status/1` })),
  ];
  const capped = capNewsItemsWithPublisherDiversity(items, 50);
  assert.equal(capped.length, 50);
  assert.deepEqual(capped.slice(0, 35), items.slice(0, 35));
  assert.equal(capped.filter((item) => item.url.startsWith('https://x.com/')).length, 15);
});
