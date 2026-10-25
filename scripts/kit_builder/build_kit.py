#!/usr/bin/env python3
"""Interactive CLI tool for building XOX drum kits."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys

from sample_index import build_sample_index
from browser import browse_all_slots
from assembler import assemble_kit, kit_conflict
from preview import stop
from colors import GREEN, RESET

# Kit IDs and folders: lowercase words joined by hyphens.
SLUG_RE = r"^[a-z0-9]+(-[a-z0-9]+)*$"

DEFAULT_SAMPLES_ROOT = os.path.expanduser("~/media/samples")
USAGE = (
    "Usage: build_kit.py [samples_root]"
    f"  (default: {DEFAULT_SAMPLES_ROOT})"
)


def slugify(text: str) -> str:
    return re.sub(
        r"^-|-$", "",
        re.sub(r"[^a-z0-9]+", "-", text.lower()),
    )


def prompt(message: str, default: str = "",
           validate: str = "") -> str:
    """Simple input prompt with optional default/validation."""
    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"  {message}{suffix}: ").strip()
        if not value and default:
            value = default
        if not value:
            print("  Required.")
            continue
        if validate and not re.match(validate, value):
            print("  Lowercase alphanumeric + hyphens only.")
            continue
        return value


def prompt_kit_names() -> tuple[str, str, str]:
    """Ask for a kit name, ID and folder that are free.

    Checked before picking samples, so a taken name
    doesn't throw away a finished set of picks.

    Returns:
        (name, kit_id, folder).
    """
    while True:
        name = prompt("Kit name")
        kit_id = prompt(
            "Kit ID", default=slugify(name),
            validate=SLUG_RE,
        )
        folder = prompt(
            "Kit folder", default=kit_id,
            validate=SLUG_RE,
        )
        conflict = kit_conflict(kit_id, folder)
        if conflict is None:
            return name, kit_id, folder
        print(f"  {conflict}. Choose another name.\n")


def main() -> None:
    missing = [t for t in ("ffmpeg", "ffplay") if not shutil.which(t)]
    if missing:
        print(
            f"Error: {' and '.join(missing)} not found "
            "(install ffmpeg).",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(sys.argv) > 2:
        print(USAGE, file=sys.stderr)
        sys.exit(1)
    samples_root = (
        sys.argv[1] if len(sys.argv) == 2 else DEFAULT_SAMPLES_ROOT
    )

    if not os.path.isdir(samples_root):
        print(
            f"Error: not a directory: {samples_root}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"\nScanning {samples_root}...")
    by_track, all_samples = build_sample_index(samples_root)
    total = len(all_samples)
    mapped = sum(len(v) for v in by_track.values())
    print(
        f"{total:,} samples indexed "
        f"({mapped:,} auto-mapped).\n"
    )

    build_another = True

    while build_another:
        name, kit_id, folder = prompt_kit_names()

        print()
        assignments = browse_all_slots(by_track, all_samples)

        if not assignments:
            print("No samples assigned. Kit not created.\n")
        else:
            print(
                f"\nAssembling kit \"{name}\" "
                f"({len(assignments)} samples)..."
            )
            try:
                assemble_kit(kit_id, name, folder, assignments)
            except (ValueError, OSError,
                    subprocess.CalledProcessError) as err:
                print(f"Kit not created: {err}\n", file=sys.stderr)
            else:
                print(
                    f"{GREEN}✓{RESET} Kit \"{name}\" created!\n"
                    f"  → public/kits/{folder}/ "
                    f"({len(assignments)} samples)\n"
                    f"  → kits.json updated\n"
                )

        answer = input("Build another kit? (y/N): ").strip()
        build_another = answer.lower() in ("y", "yes")
        print()

    stop()
    print("Done.")


def run() -> None:
    """Run main(), exiting cleanly on Ctrl+C or Ctrl+D."""
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        stop()
        print("\nAborted.")
        sys.exit(130)


if __name__ == "__main__":
    run()
