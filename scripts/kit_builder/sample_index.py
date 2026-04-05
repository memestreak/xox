"""Scan a sample library and build a track-mapped index."""

from __future__ import annotations

import os
from pathlib import Path

from .types import (
    AUDIO_EXTENSIONS,
    CURATED_PREFIX_MAP,
    DIR_MAPPINGS,
    KIT_TRACK_IDS,
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

            track_id = _classify(rel_path, fname)
            if track_id:
                by_track[track_id].append(sample)

    for samples in by_track.values():
        samples.sort(key=lambda s: s.rel_path)
    all_samples.sort(key=lambda s: s.rel_path)

    return by_track, all_samples


def _classify(rel_path: str, filename: str) -> str | None:
    parts = rel_path.split(os.sep)
    top_dir = parts[0]
    lower_fn = filename.lower()

    # 1. Top-level directory mappings
    for mapping in DIR_MAPPINGS:
        if top_dir != mapping.dir:
            continue
        if mapping.filter:
            if mapping.filter in lower_fn:
                return mapping.track_id
        else:
            return mapping.track_id

    # Toms fallback → mid tom
    if top_dir == "toms":
        return "mt"

    # Percussion fallback
    if top_dir == "percussion":
        return "cp"

    # 2. Curated samples: match by filename prefix
    if top_dir == "curated_samples":
        for prefix, track_id in CURATED_PREFIX_MAP:
            if lower_fn.startswith(prefix):
                return track_id

    # 3. Geist / elektron / rample: match by subdir name
    if top_dir in ("geist", "elektron_kits", "rample"):
        for part in parts[1:]:
            track_id = SUBDIR_TYPE_MAP.get(part.lower())
            if track_id:
                return track_id

    return None
