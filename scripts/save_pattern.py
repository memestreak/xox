#!/usr/bin/env python3
"""Save a pattern copied from the app into patterns.json.

Usage: save_pattern.py [FILE]

In the app, open the grid menu (the ⋯ key over the track
names) and choose Copy pattern. Then run
`npm run save-pattern`. The entry is read from FILE, else
from stdin when it is piped, else from the macOS
clipboard (pbpaste).

The preset with the same id is replaced in place; a new
id is added at the end. Nothing is written unless the
entry passes every check. Review with `git diff` and
commit.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

PATTERNS_JSON = (
  Path(__file__).resolve().parent.parent
  / "src" / "app" / "data" / "patterns.json"
)

# Same order as TRACK_IDS in src/app/types.ts.
TRACK_IDS = (
  "ac", "bd", "sd", "ch", "oh", "cy",
  "ht", "mt", "lt", "rs", "cp", "cb",
)
GRID_TRACK_IDS = TRACK_IDS[1:]

ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
STEPS_RE = re.compile(r"^[01]{1,64}$")
CUSTOM_ID = "custom"

ENTRY_KEYS = ("id", "name", "category", "tracks", "mixer")
TRACK_KEYS = (
  "steps", "freeRun", "trigConditions", "parameterLocks",
)
CONDITION_KEYS = {"probability", "cycle", "fill"}
LOCK_KEYS = {"gain", "pan"}
LEVEL_KEYS = {"gain", "pan"}


class PatternError(ValueError):
  """The entry can't be saved; the message says why."""


def _check_level(value: Any, where: str) -> None:
  """A volume or pan value: a number from 0 to 1."""
  if (
    isinstance(value, bool)
    or not isinstance(value, (int, float))
    or not 0 <= value <= 1
  ):
    raise PatternError(f"{where} must be a number from 0 to 1")


def _check_step_map(
  value: Any, steps: int, allowed: set[str], where: str,
) -> None:
  """trigConditions or parameterLocks: step index -> fields."""
  if not isinstance(value, dict):
    raise PatternError(f"{where} must be an object")
  for key, fields in value.items():
    if not key.isdigit() or int(key) >= steps:
      raise PatternError(f"{where} has a bad step index {key!r}")
    if not isinstance(fields, dict) or not fields:
      raise PatternError(f"{where}.{key} must be a non-empty object")
    unknown = set(fields) - allowed
    if unknown:
      raise PatternError(
        f"{where}.{key} has unknown fields: {sorted(unknown)}"
      )


def _check_track(track_id: str, track: Any) -> None:
  where = f"tracks.{track_id}"
  if not isinstance(track, dict):
    raise PatternError(f"{where} must be an object")
  unknown = set(track) - set(TRACK_KEYS)
  if unknown:
    raise PatternError(f"{where} has unknown fields: {sorted(unknown)}")
  steps = track.get("steps")
  if not isinstance(steps, str) or not STEPS_RE.match(steps):
    raise PatternError(
      f"{where}.steps must be 1-64 characters of 0 and 1"
    )
  if "freeRun" in track and not isinstance(track["freeRun"], bool):
    raise PatternError(f"{where}.freeRun must be true or false")
  if "trigConditions" in track:
    _check_step_map(
      track["trigConditions"], len(steps), CONDITION_KEYS,
      f"{where}.trigConditions",
    )
  if "parameterLocks" in track:
    locks = track["parameterLocks"]
    _check_step_map(
      locks, len(steps), LOCK_KEYS, f"{where}.parameterLocks",
    )
    for key, fields in locks.items():
      for name, value in fields.items():
        _check_level(value, f"{where}.parameterLocks.{key}.{name}")


def _check_mixer(mixer: Any) -> None:
  if not isinstance(mixer, dict):
    raise PatternError("mixer must be an object")
  for track_id, levels in mixer.items():
    if track_id not in GRID_TRACK_IDS:
      raise PatternError(f"mixer has an unknown track {track_id!r}")
    if not isinstance(levels, dict):
      raise PatternError(f"mixer.{track_id} must be an object")
    unknown = set(levels) - LEVEL_KEYS
    if unknown:
      raise PatternError(
        f"mixer.{track_id} has unknown fields: {sorted(unknown)}"
      )
    for name, value in levels.items():
      _check_level(value, f"mixer.{track_id}.{name}")


