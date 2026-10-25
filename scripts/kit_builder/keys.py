#!/usr/bin/env python3
"""Single-keypress input for interactive prompts."""

from __future__ import annotations

import sys
import tty
import termios


def getch() -> str:
    """Read a single keypress without waiting for Enter.

    Returns:
        The character pressed (lowercase).
    """
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        ch = sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
    return ch.lower()
