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
