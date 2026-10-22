"""Serving the bundled web-app collection, and the runtime config it needs.

A Vite build freezes `import.meta.env.VITE_*` into the bundle, so an app copied
into `webapp/` carries whatever URLs its build machine had. `API_PREFIX` is a
deployment choice made when this process starts. These tests pin down the bridge
between the two: every entry document gets the live values injected ahead of its
own scripts.
"""

import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.adapter.input.controllers import webapp_controller
from src.application.config.config import settings
from src.main import app

CONFIG_RE = re.compile(r"<script>window\.__WEBAPP_CONFIG__=Object\.freeze\((.*?)\);</script>")


def injected_config(html: str) -> dict:
    """The config object the page hands to the browser."""
    match = CONFIG_RE.search(html)
    assert match, f"no runtime config in: {html[:200]!r}"
    return json.loads(match.group(1))


@pytest.fixture
def webapp_root(tmp_path, monkeypatch):
    """A throwaway collection, so tests do not depend on what is checked in.

    Layout:
        solo/index.html                     - an app at the root
        team/nested/index.html              - an app inside a collection
        team/nested/metadata.json           - with extra config
        team/plain/index.html               - an app with no metadata
        solo/app.js                         - a normal asset
    """
    root = tmp_path / "webapp"

    solo = root / "solo"
    solo.mkdir(parents=True)
    (solo / "index.html").write_text(
        "<!doctype html><html><head><title>Solo</title></head>"
        "<body><script src='./app.js'></script></body></html>",
        encoding="utf-8",
    )
    (solo / "app.js").write_text("console.log('hi')", encoding="utf-8")

    nested = root / "team" / "nested"
    nested.mkdir(parents=True)
    (nested / "index.html").write_text(
        "<!doctype html><html><head></head><body><script src='./main.js'></script></body></html>",
        encoding="utf-8",
    )
    (nested / "metadata.json").write_text(
        json.dumps({"title": "Nested", "config": {"featureFlag": True, "apiBase": "/override"}}),
        encoding="utf-8",
    )

    plain = root / "team" / "plain"
    plain.mkdir(parents=True)
    (plain / "index.html").write_text("<html><head></head><body>plain</body></html>", encoding="utf-8")

    monkeypatch.setattr(webapp_controller, "WEBAPP_ROOT", root)
    return root


@pytest.fixture
def client(webapp_root):
    with TestClient(app) as test_client:
        yield test_client


# --------------------------------------------------------------------------
# Injection reaches every way an entry document is served
# --------------------------------------------------------------------------

def test_app_at_the_root_gets_the_config(client):
    r = client.get("/webapp/solo/", follow_redirects=True)
    assert r.status_code == 200
    assert injected_config(r.text)["apiBase"] == settings.API_PREFIX


def test_app_inside_a_collection_gets_the_config(client):
    """Regression: a collection app is served by serve_asset, which used to
    stream the file straight through and so could not inject anything."""
    r = client.get("/webapp/team/plain/", follow_redirects=True)
    assert r.status_code == 200
    assert "apiBase" in injected_config(r.text)


# --------------------------------------------------------------------------
# `…/<app>/index.html` asked for by name is the same entry document
#
# An installed PWA opens its start_url (`./index.html?source=pwa`) and a
# service worker precaches `index.html`. Streaming that file raw left the app
# with no config at all, so Personal Wiki believed no server was there.
# --------------------------------------------------------------------------

def test_index_html_asked_for_by_name_gets_the_config(client, monkeypatch):
    monkeypatch.setattr(settings, "API_PREFIX", "/api/v1")

    r = client.get("/webapp/solo/index.html")

    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert injected_config(r.text)["apiBase"] == "/api/v1"


def test_index_html_by_name_matches_the_folder_url(client):
    """Same bytes either way: the two URLs are one document."""
    by_folder = client.get("/webapp/solo/", follow_redirects=True).text
    by_name = client.get("/webapp/solo/index.html").text

    assert by_name == by_folder


def test_the_pwa_start_url_keeps_the_config(client):
    """The query string of a start_url must not change what is served."""
    r = client.get("/webapp/solo/index.html", params={"source": "pwa"})

    assert r.status_code == 200
    assert "apiBase" in injected_config(r.text)


