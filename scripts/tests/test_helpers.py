"""Tests for parse_pdf_patterns helper functions."""

import sys
from pathlib import Path

sys.path.insert(
  0, str(Path(__file__).resolve().parent.parent)
)
import parse_pdf_patterns as pp


class TestParsePageRange:
  """Tests for parse_page_range."""

  def test_single_page(self) -> None:
    assert pp.parse_page_range("15") == (15, 15)

  def test_page_range(self) -> None:
    assert pp.parse_page_range("9-13") == (9, 13)

  def test_none_returns_defaults(self) -> None:
    assert pp.parse_page_range(None) == (
      pp.DEFAULT_PAGE_START,
      pp.DEFAULT_PAGE_END,
    )

  def test_custom_defaults(self) -> None:
    assert pp.parse_page_range(None, 1, 50) == (1, 50)

  def test_invalid_raises(self) -> None:
    import pytest

    with pytest.raises(ValueError):
      pp.parse_page_range("abc")


class TestNameToId:
  """Tests for name_to_id."""

  def test_afro_cub(self) -> None:
    assert pp.name_to_id("Afro-cub: 1") == "afro-cub-1"

  def test_rock(self) -> None:
    assert pp.name_to_id("Rock: 3") == "rock-3"

  def test_new_wave(self) -> None:
    assert pp.name_to_id("New Wave: 1") == "new-wave-1"

  def test_spaces(self) -> None:
    assert pp.name_to_id("Rhythm & Blues: 2") == (
      "rhythm-blues-2"
    )


class TestCleanName:
  """Tests for clean_name."""

  def test_colon_removed(self) -> None:
    assert pp.clean_name("Afro-cub: 1") == "Afro-Cub 1"

  def test_title_case(self) -> None:
    assert pp.clean_name("Rock: 3") == "Rock 3"

  def test_hyphenated(self) -> None:
    assert pp.clean_name("new wave: 1") == "New Wave 1"


class TestCellsToBinaryString:
  """Tests for cells_to_binary_string."""

  def test_all_empty(self) -> None:
    cells = [
      pp.Cell(column=i, filled=False)
      for i in range(1, 17)
    ]
    assert pp.cells_to_binary_string(cells) == (
      "0000000000000000"
    )

  def test_all_filled(self) -> None:
    cells = [
      pp.Cell(column=i, filled=True)
      for i in range(1, 17)
    ]
    assert pp.cells_to_binary_string(cells) == (
      "1111111111111111"
    )

  def test_mixed(self) -> None:
    fills = [
      True, False, True, True, True, False, True, False,
      True, False, True, False, True, False, True, False,
    ]
    cells = [
      pp.Cell(column=i + 1, filled=f)
      for i, f in enumerate(fills)
    ]
    assert pp.cells_to_binary_string(cells) == (
      "1011101010101010"
    )

  def test_twelve_columns(self) -> None:
    cells = [
      pp.Cell(column=i, filled=(i % 2 == 1))
      for i in range(1, 13)
    ]
    assert pp.cells_to_binary_string(cells) == (
      "101010101010"
    )


class TestComputeConsensus:
  """Tests for compute_consensus."""

  def test_unanimous_agreement(self) -> None:
    passes = [
      {"AC": "1000000000000000"},
      {"AC": "1000000000000000"},
      {"AC": "1000000000000000"},
    ]
    result, flagged = pp.compute_consensus(passes, 16)
    assert result["AC"] == "1000000000000000"
    assert flagged == 0

  def test_majority_vote(self) -> None:
    passes = [
      {"AC": "1000000000000000"},
      {"AC": "1100000000000000"},
      {"AC": "1000000000000000"},
    ]
    result, flagged = pp.compute_consensus(passes, 16)
    assert result["AC"] == "1000000000000000"
    assert flagged == 1

  def test_all_instruments(self) -> None:
    row = "0" * 16
    passes = [
      {k: row for k in pp.INSTRUMENT_ORDER},
      {k: row for k in pp.INSTRUMENT_ORDER},
      {k: row for k in pp.INSTRUMENT_ORDER},
    ]
    result, flagged = pp.compute_consensus(passes, 16)
    assert len(result) == 12
    assert flagged == 0


class TestNormalizePattern:
  """Tests for normalize_pattern."""

  def test_basic_normalization(self) -> None:
    raw = {
      "name": "Rock: 1",
      "grid_width": 16,
      "steps": {
        "BD": "1000100010001000",
        "SD": "0000100000001000",
        "CH": "1111111111111111",
      },
    }
    result = pp.normalize_pattern(raw)
    assert result is not None
    assert result["id"] == "rock-1"
    assert result["name"] == "Rock 1"
    assert result["steps"]["bd"] == "1000100010001000"
    assert result["steps"]["sd"] == "0000100000001000"
    assert result["steps"]["cy"] == "0000000000000000"

  def test_skip_non_16_step(self) -> None:
    raw = {
      "name": "Blues: 1",
      "grid_width": 12,
      "steps": {},
    }
    assert pp.normalize_pattern(raw) is None

  def test_skip_break(self) -> None:
    raw = {
      "name": "Rock Break: 1",
      "grid_width": 16,
      "steps": {},
    }
    assert pp.normalize_pattern(raw) is None

  def test_invalid_step_string(self) -> None:
    raw = {
      "name": "Pop: 1",
      "grid_width": 16,
      "steps": {"BD": "10001"},
    }
    result = pp.normalize_pattern(raw)
    assert result is not None
    assert result["steps"]["bd"] == "0000000000000000"

  def test_all_12_tracks(self) -> None:
    raw = {
      "name": "Test: 1",
      "grid_width": 16,
      "steps": {},
    }
    result = pp.normalize_pattern(raw)
    assert result is not None
    assert len(result["steps"]) == 12
    for tid in pp.ALL_TRACK_IDS:
      assert tid in result["steps"]
