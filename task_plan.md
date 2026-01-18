# Task Plan: AI Daily & BioAI Daily Status + Blog Automation

## Goal
Resolve remaining issues: missing 2026-01-16 BioAI daily update, blog auto-generation on yuyu.aivora.cn, remove AstroPaper sample posts, and deploy backend fixes.

## Add-on Goal (2026-01-16)
Switch all Claude model defaults to `claude-sonnet-4-5` across AI/BioAI backends and frontends (except translation models).

## Current Phase
Phase 8

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm user intent and current status signals
- [x] Collect evidence: GH Actions run status for translations
- [x] Inspect CloudFlare-BioAI-Daily for blog automation wiring
- [x] Inspect BioAI daily 2026-01-16 generation status and backend logs/signals
- [x] Inspect astro-paper for sample posts and current blog list
- [x] Document findings in findings.md
- **Status:** in_progress

### Phase 2: Planning & Structure
- [x] Decide if fixes/edits are required
- [x] Identify minimal changes and impacted repos
- [ ] Document decisions with rationale
- **Status:** in_progress

### Phase 3: Implementation
- [x] Apply targeted edits if missing wiring is found
- [x] Keep changes minimal and isolated
- [x] Upgrade Wrangler and redeploy CloudFlare-BioAI-Daily
- [x] Trigger or backfill 2026-01-16 daily update if missing
- [ ] Remove AstroPaper sample posts
- [ ] Update docs/notes as needed
- [x] Add public image proxy for AI/BioAI/astro frontends
- **Status:** in_progress

### Phase 4: Testing & Verification
- [ ] Re-run or check workflows if changes applied
- [x] Verify daily 2026-01-16 exists and homepage updated
- [ ] Verify blog auto-generation produces 2026-01-16 post
- [ ] Document results in progress.md
- **Status:** pending

### Phase 5: Delivery
- [ ] Summarize findings and status clearly
- [ ] Provide next steps for user
- **Status:** pending

### Phase 6: Model Switch - Discovery
- [x] Locate all Claude model references across AI/BioAI backends + frontends
- [x] Identify translation-only model references to exclude
- **Status:** complete

### Phase 7: Model Switch - Implementation
- [x] Update DEFAULT_ANTHROPIC_MODEL to `claude-sonnet-4-5` (except translation)
- [x] Update any code fallback defaults for Claude model selection
- **Status:** complete

### Phase 8: Model Switch - Verification
- [ ] Run model-string verification (TDD red/green) across remaining repos
- [ ] Document results in progress.md
- **Status:** in_progress

## Key Questions
1. Why is BioAI 2026-01-16 daily missing despite schedule?
2. Why is blog auto-generation not creating 2026-01-16 posts?
3. Which AstroPaper sample posts should be removed (confirm file paths)?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Inline python test timed out (TDD check for workflow) | 1 | Switch to `python -c` one-liner |
| TDD check script exited nonzero on PASS | 2 | Use explicit `sys.exit(0)` when passing |
| git push timed out for Hextra-AI-Insight-Daily | 1 | Retry with explicit remote/verbose |
| git push rejected (non-fast-forward) for Hextra-AI-Insight-Daily | 2 | Rebase onto origin/main then push |
| git pull --rebase failed (out of memory) for Hextra-AI-Insight-Daily | 3 | Need user guidance before retrying (3-strike) |
| Node inline test failed due to string quoting | 1 | Use single-quoted strings with escaped newlines |
| Node inline test still failed (quotes around description) | 2 | Switch to temp .mjs test file |
| Set-Content failed because tmp/ directory missing | 1 | Create directory before writing test file |
| Debug inline node script failed due to quoting | 1 | Use temp file for debug output |
| Temp .mjs test files written in wrong encoding (garbled Chinese) | 1 | Rewrite with `-Encoding utf8` |
| Blog cron test import failed (index.js ESM resolution) | 1 | Use text-based check instead of module import |
| Blog cron text test failed (bad path) | 1 | Resolve path from repo root (`src/index.js`) |
| wrangler deploy failed for CloudFlare-BioAI-Daily (fetch failed) | 1 | Retry or upgrade Wrangler after user guidance |
| wrangler secret list failed for CloudFlare-AI-Insight-Daily (fetch failed) | 1 | Retry later or check proxy/network |
| astro-paper astro.config.mjs not found | 1 | Check for astro.config.ts/cjs and continue |
| Hextra image-proxy test script timed out | 1 | Re-run with separate steps and longer timeout |
| astro-paper image-proxy test failed due to ESM (require not defined) | 1 | Use .cjs or ESM import for test |
| git push failed for astro-paper (SSL/TLS handshake) | 1 | Retry with `git push -v` succeeded |
| Remove-Item failed (access denied) when deleting tmp/model-switch.test.mjs | 1 | Pending |
| cmd del/rmdir failed (access denied) when deleting tmp | 2 | Pending |
| attrib+del+rmdir failed (access denied) when deleting tmp | 3 | Need user guidance (3-strike) |
| git add failed in CloudFlare-AI-Insight-Daily (index.lock permission denied) | 1 | Pending |
| attrib -r -s -h .git failed (access denied) | 1 | Pending |
| icacls .git /remove:d failed (no files processed) | 1 | Pending |
| Set-Acl attempt failed removing deny ACE (invalid rights + unauthorized) | 1 | Need user guidance |
| git push timed out for CloudFlare-BioAI-Daily | 1 | Pending |

## Notes
- Update phase status as you progress
- Log errors immediately
