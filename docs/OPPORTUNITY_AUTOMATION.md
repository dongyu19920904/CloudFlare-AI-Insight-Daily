# Daily AI Opportunity Watchdog

This project already has a Cloudflare cron for `AI商机` at `09:20` Beijing time.

To make daily updates more reliable, the repository now includes:

- `.github/workflows/ensure-daily-opportunity.yml`

What this workflow does:

- Runs every day at `09:31` and `09:39` Beijing time, after the Worker's `09:20` opportunity task.
- Checks whether today's opportunity file already exists in the frontend repo.
- If the file is missing, it calls:
  - `/testTriggerScheduledOpportunity?date=YYYY-MM-DD`
- After triggering, it verifies that today's file was created.

The opportunity recovery workflow is independent of the main AI daily. It does not change the daily's 09:00 attempt / 10:00 retry policy. An existing dated page and a working latest pointer are checked before generation, so a healthy edition does not need another model call.

## Required GitHub Actions Secret

Add this secret in the backend repository:

- `TEST_TRIGGER_SECRET`

Path:

- `Settings -> Secrets and variables -> Actions -> New repository secret`

The value must match the Worker secret with the same name.

## Manual Use

You can also run the workflow manually from GitHub Actions:

- Workflow: `Ensure Daily Opportunity`
- Optional input:
  - `date`: a date like `2026-03-24`
  - `force`: set to `true` if you want to rerun even when the page already exists