def test_an_empty_prefix_reaches_index_html_as_an_empty_string(client, monkeypatch):
    """API_PREFIX='' means "API at the root", not "no server"."""
    monkeypatch.setattr(settings, "API_PREFIX", "")

    assert injected_config(client.get("/webapp/solo/index.html").text)["apiBase"] == ""


def test_index_html_of_a_collection_app_gets_its_own_metadata_config(client):
    config = injected_config(client.get("/webapp/team/nested/index.html").text)

    assert config["featureFlag"] is True
    assert config["apiBase"] == "/override"


def test_index_html_by_name_keeps_the_config_ahead_of_scripts_inside_head(client):
    html = client.get("/webapp/solo/index.html").text

    assert html.index("<head>") < html.index("__WEBAPP_CONFIG__") < html.index("</head>")
    assert html.index("__WEBAPP_CONFIG__") < html.index("./app.js")
    assert len(CONFIG_RE.findall(html)) == 1


def test_other_html_pages_of_an_app_are_served_untouched(client, webapp_root):
    """Only the folder's index file is an entry document."""
    page = "<html><head></head><body>other</body></html>"
    (webapp_root / "solo" / "other.html").write_text(page, encoding="utf-8")
    (webapp_root / "solo" / "home.html").write_text(page, encoding="utf-8")   # an index candidate, but index.html wins

    for name in ("other.html", "home.html"):
        r = client.get("/webapp/solo/" + name)
        assert r.status_code == 200
        assert r.text == page
        assert "__WEBAPP_CONFIG__" not in r.text


def test_a_folder_whose_only_entry_is_home_html_injects_into_it(client, webapp_root):
    """The rule follows _find_index_file, the same lookup the folder URL uses."""
    docs = webapp_root / "solo" / "docs"
    docs.mkdir()
    (docs / "home.html").write_text("<html><head></head><body>docs</body></html>", encoding="utf-8")

    assert "apiBase" in injected_config(client.get("/webapp/solo/docs/home.html").text)
    assert "apiBase" in injected_config(client.get("/webapp/solo/docs/", follow_redirects=True).text)


def test_a_missing_index_html_is_still_404(client):
    assert client.get("/webapp/solo/nope/index.html").status_code == 404


def test_every_checked_in_app_serves_its_index_by_name_like_its_folder():
    """Regression sweep over the REAL collection (not the throwaway one): for every
    folder that has an entry document, `…/<app>/<index>?source=pwa` (the PWA
    start_url, the copy a service worker precaches) is byte-for-byte the page
    `…/<app>/` serves, with exactly one config tag. Courses, the portal's apps,
    React builds and hand-written apps all ride on this."""
    import os

    root = webapp_controller.WEBAPP_ROOT
    checked = []
    with TestClient(app) as client:
        for folder, dirs, _files in os.walk(root):
            dirs[:] = [d for d in dirs if not d.startswith((".", "_")) and d != "node_modules"]
            index_file = webapp_controller._find_index_file(Path(folder))
            rel = os.path.relpath(folder, root).replace(os.sep, "/")
            if index_file is None or rel == ".":
                continue
            by_folder = client.get(f"/webapp/{rel}/")
            by_name = client.get(f"/webapp/{rel}/{index_file.name}?source=pwa")
            assert by_folder.status_code == 200, rel
            assert by_folder.text.count("window.__WEBAPP_CONFIG__=") == 1, rel
            assert by_name.content == by_folder.content, rel
            checked.append(rel)

    assert len(checked) >= 100, f"only {len(checked)} apps found under {root}"


def test_the_config_precedes_the_app_scripts(client):
    """The bundle reads the global while it evaluates, so order is the contract."""
    html = client.get("/webapp/solo/", follow_redirects=True).text
    assert html.index("__WEBAPP_CONFIG__") < html.index("./app.js")


def test_the_config_lands_inside_head(client):
    html = client.get("/webapp/solo/", follow_redirects=True).text
    assert html.index("<head>") < html.index("__WEBAPP_CONFIG__") < html.index("</head>")


# --------------------------------------------------------------------------
# What the config carries
# --------------------------------------------------------------------------

