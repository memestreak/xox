#!/usr/bin/env python3
"""Assemble a kit: convert samples and update kits.json."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import wave
from array import array
from pathlib import Path
from typing import Any

from kit_types import KIT_TRACK_IDS, SampleEntry

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
KITS_DIR = PROJECT_ROOT / "public" / "kits"
KITS_JSON = PROJECT_ROOT / "src" / "app" / "data" / "kits.json"

# Every kit file is written in this format so browsers
# (Safari especially) decode them the same way.
SAMPLE_RATE = 44100
SILENCE_SECONDS = 0.1

# Trim: audio more than this far below the peak counts
# as silence at either end.
TRIM_THRESHOLD_DB = 50.0
# Kept before the first audible frame, so the attack
# isn't clipped.
TRIM_PREROLL_SECONDS = 0.001
FADE_OUT_SECONDS = 0.02
# Longest sample per slot, in seconds.
SLOT_CAPS: dict[str, float] = {
    "bd": 2.0, "sd": 1.2, "ch": 0.5, "oh": 1.5, "cy": 3.0,
    "ht": 1.5, "mt": 1.5, "lt": 1.5, "rs": 0.6, "cp": 1.0,
    "cb": 0.8,
}


def kit_conflict(kit_id: str, folder: str) -> str | None:
    """Explain why a kit can't be created, if it can't.

    Args:
        kit_id: Proposed kit ID.
        folder: Proposed folder under public/kits/.

    Returns:
        An error message, or None if both are free.
    """
    if any(k["id"] == kit_id for k in _read_kits()["kits"]):
        return f'Kit ID "{kit_id}" already exists in kits.json'
    if (KITS_DIR / folder).exists():
        return f'Kit folder "{folder}" already exists'
    return None


def assemble_kit(
    kit_id: str,
    name: str,
    folder: str,
    assignments: dict[str, SampleEntry],
) -> None:
    """Write every slot's sample and register the kit.

    Picks are converted to 44.1 kHz 16-bit WAV and
    trimmed (`trim_wav`); skipped
    slots get a short silent file, since the app loads all
    11 files. The kit is built in a temporary folder and
    only moved into place once every file is written, so
    a failure leaves nothing behind.

    Args:
        kit_id: Kit ID for kits.json.
        name: Display name for kits.json.
        folder: Folder name under public/kits/.
        assignments: Chosen sample per track ID.

    Raises:
        ValueError: If the kit ID or folder is taken.
        subprocess.CalledProcessError: If ffmpeg fails.
    """
    conflict = kit_conflict(kit_id, folder)
    if conflict:
        raise ValueError(conflict)

    tmp_dir = Path(tempfile.mkdtemp(
        dir=KITS_DIR, prefix=f".{folder}-",
    ))
    try:
        for track_id in KIT_TRACK_IDS:
            dest = tmp_dir / f"{track_id}.wav"
            sample = assignments.get(track_id)
            if sample is None:
                _write_silence(dest)
            else:
                _convert(sample.path, dest)
                trim_wav(dest, track_id)
    except BaseException:
        # Also on Ctrl+C: never leave a half-built kit.
        shutil.rmtree(tmp_dir)
        raise
    tmp_dir.chmod(0o755)  # mkdtemp creates it as 0700
    tmp_dir.rename(KITS_DIR / folder)

    data = _read_kits()
    data["kits"].append({
        "id": kit_id,
        "name": name,
        "folder": folder,
    })
    KITS_JSON.write_text(json.dumps(data, indent=2) + "\n")


def _read_kits() -> dict[str, Any]:
    """Load kits.json."""
    data: dict[str, Any] = json.loads(KITS_JSON.read_text())
    return data


def _convert(src: str, dest: Path) -> None:
    """Convert any audio file to 44.1 kHz 16-bit WAV."""
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
         "-i", src, "-ar", str(SAMPLE_RATE),
         "-c:a", "pcm_s16le", "-map_metadata", "-1",
         str(dest)],
        check=True,
    )


def _write_silence(dest: Path) -> None:
    """Write a short mono 16-bit silent WAV."""
    frames = int(SAMPLE_RATE * SILENCE_SECONDS)
    with wave.open(str(dest), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(b"\x00\x00" * frames)


def trim_wav(path: Path, slot: str) -> float:
    """Trim a 16-bit WAV in place for use as a kit sample.

    Drops leading audio more than TRIM_THRESHOLD_DB below
    the peak (keeping TRIM_PREROLL_SECONDS before the first
    louder frame), cuts after the last louder frame, caps
    the length at SLOT_CAPS[slot] and fades out the last
    FADE_OUT_SECONDS (at most a quarter of what's left).
    An all-silent file is only capped.

    Args:
        path: 16-bit PCM WAV, rewritten in place.
        slot: Track ID whose length cap applies.

    Returns:
        The new length in seconds.

    Raises:
        ValueError: If the file isn't 16-bit PCM.
        KeyError: If the slot has no length cap.
    """
    cap_seconds = SLOT_CAPS[slot]
    with wave.open(str(path), "rb") as src:
        params = src.getparams()
        raw = src.readframes(params.nframes)
    if params.sampwidth != 2:
        raise ValueError(f"{path.name} is not 16-bit PCM")
    channels = params.nchannels
    rate = params.framerate
    samples = array("h")
    samples.frombytes(raw)
    frames = len(samples) // channels

    peak = max((abs(s) for s in samples), default=0)
    if peak == 0:
        start, end = 0, frames
    else:
        threshold = peak * 10 ** (-TRIM_THRESHOLD_DB / 20)
        first = next(
            i for i, s in enumerate(samples) if abs(s) >= threshold
        )
        last = next(
            i for i in range(len(samples) - 1, -1, -1)
            if abs(samples[i]) >= threshold
        )
        preroll = int(rate * TRIM_PREROLL_SECONDS)
        start = max(0, first // channels - preroll)
        end = last // channels + 1
    end = min(end, start + int(rate * cap_seconds))
    kept = samples[start * channels:end * channels]

    if peak:
        fade = min(int(rate * FADE_OUT_SECONDS), (end - start) // 4)
        first_faded = (end - start - fade) * channels
        for offset in range(fade * channels):
            gain = (fade - 1 - offset // channels) / fade
            index = first_faded + offset
            kept[index] = int(kept[index] * gain)

    with wave.open(str(path), "wb") as out:
        out.setnchannels(channels)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(kept.tobytes())
    return (end - start) / rate
