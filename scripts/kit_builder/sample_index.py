#!/usr/bin/env python3
"""Scan a sample library and build a track-mapped index."""

from __future__ import annotations

import os
import re
from pathlib import Path

from kit_types import (
    AUDIO_EXTENSIONS,
    DIR_MAP,
    GENERIC_TOM,
    HAT_DIRS,
    HR16_MAP,
    KEYWORD_PATTERNS,
    KIT_TRACK_IDS,
    PREFIX_MAP,
    SUBDIR_TYPE_MAP,
    TOM_PITCH_WORDS,
    SampleEntry,
)

_WORD = re.compile(r"[a-z]+")
_ALL_TOMS = ["ht", "mt", "lt"]


def build_sample_index(
    samples_root: str,
) -> tuple[dict[str, list[SampleEntry]], list[SampleEntry]]:
    """Scan a directory tree and sort samples into slots.

    Args:
        samples_root: Root of the sample library.

    Returns:
        (by_track, all_samples): samples per track slot,
        and every audio file found. Both sorted by path.
    """
    root = Path(samples_root)
    by_track: dict[str, list[SampleEntry]] = {
        tid: [] for tid in KIT_TRACK_IDS
    }
    all_samples: list[SampleEntry] = []

    for dirpath, _dirnames, filenames in os.walk(root):
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in AUDIO_EXTENSIONS:
                continue

            abs_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(abs_path, root)

            sample = SampleEntry(
                path=abs_path,
                filename=fname,
                rel_path=rel_path,
            )
            all_samples.append(sample)

            for tid in classify(rel_path):
                by_track[tid].append(sample)

    for samples in by_track.values():
        samples.sort(key=lambda s: s.rel_path)
    all_samples.sort(key=lambda s: s.rel_path)

    return by_track, all_samples


def classify(rel_path: str) -> list[str]:
    """Classify a sample into zero or more track slots.

    Classification priority (first match wins):
    1. Top-level directory name
    2. Subdirectory names, deepest first, so
       ``geist/percussion/toms/x.wav`` counts as a tom
    3. Filename prefix
    4. HR16 abbreviation prefix
    5. Whole-word keyword in the filename

    Generic percussion folders map to nothing on their
    own; their samples are classified by filename and
    otherwise left to search.

    Args:
        rel_path: Path relative to the library root.

    Returns:
        Track IDs the sample should be offered for.
    """
    parts = rel_path.lower().split(os.sep)
    dirs, lower_fn = parts[:-1], parts[-1]
    stem = os.path.splitext(lower_fn)[0]

    slot = _match_dirs(dirs) or _match_filename(lower_fn, stem)
    if slot is None:
        return []
    if slot == GENERIC_TOM:
        return tom_slots(stem, dirs)
    if dirs and dirs[0] in HAT_DIRS:
        return [slot, "cy"]
    return [slot]


def _match_dirs(dirs: list[str]) -> str | None:
    """Match the top-level dir, then subdirs deepest first."""
    if dirs and dirs[0] in DIR_MAP:
        return DIR_MAP[dirs[0]]
    for part in reversed(dirs[1:]):
        if part in SUBDIR_TYPE_MAP:
            return SUBDIR_TYPE_MAP[part]
    return None


def _match_filename(lower_fn: str, stem: str) -> str | None:
    """Match a filename by prefix, HR16 code, then keyword."""
    for prefix, track_id in PREFIX_MAP:
        if lower_fn.startswith(prefix):
            # hh_ without explicit ch/oh qualifier
            if prefix == "hh_" and "open" in lower_fn:
                return "oh"
            return track_id

    for abbr, track_id in HR16_MAP:
        if stem.startswith(abbr):
            return track_id

    for pattern, track_id in KEYWORD_PATTERNS:
        if pattern.search(stem):
            return track_id

    return None


def tom_slots(stem: str, dirs: list[str]) -> list[str]:
    """Decide which tom slots a tom sample belongs in.

    Looks for whole pitch words ("hi", "low", "floor"...)
    in the filename, then in the folder names. "hit" and
    "slow" do not count. With no pitch word, the tom is
    offered for all three slots so it can be picked by ear.

    Args:
        stem: Lowercase filename without extension.
        dirs: Lowercase directory names, top first.

    Returns:
        ["ht"], ["mt"], ["lt"], or all three.
    """
    for text in (stem, " ".join(reversed(dirs))):
        words = set(_WORD.findall(text))
        for pitch_words, track_id in TOM_PITCH_WORDS:
            if words & pitch_words:
                return [track_id]
    return list(_ALL_TOMS)
