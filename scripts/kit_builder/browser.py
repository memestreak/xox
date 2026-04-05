"""Interactive sample browsing and selection."""

from __future__ import annotations

from .types import KIT_TRACK_IDS, TRACK_LABELS, SampleEntry
from .preview import preview, stop

# ANSI helpers
BOLD = "\033[1m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
DIM = "\033[2m"
RESET = "\033[0m"

PAGE_SIZE = 20


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
        print(f"  Auto-suggested: {len(suggested)} samples")
    else:
        print("  No auto-suggestions for this slot.")

    pool = _choose_pool(track_id, suggested, all_samples)
    if pool is None:
        return None

    return _search_and_select(pool)


def _choose_pool(
    track_id: str,
    suggested: list[SampleEntry],
    all_samples: list[SampleEntry],
) -> list[SampleEntry] | None:
    options: list[tuple[str, str]] = []
    if suggested:
        options.append((
            "s",
            f"Suggested ({len(suggested)} samples)",
        ))
    options.append((
        "a",
        f"Browse all ({len(all_samples)} samples)",
    ))
    options.append(("k", "Skip this slot"))

    print(f"  [{track_id}] Sample source:")
    for key, desc in options:
        print(f"    {CYAN}{key}{RESET}) {desc}")

    while True:
        choice = input("  > ").strip().lower()
        if choice == "s" and suggested:
            return suggested
        if choice == "a":
            return all_samples
        if choice == "k":
            return None
        valid = ", ".join(k for k, _ in options)
        print(f"  Enter one of: {valid}")


def _search_and_select(
    pool: list[SampleEntry],
) -> SampleEntry | None:
    while True:
        term = input(
            f"\n  Search ({len(pool)} samples, "
            f"empty=list, q=skip): "
        ).strip()

        if term.lower() == "q":
            return None

        if term:
            filtered = [
                s for s in pool
                if term.lower() in s.rel_path.lower()
            ]
        else:
            filtered = pool

        if not filtered:
            print("  No matches. Try another term.")
            continue

        # Paginated display
        page = 0
        while True:
            start = page * PAGE_SIZE
            end = start + PAGE_SIZE
            page_items = filtered[start:end]

            for i, s in enumerate(page_items, start + 1):
                print(f"    {DIM}{i:4d}{RESET} {s.rel_path}")

            remaining = len(filtered) - end
            if remaining > 0:
                print(
                    f"    {DIM}... {remaining} more "
                    f"(n=next page){RESET}"
                )

            result = _pick_from_list(filtered, page, end)
            if result == "next" and remaining > 0:
                page += 1
                continue
            if result == "search":
                break
            if result == "skip":
                return None
            if isinstance(result, SampleEntry):
                return result
            break  # back to search prompt


def _pick_from_list(
    filtered: list[SampleEntry],
    page: int,
    end: int,
) -> SampleEntry | str:
    """Prompt for number selection, preview, navigation."""
    while True:
        cmd = input(
            "  # to select, p# to preview, "
            "n=next, s=search, q=skip: "
        ).strip().lower()

        if cmd == "n":
            return "next"
        if cmd == "s":
            return "search"
        if cmd == "q":
            return "skip"

        # Preview: p<number>
        if cmd.startswith("p"):
            try:
                idx = int(cmd[1:]) - 1
                if 0 <= idx < len(filtered):
                    preview(filtered[idx].path)
                    print(
                        f"  {CYAN}♪{RESET} "
                        f"{filtered[idx].rel_path}"
                    )
                else:
                    print(f"  Out of range (1-{len(filtered)})")
            except ValueError:
                print("  Use p<number> to preview, e.g. p3")
            continue

        # Select by number
        try:
            idx = int(cmd) - 1
            if 0 <= idx < len(filtered):
                sample = filtered[idx]
                preview(sample.path)
                print(
                    f"  {CYAN}♪{RESET} {sample.rel_path}"
                )
                confirm = input(
                    "  Accept? (Y/n): "
                ).strip().lower()
                if confirm in ("", "y", "yes"):
                    stop()
                    return sample
                stop()
                continue
            print(f"  Out of range (1-{len(filtered)})")
        except ValueError:
            print("  Enter a number, p#, n, s, or q")