def parse_entry(text: str) -> dict[str, Any]:
  """Read and check a copied entry.

  Returns the entry with its keys in patterns.json order.

  Raises:
    PatternError: The text isn't a valid pattern entry.
  """
  try:
    entry = json.loads(text)
  except json.JSONDecodeError as err:
    raise PatternError(f"not JSON: {err}") from err
  if not isinstance(entry, dict):
    raise PatternError("expected one pattern object")

  unknown = set(entry) - set(ENTRY_KEYS)
  if unknown:
    raise PatternError(f"unknown fields: {sorted(unknown)}")

  pattern_id = entry.get("id")
  if pattern_id == CUSTOM_ID:
    raise PatternError(
      "id is 'custom' (no preset was loaded): set id, name"
      " and category in the entry first"
    )
  if not isinstance(pattern_id, str) or not ID_RE.match(pattern_id):
    raise PatternError(
      "id must be lowercase words joined by hyphens"
    )
  name = entry.get("name")
  if not isinstance(name, str) or not name.strip():
    raise PatternError("name must be a non-empty string")
  category = entry.get("category")
  if category is not None and (
    not isinstance(category, str) or not category.strip()
  ):
    raise PatternError("category must be a non-empty string")

  tracks = entry.get("tracks")
  if not isinstance(tracks, dict):
    raise PatternError("tracks must be an object")
  if set(tracks) != set(TRACK_IDS):
    raise PatternError(
      "tracks must have exactly these tracks: "
      + " ".join(TRACK_IDS)
    )
  for track_id in TRACK_IDS:
    _check_track(track_id, tracks[track_id])

  if "mixer" in entry:
    _check_mixer(entry["mixer"])

  ordered: dict[str, Any] = {
    key: entry[key] for key in ENTRY_KEYS if key in entry
  }
  ordered["tracks"] = {
    track_id: {
      key: tracks[track_id][key]
      for key in TRACK_KEYS if key in tracks[track_id]
    }
    for track_id in TRACK_IDS
  }
  return ordered


def upsert(
  patterns: list[dict[str, Any]], entry: dict[str, Any],
) -> bool:
  """Replace the preset with the entry's id, or append it.

  Returns:
    True if a preset was replaced, False if added.
  """
  for index, pattern in enumerate(patterns):
    if pattern["id"] == entry["id"]:
      patterns[index] = entry
      return True
  patterns.append(entry)
  return False


def save(text: str, path: Path | None = None) -> str:
  """Check the entry and write it into patterns.json.

  Returns:
    A one-line report of what changed.

  Raises:
    PatternError: The entry can't be saved.
  """
  path = path or PATTERNS_JSON
  entry = parse_entry(text)
  data = json.loads(path.read_text(encoding="utf-8"))
  replaced = upsert(data["patterns"], entry)
  path.write_text(
    json.dumps(data, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
  )
  verb = "Updated" if replaced else "Added"
  return f"{verb} {entry['id']} ({entry['name']}) in {path.name}"


def read_input(file: str | None) -> str:
  """The entry text from FILE, piped stdin, or pbpaste."""
  if file is not None:
    return Path(file).read_text(encoding="utf-8")
  if not sys.stdin.isatty():
    return sys.stdin.read()
  try:
    result = subprocess.run(
      ["pbpaste"], capture_output=True, text=True, check=True,
    )
  except (OSError, subprocess.CalledProcessError) as err:
    raise PatternError(
      "no FILE or piped input, and pbpaste is unavailable"
    ) from err
  return result.stdout


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(
    description="Save a pattern copied from the app into"
    " patterns.json.",
  )
  parser.add_argument(
    "file", nargs="?",
    help="JSON file with the entry (default: stdin or clipboard)",
  )
  args = parser.parse_args(argv)
  try:
    print(save(read_input(args.file)))
  except PatternError as err:
    print(f"save-pattern: {err}", file=sys.stderr)
    return 1
  return 0


if __name__ == "__main__":
  sys.exit(main())
