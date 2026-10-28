#!/usr/bin/env python3
"""Tests for import_kit.py and assembler.trim_wav."""

from __future__ import annotations

import io
import json
import shutil
import sys
import wave
import zipfile
from array import array
from pathlib import Path

import pytest

sys.path.insert(
    0,
    str(Path(__file__).resolve().parent.parent / "kit_builder"),
)
import assembler  # noqa: E402
import import_kit  # noqa: E402
from kit_types import KIT_TRACK_IDS  # noqa: E402

RATE = assembler.SAMPLE_RATE


def wav_bytes(
    samples: list[int], channels: int = 1, rate: int = RATE,
) -> bytes:
    """A 16-bit WAV file's bytes holding `samples`."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(channels)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(array("h", samples).tobytes())
    return buffer.getvalue()


def write_wav(
    path: Path, samples: list[int], channels: int = 1, rate: int = RATE,
) -> None:
    """Write interleaved 16-bit samples as a WAV."""
    path.write_bytes(wav_bytes(samples, channels, rate))


def read_wav(path: Path) -> tuple[list[int], int]:
    """Samples and channel count of a 16-bit WAV."""
    with wave.open(str(path), "rb") as src:
        channels = src.getnchannels()
        data = array("h")
        data.frombytes(src.readframes(src.getnframes()))
    return list(data), channels


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A fake repo root with public/kits and kits.json."""
    root = tmp_path / "repo"
    kits_dir = root / "public" / "kits"
    kits_dir.mkdir(parents=True)
    kits_json = root / "src" / "app" / "data" / "kits.json"
    kits_json.parent.mkdir(parents=True)
    kits_json.write_text(json.dumps({"kits": [
        {"id": "808", "name": "808", "folder": "808"},
        {"id": "electro", "name": "Electro", "folder": "electro"},
    ]}))
    monkeypatch.setattr(assembler, "PROJECT_ROOT", root)
    monkeypatch.setattr(assembler, "KITS_DIR", kits_dir)
    monkeypatch.setattr(assembler, "KITS_JSON", kits_json)
    # ffmpeg isn't needed: inputs are already 44.1 kHz 16-bit.
    monkeypatch.setattr(
        assembler, "_convert",
        lambda src, dest: shutil.copyfile(src, dest),
    )
    return root


