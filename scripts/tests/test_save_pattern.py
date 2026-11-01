#!/usr/bin/env python3
"""Tests for save_pattern.py."""

from __future__ import annotations

import copy
import json
import shutil
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import save_pattern  # noqa: E402
from save_pattern import PatternError  # noqa: E402


@pytest.fixture
def patterns_file(tmp_path: Path) -> Path:
  """A copy of the real patterns.json."""
  path = tmp_path / "patterns.json"
  shutil.copy(save_pattern.PATTERNS_JSON, path)
  return path


def first_pattern(path: Path) -> dict[str, Any]:
  data = json.loads(path.read_text(encoding="utf-8"))
  pattern: dict[str, Any] = data["patterns"][0]
  return pattern


def test_saving_an_unchanged_preset_keeps_the_file(
  patterns_file: Path,
) -> None:
  before = patterns_file.read_text(encoding="utf-8")
  entry = json.dumps(first_pattern(patterns_file), indent=2)
  report = save_pattern.save(entry, patterns_file)
  assert report.startswith("Updated ")
  assert patterns_file.read_text(encoding="utf-8") == before


def test_replaces_the_preset_in_place(patterns_file: Path) -> None:
  entry = first_pattern(patterns_file)
  entry["tracks"]["sd"] = {
    "steps": "0000100000001000",
    "trigConditions": {"12": {"fill": "fill"}},
  }
  entry["mixer"] = {"bd": {"gain": 0.8}, "ch": {"pan": 0.3}}
  save_pattern.save(json.dumps(entry), patterns_file)
  data = json.loads(patterns_file.read_text(encoding="utf-8"))
  assert data["patterns"][0] == entry
  ids = [p["id"] for p in data["patterns"]]
  assert ids.count(entry["id"]) == 1


def test_adds_a_new_id_at_the_end(patterns_file: Path) -> None:
  entry = first_pattern(patterns_file)
  entry["id"] = "house-new"
  entry["name"] = "House New"
  report = save_pattern.save(json.dumps(entry), patterns_file)
  assert report.startswith("Added house-new")
  data = json.loads(patterns_file.read_text(encoding="utf-8"))
  assert data["patterns"][-1]["id"] == "house-new"


def test_writes_keys_in_file_order(patterns_file: Path) -> None:
  entry = first_pattern(patterns_file)
  shuffled = {
    "tracks": {
      track_id: entry["tracks"][track_id]
      for track_id in reversed(save_pattern.TRACK_IDS)
    },
    "name": entry["name"],
    "id": entry["id"],
    "category": entry["category"],
  }
  parsed = save_pattern.parse_entry(json.dumps(shuffled))
  assert list(parsed) == ["id", "name", "category", "tracks"]
  assert tuple(parsed["tracks"]) == save_pattern.TRACK_IDS


def test_nothing_is_written_on_a_bad_entry(
  patterns_file: Path,
) -> None:
  before = patterns_file.read_text(encoding="utf-8")
  with pytest.raises(PatternError):
    save_pattern.save("{}", patterns_file)
  assert patterns_file.read_text(encoding="utf-8") == before


def _broken(change: str) -> str:
  """A valid entry with one thing wrong."""
  entry: dict[str, Any] = copy.deepcopy(
    first_pattern(save_pattern.PATTERNS_JSON)
  )
  if change == "custom id":
    entry["id"] = "custom"
  elif change == "edited mark":
    entry["id"] += "*"
  elif change == "missing track":
    del entry["tracks"]["cb"]
  elif change == "bad steps":
    entry["tracks"]["bd"]["steps"] = "10x0"
  elif change == "too many steps":
    entry["tracks"]["bd"]["steps"] = "1" * 65
  elif change == "condition past the end":
    entry["tracks"]["bd"]["trigConditions"] = {
      "16": {"probability": 50},
    }
  elif change == "loud mixer":
    entry["mixer"] = {"bd": {"gain": 1.5}}
  elif change == "accent in mixer":
    entry["mixer"] = {"ac": {"gain": 0.5}}
  elif change == "mute in mixer":
    entry["mixer"] = {"bd": {"isMuted": True}}
  elif change == "bpm":
    entry["bpm"] = 120
  elif change == "odd retrig rate":
    entry["tracks"]["bd"]["parameterLocks"] = {
      "0": {"retrig": {"enabled": True, "rate": 7, "length": 1}},
    }
  elif change == "retrig without length":
    entry["tracks"]["bd"]["parameterLocks"] = {
      "0": {"retrig": {"enabled": True, "rate": 32}},
    }
  return json.dumps(entry)


@pytest.mark.parametrize("change", [
  "custom id", "edited mark", "missing track", "bad steps",
  "too many steps", "condition past the end", "loud mixer",
  "accent in mixer", "mute in mixer", "bpm",
  "odd retrig rate", "retrig without length",
])
def test_rejects(change: str) -> None:
  with pytest.raises(PatternError):
    save_pattern.parse_entry(_broken(change))


def test_accepts_a_retrig_lock() -> None:
  entry: dict[str, Any] = copy.deepcopy(
    first_pattern(save_pattern.PATTERNS_JSON)
  )
  entry["tracks"]["bd"]["steps"] = "1" + entry["tracks"]["bd"]["steps"][1:]
  entry["tracks"]["bd"]["parameterLocks"] = {
    "0": {"gain": 0.5, "retrig": {
      "enabled": True, "rate": 64, "length": 0.5,
    }},
  }
  parsed = save_pattern.parse_entry(json.dumps(entry))
  assert parsed["tracks"]["bd"]["parameterLocks"]["0"]["retrig"] == {
    "enabled": True, "rate": 64, "length": 0.5,
  }


def test_rejects_text_that_is_not_json() -> None:
  with pytest.raises(PatternError, match="not JSON"):
    save_pattern.parse_entry("https://example.com/#abc")


def test_main_reads_a_file(
  patterns_file: Path,
  tmp_path: Path,
  monkeypatch: pytest.MonkeyPatch,
  capsys: pytest.CaptureFixture[str],
) -> None:
  monkeypatch.setattr(save_pattern, "PATTERNS_JSON", patterns_file)
  entry_file = tmp_path / "entry.json"
  entry_file.write_text(
    json.dumps(first_pattern(patterns_file)), encoding="utf-8",
  )
  assert save_pattern.main([str(entry_file)]) == 0
  assert "Updated" in capsys.readouterr().out


def test_main_reports_errors(
  tmp_path: Path, capsys: pytest.CaptureFixture[str],
) -> None:
  entry_file = tmp_path / "entry.json"
  entry_file.write_text("[]", encoding="utf-8")
  assert save_pattern.main([str(entry_file)]) == 1
  assert "save-pattern:" in capsys.readouterr().err
