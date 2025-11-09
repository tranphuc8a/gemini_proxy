import os
import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import HTMLResponse, FileResponse, Response, RedirectResponse, JSONResponse
from pydantic import BaseModel
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


class AppMetadata(BaseModel):
    """Metadata for a web app."""
    name: str
    path: str  # relative path from WEBAPP_ROOT
    title: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = []
    icon: Optional[str] = None
    collection: Optional[str] = None  # parent folder name if in a collection
    has_index: bool = False


def _load_app_metadata(app_path: Path, relative_path: str) -> Dict[str, Any]:
    """Load metadata.json if exists, otherwise return defaults."""
    metadata_file = app_path / "metadata.json"
    metadata = {
        "title": app_path.name,
        "description": "",
        "tags": [],
        "icon": None
    }
    if metadata_file.exists():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                custom = json.load(f)
                metadata.update(custom)
        except Exception:
            pass
    return metadata


def _scan_apps_recursive(base: Path, current: Path, collection: Optional[str] = None, depth: int = 0) -> List[AppMetadata]:
    """Recursively scan for apps (folders with index.html or subdirectories).
    
    Logic:
    - If folder has index.html -> it's an app, add it and STOP (don't scan deeper)
    - If folder has no index.html but has subdirs -> it's a collection, scan subdirs (only 1 level)
    - Max depth is 1 (only scan webapp/ and webapp/collection/, not deeper)
    """
    apps = []
    
    # Limit depth to prevent scanning too deep into app folders
    if depth > 1:
        return apps
    
    try:
        for child in sorted(current.iterdir(), key=lambda p: p.name.lower()):
            if not child.is_dir():
                continue
            # Skip special folders
            if child.name.startswith("_"):
                continue
            
            relative_path = str(child.relative_to(base)).replace("\\", "/")
            index_file = _find_index_file(child)
            has_index = index_file is not None
            
            if has_index:
                # This is an app - add it and STOP (don't scan its subdirectories)
                metadata = _load_app_metadata(child, relative_path)
                apps.append(AppMetadata(
                    name=child.name,
                    path=relative_path,
                    title=metadata.get("title", child.name),
                    description=metadata.get("description", ""),
                    tags=metadata.get("tags", []),
                    icon=metadata.get("icon"),
                    collection=collection,
                    has_index=True
                ))
                # DON'T scan deeper - this is a complete app
            else:
                # No index.html - check if it has subdirs (potential collection)
                subdirs = [x for x in child.iterdir() if x.is_dir() and not x.name.startswith("_")]
                if subdirs and depth == 0:
                    # This is a collection folder at root level, scan its children
                    collection_name = child.name
                    apps.extend(_scan_apps_recursive(base, child, collection_name, depth + 1))
                # If depth > 0, don't scan further (already in a collection)
    
    except Exception as e:
        print(f"[ERROR] Failed to scan {current}: {e}")
    return apps


@router.get("/_api/list")
async def list_apps_with_metadata():
    """Return JSON list of all apps with metadata, supporting collections."""
    if not WEBAPP_ROOT.exists():
        return JSONResponse({"apps": [], "collections": [], "error": f"WEBAPP_ROOT not found: {WEBAPP_ROOT}"})
    
    apps = _scan_apps_recursive(WEBAPP_ROOT, WEBAPP_ROOT)
    
    # Group by collection
    collections_map: Dict[str, List[AppMetadata]] = {}
    standalone_apps = []
    
    for app in apps:
        if app.collection:
            if app.collection not in collections_map:
                collections_map[app.collection] = []
            collections_map[app.collection].append(app)
        else:
            standalone_apps.append(app)
    
    collections = [
        {
            "name": name,
            "apps": [app.dict() for app in apps_list]
        }
        for name, apps_list in collections_map.items()
    ]
    
    return JSONResponse({
        "apps": [app.dict() for app in standalone_apps],
        "collections": collections,
        "total": len(apps)
    })


@router.get("/_api/search")
async def search_apps(q: str = Query("", description="Search query")):
    """Search apps by name, title, description, or tags."""
    if not q.strip():
        return JSONResponse({"results": []})
    
    query = q.lower().strip()
    apps = _scan_apps_recursive(WEBAPP_ROOT, WEBAPP_ROOT)
    
    results = []
    for app in apps:
        score = 0
        # Name match (highest priority)
        if query in app.name.lower():
            score += 10
        # Title match
        if app.title and query in app.title.lower():
            score += 8
        # Description match
        if app.description and query in app.description.lower():
            score += 5
        # Tag match
        for tag in app.tags:
            if query in tag.lower():
                score += 6
        
        if score > 0:
            results.append({"app": app.dict(), "score": score})
    
    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    
    return JSONResponse({
        "query": q,
        "results": [r["app"] for r in results],
        "count": len(results)
    })


@router.get("/_list", response_model=list)
async def list_apps_json():
    """Return JSON list of available app names (subdirectories with index.html). Legacy endpoint."""
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
    """Redirect to the portal page."""
    return RedirectResponse(url="/webapp/_portal/portal.html", status_code=302)


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
