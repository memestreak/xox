"""Interactive CLI tool for building XOX drum kits."""

from __future__ import annotations

import re
import sys

from .sample_index import build_sample_index
from .browser import browse_all_slots
from .assembler import assemble_kit
from .preview import stop

DEFAULT_SAMPLES_ROOT = "/m/media/samples"

GREEN = "\033[32m"
RESET = "\033[0m"


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


def main() -> None:
    samples_root = (
        sys.argv[1] if len(sys.argv) > 1
        else DEFAULT_SAMPLES_ROOT
    )

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
        name = prompt("Kit name")
        default_slug = slugify(name)
        kit_id = prompt(
            "Kit ID", default=default_slug,
            validate=r"^[a-z0-9-]+$",
        )
        folder = prompt(
            "Kit folder", default=kit_id,
            validate=r"^[a-z0-9-]+$",
        )

        print()
        assignments = browse_all_slots(by_track, all_samples)

        if not assignments:
            print("No samples assigned. Kit not created.\n")
        else:
            print(
                f"\nAssembling kit \"{name}\" "
                f"({len(assignments)} samples)..."
            )
            assemble_kit(kit_id, name, folder, assignments)
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


if __name__ == "__main__":
    main()
