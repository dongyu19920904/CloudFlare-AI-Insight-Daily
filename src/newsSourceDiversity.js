import { getDailyPublisherKey } from './dailyPromptSelection.js';

export function capNewsItemsWithPublisherDiversity(items, maxItems) {
  if (items.length <= maxItems) return items;
  const diversitySlots = Math.min(15, Math.max(1, Math.floor(maxItems * 0.3)));
  const selected = new Set(items.slice(0, maxItems - diversitySlots));
  const publishers = new Set([...selected].map(getDailyPublisherKey));
  for (const item of items.slice(maxItems - diversitySlots)) {
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
