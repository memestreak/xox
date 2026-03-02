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