def test_the_config_reports_the_running_api_prefix(client, monkeypatch):
    """The whole point: this follows the server, not the machine that built."""
    monkeypatch.setattr(settings, "API_PREFIX", "/api/v1")

    config = injected_config(client.get("/webapp/solo/", follow_redirects=True).text)

    assert config["apiBase"] == "/api/v1"


def test_an_empty_prefix_is_reported_as_an_empty_string(client, monkeypatch):
    monkeypatch.setattr(settings, "API_PREFIX", "")

    assert injected_config(client.get("/webapp/solo/", follow_redirects=True).text)["apiBase"] == ""


def test_metadata_can_add_and_override_keys(client):
    config = injected_config(client.get("/webapp/team/nested/", follow_redirects=True).text)

    assert config["featureFlag"] is True
    assert config["apiBase"] == "/override"


def test_an_app_without_metadata_still_gets_the_defaults(client):
    config = injected_config(client.get("/webapp/team/plain/", follow_redirects=True).text)

    assert set(config) == {"apiBase", "webappBase"}


# --------------------------------------------------------------------------
# Safety and scope
# --------------------------------------------------------------------------

def test_a_closing_script_tag_in_the_config_cannot_break_out(webapp_root):
    """A value containing '</script>' must not end the tag early."""
    (webapp_root / "team" / "nested" / "metadata.json").write_text(
        json.dumps({"config": {"evil": "</script><script>alert(1)</script>"}}),
        encoding="utf-8",
    )

    with TestClient(app) as client:
        html = client.get("/webapp/team/nested/", follow_redirects=True).text

    # Exactly one script tag was added, and the payload is still parseable.
    assert "<script>alert(1)</script>" not in html
    assert injected_config(html)["evil"] == "</script><script>alert(1)</script>"


def test_plain_assets_are_served_untouched(client):
    r = client.get("/webapp/solo/app.js")

    assert r.status_code == 200
    assert r.text == "console.log('hi')"
    assert "__WEBAPP_CONFIG__" not in r.text


def test_non_html_assets_do_not_probe_the_folder_for_an_index(client, monkeypatch):
    # Every asset request asks "is this the entry document?"; a script or an image
    # can never be one, so it must not pay for the index lookup (several stat calls).
    probed = []
    real = webapp_controller._find_index_file
    monkeypatch.setattr(webapp_controller, "_find_index_file", lambda folder: probed.append(folder) or real(folder))

    assert client.get("/webapp/solo/app.js").status_code == 200
    assert probed == []

    assert "__WEBAPP_CONFIG__" in client.get("/webapp/solo/index.html").text
    assert probed, "index.html by name must still be recognised as the entry document"


def test_a_service_worker_and_its_manifest_get_their_web_types(client, webapp_root):
    # Browsers refuse to register a service worker served as anything but JavaScript.
    (webapp_root / "solo" / "sw.js").write_text("self.addEventListener('fetch', () => {})", encoding="utf-8")
    (webapp_root / "solo" / "manifest.webmanifest").write_text('{"name": "Solo"}', encoding="utf-8")

    assert client.get("/webapp/solo/sw.js").headers["content-type"].startswith("text/javascript")
    manifest = client.get("/webapp/solo/manifest.webmanifest")
    assert manifest.headers["content-type"].startswith("application/manifest+json")


def test_a_missing_app_is_still_404(client):
    assert client.get("/webapp/nope/", follow_redirects=True).status_code == 404


# --------------------------------------------------------------------------
# The fetchable form, for apps running on a dev server
# --------------------------------------------------------------------------

def test_config_endpoint_matches_what_is_injected(client):
    endpoint = client.get("/webapp/_api/config").json()
    injected = injected_config(client.get("/webapp/solo/", follow_redirects=True).text)

    assert endpoint == injected


def test_config_endpoint_can_include_an_app_s_extra_keys(client):
    config = client.get("/webapp/_api/config", params={"app": "team/nested"}).json()

    assert config["featureFlag"] is True


def test_config_endpoint_ignores_an_unknown_app(client):
    config = client.get("/webapp/_api/config", params={"app": "does/not/exist"}).json()

    assert set(config) == {"apiBase", "webappBase"}


def test_config_endpoint_refuses_to_escape_the_collection(client):
    r = client.get("/webapp/_api/config", params={"app": "../../../etc"})

    assert r.status_code == 400


