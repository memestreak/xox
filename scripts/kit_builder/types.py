"""Track IDs, labels, and category-to-track mappings."""

from __future__ import annotations

from dataclasses import dataclass
from typing import NamedTuple

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


class DirMapping(NamedTuple):
    dir: str
    track_id: str
    filter: str | None = None


# Top-level directory mappings. Order matters: first match
# wins for dirs without filters; filtered entries are additive.
DIR_MAPPINGS: tuple[DirMapping, ...] = (
    DirMapping("bass_drum", "bd"),
    DirMapping("snare", "sd"),
    DirMapping("closed_hats", "ch"),
    DirMapping("open_hats", "oh"),
    DirMapping("rim_shots", "rs"),
    # toms: split by filename hints
    DirMapping("toms", "ht", "hi"),
    DirMapping("toms", "mt", "mid"),
    DirMapping("toms", "lt", "lo"),
    DirMapping("toms", "lt", "floor"),
    # percussion: split by filename hints
    DirMapping("percussion", "cy", "cy"),
    DirMapping("percussion", "cp", "clap"),
    DirMapping("percussion", "cb", "cowbell"),
    DirMapping("percussion", "cp", "cp"),
)

# Curated sample filename prefix → track mapping.
# Longest prefixes first for greedy matching.
CURATED_PREFIX_MAP = (
    ("hh_ch_", "ch"),
    ("hh_oh_", "oh"),
    ("hh_", "ch"),
    ("bd_", "bd"),
    ("sd_", "sd"),
    ("sn_", "sd"),
    ("cy_", "cy"),
    ("ht_", "ht"),
    ("mt_", "mt"),
    ("lt_", "lt"),
    ("rs_", "rs"),
    ("cp_", "cp"),
    ("cb_", "cb"),
)

# Geist/elektron subdirectory name → track mapping.
SUBDIR_TYPE_MAP = {
    "kick": "bd",
    "kicks": "bd",
    "bass drum": "bd",
    "snare": "sd",
    "snares": "sd",
    "hihat": "ch",
    "hihats": "ch",
    "hi hat": "ch",
    "hi-hat": "ch",
    "open hat": "oh",
    "open hats": "oh",
    "cymbal": "cy",
    "cymbals": "cy",
    "ride": "cy",
    "crash": "cy",
    "tom": "ht",
    "toms": "ht",
    "clap": "cp",
    "claps": "cp",
    "rim": "rs",
    "rimshot": "rs",
    "cowbell": "cb",
    "percussion": "cp",
}
