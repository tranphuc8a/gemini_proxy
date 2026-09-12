/**
 * Run the user's test script against a response.
 *
 * The script is arbitrary JavaScript the user typed, so it runs in a Web Worker
 * rather than on the page: a worker has no DOM, no localStorage and no access to
 * the app's state, and - the part that actually matters - an infinite loop in it
 * can be killed with `terminate()` instead of freezing the tab.
 *
 * The sandbox body lives in one string so the worker and the no-Worker fallback
 * cannot drift apart. The fallback exists for environments without workers
 * (jsdom under Vitest, and older embedded browsers); it is otherwise identical,
 * minus the ability to interrupt a runaway loop.
 */

import type { ResponseData, TestResult } from '../types'
import { decodeBytes } from './util'

export interface TestContext {
  status: number
  statusText: string
  timeMs: number
  sizeBytes: number
  headers: [string, string][]
  bodyText: string
  env: Record<string, string>
}

export interface TestRunOutcome {
  results: TestResult[]
  /** Variables the script assigned with `pm.environment.set(...)`. */
  envSets: Record<string, string>
  logs: string[]
  error?: string
}

/**
 * The sandbox, as source text.
 *
 * Defines `__run(script, ctx)` and nothing else. Kept deliberately dependency
 * free so it can be evaluated inside a worker built from a blob.
 */
export const SANDBOX_SOURCE = `
function __deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  var ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
    if (!__deepEqual(a[ka[i]], b[ka[i]])) return false;
  }
  return true;
}

function __show(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  try { return JSON.stringify(value); } catch (e) { return String(value); }
}

function __makeExpect(actual, negated) {
  function fail(message) {
    throw new Error('Kỳ vọng ' + __show(actual) + (negated ? ' KHÔNG ' : ' ') + message);
  }
  function check(ok, message) {
    if (negated ? ok : !ok) fail(message);
  }

  var assertions = {
    equal: function (expected) { check(actual === expected, 'bằng ' + __show(expected)); return assertions; },
    eql: function (expected) { check(__deepEqual(actual, expected), 'sâu bằng ' + __show(expected)); return assertions; },
    include: function (needle) {
      var ok = Array.isArray(actual)
        ? actual.some(function (item) { return __deepEqual(item, needle); })
        : typeof actual === 'string'
          ? actual.indexOf(String(needle)) > -1
          : actual && typeof actual === 'object'
            ? Object.values(actual).some(function (item) { return __deepEqual(item, needle); })
            : false;
      check(ok, 'chứa ' + __show(needle));
      return assertions;
    },
    match: function (pattern) { check(new RegExp(pattern).test(String(actual)), 'khớp ' + String(pattern)); return assertions; },
    above: function (limit) { check(Number(actual) > limit, 'lớn hơn ' + limit); return assertions; },
    below: function (limit) { check(Number(actual) < limit, 'nhỏ hơn ' + limit); return assertions; },
    least: function (limit) { check(Number(actual) >= limit, 'ít nhất ' + limit); return assertions; },
    most: function (limit) { check(Number(actual) <= limit, 'nhiều nhất ' + limit); return assertions; },
    a: function (type) { check(typeof actual === type, 'có kiểu ' + type); return assertions; },
    an: function (type) { return assertions.a(type); },
    property: function (name, value) {
      var has = actual != null && Object.prototype.hasOwnProperty.call(actual, name);
      check(has, 'có thuộc tính ' + __show(name));
      if (has && arguments.length > 1) check(__deepEqual(actual[name], value), 'có ' + name + ' = ' + __show(value));
      return assertions;
    },
    lengthOf: function (size) { check(actual != null && actual.length === size, 'có độ dài ' + size); return assertions; },
    empty: function () { check(!actual || actual.length === 0 || Object.keys(actual).length === 0, 'rỗng'); return assertions; }
  };

  Object.defineProperty(assertions, 'ok', { get: function () { check(Boolean(actual), 'là giá trị đúng'); return assertions; } });
  Object.defineProperty(assertions, 'true', { get: function () { check(actual === true, 'là true'); return assertions; } });
  Object.defineProperty(assertions, 'false', { get: function () { check(actual === false, 'là false'); return assertions; } });
  Object.defineProperty(assertions, 'null', { get: function () { check(actual === null, 'là null'); return assertions; } });
  Object.defineProperty(assertions, 'undefined', { get: function () { check(actual === undefined, 'là undefined'); return assertions; } });
  Object.defineProperty(assertions, 'exist', { get: function () { check(actual !== null && actual !== undefined, 'tồn tại'); return assertions; } });
  assertions.be = assertions;
  assertions.have = assertions;
  assertions.that = assertions;
  assertions.and = assertions;
  assertions.to = assertions;

  if (!negated) {
    Object.defineProperty(assertions, 'not', { get: function () { return __makeExpect(actual, true); } });
  }
  return assertions;
}

function __run(script, ctx) {
  var results = [];
  var envSets = {};
  var logs = [];
  var env = Object.assign({}, ctx.env);

  function header(name) {
    var wanted = String(name).toLowerCase();
    for (var i = 0; i < ctx.headers.length; i++) {
      if (String(ctx.headers[i][0]).toLowerCase() === wanted) return ctx.headers[i][1];
    }
    return undefined;
  }

  var response = {
    code: ctx.status,
    status: ctx.statusText,
    responseTime: ctx.timeMs,
    responseSize: ctx.sizeBytes,
    text: function () { return ctx.bodyText; },
    json: function () {
      try { return JSON.parse(ctx.bodyText); }
      catch (e) { throw new Error('Response body không phải JSON hợp lệ'); }
    },
    headers: { get: header, all: function () { return ctx.headers; } },
    to: {
      have: {
        status: function (expected) {
          if (ctx.status !== expected) throw new Error('Kỳ vọng status ' + expected + ' nhưng nhận ' + ctx.status);
        },
        header: function (name) {
          if (header(name) === undefined) throw new Error('Response không có header ' + name);
        }
      },
      be: {
        ok: function () {
          if (ctx.status < 200 || ctx.status >= 300) throw new Error('Kỳ vọng status 2xx nhưng nhận ' + ctx.status);
        }
      }
    }
  };

  var variables = {
    get: function (key) { return env[key]; },
    set: function (key, value) { envSets[String(key)] = String(value); env[String(key)] = String(value); },
    has: function (key) { return Object.prototype.hasOwnProperty.call(env, key); },
    unset: function (key) { delete env[String(key)]; }
  };

  var pm = {
    response: response,
    environment: variables,
    variables: variables,
    globals: variables,
    expect: function (value) { return __makeExpect(value, false); },
    test: function (name, fn) {
      try {
        fn();
        results.push({ name: String(name), passed: true });
      } catch (err) {
        results.push({ name: String(name), passed: false, error: (err && err.message) || String(err) });
      }
    }
  };

  var sandboxConsole = {
    log: function () { logs.push(Array.prototype.map.call(arguments, __show).join(' ')); },
    warn: function () { logs.push('[warn] ' + Array.prototype.map.call(arguments, __show).join(' ')); },
    error: function () { logs.push('[error] ' + Array.prototype.map.call(arguments, __show).join(' ')); }
  };

  try {
    new Function('pm', 'console', 'responseBody', 'responseCode', script)(
      pm, sandboxConsole, ctx.bodyText, { code: ctx.status, status: ctx.statusText }
    );
  } catch (err) {
    return { results: results, envSets: envSets, logs: logs, error: (err && err.message) || String(err) };
  }
  return { results: results, envSets: envSets, logs: logs };
}
`

