import test from 'node:test';
import assert from 'node:assert/strict';

import { selectAlternateDailySources } from '../src/dailyAlternateSelection.js';
import { buildDailyPromptSelection, getDailyPublisherKey } from '../src/dailyPromptSelection.js';
import { countDailyTopEligiblePromptItems } from '../src/dailyGenerationPromptInput.js';

function newsItem(publisher, index) {
  return {
    type: 'news',
    title: `News ${publisher * 4 + index}`,
    description: `AI model news description ${publisher * 4 + index}`,
    source: 'AI Base',
    url: `https://feed-${publisher}.example.com/news-${index}`,
    published_date: '2026-09-28',
    details: {
      content_html: `<p>News ${publisher * 4 + index} content about AI tools and agents.</p>`,
    },
  };
}

function promptUrls(items) {
  return items.map((item) => /^Url:\s*(\S+)/m.exec(item)?.[1]).filter(Boolean);
}

test('reselects an unused same-day URL while preserving TOP capacity and publisher cap', () => {
  const news = Array.from({ length: 4 }, (_, publisher) =>
    Array.from({ length: 4 }, (_, index) => newsItem(publisher, index + 1))
  ).flat();
  const data = { news, project: [], socialMedia: [], paper: [] };
  const original = buildDailyPromptSelection(data);
  const alternative = selectAlternateDailySources(data, {}, original.selectedContentItems, {
    minimumTopItems: 10,
  });

  assert.ok(alternative, JSON.stringify({
    selected: promptUrls(original.selectedContentItems),
    topEligible: countDailyTopEligiblePromptItems(original.selectedContentItems, original.dailyFunContentItems),
    candidates: original.selectionDiagnostics.candidateCounts,
  }));
  assert.ok(alternative.addedSourceUrls.length > 0);
  assert.ok(!promptUrls(original.selectedContentItems).includes(alternative.addedSourceUrls[0]));
  assert.ok(!promptUrls(alternative.selectedContentItems).includes(alternative.excludedUrl));
  assert.ok(countDailyTopEligiblePromptItems(
    alternative.selectedContentItems,
    alternative.dailyFunContentItems
  ) >= 10);
  const counts = new Map();
  for (const url of promptUrls(alternative.selectedContentItems)) {
    const key = getDailyPublisherKey({ url });
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  assert.ok([...counts.values()].every((count) => count <= 3));
});

test('does not invent replacement sources when the same-day pool has none', () => {
  const data = {
    news: Array.from({ length: 4 }, (_, publisher) =>
      Array.from({ length: 3 }, (_, index) => newsItem(publisher, index + 1))
    ).flat(),
    project: [], socialMedia: [], paper: [],
  };
  const original = buildDailyPromptSelection(data);
  assert.equal(selectAlternateDailySources(data, {}, original.selectedContentItems, {
    minimumTopItems: 10,
  }), null);
});
