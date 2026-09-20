"""Serving the bundled web-app collection, and the runtime config it needs.

A Vite build freezes `import.meta.env.VITE_*` into the bundle, so an app copied
into `webapp/` carries whatever URLs its build machine had. `API_PREFIX` is a
deployment choice made when this process starts. These tests pin down the bridge
between the two: every entry document gets the live values injected ahead of its
own scripts.
"""

import json
import re

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
