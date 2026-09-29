import test from 'node:test';
import assert from 'node:assert/strict';

import { capNewsItemsWithPublisherDiversity } from '../src/newsSourceDiversity.js';
import { getDailyPublisherKey } from '../src/dailyPromptSelection.js';

test('a fixed news cache reserves one slot per publisher before filling by existing rank', () => {
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
    'https://x.com/dotey/status/0',
    'https://x.com/GeminiApp/status/1',
    'https://x.com/AnthropicAI/status/1',
  ]);
  assert.equal(new Set(capped.map(getDailyPublisherKey)).size, 4);
});

test('different Jike authors can each earn a cache slot', () => {
  const items = [
    { url: 'https://m.okjike.com/originalPosts/1', authors: '歸藏' },
    { url: 'https://m.okjike.com/originalPosts/2', authors: '歸藏' },
    { url: 'https://m.okjike.com/originalPosts/3', authors: '赵纯想' },
  ];
  assert.deepEqual(capNewsItemsWithPublisherDiversity(items, 2), [items[0], items[2]]);
});
