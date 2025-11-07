import os
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, FileResponse, Response, RedirectResponse
import mimetypes
from src.application.config.config import settings

# Resolve the repository-level "webapp" folder by walking up from this file
def _find_webapp_root() -> Path:
    here = Path(__file__).resolve()
    for base in here.parents:
        candidate = base / "webapp"
        if candidate.exists() and candidate.is_dir():
            return candidate
    # Fallback to fastapi parent if not found (will 404 later)
    return Path(__file__).resolve().parents[4] / "webapp"

WEBAPP_ROOT = _find_webapp_root()

router = APIRouter(prefix="/webapp", tags=["webapp"])

ALLOWED_NAME_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")


def _validate_app_name(app_name: str) -> str:
    if not app_name or any(c not in ALLOWED_NAME_CHARS for c in app_name):
        raise HTTPException(status_code=400, detail="Invalid app name")
    return app_name


def _app_folder(app_name: str) -> Path:
    folder = WEBAPP_ROOT / app_name
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=404, detail="App not found")
    return folder


def _safe_join(base: Path, relative: str) -> Path:
    # Prevent directory traversal
    target = (base / relative).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    return target


def _guess_media_type(path: Path) -> Optional[str]:
    mt, _ = mimetypes.guess_type(str(path))
    return mt or "application/octet-stream"

def _find_index_file(folder: Path) -> Optional[Path]:
    """Return a suitable index file if present in folder."""
    candidates: List[str] = [
        "index.html",
        "index.htm",
        "Index.html",
        "home.html",
    ]
    for name in candidates:
        p = folder / name
        if p.exists() and p.is_file():
            return p
    return None

def _render_directory_listing(base_href: str, folder: Path, rel: str = "") -> HTMLResponse:
    """Produce a minimal HTML directory listing for the given folder.

    base_href: URL path prefix like /api/v1/webapp/<app_name>/ (must end with '/')
    rel: relative path inside the app ('' or 'sub/dir/') used to build links
    """
    items: List[str] = []
    # Parent link if not at app root
    if rel not in ("", "/"):
        parent = rel.rstrip("/").split("/")[:-1]
        parent_rel = "/".join(parent) + ("/" if parent else "")
        items.append(f"<li><a href='{base_href}{parent_rel}'>../</a></li>")
    try:
        for child in sorted(folder.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            name = child.name + ("/" if child.is_dir() else "")
            href = f"{base_href}{rel}{name}"
            items.append(f"<li><a href='{href}'>{name}</a></li>")
    except Exception:
        items.append("<li><em>Unable to list directory</em></li>")
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Directory listing</title>"
        "<style>body{font-family:system-ui;padding:12px} a{text-decoration:none} li{margin:4px 0}</style>"
        "</head><body>"
        f"<h3>Index of {base_href}{rel}</h3><ul>" + "".join(items) + "</ul>"
        "</body></html>"
    )
    return HTMLResponse(html)

 

DEFAULT_REDIRECT_APP = "gemini-proxy"

@router.get("/_list", response_model=list)
async def list_apps_json():
    """Return JSON list of available app names (subdirectories with index.html)."""
    if not WEBAPP_ROOT.exists():
        return []
    apps = []
    try:
        for child in WEBAPP_ROOT.iterdir():
            if child.is_dir():
                apps.append(child.name)
    except Exception:
        return [DEFAULT_REDIRECT_APP]
    # Ensure default redirect app is present even without a folder
    if DEFAULT_REDIRECT_APP not in apps:
        apps.insert(0, DEFAULT_REDIRECT_APP)
    return apps

