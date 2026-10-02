# 2026-10-02 daily recovery

## Observed failure

- Worker generated today's edition but did not publish it. Recovery run 36953260749 reproduced the failure.
- 69 cached inputs became 27 eligible candidates, then only 10 selected inputs. Four GitHub inputs reserved three slots for the project section: TOP capacity was seven, below the existing mandatory ten.
- A company-wide entity cap of one suppressed unrelated events from different publishers. Publisher and event deduplication already provide separate safeguards.
- Both initial generation and repair failed validation. A missing original source link was also reported. There was no FAQ exception or model timeout in this run.
- Scheduled status stored success even when its outcome was not-published. The dated Markdown does not exist in the frontend repository.

## Minimal scope

1. dailyPromptSelection.js: after normal diverse selection, only if TOP capacity is below ten, consider additional independently sourced events without the broad company cap. Preserve publisher cap, actual event/URL dedupe, AI relevance, project caps and prompt size. Adopt this extension only when it supplies ten TOP candidates; preserve the prior selection otherwise. Protect TOP capacity when reserving a fun item.
2. scheduledStatus.js/index.js: record failed publication as error without throwing or changing task routing. Mixed tasks retain individual outcomes.
3. preview-daily-faq.mjs: allow a complete dry-run before today's baseline exists; standalone FAQ comparison is optional in that case.
4. Focused regression tests for selection capacity, publisher/event caps, fun reservation and status semantics.

No cron, provider, secret, opportunity, account-opportunity or frontend theme changes. Original divergent workspaces remain untouched. Work uses a clean D-drive worktree based on 5c2274dee.

## Verification and delivery

Run all Node tests using process-scoped D-drive caches. Run branch preview against today's actual cached sources, inspect the full Markdown and all validation diagnostics, correct concrete defects and preview again when necessary. Deploy only the reviewed change through existing SSH/GitHub Actions flow. Publish the reviewed edition through existing repository paths, verify Hugo/Pages, dated URL and homepage. Confirm scheduled status reports publication accurately.

Rollback is a targeted revert of the recovery commit, not reset or overwrite of original workspaces. This fixes the observed selection contradiction; external model/API/source availability remains a residual operational risk.

## First preview review

Run 36954695024 passed hard validation with ten TOP items, but editorial review rejected it: the BootLoops/Claude-shaped-science article was duplicated via BestBlogs and Anthropic; an image-only unnamed-object teaser became an empty news item; and the standalone FAQ selected an academic Claude article and failed the buyer-question check.

The follow-up adds a shared event key for that scientific framework, rejects unnamed-object Telegram teasers without an explanation, preserves one social-section reserve while refilling TOP, and recognizes only the original cursor/plugins repository as Cursor functionality evidence for FAQ. Arbitrary GitHub forks stay technical-only. These changes do not add model calls, fetches or scheduled triggers.
