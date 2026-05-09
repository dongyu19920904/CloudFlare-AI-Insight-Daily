#!/usr/bin/env python3
import json
import os
from pathlib import Path
from datetime import datetime, timezone


def load_json(path):
    if not path:
        return None

    file_path = Path(path)
    if not file_path.exists():
        return None

    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as error:
        return {"_load_error": str(error)}


def compact(value):
    if value is None or value == "":
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def markdown_value(value):
    text = compact(value)
    if not text:
        return ""
    return text.replace("|", "\\|").replace("\n", " ")


def append_summary(content):
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write(content)
        handle.write("\n")


def parse_iso_timestamp(value):
    if not value:
        return None
    try:
        text = str(value).strip()
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def get_now():
    override = parse_iso_timestamp(os.environ.get("NOW_ISO"))
    return override or datetime.now(timezone.utc)


def format_age(total_minutes):
    if total_minutes is None:
        return ""
    minutes = max(0, int(total_minutes))
    if minutes < 1:
        return "less than 1 minute"
    if minutes == 1:
        return "1 minute"
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    remainder = minutes % 60
    if remainder == 0:
        return f"{hours} hours"
    return f"{hours} hours {remainder} minutes"


def get_status_timestamp(status):
    for field in ("finishedAt", "startedAt", "queuedAt"):
        parsed = parse_iso_timestamp(status.get(field))
        if parsed:
            return field, parsed
    return "", None


