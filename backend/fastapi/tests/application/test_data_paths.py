"""The rule that keeps JSON stores writable on a read-only deployment.

The bug these cover: every JSON store resolved its file against `Path.cwd()`,
which on Vercel is `/var/task` -- read-only -- so the first save died with
`[Errno 30] Read-only file system: '/var/task/data'`.
"""

import os
from pathlib import Path

import pytest

from src.application.utils import data_paths


@pytest.fixture(autouse=True)
def _fresh_probe(monkeypatch):
    """Each test probes the filesystem itself, so drop the cached answer."""
    data_paths.reset_for_tests()
    monkeypatch.delenv("DATA_DIR", raising=False)
    monkeypatch.setattr(data_paths, "_settings_data_dir", lambda: "")
    yield
    data_paths.reset_for_tests()


def test_data_dir_env_wins(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "chosen"))
    assert data_paths.data_root() == (tmp_path / "chosen").resolve()


def test_unwritable_data_dir_is_an_error_not_a_fallback(monkeypatch):
    """An explicit setting is an instruction: silently ignoring it hides a
    misconfiguration until someone wonders where their data went."""
    monkeypatch.setenv("DATA_DIR", "/chosen")
    monkeypatch.setattr(data_paths, "_is_writable", lambda directory: False)
    with pytest.raises(RuntimeError, match="DATA_DIR"):
        data_paths.data_root()


def test_uses_cwd_data_when_writable(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert data_paths.data_root() == (tmp_path / "data").resolve()


def test_falls_back_to_temp_when_cwd_is_read_only(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    fallback = tmp_path / "fallback"

    real_is_writable = data_paths._is_writable
    monkeypatch.setattr(
        data_paths,
        "_is_writable",
        lambda directory: False if directory == tmp_path / "data" else real_is_writable(directory),
    )
    monkeypatch.setattr(data_paths, "_fallback_root", lambda: fallback)

    assert data_paths.data_root() == fallback.resolve()


def test_relative_path_loses_its_data_prefix(tmp_path, monkeypatch):
    """`data/postman-workspaces.json` is the configured value everywhere, and it
    must not become `<root>/data/data/...` once the root itself moves."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    assert data_paths.resolve_data_path("data/postman-workspaces.json") == tmp_path.resolve() / "postman-workspaces.json"


def test_absolute_path_is_left_alone(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    explicit = Path(os.path.abspath(os.sep + "somewhere" + os.sep + "file.json"))
    assert data_paths.resolve_data_path(explicit) == explicit


def test_seed_copies_bundled_file_into_the_writable_root(tmp_path, monkeypatch):
    bundle = tmp_path / "bundle"
    (bundle / "data").mkdir(parents=True)
    (bundle / "data" / "seed.json").write_text('{"version": 1}', encoding="utf-8")
    monkeypatch.chdir(bundle)

    writable = tmp_path / "writable"
    monkeypatch.setenv("DATA_DIR", str(writable))

    target = data_paths.seeded_data_path("data/seed.json")
    assert target == writable.resolve() / "seed.json"
    assert target.read_text(encoding="utf-8") == '{"version": 1}'


def test_seed_does_not_overwrite_existing_content(tmp_path, monkeypatch):
    bundle = tmp_path / "bundle"
    (bundle / "data").mkdir(parents=True)
    (bundle / "data" / "seed.json").write_text("from bundle", encoding="utf-8")
    monkeypatch.chdir(bundle)

    writable = tmp_path / "writable"
    writable.mkdir()
    (writable / "seed.json").write_text("already saved", encoding="utf-8")
    monkeypatch.setenv("DATA_DIR", str(writable))

    assert data_paths.seeded_data_path("data/seed.json").read_text(encoding="utf-8") == "already saved"
