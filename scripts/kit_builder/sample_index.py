#!/usr/bin/env python3
"""Scan a sample library and build a track-mapped index."""

from __future__ import annotations

import os
from pathlib import Path

from kit_types import (
    AUDIO_EXTENSIONS,
    DIR_MAP,
    HAT_DIRS,
    HR16_MAP,
    KEYWORD_PATTERNS,
    KIT_TRACK_IDS,
    PERC_KEYWORD_MAP,
    PERCUSSION_DIRS,
    PREFIX_MAP,
    SUBDIR_TYPE_MAP,
    SampleEntry,
)


def build_sample_index(
    samples_root: str,
) -> tuple[dict[str, list[SampleEntry]], list[SampleEntry]]:
    """Return (by_track, all_samples)."""
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

            track_ids = _classify(rel_path, fname)
            for tid in track_ids:
                by_track[tid].append(sample)

    for samples in by_track.values():
        samples.sort(key=lambda s: s.rel_path)
    all_samples.sort(key=lambda s: s.rel_path)

    return by_track, all_samples


def _classify(rel_path: str, filename: str) -> list[str]:
    """Classify a sample into zero or more track slots.

    Classification priority:
    1. Top-level directory name
    2. Subdirectory names (Geist/Elektron/etc.)
    3. Filename prefix
    4. HR16 abbreviation prefix
    5. Keyword match in filename
    """
    parts = rel_path.split(os.sep)
    lower_fn = filename.lower()
    stem = os.path.splitext(lower_fn)[0]

    # 1. Top-level directory name (case-insensitive)
    top_dir = parts[0].lower()
    matched = _match_directory(top_dir, lower_fn)
    if matched:
        return matched

    # 2. Subdirectory names — check all path components
    for part in parts[1:]:
        result = _match_subdir(part.lower(), lower_fn)
        if result:
            return result

    # 3. Filename prefix
    result = _match_prefix(lower_fn)
    if result:
        return result

    # 4. HR16 compressed abbreviations
    for abbr, track_id in HR16_MAP:
        if stem.startswith(abbr):
            return [track_id]

    # 5. Keyword match in filename
    for pattern, track_id in KEYWORD_PATTERNS:
        if pattern.search(stem):
            return [track_id]

    return []


def _match_directory(
    top_dir: str,
    lower_fn: str,
) -> list[str]:
    """Match against DIR_MAP with filename refinement."""
    mapping = DIR_MAP.get(top_dir)
    if mapping is None:
        return []

    # Hat directories also feed the cy slot
    if top_dir in HAT_DIRS:
        base = mapping if isinstance(mapping, str) else mapping[0]
        return [base, "cy"]

    # Percussion directories: everything goes to cp and cb,
    # plus keyword-refined slots
    if top_dir in PERCUSSION_DIRS:
        slots = {"cp", "cb"}
        for pattern, track_id in PERC_KEYWORD_MAP:
            if pattern.search(lower_fn):
                slots.add(track_id)
        return list(slots)

    # Tom directories: refine by filename hints
    if top_dir in ("toms", "tom"):
        return [_refine_tom(lower_fn)]

    if isinstance(mapping, list):
        return mapping
    return [mapping]


def _match_subdir(
    subdir: str,
    lower_fn: str,
) -> list[str]:
    """Match a subdirectory name against SUBDIR_TYPE_MAP."""
    track_id = SUBDIR_TYPE_MAP.get(subdir)
    if track_id is None:
        return []

    # Generic tom subdir: refine by filename
    if track_id == "ht" and subdir in (
        "tom", "toms", "10 high toms",
        "10 med toms", "10 floors",
    ):
        return [_refine_tom(lower_fn)]

    return [track_id]


def _refine_tom(lower_fn: str) -> str:
    """Determine tom pitch from filename hints."""
    if "hi" in lower_fn or "high" in lower_fn:
        return "ht"
    if "lo" in lower_fn or "floor" in lower_fn:
        return "lt"
    if "mid" in lower_fn or "med" in lower_fn:
        return "mt"
    return "mt"  # default unqualified toms to mid


def _match_prefix(lower_fn: str) -> list[str]:
    """Match filename against PREFIX_MAP.

    Special handling for hh_ prefix: check for 'open'
    keyword to override to oh.
    """
    for prefix, track_id in PREFIX_MAP:
        if lower_fn.startswith(prefix):
            # hh_ without explicit ch/oh qualifier:
            # check for open-hat keywords
            if prefix == "hh_" and "open" in lower_fn:
                return ["oh"]
            return [track_id]
    return []
