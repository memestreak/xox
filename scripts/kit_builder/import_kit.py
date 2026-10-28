#!/usr/bin/env python3
"""Turn an XOX "Export kit" zip into a kit in the repo.

Usage: import_kit.py ZIP [--replace]

Converts every slot to 44.1 kHz 16-bit WAV, trims it,
checks the result and installs it as public/kits/<id>/
with an entry in src/app/data/kits.json. Nothing in the
repo changes unless every step passes.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import wave
import zipfile
from dataclasses import dataclass
from pathlib import Path

import assembler
from kit_types import KIT_TRACK_IDS, SLUG_RE

EXPORT_FORMAT = 1
KIT_JSON = "kit.json"
MAX_ENTRY_BYTES = 20 * 1024 * 1024
SLOT_FILES = {f"{slot}.wav": slot for slot in KIT_TRACK_IDS}


class KitImportError(ValueError):
    """The export can't be imported; the message says why."""


@dataclass(frozen=True)
class KitExport:
    """A validated export zip.

    Attributes:
        kit_id: Kit ID and folder name.
        name: Display name.
        base: Kit the non-custom slots came from.
        sources: Original file name per custom slot.
        audio: WAV bytes per slot, for every slot.
    """

    kit_id: str
    name: str
    base: str
    sources: dict[str, str]
    audio: dict[str, bytes]


def read_export(zip_path: Path) -> KitExport:
    """Read and check an export zip.

    Args:
        zip_path: The downloaded zip.

    Returns:
        The kit's metadata and audio.

    Raises:
        KitImportError: If the zip or its kit.json is not
            a valid export.
    """
    try:
        with zipfile.ZipFile(zip_path) as archive:
            infos = archive.infolist()
            _check_entries(infos)
            raw_meta = archive.read(KIT_JSON)
            audio = {
                slot: archive.read(name)
                for name, slot in SLOT_FILES.items()
            }
    except (zipfile.BadZipFile, OSError) as err:
        raise KitImportError(f"Can't read {zip_path}: {err}") from err
    return _parse_meta(raw_meta, audio)


def _check_entries(infos: list[zipfile.ZipInfo]) -> None:
    """Require exactly kit.json and one WAV per slot."""
    names: list[str] = []
    for info in infos:
        name = info.filename
        if info.is_dir():
            raise KitImportError(f"Unexpected folder in zip: {name}")
        if "/" in name or "\\" in name or ".." in name:
            raise KitImportError(f"Unsafe path in zip: {name}")
        if info.file_size > MAX_ENTRY_BYTES:
            raise KitImportError(f"{name} is larger than 20 MB")
        names.append(name)
    if len(names) != len(set(names)):
        raise KitImportError("Zip has duplicate entries")
    expected = {KIT_JSON, *SLOT_FILES}
    missing = sorted(expected - set(names))
    extra = sorted(set(names) - expected)
    if missing:
        raise KitImportError(f"Zip is missing: {', '.join(missing)}")
    if extra:
        raise KitImportError(f"Unexpected files in zip: {', '.join(extra)}")


def _parse_meta(raw: bytes, audio: dict[str, bytes]) -> KitExport:
    """Check kit.json and pair it with the slots' audio."""
    try:
        meta = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as err:
        raise KitImportError(f"kit.json is not valid JSON: {err}") from err
    if not isinstance(meta, dict):
        raise KitImportError("kit.json must be an object")
    if meta.get("format") != EXPORT_FORMAT:
        raise KitImportError(
            f"kit.json format must be {EXPORT_FORMAT}, "
            f"got {meta.get('format')!r}"
        )
    kit_id = meta.get("id")
    if not isinstance(kit_id, str) or not re.match(SLUG_RE, kit_id):
        raise KitImportError(
            f"kit.json id {kit_id!r} must be lowercase letters, "
            "digits and single hyphens"
        )
    name = meta.get("name")
    if not isinstance(name, str) or not name.strip():
        raise KitImportError("kit.json name must be a non-empty string")
    base = meta.get("base", "")
    sources = meta.get("sources", {})
    if not isinstance(base, str):
        raise KitImportError("kit.json base must be a string")
    if not isinstance(sources, dict) or not all(
        slot in KIT_TRACK_IDS and isinstance(file, str)
        for slot, file in sources.items()
    ):
        raise KitImportError(
            "kit.json sources must map slot IDs to file names"
        )
    return KitExport(
        kit_id=kit_id,
        name=name.strip(),
        base=base,
        sources=sources,
        audio=audio,
    )


