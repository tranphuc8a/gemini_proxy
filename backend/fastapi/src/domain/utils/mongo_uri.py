"""Build, parse and redact MongoDB connection strings.

The login form offers two equivalent routes: individual fields (host, port,
user, password) or a pasted connection string. Both end up as one URI, because
that is the only thing the driver accepts. Parsing is done here in plain Python
rather than through `pymongo.uri_parser` so the rules stay testable without a
driver and so a `mongodb+srv://` URI can be inspected without a DNS lookup.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, quote, unquote, urlencode

SCHEME_STANDARD = "mongodb://"
SCHEME_SRV = "mongodb+srv://"

DEFAULT_HOST = "localhost"
DEFAULT_PORT = 27017

# Percent-encoding is mandatory for these inside the userinfo section; a
# password containing a ':' or '@' otherwise splits the URI in the wrong place.
_USERINFO_SAFE = "~"


class InvalidConnectionStringError(ValueError):
    """Raised when a pasted connection string cannot be understood."""


def _split_once(text: str, separator: str) -> tuple[str, str]:
    head, found, tail = text.partition(separator)
    return (head, tail) if found else (text, "")


def parse_uri(uri: str) -> dict[str, Any]:
    """Break a connection string into its parts without contacting any server."""
    if not isinstance(uri, str) or not uri.strip():
        raise InvalidConnectionStringError("a connection string is required")
    text = uri.strip()

    if text.startswith(SCHEME_SRV):
        srv = True
        remainder = text[len(SCHEME_SRV) :]
    elif text.startswith(SCHEME_STANDARD):
        srv = False
        remainder = text[len(SCHEME_STANDARD) :]
    else:
        raise InvalidConnectionStringError("a connection string must start with mongodb:// or mongodb+srv://")

    remainder, query = _split_once(remainder, "?")
    # The path (auth database) is separated by the first '/' after the hosts,
    # which is why userinfo has to come off first: it may itself contain one.
    userinfo, _, hostpart = remainder.rpartition("@")
    username = password = None
    if userinfo:
        raw_user, raw_password = _split_once(userinfo, ":")
        username = unquote(raw_user) or None
        password = unquote(raw_password) if raw_password else None

    hosts_text, database = _split_once(hostpart, "/")
    if not hosts_text:
        raise InvalidConnectionStringError("a connection string must name at least one host")

    hosts: list[tuple[str, int | None]] = []
    for entry in hosts_text.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if entry.startswith("["):  # IPv6 literal: [::1]:27017
            close = entry.find("]")
            if close == -1:
                raise InvalidConnectionStringError("unterminated IPv6 host in the connection string")
            host = entry[: close + 1]
            port_text = entry[close + 1 :].lstrip(":")
        else:
            host, port_text = _split_once(entry, ":")
        port: int | None = None
        if port_text:
            if srv:
                raise InvalidConnectionStringError("a mongodb+srv:// connection string may not carry a port")
            try:
                port = int(port_text)
            except ValueError as exc:
                raise InvalidConnectionStringError(f"{port_text!r} is not a valid port") from exc
            if not 1 <= port <= 65535:
                raise InvalidConnectionStringError(f"port {port} is out of range")
        hosts.append((host, port))

    if not hosts:
        raise InvalidConnectionStringError("a connection string must name at least one host")

    options = {key: value for key, value in parse_qsl(query, keep_blank_values=False)}
    lowered = {key.lower(): value for key, value in options.items()}

    return {
        "srv": srv,
        "hosts": hosts,
        "host": hosts[0][0],
        "port": hosts[0][1],
        "username": username,
        "password": password,
        "database": unquote(database) or None,
        "auth_source": lowered.get("authsource"),
        "replica_set": lowered.get("replicaset"),
        "tls": _truthy(lowered.get("tls", lowered.get("ssl"))) or srv,
        "direct_connection": _truthy(lowered.get("directconnection")),
        "options": options,
    }


def _truthy(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"} if value is not None else False


def build_uri(
    host: str = DEFAULT_HOST,
    port: int | None = DEFAULT_PORT,
    username: str | None = None,
    password: str | None = None,
    database: str | None = None,
    auth_source: str | None = None,
    auth_mechanism: str | None = None,
    replica_set: str | None = None,
    tls: bool = False,
    srv: bool = False,
    direct_connection: bool = False,
    extra_options: dict[str, Any] | None = None,
) -> str:
    """Assemble a connection string from the fields of the login form."""
    clean_host = (host or "").strip() or DEFAULT_HOST
    if "://" in clean_host:
        raise InvalidConnectionStringError("host must be a hostname, not a full connection string")

    scheme = SCHEME_SRV if srv else SCHEME_STANDARD
    userinfo = ""
    if username:
        userinfo = quote(username, safe=_USERINFO_SAFE)
        if password:
            userinfo += ":" + quote(password, safe=_USERINFO_SAFE)
        userinfo += "@"

    authority = clean_host
    if not srv and port:
        if not 1 <= int(port) <= 65535:
            raise InvalidConnectionStringError(f"port {port} is out of range")
        # A comma-separated seed list already carries its own ports.
        if "," not in clean_host and ":" not in clean_host.rsplit("]", 1)[-1]:
            authority = f"{clean_host}:{int(port)}"

    options: dict[str, Any] = {}
    if auth_source:
        options["authSource"] = auth_source
    elif username:
        # Without this the driver authenticates against the browsing database,
        # which is almost never where the user account actually lives.
        options["authSource"] = database or "admin"
    if auth_mechanism:
        options["authMechanism"] = auth_mechanism
    if replica_set:
        options["replicaSet"] = replica_set
    if tls and not srv:
        options["tls"] = "true"
    if direct_connection:
        options["directConnection"] = "true"
    for key, value in (extra_options or {}).items():
        if value is not None and str(value) != "":
            options[key] = value

    path = f"/{quote(database, safe='')}" if database else "/"
    query = f"?{urlencode(options)}" if options else ""
    return f"{scheme}{userinfo}{authority}{path}{query}"


def redact_uri(uri: str) -> str:
    """Replace the password with '***' so a URI can be logged or displayed."""
    if not isinstance(uri, str) or "@" not in uri:
        return uri or ""
    scheme, separator, remainder = uri.partition("://")
    if not separator:
        return uri
    userinfo, _, rest = remainder.rpartition("@")
    if not userinfo:
        return uri
    user, colon, _password = userinfo.partition(":")
    masked = f"{user}:***" if colon else user
    return f"{scheme}://{masked}@{rest}"


def describe(profile_uri: str) -> str:
    """A short 'user@host:port' label for the UI, derived from the URI."""
    try:
        parts = parse_uri(profile_uri)
    except InvalidConnectionStringError:
        return redact_uri(profile_uri)
    host = parts["host"]
    if parts["port"]:
        host = f"{host}:{parts['port']}"
    return f"{parts['username']}@{host}" if parts["username"] else host