# --------------------------------------------------------------------------
# `category` — what an app IS, as opposed to `collection`, where it SITS
#
# `collection` is derived from the folder tree, so every app under `courses/`
# reports the same one. Only the app itself can say whether it is a course or
# a lab, so that has to come from its own metadata.json.
# --------------------------------------------------------------------------


def write_metadata(app_dir, **fields):
    (app_dir / "metadata.json").write_text(json.dumps(fields), encoding="utf-8")


def find_app(payload, name):
    """The listing splits standalone apps from collections; callers want neither."""
    everything = list(payload["apps"])
    for entry in payload["collections"]:
        everything.extend(entry["apps"])
    matches = [app for app in everything if app["name"] == name]
    assert matches, f"{name!r} missing from listing"
    return matches[0]


def test_the_listing_reports_a_declared_category(client, webapp_root):
    write_metadata(webapp_root / "solo", title="Solo", category="Lab trực quan")

    solo = find_app(client.get("/webapp/_api/list").json(), "solo")

    assert solo["category"] == "Lab trực quan"


def test_an_app_without_a_category_reports_none_rather_than_omitting_it(client):
    plain = find_app(client.get("/webapp/_api/list").json(), "plain")

    assert plain["category"] is None


def test_category_is_independent_of_collection(client, webapp_root):
    """Two apps in the same folder may be different kinds of thing."""
    write_metadata(webapp_root / "team" / "nested", title="Nested", category="Khoá học")
    write_metadata(webapp_root / "team" / "plain", title="Plain", category="Lab trực quan")

    payload = client.get("/webapp/_api/list").json()
    nested, plain = find_app(payload, "nested"), find_app(payload, "plain")

    assert nested["collection"] == plain["collection"] == "team"
    assert nested["category"] == "Khoá học"
    assert plain["category"] == "Lab trực quan"


def test_a_category_is_searchable(client, webapp_root):
    write_metadata(webapp_root / "solo", title="Solo", category="Lab trực quan")

    results = client.get("/webapp/_api/search", params={"q": "lab"}).json()["results"]

    assert [app["name"] for app in results] == ["solo"]


def test_a_category_does_not_disturb_the_runtime_config(client, webapp_root):
    """Only a `config` object feeds the browser; `category` is listing metadata."""
    write_metadata(webapp_root / "solo", title="Solo", category="Lab trực quan")

    config = injected_config(client.get("/webapp/solo").text)

    assert "category" not in config


# --------------------------------------------------------------------------
# `updated` and `pwa` — what the portal needs to sort by "newest" and to badge
# the apps that open offline
# --------------------------------------------------------------------------


def test_the_listing_reports_when_an_app_was_last_touched(client, webapp_root):
    import os

    index = webapp_root / "solo" / "index.html"
    os.utime(index, (1_700_000_000, 1_700_000_000))

    assert find_app(client.get("/webapp/_api/list").json(), "solo")["updated"] == 1_700_000_000


def test_editing_metadata_counts_as_touching_the_app(client, webapp_root):
    import os

    os.utime(webapp_root / "solo" / "index.html", (1_700_000_000, 1_700_000_000))
    write_metadata(webapp_root / "solo", title="Solo")
    os.utime(webapp_root / "solo" / "metadata.json", (1_800_000_000, 1_800_000_000))

    assert find_app(client.get("/webapp/_api/list").json(), "solo")["updated"] == 1_800_000_000


def test_an_app_is_pwa_only_with_both_a_manifest_and_a_service_worker(client, webapp_root):
    solo = webapp_root / "solo"
    assert find_app(client.get("/webapp/_api/list").json(), "solo")["pwa"] is False

    (solo / "sw.js").write_text("// worker", encoding="utf-8")
    assert find_app(client.get("/webapp/_api/list").json(), "solo")["pwa"] is False   # a worker alone cannot be installed

    (solo / "manifest.webmanifest").write_text("{}", encoding="utf-8")
    assert find_app(client.get("/webapp/_api/list").json(), "solo")["pwa"] is True


def test_a_manifest_without_a_worker_is_not_offline_capable(client, webapp_root):
    (webapp_root / "solo" / "manifest.json").write_text("{}", encoding="utf-8")

    assert find_app(client.get("/webapp/_api/list").json(), "solo")["pwa"] is False