def make_zip(
    path: Path,
    meta: dict[str, object] | None = None,
    entries: dict[str, bytes] | None = None,
) -> Path:
    """An export zip; `entries` overrides or adds files."""
    meta = meta if meta is not None else {
        "format": 1,
        "id": "electro-custom",
        "name": "Electro custom",
        "base": "electro",
        "sources": {"cp": "clap.wav"},
    }
    files: dict[str, bytes] = {"kit.json": json.dumps(meta).encode()}
    hit = [0] * 10 + [20000, -15000, 8000, -4000] + [0] * 100
    for slot in KIT_TRACK_IDS:
        files[f"{slot}.wav"] = wav_bytes(hit)
    files.update(entries or {})
    with zipfile.ZipFile(path, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return path


class TestTrimWav:
    """trim_wav: lead, tail, cap, fade, silence."""

    def test_trims_lead_keeping_preroll_and_tail(
        self, tmp_path: Path,
    ) -> None:
        path = tmp_path / "a.wav"
        lead = RATE // 10
        body = [10000] * 2000
        write_wav(path, [0] * lead + body + [0] * RATE)
        seconds = assembler.trim_wav(path, "bd")
        samples, _ = read_wav(path)
        preroll = int(RATE * assembler.TRIM_PREROLL_SECONDS)
        assert len(samples) == preroll + len(body)
        assert seconds == pytest.approx(len(samples) / RATE)
        assert samples[:preroll] == [0] * preroll
        assert samples[preroll] == 10000

    def test_quiet_audio_counts_as_silence(self, tmp_path: Path) -> None:
        path = tmp_path / "a.wav"
        # 1 is far more than 50 dB below 30000.
        write_wav(path, [1] * 500 + [30000] * 1000 + [1] * 500)
        assembler.trim_wav(path, "bd")
        samples, _ = read_wav(path)
        preroll = int(RATE * assembler.TRIM_PREROLL_SECONDS)
        assert len(samples) == preroll + 1000

    def test_caps_length_by_slot(self, tmp_path: Path) -> None:
        path = tmp_path / "a.wav"
        write_wav(path, [12000] * RATE)
        seconds = assembler.trim_wav(path, "ch")
        assert seconds == pytest.approx(assembler.SLOT_CAPS["ch"])

    def test_fades_out_to_zero(self, tmp_path: Path) -> None:
        path = tmp_path / "a.wav"
        write_wav(path, [12000] * RATE)
        assembler.trim_wav(path, "bd")
        samples, _ = read_wav(path)
        fade = int(RATE * assembler.FADE_OUT_SECONDS)
        assert samples[-1] == 0
        assert samples[-fade - 1] == 12000
        assert samples[-fade // 2] < 12000

    def test_short_sample_fades_at_most_a_quarter(
        self, tmp_path: Path,
    ) -> None:
        path = tmp_path / "a.wav"
        write_wav(path, [12000] * 100)
        assembler.trim_wav(path, "bd")
        samples, _ = read_wav(path)
        assert samples[:75] == [12000] * 75
        assert samples[-1] == 0

    def test_stereo_keeps_frames_together(self, tmp_path: Path) -> None:
        path = tmp_path / "a.wav"
        frames = [0, 0] * 200 + [0, 9000] * 1000
        write_wav(path, frames, channels=2)
        assembler.trim_wav(path, "bd")
        samples, channels = read_wav(path)
        preroll = int(RATE * assembler.TRIM_PREROLL_SECONDS)
        assert channels == 2
        assert len(samples) == 2 * (preroll + 1000)
        assert samples[2 * preroll:2 * preroll + 2] == [0, 9000]

    def test_silent_file_is_only_capped(self, tmp_path: Path) -> None:
        path = tmp_path / "a.wav"
        write_wav(path, [0] * (RATE * 2))
        seconds = assembler.trim_wav(path, "rs")
        assert seconds == pytest.approx(assembler.SLOT_CAPS["rs"])
        samples, _ = read_wav(path)
        assert set(samples) == {0}

    def test_short_silence_is_unchanged(self, tmp_path: Path) -> None:
        path = tmp_path / "a.wav"
        write_wav(path, [0] * 4410)
        assert assembler.trim_wav(path, "bd") == pytest.approx(0.1)


class TestReadExport:
    """read_export refuses anything but a clean export."""

    def test_reads_a_valid_export(self, tmp_path: Path) -> None:
        export = import_kit.read_export(make_zip(tmp_path / "k.zip"))
        assert export.kit_id == "electro-custom"
        assert export.name == "Electro custom"
        assert export.base == "electro"
        assert export.sources == {"cp": "clap.wav"}
        assert set(export.audio) == set(KIT_TRACK_IDS)

    @pytest.mark.parametrize(
        ("entries", "message"),
        [
            ({"extra.txt": b"x"}, "Unexpected files"),
            ({"sub/bd.wav": b"x"}, "Unsafe path"),
            ({"..bd.wav": b"x"}, "Unsafe path"),
        ],
    )
    def test_refuses_bad_entries(
        self, tmp_path: Path, entries: dict[str, bytes], message: str,
    ) -> None:
        path = make_zip(tmp_path / "k.zip", entries=entries)
        with pytest.raises(import_kit.KitImportError, match=message):
            import_kit.read_export(path)

    def test_refuses_a_missing_slot(self, tmp_path: Path) -> None:
        good = make_zip(tmp_path / "good.zip")
        bad = tmp_path / "bad.zip"
        with zipfile.ZipFile(good) as src, \
                zipfile.ZipFile(bad, "w") as dest:
            for info in src.infolist():
                if info.filename != "oh.wav":
                    dest.writestr(info, src.read(info))
        with pytest.raises(import_kit.KitImportError, match="oh.wav"):
            import_kit.read_export(bad)

    def test_refuses_a_folder_entry(self, tmp_path: Path) -> None:
        path = make_zip(tmp_path / "k.zip")
        with zipfile.ZipFile(path, "a") as archive:
            archive.writestr(zipfile.ZipInfo("dir/"), b"")
        with pytest.raises(import_kit.KitImportError, match="folder"):
            import_kit.read_export(path)

    def test_refuses_a_large_entry(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(import_kit, "MAX_ENTRY_BYTES", 10)
        with pytest.raises(import_kit.KitImportError, match="20 MB"):
            import_kit.read_export(make_zip(tmp_path / "k.zip"))

    def test_refuses_a_non_zip(self, tmp_path: Path) -> None:
        path = tmp_path / "k.zip"
        path.write_text("nope")
        with pytest.raises(import_kit.KitImportError, match="Can't read"):
            import_kit.read_export(path)

    @pytest.mark.parametrize(
        ("change", "message"),
        [
            ({"format": 2}, "format"),
            ({"id": "Bad ID"}, "id"),
            ({"id": 5}, "id"),
            ({"name": "  "}, "name"),
            ({"sources": {"zz": "a.wav"}}, "sources"),
            ({"sources": ["a"]}, "sources"),
            ({"base": 1}, "base"),
        ],
    )
    def test_refuses_bad_kit_json(
        self, tmp_path: Path, change: dict[str, object], message: str,
    ) -> None:
        meta: dict[str, object] = {
            "format": 1, "id": "k", "name": "K", **change,
        }
        path = make_zip(tmp_path / "k.zip", meta=meta)
        with pytest.raises(import_kit.KitImportError, match=message):
            import_kit.read_export(path)

    def test_refuses_kit_json_that_is_not_json(
        self, tmp_path: Path,
    ) -> None:
        path = make_zip(tmp_path / "k.zip", entries={"kit.json": b"{"})
        with pytest.raises(import_kit.KitImportError, match="JSON"):
            import_kit.read_export(path)


class TestImportKit:
    """import_kit installs, refuses clashes, cleans up."""

    def test_installs_the_kit(self, repo: Path, tmp_path: Path) -> None:
        export = import_kit.read_export(make_zip(tmp_path / "k.zip"))
        lengths = import_kit.import_kit(export)
        kit_dir = assembler.KITS_DIR / "electro-custom"
        assert sorted(p.name for p in kit_dir.iterdir()) == sorted(
            f"{slot}.wav" for slot in KIT_TRACK_IDS
        )
        assert set(lengths) == set(KIT_TRACK_IDS)
        kits = json.loads(assembler.KITS_JSON.read_text())["kits"]
        assert kits[-1] == {
            "id": "electro-custom",
            "name": "Electro custom",
            "folder": "electro-custom",
        }
        assert not [
            p for p in assembler.KITS_DIR.iterdir()
            if p.name.startswith(".")
        ]

    def test_refuses_a_taken_id(self, repo: Path, tmp_path: Path) -> None:
        meta = {"format": 1, "id": "electro", "name": "E2"}
        export = import_kit.read_export(
            make_zip(tmp_path / "k.zip", meta=meta)
        )
        with pytest.raises(import_kit.KitImportError, match="--replace"):
            import_kit.import_kit(export)

    def test_replace_keeps_the_kits_json_position(
        self, repo: Path, tmp_path: Path,
    ) -> None:
        old = assembler.KITS_DIR / "electro"
        old.mkdir()
        (old / "stale.wav").write_bytes(b"x")
        meta = {"format": 1, "id": "808", "name": "New 808"}
        export = import_kit.read_export(
            make_zip(tmp_path / "k.zip", meta=meta)
        )
        import_kit.import_kit(export, replace=True)
        kits = json.loads(assembler.KITS_JSON.read_text())["kits"]
        assert [k["id"] for k in kits] == ["808", "electro"]
        assert kits[0]["name"] == "New 808"

        meta = {"format": 1, "id": "electro", "name": "Electro 2"}
        export = import_kit.read_export(
            make_zip(tmp_path / "k2.zip", meta=meta)
        )
        import_kit.import_kit(export, replace=True)
        assert not (old / "stale.wav").exists()
        assert (old / "bd.wav").exists()

    def test_bad_audio_leaves_nothing_behind(
        self, repo: Path, tmp_path: Path,
    ) -> None:
        path = make_zip(
            tmp_path / "k.zip",
            entries={"sd.wav": wav_bytes([5000] * 100, rate=22050)},
        )
        export = import_kit.read_export(path)
        with pytest.raises(import_kit.KitImportError, match="rate 22050"):
            import_kit.import_kit(export)
        assert list(assembler.KITS_DIR.iterdir()) == []
        kits = json.loads(assembler.KITS_JSON.read_text())["kits"]
        assert len(kits) == 2


class TestMain:
    """The command line reports and exits cleanly."""

    def test_reports_sources_and_git_add(
        self, repo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str],
    ) -> None:
        status = import_kit.main([str(make_zip(tmp_path / "k.zip"))])
        out = capsys.readouterr().out
        assert status == 0
        assert "clap.wav" in out
        assert "electro" in out
        assert (
            "git add public/kits/electro-custom src/app/data/kits.json"
            in out
        )

    def test_errors_exit_1(
        self, repo: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str],
    ) -> None:
        path = tmp_path / "k.zip"
        path.write_text("nope")
        assert import_kit.main([str(path)]) == 1
        assert "Error:" in capsys.readouterr().err
