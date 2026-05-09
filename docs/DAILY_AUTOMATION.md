# Daily AI Journal Watchdog

This project already has a Cloudflare cron for `AI日报` at `09:00` Beijing time.

To make daily updates more reliable, the repository now includes:

- `.github/workflows/ensure-daily-journal.yml`

What this workflow does:

- Runs every day at `09:15` Beijing time.
- Checks whether today's daily page already exists in the frontend repo.
- If the file is missing, it calls:
  - `/testTriggerScheduledDaily?date=YYYY-MM-DD`
- After triggering, it verifies that today's file was created.

## Required GitHub Actions Secret

Add this secret in the backend repository:

- `TEST_TRIGGER_SECRET`

Path:

- `Settings -> Secrets and variables -> Actions -> New repository secret`

The value must match the Worker secret with the same name.

## Manual Use

You can also run the workflow manually from GitHub Actions:

- Workflow: `Ensure Daily Journal`
- Optional input:
  - `date`: a date like `2026-03-25`
  - `force`: set to `true` if you want to rerun even when the page already exists

## Daily Operator Check

Use this order when checking whether the daily automation is healthy:

1. Check GitHub Actions:

   ```bash
   gh run list --limit 5
   ```

   The latest `Deploy Cloudflare Worker` and `Ensure Daily Journal` runs should be `success`.

2. Check the Worker scheduled status endpoint:

   ```text
   https://<worker>.workers.dev/testTriggerScheduledStatus?key=<TEST_TRIGGER_SECRET>&mode=daily
   https://<worker>.workers.dev/testTriggerScheduledStatus?key=<TEST_TRIGGER_SECRET>&mode=opportunity
   https://<worker>.workers.dev/testTriggerScheduledStatus?key=<TEST_TRIGGER_SECRET>&mode=account-opportunity
   ```

   Expected states:

   - `running`: cron started and is still working.
   - `success`: cron completed.
   - `error`: cron failed; inspect `error`, `stack`, and `debug`.
   - `null`: no recent status was written for that mode.

3. Check content quality diagnostics inside `status.debug`:

   - `promptTotalCandidateCount`: how much source material was available.
   - `promptSelectedCounts`: how many items were selected from each source type.
   - `promptSelectionDiagnostics`: quotas, hard caps, source candidate counts, and media counts.
   - `dailyValidationPassed` / `dailyValidationIssues`: whether publish validation passed.
   - `dailyPublished`: whether the daily page was committed to the frontend repo.

## Safe Manual Recovery

Prefer async trigger mode when recovering a run, because it stores status while the job runs:

```text
https://<worker>.workers.dev/testTriggerScheduledDaily?key=<TEST_TRIGGER_SECRET>&date=YYYY-MM-DD&async=1
```

The response includes a `statusKey`. Poll it with:

```text
https://<worker>.workers.dev/testTriggerScheduledStatus?key=<TEST_TRIGGER_SECRET>&statusKey=<statusKey>
```

Use these mode-specific trigger endpoints when needed:

- `/testTriggerScheduledDaily`
- `/testTriggerScheduledOpportunity`
- `/testTriggerScheduledAccountOpportunity`

Do not use or document any fallback trigger secret. Both GitHub Actions and the Worker must have a configured `TEST_TRIGGER_SECRET`.
