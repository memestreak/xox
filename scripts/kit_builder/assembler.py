"""Assemble a kit: copy/convert samples and update kits.json."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

from .types import SampleEntry

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
KITS_DIR = PROJECT_ROOT / "public" / "kits"
KITS_JSON = PROJECT_ROOT / "src" / "app" / "data" / "kits.json"


def assemble_kit(
    kit_id: str,
    name: str,
    folder: str,
    assignments: list[tuple[str, SampleEntry]],
) -> None:
    kit_dir = KITS_DIR / folder
    kit_dir.mkdir(parents=True, exist_ok=True)

    for track_id, sample in assignments:
        dest = kit_dir / f"{track_id}.wav"
        ext = os.path.splitext(sample.path)[1].lower()

        if ext == ".wav":
            shutil.copy2(sample.path, dest)
        else:
            subprocess.run(
                ["ffmpeg", "-i", sample.path, "-y",
                 "-loglevel", "error", str(dest)],
                check=True,
            )

    # Update kits.json
    data = json.loads(KITS_JSON.read_text())

    if any(k["id"] == kit_id for k in data["kits"]):
        raise ValueError(
            f'Kit ID "{kit_id}" already exists in kits.json'
        )

    data["kits"].append({
        "id": kit_id,
        "name": name,
        "folder": folder,
    })

    KITS_JSON.write_text(json.dumps(data, indent=2) + "\n")