def build_freshness(status, state, target_date):
    page_health = os.environ.get("PAGE_HEALTH", "").strip()

    if state == "not_recorded":
        return {
            "label": "not recorded for this mode/date",
            "timestamp_field": "",
            "age_minutes": None,
            "age_text": "",
            "warning": "",
        }

    if not isinstance(status, dict) or not status:
        return {
            "label": "unavailable",
            "timestamp_field": "",
            "age_minutes": None,
            "age_text": "",
            "warning": "",
        }

    timestamp_field, timestamp = get_status_timestamp(status)
    now = get_now()
    age_minutes = None
    if timestamp:
        age_minutes = max(0, int((now - timestamp).total_seconds() // 60))

    warnings = []
    status_date = str(status.get("date") or "").strip()
    if target_date and status_date and status_date not in {target_date, "current date"}:
        warnings.append(f"status date {status_date} does not match target {target_date}")

    running_stale_minutes = int(os.environ.get("RUNNING_STALE_MINUTES", "90"))
    finished_stale_minutes = int(os.environ.get("FINISHED_STALE_MINUTES", "1440"))

    label = "no timestamp"
    if state == "not_recorded":
        label = "not recorded for this mode/date"
    elif state == "running":
        if age_minutes is not None and age_minutes >= running_stale_minutes:
            if page_health == "healthy":
                label = "stale running status, page already healthy"
            else:
                label = "possible stale running status"
                warnings.append(f"still running after {format_age(age_minutes)}")
        else:
            label = "running"
    elif state in {"success", "error"}:
        if age_minutes is not None and age_minutes >= finished_stale_minutes:
            label = f"old {state} status"
            warnings.append(f"{state} status is {format_age(age_minutes)} old")
        else:
            label = state
    elif state:
        label = state

    return {
        "label": label,
        "timestamp_field": timestamp_field,
        "age_minutes": age_minutes,
        "age_text": format_age(age_minutes),
        "warning": "; ".join(warnings),
    }


mode = os.environ.get("MODE", "")
target_date = os.environ.get("TARGET_DATE", "")
status_http_code = os.environ.get("STATUS_HTTP_CODE", "")
status_payload = load_json(os.environ.get("STATUS_RESPONSE_PATH", "worker-status.json"))
trigger_payload = load_json(os.environ.get("TRIGGER_RESPONSE_PATH", "trigger-response.json"))

status = status_payload.get("status") if isinstance(status_payload, dict) else None
if not isinstance(status, dict):
    status = {}

trigger_debug = trigger_payload.get("debug") if isinstance(trigger_payload, dict) else None
status_debug = status.get("debug") if isinstance(status, dict) else None
debug = trigger_debug if isinstance(trigger_debug, dict) else status_debug if isinstance(status_debug, dict) else {}

mode = mode or status.get("mode") or (trigger_payload or {}).get("mode") or "unknown"
target_date = target_date or status.get("date") or (trigger_payload or {}).get("date") or ""

published_fields = {
    "daily": "dailyPublished",
    "opportunity": "opportunityPublished",
    "account-opportunity": "accountOpportunityPublished",
}
generated_fields = {
    "daily": "dailyGenerated",
    "opportunity": "opportunityGenerated",
    "account-opportunity": "accountOpportunityGenerated",
}
validation_fields = {
    "daily": "dailyValidationIssues",
    "opportunity": "opportunityValidationIssues",
    "account-opportunity": "accountOpportunityValidationIssues",
}

published = debug.get(published_fields.get(mode, ""))
generated = debug.get(generated_fields.get(mode, ""))
validation_issues = debug.get(validation_fields.get(mode, "")) or []
diagnostics = debug.get("promptSelectionDiagnostics") if isinstance(debug.get("promptSelectionDiagnostics"), dict) else {}

state = status.get("state") or ("not_recorded" if isinstance(status_payload, dict) else "unavailable")
status_key = status_payload.get("statusKey") if isinstance(status_payload, dict) else ""
freshness = build_freshness(status, state, target_date)

notice_parts = [
    f"mode={mode}",
    f"date={target_date or 'unknown'}",
    f"state={state}",
]
if published is not None:
    notice_parts.append(f"published={published}")
if generated is not None:
    notice_parts.append(f"generated={generated}")
if debug.get("promptTotalCandidateCount") is not None:
    notice_parts.append(f"candidates={debug.get('promptTotalCandidateCount')}")
if freshness.get("label"):
    notice_parts.append(f"freshness={freshness.get('label')}")

annotation = "::warning" if freshness.get("warning") or state == "error" else "::notice"
print(f"{annotation} title=Worker status::{', '.join(notice_parts)}")

rows = [
    ("Mode", mode),
    ("Date", target_date),
    ("Page health", os.environ.get("PAGE_HEALTH", "")),
    ("Status HTTP", status_http_code),
    ("Status key", status_key),
    ("State", state),
    ("Freshness", freshness.get("label")),
    ("Status age", freshness.get("age_text")),
    ("Status timestamp field", freshness.get("timestamp_field")),
    ("Freshness warning", freshness.get("warning")),
    ("Started at", status.get("startedAt")),
    ("Finished at", status.get("finishedAt")),
    ("Generated", generated),
    ("Published", published),
    ("Error", status.get("error")),
    ("Validation issues", validation_issues),
    ("Prompt candidate count", debug.get("promptTotalCandidateCount")),
    ("Prompt selected counts", debug.get("promptSelectedCounts")),
    ("Selection candidate counts", diagnostics.get("candidateCounts")),
    ("Selection selected counts", diagnostics.get("selectedCounts")),
    ("Selection quotas", diagnostics.get("quotas")),
    ("Selection hard caps", diagnostics.get("hardCaps")),
    ("Items with media", diagnostics.get("itemsWithMedia")),
    ("Items without media", diagnostics.get("itemsWithoutMedia")),
]

summary_lines = [
    f"## Worker Status: {mode} {target_date}".strip(),
    "",
    "| Field | Value |",
    "| --- | --- |",
]

for label, value in rows:
    rendered = markdown_value(value)
    if rendered:
        summary_lines.append(f"| {label} | {rendered} |")

if isinstance(trigger_payload, dict):
    summary_lines.extend([
        "",
        "### Trigger Response",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| Success | {markdown_value(trigger_payload.get('success'))} |",
        f"| Message | {markdown_value(trigger_payload.get('message'))} |",
    ])

if isinstance(status_payload, dict) and status_payload.get("_load_error"):
    summary_lines.append(f"| Status parse error | {markdown_value(status_payload.get('_load_error'))} |")

append_summary("\n".join(summary_lines))
