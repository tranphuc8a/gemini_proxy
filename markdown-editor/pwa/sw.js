/* ==========================================================================
   sw.js - Markdown Editor Pro keeps working with no network once installed.

   This file is a TEMPLATE. `scripts/make-sw.mjs` runs after `vite build`, fills in the two
   placeholders on the `var BUILD` and `var PRECACHE` lines below, and writes the result to dist/sw.js.
   Filling in the build id is what makes the browser see a new worker after every deploy (it compares
   sw.js byte for byte).

   It must sit at the ROOT of the app folder: a worker's scope is the folder that holds it.

   The invariant that matters most: the worker only touches GET requests below its own scope. The API
   (/api/v1/markdown/..., /api/v1/ai/...) lives outside it, and a server on another origin is ignored, so
   a stale saved copy can never be served for a sync call and then overwrite the shared store.
   Offline, API calls fail for real, which is what the editor expects.

   Strategy:
   * install   - save the page plus EVERY file the build emitted (js, css, woff2, icons). Mermaid, PDF
                 export and syntax highlighting are lazy chunks the page never lists, so saving only what
                 index.html mentions would leave those features dead offline. A file that an earlier build
                 already saved under the same (hashed) name is copied over, not downloaded again.
   * assets/*  - hashed and immutable: saved copy first, network only to fill a gap.
   * the rest  - network first, saved copy when offline or when the network hangs past NETWORK_WAIT_MS.
   ========================================================================== */
"use strict";

var BUILD = "__BUILD__";
var PRECACHE = __PRECACHE__;
var SCOPE = self.registration.scope;                       /* .../markdown-editor-pro/ */
var BASE_PATH = new URL(SCOPE).pathname;
var PREFIX = "mdpro:" + SCOPE + ":";
var CACHE = PREFIX + BUILD;
var READY = SCOPE + "__offline-ready.json";                 /* written last: its presence means "install finished" */
var NETWORK_WAIT_MS = 4000;

function keyOf(url) { return url.origin + url.pathname; }   /* ?import=1 and ?read=1 are the same page */

function precache() {
  return caches.open(CACHE).then(function (cache) {
    /* The page is re-fetched (not taken from the HTTP cache) so what we keep includes the config the server injects. */
    return fetch(new Request(SCOPE, { cache: "reload" })).then(function (res) {
      if (!res.ok) throw new Error("page: HTTP " + res.status);
      return cache.put(SCOPE, res);
    }).then(function () {
      var failed = 0;
      return Promise.all(PRECACHE.map(function (path) {
        var url = new URL(path, SCOPE).href;
        return caches.match(url).then(function (hit) {
          return hit || fetch(new Request(url, { cache: "reload" })).then(function (res) {
            if (!res.ok) throw new Error(path + ": HTTP " + res.status);
            return res;
          });
        }).then(function (res) { return cache.put(url, res); }).catch(function () { failed += 1; });
      })).then(function () {
        var body = JSON.stringify({ build: BUILD, files: PRECACHE.length, failed: failed });
        return cache.put(READY, new Response(body, { headers: { "Content-Type": "application/json" } }));
      });
    });
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(precache().then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return n.indexOf(PREFIX) === 0 && n !== CACHE; })   /* older builds of this app only */
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

function savedFirst(req, key) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (saved) {
      if (saved) return saved;
      return fetch(req).then(function (res) {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });
    });
  });
}

function networkFirst(req, key) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (saved) {
      var live = fetch(req, req.mode === "navigate" ? undefined : { cache: "no-cache" }).then(function (res) {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });
      if (!saved) return live;
      var giveUp = new Promise(function (resolve) { setTimeout(function () { resolve(saved); }, NETWORK_WAIT_MS); });
      /* a 5xx or a dead proxy gets the saved copy too, never an error page */
      return Promise.race([live.then(function (res) { return res.ok ? res : saved; }, function () { return saved; }), giveUp]);
    });
  });
}

function page(req, url) {
  return networkFirst(req, keyOf(url)).catch(function () {
    return caches.open(CACHE).then(function (cache) { return cache.match(SCOPE); }).then(function (res) {   /* e.g. .../index.html */
      return res || new Response(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<title>Offline</title><body style='font:16px/1.6 system-ui;padding:40px;max-width:520px;margin:auto'>" +
        "<h1>You are offline</h1><p>Markdown Editor Pro has not been saved on this device yet. " +
        "Connect once and reload the page.</p>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(BASE_PATH) !== 0) return;              /* outside the app (API...): the network decides */
  var rest = url.pathname.slice(BASE_PATH.length);
  if (rest === "sw.js") return;                                    /* the browser's own update check must see the real file */
  if (req.mode === "navigate") event.respondWith(page(req, url));
  else if (rest.indexOf("assets/") === 0) event.respondWith(savedFirst(req, keyOf(url)));
  else event.respondWith(networkFirst(req, keyOf(url)));
});
