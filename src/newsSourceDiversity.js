import { getDailyPublisherKey } from './dailyPromptSelection.js';

export function capNewsItemsWithPublisherDiversity(items, maxItems) {
  if (items.length <= maxItems) return items;
  const selected = new Set();
  const publishers = new Set();
  for (const item of items) {
    const publisher = getDailyPublisherKey(item);
    if (publishers.has(publisher)) continue;
    selected.add(item);
    publishers.add(publisher);
    if (selected.size >= maxItems) break;
  }
  for (const item of items) {
    if (selected.size >= maxItems) break;
    selected.add(item);
  }
  return items.filter((item) => selected.has(item));
}