def import_kit(export: KitExport, replace: bool = False) -> dict[str, float]:
    """Convert, trim, verify and install an export.

    Args:
        export: From read_export.
        replace: Overwrite a kit with the same ID, keeping
            its place in kits.json.

    Returns:
        Length in seconds per slot.

    Raises:
        KitImportError: If the ID is taken (without
            replace) or a slot fails verification.
        subprocess.CalledProcessError: If ffmpeg fails.
    """
    kit_id = export.kit_id
    conflict = assembler.kit_conflict(kit_id, kit_id)
    if conflict and not replace:
        raise KitImportError(f"{conflict}; use --replace to overwrite it")

    tmp_dir = Path(tempfile.mkdtemp(
        dir=assembler.KITS_DIR, prefix=f".{kit_id}-",
    ))
    try:
        lengths = _build(export, tmp_dir)
        _verify(tmp_dir)
    except BaseException:
        # Also on Ctrl+C: never leave a half-built kit.
        shutil.rmtree(tmp_dir)
        raise
    tmp_dir.chmod(0o755)  # mkdtemp creates it as 0700
    _install(tmp_dir, export)
    return lengths


def _build(export: KitExport, out_dir: Path) -> dict[str, float]:
    """Write each slot as a converted, trimmed WAV."""
    lengths: dict[str, float] = {}
    for slot, data in export.audio.items():
        src = out_dir / f"source-{slot}.wav"
        src.write_bytes(data)
        dest = out_dir / f"{slot}.wav"
        assembler._convert(str(src), dest)
        src.unlink()
        lengths[slot] = assembler.trim_wav(dest, slot)
    return lengths


def _verify(kit_dir: Path) -> None:
    """Check the folder holds exactly the committed layout."""
    found = sorted(p.name for p in kit_dir.iterdir())
    if found != sorted(SLOT_FILES):
        raise KitImportError(f"Unexpected kit files: {', '.join(found)}")
    for name, slot in SLOT_FILES.items():
        with wave.open(str(kit_dir / name), "rb") as wav:
            params = wav.getparams()
        cap = int(assembler.SAMPLE_RATE * assembler.SLOT_CAPS[slot])
        problems = [
            text for bad, text in (
                (params.framerate != assembler.SAMPLE_RATE,
                 f"rate {params.framerate}"),
                (params.sampwidth != 2,
                 f"{params.sampwidth * 8}-bit"),
                (params.nchannels not in (1, 2),
                 f"{params.nchannels} channels"),
                (params.nframes == 0, "empty"),
                (params.nframes > cap, "longer than its cap"),
            ) if bad
        ]
        if problems:
            raise KitImportError(f"{name}: {', '.join(problems)}")


def _install(built: Path, export: KitExport) -> None:
    """Move the built folder into place and update kits.json."""
    dest = assembler.KITS_DIR / export.kit_id
    old = dest.with_name(f".{export.kit_id}-replaced")
    if dest.exists():
        dest.rename(old)
    built.rename(dest)
    if old.exists():
        shutil.rmtree(old)

    data = assembler._read_kits()
    entry = {
        "id": export.kit_id,
        "name": export.name,
        "folder": export.kit_id,
    }
    kits = data["kits"]
    index = next(
        (i for i, k in enumerate(kits) if k["id"] == export.kit_id),
        None,
    )
    if index is None:
        kits.append(entry)
    else:
        kits[index] = entry
    assembler.KITS_JSON.write_text(json.dumps(data, indent=2) + "\n")


def _report(export: KitExport, lengths: dict[str, float]) -> str:
    """Per-slot source and length, then the git add line."""
    base = export.base or "base kit"
    lines = [f"Imported {export.name} ({export.kit_id}):"]
    for slot in KIT_TRACK_IDS:
        source = export.sources.get(slot, base)
        lines.append(f"  {slot:<3} {lengths[slot]:5.2f} s  {source}")
    rel_kits = assembler.KITS_DIR.relative_to(assembler.PROJECT_ROOT)
    rel_json = assembler.KITS_JSON.relative_to(assembler.PROJECT_ROOT)
    lines.append("")
    lines.append(f"git add {rel_kits / export.kit_id} {rel_json}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    """Command-line entry point.

    Args:
        argv: Arguments without the program name.

    Returns:
        Exit status: 0 on success, 1 on any error.
    """
    parser = argparse.ArgumentParser(
        description="Import an XOX Export kit zip into public/kits/.",
    )
    parser.add_argument("zip", type=Path, help="the exported zip")
    parser.add_argument(
        "--replace", action="store_true",
        help="overwrite a kit with the same ID",
    )
    args = parser.parse_args(argv)
    try:
        export = read_export(args.zip)
        lengths = import_kit(export, replace=args.replace)
    except KitImportError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as err:
        print(f"Error: ffmpeg failed ({err})", file=sys.stderr)
        return 1
    except FileNotFoundError as err:
        print(f"Error: {err}", file=sys.stderr)
        return 1
    print(_report(export, lengths))
    return 0


if __name__ == "__main__":
    sys.exit(main())
