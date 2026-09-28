import { buildDailyPromptSelection } from './dailyPromptSelection.js';
import { countDailyTopEligiblePromptItems, getDailyPromptAllocationStats } from './dailyGenerationPromptInput.js';

function getPromptSourceUrl(item) {
  return /^Url:\s*(https?:\/\/\S+)/im.exec(String(item || ''))?.[1] || '';
}

export function selectAlternateDailySources(allUnifiedData, env, selectedContentItems, requirements = {}) {
  const originalUrls = new Set(selectedContentItems.map(getPromptSourceUrl).filter(Boolean));

  // Try the lowest-ranked selected sources first so important leading stories stay available.
  for (const excludedUrl of [...originalUrls].reverse()) {
    const alternative = buildDailyPromptSelection(allUnifiedData, env, {
      excludedSourceUrls: [excludedUrl],
    });
    const alternativeUrls = new Set(alternative.selectedContentItems.map(getPromptSourceUrl).filter(Boolean));
    if (![...alternativeUrls].some((url) => !originalUrls.has(url))) continue;
    if (countDailyTopEligiblePromptItems(
      alternative.selectedContentItems,
      alternative.dailyFunContentItems
    ) < (requirements.minimumTopItems || 10)) continue;

    const allocation = getDailyPromptAllocationStats(
      alternative.selectedContentItems,
      alternative.dailyFunContentItems
    );
    if (allocation.reservedProjectItems < (requirements.minimumOpenSourceItems || 0) ||
        allocation.reservedSocialItems < (requirements.minimumSocialItems || 0) ||
        allocation.reservedPaperItems < (requirements.minimumResearchItems || 0) ||
        allocation.reservedNewsItems < (requirements.minimumIndustryItems || 0)) continue;
    const topicSections = Math.min(allocation.reservedNewsItems, 2) +
      Number(allocation.reservedPaperItems > 0) +
      Number(allocation.reservedProjectItems > 0) +
      Number(allocation.reservedSocialItems > 0);
    if (topicSections < (requirements.minimumTopicSections || 0)) continue;

    return {
      ...alternative,
      excludedUrl,
      addedSourceUrls: [...alternativeUrls].filter((url) => !originalUrls.has(url)),
    };
  }

  return null;
}
