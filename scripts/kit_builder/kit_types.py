#!/usr/bin/env python3
"""Track IDs, labels, and category-to-track mappings."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Track slots in display order (excludes 'ac' which has no sample).
KIT_TRACK_IDS = (
    "bd", "sd", "ch", "oh", "cy",
    "ht", "mt", "lt", "rs", "cp", "cb",
)

TRACK_LABELS = {
    "bd": "Bass Drum",
    "sd": "Snare Drum",
    "ch": "Closed Hat",
    "oh": "Open Hat",
    "cy": "Cymbal",
    "ht": "High Tom",
    "mt": "Mid Tom",
    "lt": "Low Tom",
    "rs": "Rim Shot",
    "cp": "Clap",
    "cb": "Cowbell",
}

# Kit IDs and folders: lowercase words joined by hyphens.
SLUG_RE = r"^[a-z0-9]+(-[a-z0-9]+)*$"

AUDIO_EXTENSIONS = frozenset((".wav", ".aif", ".aiff"))

# Placeholder slot for a tom of unknown pitch. The
# classifier replaces it with ht, mt and/or lt.
GENERIC_TOM = "tom"


@dataclass(frozen=True)
class SampleEntry:
    path: str       # absolute path
    filename: str   # filename only
    rel_path: str   # relative to samples root (for display)


# --- Directory name → track mapping ---
# Keys are lowercased for case-insensitive matching.
# GENERIC_TOM values are refined to a tom pitch later.
DIR_MAP: dict[str, str] = {
    # Bass drum
    "bass_drum": "bd",
    "kicks": "bd",
    "kick": "bd",
    # Snare
    "snare": "sd",
    "snares": "sd",
    # Closed hi-hat
    "closed_hats": "ch",
    "closedhats": "ch",
    "hats": "ch",
    "hihat": "ch",
    "hihats": "ch",
    # Open hi-hat
    "open_hats": "oh",
    "openhats": "oh",
    # Cymbal
    "cymbals": "cy",
    "crash": "cy",
    "ride": "cy",
    # Toms (pitch refined by tom_slots)
    "toms": GENERIC_TOM,
    "tom": GENERIC_TOM,
    # Rim shot / side stick
    "rim_shots": "rs",
    "rimshots": "rs",
    "rimshot": "rs",
    "side_stick": "rs",
    "sidestick": "rs",
    "sidesticks_rimshots": "rs",
    "sticks": "rs",
    # Clap
    "claps": "cp",
    # Cowbell
    "cowbell": "cb",
}

# Directories that contain hats also feed the cy slot.
HAT_DIRS = {"closed_hats", "closedhats", "hats",
            "hihat", "hihats", "open_hats", "openhats"}

# --- Filename prefix → track mapping ---
# Checked case-insensitively. Longest prefixes first
# for greedy matching.
PREFIX_MAP: tuple[tuple[str, str], ...] = (
    # Double prefix: pc_ files use a secondary prefix
    ("pc_bd_", "bd"),
    ("pc_sd_", "sd"),
    ("pc_sn_", "sd"),
    ("pc_hh_", "ch"),
    ("pc_oh_", "oh"),
    ("pc_rs_", "rs"),
    ("pc_cp_", "cp"),
    ("pc_cb_", "cb"),
    ("pc_cy_", "cy"),
    # Hi-hat (order matters: specific before generic)
    ("hh_ch_", "ch"),
    ("hh_oh_", "oh"),
    ("hhc_", "ch"),
    ("hho_", "oh"),
    ("hh_", "ch"),
    # Bass drum
    ("bd_", "bd"),
    ("kick_", "bd"),
    ("808 bd", "bd"),
    ("909 bd", "bd"),
    ("909-bd_", "bd"),
    ("808kick", "bd"),
    ("909bdrum", "bd"),
    # Snare
    ("sd_", "sd"),
    ("sn_", "sd"),
    ("sn ", "sd"),
    ("snare_", "sd"),
    ("snare ", "sd"),
    ("808snare", "sd"),
    ("909snare", "sd"),
    ("909-sd_", "sd"),
    # Closed hi-hat
    ("ch_", "ch"),
    ("808 hh", "ch"),
    ("808hihat", "ch"),
    ("909-hh_", "ch"),
    # Open hi-hat
    ("oh_", "oh"),
    ("808 ohh", "oh"),
    ("909-oh_", "oh"),
    # Cymbal
    ("cy_", "cy"),
    ("cr ", "cy"),
    ("rd ", "cy"),
    ("808 cy", "cy"),
    ("909-cy_", "cy"),
    ("cymbal_", "cy"),
    ("cymbal ", "cy"),
    # Toms
    ("tm_", GENERIC_TOM),
    ("tom_", GENERIC_TOM),
    ("808 ht", "ht"),
    ("808 mt", "mt"),
    ("808 lt", "lt"),
    ("909-ht_", "ht"),
    ("909-mt_", "mt"),
    ("909-lt_", "lt"),
    # Rim shot / side stick
    ("rs_", "rs"),
    ("rs ", "rs"),
    ("ss_", "rs"),
    ("rim_", "rs"),
    ("rim ", "rs"),
    ("stick_", "rs"),
    ("808 rim", "rs"),
    ("808rim", "rs"),
    ("909-rim", "rs"),
    # Clap
    ("cl_", "cp"),
    ("cl ", "cp"),
    ("cp_", "cp"),
    ("cp ", "cp"),
    ("clap", "cp"),
    ("808 clap", "cp"),
    ("808clap", "cp"),
    ("909-clap", "cp"),
    # Cowbell
    ("cb_", "cb"),
    ("cb ", "cb"),
    ("808 cow", "cb"),
    ("808cow", "cb"),
)

# --- Tom pitch words ---
# Whole words (split on anything but letters) that say
# which tom a sample is. A tom with none of these is
# offered in all three tom slots.
TOM_PITCH_WORDS: tuple[tuple[frozenset[str], str], ...] = (
    (frozenset(("hi", "high", "hitom")), "ht"),
    (frozenset(("lo", "low", "floor", "flr")), "lt"),
    (frozenset(("mid", "med", "medium")), "mt"),
)


def _words(*alternatives: str) -> re.Pattern[str]:
    """Compile alternatives that must stand as whole words.

    Unlike ``\\b``, underscores and digits count as word
    breaks, so ``cl_medium_clap_01`` matches ``clap``.

    Args:
        alternatives: Regex fragments to match.

    Returns:
        The compiled pattern.
    """
    joined = "|".join(alternatives)
    return re.compile(rf"(?<![a-z])(?:{joined})(?![a-z])")


# --- Keyword patterns for filename-based fallback ---
# Checked against the lowercase filename (without
# extension). Order matters: first match wins.
KEYWORD_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (_words(r"kicks?", r"bass.?drums?", "bdrum"), "bd"),
    (_words(r"snares?", "snr"), "sd"),
    (_words(r"closed.?h?.?hats?", "clsd"), "ch"),
    (_words(r"open.?h?.?hats?"), "oh"),
    (_words(r"cymbals?", "crash", "ride", "splash", "china"), "cy"),
    (_words(r"hi.?tom", r"high.?tom"), "ht"),
    (_words(r"mid.?tom", r"med.?tom"), "mt"),
    (_words(r"low?.?tom", r"floor.?tom"), "lt"),
    (_words(r"toms?"), GENERIC_TOM),
    (_words(r"rim.?shots?", r"side.?sticks?"), "rs"),
    (_words(r"(?:hand)?claps?"), "cp"),
    (_words(r"cow.?bells?"), "cb"),
)

# --- HR16-style compressed abbreviations ---
# Mapped to track IDs. Checked as prefixes.
HR16_MAP: tuple[tuple[str, str], ...] = (
    ("drbass", "bd"),
    ("pwrbss", "bd"),
    ("elecbs", "bd"),
    ("drsnarr", "sd"),
    ("clhat", "ch"),
    ("drchat", "ch"),
    ("opnhat", "oh"),
    ("drohat", "oh"),
    ("drcymb", "cy"),
    ("crashr16", "cy"),
    ("ridsym", "cy"),
    ("ridbel", "cy"),
    ("powrtom", "ht"),
    ("electm", "ht"),
    ("dblhtm", "ht"),
    ("dblftm", "lt"),
    ("drclap", "cp"),
    ("clapsss", "cp"),
    ("lrgcow", "cb"),
    ("midcow", "cb"),
    ("rosclv", "rs"),
)

# --- Subdirectory name → track mapping ---
# For collections organized into instrument subdirs
# (Geist, Elektron, Rample, etc.). Keys are lowercase.
SUBDIR_TYPE_MAP: dict[str, str] = {
    # Bass drum
    "kick": "bd",
    "kicks": "bd",
    "bass drum": "bd",
    "bass drums": "bd",
    # Snare
    "snare": "sd",
    "snares": "sd",
    # Hi-hat
    "hihat": "ch",
    "hihats": "ch",
    "hi hat": "ch",
    "hi hats": "ch",
    "hi-hat": "ch",
    "hi-hats": "ch",
    "hats": "ch",
    "acoustic hats": "ch",
    "analogue hats": "ch",
    "electronic hats": "ch",
    "open hat": "oh",
    "open hats": "oh",
    # Cymbal
    "cymbal": "cy",
    "cymbals": "cy",
    "acoustic cymbals": "cy",
    "analogue cymbals": "cy",
    "electronic cymbals": "cy",
    "reverse cymbals": "cy",
    "ride": "cy",
    "crash": "cy",
    # Toms
    "tom": GENERIC_TOM,
    "toms": GENERIC_TOM,
    "hi tom": "ht",
    "high tom": "ht",
    "10 high toms": "ht",
    "mid tom": "mt",
    "med tom": "mt",
    "10 med toms": "mt",
    "low tom": "lt",
    "lo tom": "lt",
    "floor tom": "lt",
    "10 floors": "lt",
    # Rim shot / side stick
    "rim": "rs",
    "rimshot": "rs",
    "rimshots": "rs",
    "rim shot": "rs",
    "side stick": "rs",
    "sidestick": "rs",
    "side_stick": "rs",
    "sidesticks_rimshots": "rs",
    "sticks": "rs",
    # Clap
    "clap": "cp",
    "claps": "cp",
    # Cowbell
    "cowbell": "cb",
}
