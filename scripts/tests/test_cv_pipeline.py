"""Golden-file integration tests for parse_pdf_cv pipeline."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import parse_pdf_cv as cv

TESTS_DIR = Path(__file__).resolve().parent
GOLDEN_DIR = TESTS_DIR / "golden"
IMAGES_DIR = cv.IMAGES_DIR


def _load_golden(page_num: int) -> dict:
  """Load golden reference JSON for a page."""
  path = GOLDEN_DIR / f"page_{page_num:03d}.json"
  return json.loads(path.read_text())


@pytest.fixture(autouse=True)
def _use_tmp_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
  """Redirect CV output to tmp dir to avoid polluting repo."""
  monkeypatch.setattr(cv, "CV_DIR", tmp_path / "cv")
  monkeypatch.setattr(cv, "DEBUG_DIR", tmp_path / "debug")


def _skip_if_no_image(page_num: int) -> None:
  """Skip test if the page image is not available."""
  path = IMAGES_DIR / f"page_{page_num:03d}.png"
  if not path.exists():
    pytest.skip(f"Image not available: {path}")


class TestPage008NoGrids:
  """Page 8 is text-only: zero grids expected."""

  def test_no_patterns(self) -> None:
    _skip_if_no_image(8)
    result = cv.process_page(8, debug=False)
    assert result["page"] == 8
    assert result["patterns"] == []

  def test_matches_golden(self) -> None:
    _skip_if_no_image(8)
    result = cv.process_page(8, debug=False)
    golden = _load_golden(8)
    assert result["patterns"] == golden["patterns"]


class TestPage009Standard:
  """Page 9: three 16-col patterns (Afro-Cub 1-3)."""

  def test_pattern_count(self) -> None:
    _skip_if_no_image(9)
    result = cv.process_page(9, debug=False)
    assert len(result["patterns"]) == 3

  def test_grid_widths(self) -> None:
    _skip_if_no_image(9)
    result = cv.process_page(9, debug=False)
    for pat in result["patterns"]:
      assert pat["grid_width"] == 16

  def test_steps_match_golden(self) -> None:
    """Cell data must exactly match golden reference."""
    _skip_if_no_image(9)
    result = cv.process_page(9, debug=False)
    golden = _load_golden(9)
    for cv_pat, gold_pat in zip(result["patterns"], golden["patterns"]):
      assert cv_pat["steps"] == gold_pat["steps"]

  def test_all_instruments_present(self) -> None:
    _skip_if_no_image(9)
    result = cv.process_page(9, debug=False)
    for pat in result["patterns"]:
      assert len(pat["steps"]) == 12
      for inst in cv.INSTRUMENT_ORDER:
        assert inst in pat["steps"]

  def test_ground_truth_accuracy(self) -> None:
    """Compare against patterns.json ground truth."""
    _skip_if_no_image(9)
    if not cv.PATTERNS_JSON.exists():
      pytest.skip("patterns.json not available")

    result = cv.process_page(9, debug=False)
    gt_data = json.loads(cv.PATTERNS_JSON.read_text())
    gt = {p["id"]: p for p in gt_data["patterns"]}

    expected_ids = [
      "afro-cub-1",
      "afro-cub-2",
      "afro-cub-3",
    ]
    total_cells = 0
    total_diffs = 0

    for cv_pat, exp_id in zip(result["patterns"], expected_ids):
      if exp_id not in gt:
        continue
      gt_pat = gt[exp_id]
      for pdf_key, tid in cv.INSTRUMENT_MAP.items():
        cv_s = cv_pat["steps"].get(pdf_key, "0" * 16)
        gt_s = gt_pat["steps"].get(tid, "0" * 16)
        for a, b in zip(cv_s, gt_s):
          total_cells += 1
          if a != b:
            total_diffs += 1

    assert total_diffs == 0, f"{total_diffs}/{total_cells} cell diffs"


class TestPage015TwelveColumn:
  """Page 15: three 12-col grids (Blues 4-6)."""

  def test_pattern_count(self) -> None:
    _skip_if_no_image(15)
    result = cv.process_page(15, debug=False)
    assert len(result["patterns"]) == 3

  def test_grid_widths_are_12(self) -> None:
    _skip_if_no_image(15)
    result = cv.process_page(15, debug=False)
    for pat in result["patterns"]:
      assert pat["grid_width"] == 12

  def test_steps_match_golden(self) -> None:
    _skip_if_no_image(15)
    result = cv.process_page(15, debug=False)
    golden = _load_golden(15)
    for cv_pat, gold_pat in zip(result["patterns"], golden["patterns"]):
      assert cv_pat["steps"] == gold_pat["steps"]

  def test_normalize_filters_12_col(self) -> None:
    """12-col patterns should be filtered by normalize."""
    _skip_if_no_image(15)
    result = cv.process_page(15, debug=False)
    for pat in result["patterns"]:
      normalized = cv.normalize_pattern(pat)
      assert normalized is None


class TestHelpersCopied:
  """Verify copied helper functions work correctly."""

  def test_name_to_id(self) -> None:
    assert cv.name_to_id("Afro-cub: 1") == "afro-cub-1"
    assert cv.name_to_id("Rock: 3") == "rock-3"

  def test_clean_name(self) -> None:
    assert cv.clean_name("Afro-cub: 1") == "Afro-Cub 1"
    assert cv.clean_name("Rock: 3") == "Rock 3"

  def test_parse_page_range(self) -> None:
    assert cv.parse_page_range("9-13") == (9, 13)
    assert cv.parse_page_range("15") == (15, 15)
    assert cv.parse_page_range(None) == (9, 97)

  def test_normalize_skips_break(self) -> None:
    raw = {
      "name": "Break: 1",
      "grid_width": 16,
      "steps": {},
    }
    assert cv.normalize_pattern(raw) is None

  def test_normalize_skips_12_col(self) -> None:
    raw = {
      "name": "Blues: 1",
      "grid_width": 12,
      "steps": {},
    }
    assert cv.normalize_pattern(raw) is None
