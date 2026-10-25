#!/usr/bin/env python3
"""Tests for the kit builder classifier and assembler."""

import json
import os
import subprocess
import sys
import wave
from pathlib import Path

import pytest

sys.path.insert(
  0,
  str(Path(__file__).resolve().parent.parent / "kit_builder"),
)
import assembler
from kit_types import KIT_TRACK_IDS, SampleEntry
from sample_index import classify, tom_slots


def _p(*parts: str) -> str:
  """Join path parts with the OS separator."""
  return os.path.join(*parts)


class TestTomSlots:
  """Tom pitch comes from whole words only."""

  def test_hit_is_not_high(self) -> None:
    assert tom_slots("soul_hit_tom_05_gb", []) == ["ht", "mt", "lt"]

  def test_this_is_not_high(self) -> None:
    assert tom_slots("this_tom_02_gb", []) == ["ht", "mt", "lt"]

  def test_slow_is_not_low(self) -> None:
    assert tom_slots("slow_tom", []) == ["ht", "mt", "lt"]

  def test_hi_word(self) -> None:
    assert tom_slots("gretsch_hi_rb8_hit_02", []) == ["ht"]

  def test_floor_word(self) -> None:
    assert tom_slots("tom_floor_03", []) == ["lt"]

  def test_mid_word(self) -> None:
    assert tom_slots("tom-mid-1", []) == ["mt"]

  def test_folder_word_used_when_name_silent(self) -> None:
    assert tom_slots("tom_03", ["kit", "low toms"]) == ["lt"]

  def test_filename_beats_folder(self) -> None:
    assert tom_slots("tom_hi", ["low toms"]) == ["ht"]


class TestClassify:
  """Classification of real-world library paths."""

  def test_toms_folder_unknown_pitch(self) -> None:
    path = _p("toms", "vitamin_c", "tom_03.wav")
    assert classify(path) == ["ht", "mt", "lt"]

  def test_toms_inside_percussion_folder(self) -> None:
    path = _p("geist", "geist_factory", "percussion", "toms",
              "tm_tom_real_a1_mpc60_gb.wav")
    assert classify(path) == ["ht", "mt", "lt"]

  def test_claps_inside_percussion_folder(self) -> None:
    path = _p("geist", "best_of_guru", "percussion", "claps",
              "con_clap04_gb.aif")
    assert classify(path) == ["cp"]

  def test_shaker_in_percussion_is_unmapped(self) -> None:
    path = _p("geist", "geist_factory", "percussion", "shaker",
              "sh_shaker_stereo_061_hc.wav")
    assert classify(path) == []

  def test_top_level_percussion_needs_a_keyword(self) -> None:
    assert classify(_p("percussion", "120", "perc_07.wav")) == []

  def test_top_level_percussion_cowbell(self) -> None:
    path = _p("percussion", "120", "big_cowbell.wav")
    assert classify(path) == ["cb"]

  def test_keyword_with_underscores(self) -> None:
    path = _p("misc", "my_clap_01.wav")
    assert classify(path) == ["cp"]

  def test_specific_tom_subdir(self) -> None:
    path = _p("rample", "10 floors", "a.wav")
    assert classify(path) == ["lt"]

  def test_hat_dir_also_feeds_cymbal(self) -> None:
    path = _p("closed_hats", "analog", "x.wav")
    assert classify(path) == ["ch", "cy"]

  def test_prefix(self) -> None:
    assert classify(_p("curated_samples", "bd_deep.wav")) == ["bd"]


@pytest.fixture
def kit_env(
  tmp_path: Path,
  monkeypatch: pytest.MonkeyPatch,
) -> Path:
  """Point the assembler at a temp kits dir and kits.json."""
  kits_dir = tmp_path / "kits"
  kits_dir.mkdir()
  kits_json = tmp_path / "kits.json"
  kits_json.write_text(json.dumps(
    {"kits": [{"id": "808", "name": "808", "folder": "808"}]}
  ))
  monkeypatch.setattr(assembler, "KITS_DIR", kits_dir)
  monkeypatch.setattr(assembler, "KITS_JSON", kits_json)
  return tmp_path


def _fake_convert(src: str, dest: Path) -> None:
  """Stand-in for ffmpeg: copy the source bytes."""
  dest.write_bytes(Path(src).read_bytes())


def _sample(tmp_path: Path) -> SampleEntry:
  """Create a dummy source sample."""
  src = tmp_path / "src.wav"
  src.write_bytes(b"RIFF")
  return SampleEntry(str(src), "src.wav", "src.wav")


class TestKitConflict:
  """Up-front name checks."""

  def test_free(self, kit_env: Path) -> None:
    assert assembler.kit_conflict("new", "new") is None

  def test_taken_id(self, kit_env: Path) -> None:
    assert "already exists" in str(
      assembler.kit_conflict("808", "other")
    )

  def test_taken_folder(self, kit_env: Path) -> None:
    (kit_env / "kits" / "taken").mkdir()
    assert "already exists" in str(
      assembler.kit_conflict("new", "taken")
    )


class TestAssembleKit:
  """File writing and cleanup."""

  def test_skipped_slots_get_silence(
    self, kit_env: Path, monkeypatch: pytest.MonkeyPatch,
  ) -> None:
    monkeypatch.setattr(assembler, "_convert", _fake_convert)

    assembler.assemble_kit(
      "new", "New", "new", {"bd": _sample(kit_env)},
    )

    kit_dir = kit_env / "kits" / "new"
    names = sorted(p.name for p in kit_dir.iterdir())
    assert names == sorted(f"{t}.wav" for t in KIT_TRACK_IDS)
    assert (kit_dir / "bd.wav").read_bytes() == b"RIFF"
    with wave.open(str(kit_dir / "sd.wav")) as silent:
      assert silent.getframerate() == assembler.SAMPLE_RATE
      assert silent.getsampwidth() == 2
    kits = json.loads((kit_env / "kits.json").read_text())
    assert kits["kits"][-1] == {
      "id": "new", "name": "New", "folder": "new",
    }

  def test_failure_leaves_nothing_behind(
    self, kit_env: Path, monkeypatch: pytest.MonkeyPatch,
  ) -> None:
    def fail(src: str, dest: Path) -> None:
      raise subprocess.CalledProcessError(1, "ffmpeg")

    monkeypatch.setattr(assembler, "_convert", fail)

    with pytest.raises(subprocess.CalledProcessError):
      assembler.assemble_kit(
        "new", "New", "new", {"bd": _sample(kit_env)},
      )

    assert list((kit_env / "kits").iterdir()) == []
    kits = json.loads((kit_env / "kits.json").read_text())
    assert len(kits["kits"]) == 1

  def test_taken_name_raises_before_writing(
    self, kit_env: Path,
  ) -> None:
    with pytest.raises(ValueError):
      assembler.assemble_kit("808", "Dup", "dup", {})
    assert list((kit_env / "kits").iterdir()) == []
