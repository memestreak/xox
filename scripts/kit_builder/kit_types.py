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

AUDIO_EXTENSIONS = frozenset((".wav", ".aif", ".aiff"))


@dataclass(frozen=True)
class SampleEntry:
    path: str       # absolute path
    filename: str   # filename only
    rel_path: str   # relative to samples root (for display)


# --- Directory name → track mapping ---
# Keys are lowercased for case-insensitive matching.
# Values can be a single track ID or a list (for
# directories whose contents map to multiple slots).
DIR_MAP: dict[str, str | list[str]] = {
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
    # Toms (refined by filename in _classify)
    "toms": "ht",
    "tom": "ht",
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
    # Percussion → multiple slots
    "percussion": ["cy", "rs", "cp", "cb"],
    "perc": ["cy", "rs", "cp", "cb"],
}

# Directories that contain hats also feed the cy slot.
HAT_DIRS = {"closed_hats", "closedhats", "hats",
            "hihat", "hihats", "open_hats", "openhats"}

# Directories where filenames need keyword filtering
# to decide cy vs rs vs cp vs cb.
PERCUSSION_DIRS = {"percussion", "perc"}

# Keywords that refine a percussion directory match.
# Checked against the lowercase filename.
PERC_KEYWORD_MAP: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"cymbal|crash|ride|splash|china"), "cy"),
    (re.compile(r"rim|sidestick|side.stick|stick"), "rs"),
    (re.compile(r"clap|handclap"), "cp"),
    (re.compile(r"cowbell|cow.?bell"), "cb"),
]

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
    ("tm_", "ht"),
    ("tom_", "ht"),
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

# --- Keyword patterns for filename-based fallback ---
# Checked against the full lowercase filename (without
# extension). Order matters: first match wins.
KEYWORD_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bkick\b|\bbass.drum\b|\bbdrum\b"), "bd"),
    (re.compile(r"\bsnare\b|\bsnr\b"), "sd"),
    (re.compile(
        r"\bclosed.hat\b|\bclosed.h.hat\b|\bclsd\b"
    ), "ch"),
    (re.compile(
        r"\bopen.hat\b|\bopen.h.hat\b|\bopenhat\b"
    ), "oh"),
    (re.compile(
        r"\bcymbal\b|\bcrash\b|\bride\b|\bsplash\b"
    ), "cy"),
    (re.compile(r"\bhi.tom\b|\bhigh.tom\b"), "ht"),
    (re.compile(r"\bmid.tom\b|\bmed.tom\b"), "mt"),
    (re.compile(
        r"\blow.tom\b|\blo.tom\b|\bfloor.tom\b"
    ), "lt"),
    (re.compile(
        r"\brimshot\b|\brim.shot\b|\bsidestick\b"
        r"|\bside.stick\b"
    ), "rs"),
    (re.compile(r"\bclap\b|\bhandclap\b"), "cp"),
    (re.compile(r"\bcowbell\b|\bcow.bell\b"), "cb"),
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
    "tom": "ht",
    "toms": "ht",
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
    # Generic percussion
    "percussion": "cp",
    "perc": "cp",
    "misc_perc": "cp",
}
