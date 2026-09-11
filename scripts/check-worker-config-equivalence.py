"""Read-only TOML equivalence audit against the pre-compaction Git baseline.

Requires Python 3.11+ and Node. No network calls, credentials or output files.
"""

import json
from pathlib import Path
import subprocess
import tomllib


root = Path(__file__).resolve().parents[1]
baseline = "237c69e4d"
old = tomllib.loads(subprocess.check_output(
    ["git", "show", f"{baseline}:wrangler.toml"], cwd=root
).decode("utf-8"))
current = tomllib.loads((root / "wrangler.toml").read_text(encoding="utf-8"))
defaults = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import { WORKER_CONFIG_DEFAULTS } from './src/workerConfig.js';"
    "process.stdout.write(JSON.stringify(WORKER_CONFIG_DEFAULTS));",
], cwd=root).decode("utf-8"))
old_vars = old.pop("vars")
current_vars = current.pop("vars")
assert old == current, "Non-vars configuration changed (triggers/bindings included)"
assert not (defaults.keys() & current_vars.keys()), "Migrated settings still consume bindings"
resolved = defaults | current_vars
assert old_vars.keys() == resolved.keys(), "Configuration keys changed"
for key, value in old_vars.items():
    assert type(value) is type(resolved[key]), f"Type changed: {key}"
    assert value == resolved[key], f"Value changed: {key}"
assert len(current_vars) == 45
assert len(defaults) == 32
print(f"PASS: {len(old_vars)} settings equivalent, including types; "
      f"{len(current_vars)} text bindings + {len(defaults)} code defaults. "
      "All other TOML sections unchanged.")
