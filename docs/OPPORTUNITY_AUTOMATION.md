# Daily AI Opportunity Watchdog

This project already has a Cloudflare cron for `AI商机` at `09:20` Beijing time.

To make daily updates more reliable, the repository now includes:

- `.github/workflows/ensure-daily-opportunity.yml`

What this workflow does:

- Runs every day at `09:35` Beijing time.
- Checks whether today's opportunity file already exists in the frontend repo.
- If the file is missing, it calls:
  - `/testTriggerScheduledOpportunity?date=YYYY-MM-DD`
- After triggering, it verifies that today's file was created.

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