const WORKER_SOURCE = `${SANDBOX_SOURCE}
self.onmessage = function (event) {
  try {
    self.postMessage({ ok: true, outcome: __run(event.data.script, event.data.ctx) });
  } catch (err) {
    self.postMessage({ ok: false, error: (err && err.message) || String(err) });
  }
};
`

export function buildContext(response: ResponseData, env: Record<string, string>): TestContext {
  return {
    status: response.status,
    statusText: response.statusText,
    timeMs: response.timeMs,
    sizeBytes: response.sizeBytes,
    headers: response.headers,
    bodyText: decodeBytes(response.bytes, response.contentType),
    env,
  }
}

/** Evaluate in-process. Used when Worker is unavailable, and by the tests. */
export function runTestsInline(script: string, ctx: TestContext): TestRunOutcome {
  const factory = new Function(`${SANDBOX_SOURCE}; return __run;`) as () => (
    script: string,
    ctx: TestContext,
  ) => TestRunOutcome
  return factory()(script, ctx)
}

let workerUrl: string | null = null

function getWorkerUrl(): string {
  if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }))
  return workerUrl
}

export const DEFAULT_TEST_TIMEOUT_MS = 4000

export async function runTests(
  script: string,
  ctx: TestContext,
  timeoutMs = DEFAULT_TEST_TIMEOUT_MS,
): Promise<TestRunOutcome> {
  if (!script.trim()) return { results: [], envSets: {}, logs: [] }

  if (typeof Worker === 'undefined') {
    return runTestsInline(script, ctx)
  }

  return new Promise<TestRunOutcome>((resolve) => {
    let worker: Worker
    try {
      worker = new Worker(getWorkerUrl())
    } catch {
      resolve(runTestsInline(script, ctx))
      return
    }

    const timer = setTimeout(() => {
      // The whole reason for the worker: a script stuck in a loop dies here
      // instead of taking the tab with it.
      worker.terminate()
      resolve({
        results: [],
        envSets: {},
        logs: [],
        error: `Test script chạy quá ${timeoutMs} ms và đã bị dừng (có vòng lặp vô hạn?)`,
      })
    }, timeoutMs)

    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timer)
      worker.terminate()
      const payload = event.data
      resolve(payload?.ok ? payload.outcome : { results: [], envSets: {}, logs: [], error: payload?.error ?? 'Lỗi không xác định' })
    }

    worker.onerror = (event) => {
      clearTimeout(timer)
      worker.terminate()
      resolve({ results: [], envSets: {}, logs: [], error: event.message || 'Test script lỗi' })
    }

    worker.postMessage({ script, ctx })
  })
}