@router.get("/", response_class=HTMLResponse)
async def list_apps_root():
    """Serve the repository-level webapp/index.html if present; else render a dynamic listing."""
    index = WEBAPP_ROOT / "index.html"
    if index.exists():
        try:
            return HTMLResponse(index.read_text(encoding="utf-8"))
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to read root webapp index.html")
    # Fallback dynamic HTML
    apps = []
    if WEBAPP_ROOT.exists():
        try:
            for child in WEBAPP_ROOT.iterdir():
                if child.is_dir() and (child / "index.html").exists():
                    apps.append(child.name)
        except Exception:
            apps = []
    items = "".join(f'<li><a href="./{a}/">{a}</a></li>' for a in apps) or '<li><em>No apps found</em></li>'
    html = f"""
    <!DOCTYPE html><html><head><meta charset='utf-8'><title>Webapps</title></head>
    <body><h1>Webapps</h1><ul>{items}</ul></body></html>
    """.strip()
    return HTMLResponse(html)


@router.get("/{app_name}")
async def serve_index(app_name: str, request: Request):
    """Serve a webapp or redirect for special default app.

    Special case: 'gemini-proxy' -> redirect to FastAPI docs.
    Otherwise serve index.html of the app folder.
    """
    _validate_app_name(app_name)
    if app_name == DEFAULT_REDIRECT_APP:
        docs_url = f"{settings.API_PREFIX}/docs"
        return RedirectResponse(url=docs_url, status_code=302)

    # Ensure trailing slash so relative asset URLs resolve under /{app_name}/
    if not request.url.path.endswith("/"):
        # Preserve query string if any
        q = ("?" + str(request.url.query)) if request.url.query else ""
        return RedirectResponse(url=str(request.url.path) + "/" + q, status_code=307)

    folder = _app_folder(app_name)
    index_file = _find_index_file(folder)
    if index_file is not None:
        try:
            content = index_file.read_text(encoding="utf-8")
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to read index file")
        return HTMLResponse(content=content)
    # Otherwise, render directory listing at app root
    base_href = str(request.url.path)  # endswith '/'
    if not base_href.endswith('/'):
        base_href += '/'
    return _render_directory_listing(base_href=base_href, folder=folder, rel="")


@router.get("/{app_name}/{asset_path:path}")
async def serve_asset(app_name: str, asset_path: str, request: Request):
    """Serve any asset file inside the app folder.

    Example: /webapp/git-diff-viewer/main.js -> file webapp/git-diff-viewer/main.js
    """
    _validate_app_name(app_name)
    folder = _app_folder(app_name)
    if asset_path in ("", "/"):
        # Serve index.* when trailing slash is used, else render directory
        folder = _app_folder(app_name)
        index_file = _find_index_file(folder)
        if index_file is not None:
            media_type = _guess_media_type(index_file)
            return FileResponse(str(index_file), media_type=media_type)
        # No index here -> render root listing for this app
        base_href = str(request.base_url).rstrip('/') + request.url.path
        if not base_href.endswith('/'):
            base_href += '/'
        return _render_directory_listing(base_href=base_href, folder=folder, rel="")
    target = _safe_join(folder, asset_path)
    if target.is_dir():
        # Ensure trailing slash for directory URLs
        if not request.url.path.endswith('/'):
            q = ("?" + str(request.url.query)) if request.url.query else ""
            return RedirectResponse(url=str(request.url.path) + "/" + q, status_code=307)
        # Serve index.* if present otherwise directory listing
        idx = _find_index_file(target)
        if idx is not None:
            media_type = _guess_media_type(idx)
            return FileResponse(str(idx), media_type=media_type)
        # Render directory listing for nested folders
        # Compute rel path inside app
        rel = asset_path
        if rel and not rel.endswith('/'):
            rel += '/'
        base_href = str(request.url.path)
        if not base_href.endswith('/'):
            base_href += '/'
        # base_href should represent /webapp/<app_name>/<asset_path>/
        # But for links we want prefix at app level:
        # Build app_base by combining the request.base_url and the path prefix up to the app_name.
        # Use str(...) and rstrip to avoid duplicate slashes.
        app_base = str(request.base_url).rstrip('/') + request.url.path.split(app_name, 1)[0] + app_name + '/'
        # Build listing using app_base + rel
        return _render_directory_listing(base_href=app_base, folder=target, rel=rel)

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")
    media_type = _guess_media_type(target)
    return FileResponse(str(target), media_type=media_type)
