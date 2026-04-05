"""Audio preview via ffplay."""

from __future__ import annotations

import subprocess

_current: subprocess.Popen[bytes] | None = None


def preview(file_path: str) -> None:
    """Play an audio file via ffplay. Kills any previous preview."""
    stop()
    global _current
    _current = subprocess.Popen(
        ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet",
         file_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def stop() -> None:
    """Stop any currently playing preview."""
    global _current
    if _current is not None:
        try:
            _current.kill()
        except OSError:
            pass
        _current = None
