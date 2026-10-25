#!/usr/bin/env python3
"""Interactive sample browsing and selection."""

from __future__ import annotations

import random
from collections import defaultdict

from kit_types import KIT_TRACK_IDS, TRACK_LABELS, SampleEntry
from preview import preview, stop
from colors import BOLD, GREEN, YELLOW, CYAN, DIM, RESET
from keys import getch

PICK_SIZE = 10

# Map keys to pick indices: '1'-'9' → 0-8, '0' → 9
_KEY_TO_IDX = {str(i): i - 1 for i in range(1, 10)}
_KEY_TO_IDX["0"] = 9


def browse_all_slots(
    by_track: dict[str, list[SampleEntry]],
    all_samples: list[SampleEntry],
) -> list[tuple[str, SampleEntry]]:
    """Walk each slot. Return list of (track_id, sample)."""
    assignments: list[tuple[str, SampleEntry]] = []

    for track_id in KIT_TRACK_IDS:
        result = _browse_slot(track_id, by_track, all_samples)
        if result:
            assignments.append((track_id, result))
            print(
                f"  {GREEN}✓{RESET} {track_id} → "
                f"{result.rel_path}"
            )
        else:
            print(f"  {YELLOW}⊘{RESET} {track_id} — skipped")
        print()

    return assignments


def _browse_slot(
    track_id: str,
    by_track: dict[str, list[SampleEntry]],
    all_samples: list[SampleEntry],
) -> SampleEntry | None:
    label = TRACK_LABELS[track_id]
    suggested = by_track.get(track_id, [])

    bar = "─" * max(0, 40 - len(label))
    print(f"{BOLD}── {track_id} ({label}) {bar}{RESET}")

    if suggested:
        print(
            f"  {len(suggested)} samples available"
        )
        return _quick_pick(suggested)

    print("  No suggestions for this slot.")
    return _search_fallback(all_samples)


def _spread_pick(
    pool: list[SampleEntry],
    count: int,
    seen: set[str],
) -> list[SampleEntry]:
    """Pick up to `count` samples spread across directories.

    Groups by top-level directory, then round-robins one
    random sample per directory until we have enough.
    Skips samples in `seen` (by path).

    Args:
        pool: Samples to choose from.
        count: Maximum number to return.
        seen: Paths already shown; updated in place.

    Returns:
        List of up to `count` samples.
    """
    by_dir: dict[str, list[SampleEntry]] = defaultdict(list)
    for s in pool:
        if s.path not in seen:
            top = s.rel_path.split("/")[0]
            by_dir[top].append(s)

    # Shuffle within each directory
    for samples in by_dir.values():
        random.shuffle(samples)

    # Round-robin across directories
    picks: list[SampleEntry] = []
    dirs = list(by_dir.keys())
    random.shuffle(dirs)
    idx = 0
    while len(picks) < count and dirs:
        d = dirs[idx % len(dirs)]
        bucket = by_dir[d]
        if bucket:
            pick = bucket.pop()
            picks.append(pick)
            seen.add(pick.path)
            if not bucket:
                dirs.remove(d)
                if dirs:
                    idx = idx % len(dirs)
                continue
        idx = (idx + 1) % len(dirs) if dirs else 0

    return picks


def _quick_pick(pool: list[SampleEntry]) -> SampleEntry | None:
    """Present batches of 10 spread-picked samples."""
    seen: set[str] = set()

    while True:
        picks = _spread_pick(pool, PICK_SIZE, seen)
        if not picks:
            print("  No more samples to show.")
            return None

        _show_picks(picks)

        result = _pick_prompt(picks)
        if isinstance(result, SampleEntry):
            return result
        if result == "skip":
            return None
        # result == "next": loop for another batch


def _show_picks(picks: list[SampleEntry]) -> None:
    """Display numbered sample list (1-9, 0 for 10th)."""
    print()
    for i, s in enumerate(picks):
        key = str(i + 1) if i < 9 else "0"
        print(f"    {DIM}{key}{RESET}  {s.rel_path}")


def _pick_prompt(picks: list[SampleEntry]) -> SampleEntry | str:
    """Single-keypress prompt for preview/accept/next/skip."""
    last_previewed: SampleEntry | None = None

    while True:
        print(
            f"  [1-{len(picks) if len(picks) < 10 else '0'}"
            f"=preview, a=accept, n=new 10, k=skip] ",
            end="",
            flush=True,
        )
        key = getch()
        print(key)  # echo the keypress

        if key == "n":
            return "next"
        if key == "k":
            return "skip"

        # Accept last previewed
        if key == "a":
            if last_previewed is None:
                print("  Preview a sample first.")
                continue
            preview(last_previewed.path)
            print(
                f"  {CYAN}♪{RESET} "
                f"{last_previewed.rel_path}"
            )
            print("  Accept? (y/n) ", end="", flush=True)
            confirm = getch()
            print(confirm)
            if confirm == "y":
                stop()
                return last_previewed
            stop()
            continue

        # Preview by number
        if key in _KEY_TO_IDX:
            idx = _KEY_TO_IDX[key]
            if 0 <= idx < len(picks):
                last_previewed = picks[idx]
                preview(last_previewed.path)
                print(
                    f"  {CYAN}♪{RESET} "
                    f"{last_previewed.rel_path}"
                )
                continue

        # Ctrl+C passthrough
        if key == "\x03":
            raise KeyboardInterrupt


def _search_fallback(
    all_samples: list[SampleEntry],
) -> SampleEntry | None:
    """Text search against full pool when no suggestions."""
    while True:
        term = input(
            f"\n  Search ({len(all_samples)} samples, "
            f"q=skip): "
        ).strip()

        if term.lower() == "q":
            return None

        if not term:
            print("  Enter a search term.")
            continue

        filtered = [
            s for s in all_samples
            if term.lower() in s.rel_path.lower()
        ]

        if not filtered:
            print("  No matches. Try another term.")
            continue

        # Show up to PICK_SIZE results
        shown = filtered[:PICK_SIZE]
        remaining = len(filtered) - len(shown)

        _show_picks(shown)

        if remaining > 0:
            print(
                f"    {DIM}... {remaining} more "
                f"(refine your search){RESET}"
            )

        result = _pick_prompt(shown)
        if isinstance(result, SampleEntry):
            return result
        if result == "skip":
            return None
        # "next" in search context → back to search prompt
