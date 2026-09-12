// env.js - {{VARIABLE}} substitution.
//
// The previous version substituted *into the form fields* the moment you picked
// an environment: it read `#url`, replaced `{{BASE}}` with its value and wrote
// the result back. That destroyed the template — switching from Local to Staging
// afterwards did nothing, because there was no `{{BASE}}` left to replace.
//
// Substitution now happens on the way out, at send time, and the form keeps the
// template forever. Storage lives in Storage so Export/Import sees it.
(function (global) {
  const VAR_PATTERN = /\{\{\s*([A-Za-z0-9_.\-]+)\s*\}\}/g;

  function listEnvironments() {
    return Storage.getEnvironments();
  }

  function getEnvironment(name) {
    return Storage.getEnvironment(name);
  }

  function upsertEnvironment(name, vars) {
    return Storage.upsertEnvironment(name, vars);
  }

  function deleteEnvironment(name) {
    Storage.deleteEnvironment(name);
  }

  function getActiveName() {
    return Storage.getSettings().activeEnvironment || '';
  }

  function setActiveName(name) {
    Storage.updateSettings({ activeEnvironment: name || '' });
  }

  /** Variables of the active environment, or {} when none is selected. */
  function activeVars() {
    const env = getEnvironment(getActiveName());
    return (env && env.vars) || {};
  }

  /**
   * Replace every {{NAME}} in `str` using `vars` (defaults to the active env).
   * Unknown names are left as-is so the user can see what is missing instead of
   * silently sending the literal text "undefined".
   */
  function resolve(str, vars) {
    if (typeof str !== 'string' || !str) return str;
    const table = vars || activeVars();
    return str.replace(VAR_PATTERN, (match, key) =>
      Object.prototype.hasOwnProperty.call(table, key) ? table[key] : match
    );
  }

  /** Resolve every key and value of a flat object. */
  function resolveObject(obj, vars) {
    const table = vars || activeVars();
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      out[resolve(k, table)] = resolve(String(v ?? ''), table);
    });
    return out;
  }

  /** Names used by `str` that the active environment cannot supply. */
  function findUnresolved(str, vars) {
    if (typeof str !== 'string' || !str) return [];
    const table = vars || activeVars();
    const missing = [];
    let match;
    VAR_PATTERN.lastIndex = 0;
    while ((match = VAR_PATTERN.exec(str)) !== null) {
      if (!Object.prototype.hasOwnProperty.call(table, match[1]) && !missing.includes(match[1])) {
        missing.push(match[1]);
      }
    }
    return missing;
  }

  /** Same, across a whole request spec, so the UI can warn before sending. */
  function findUnresolvedInSpec(spec, vars) {
    const table = vars || activeVars();
    const missing = new Set();
    const scan = (value) => findUnresolved(value, table).forEach(v => missing.add(v));

    scan(spec.url);
    scan(spec.body);
    [spec.headers, spec.params, spec.cookies].forEach(map => {
      Object.entries(map || {}).forEach(([k, v]) => { scan(k); scan(String(v ?? '')); });
    });
    Object.values(spec.auth || {}).forEach(v => scan(String(v ?? '')));
    return [...missing];
  }

  global.EnvManager = {
    listEnvironments,
    getEnvironment,
    upsertEnvironment,
    deleteEnvironment,
    getActiveName,
    setActiveName,
    activeVars,
    resolve,
    resolveObject,
    findUnresolved,
    findUnresolvedInSpec
  };
})(window);
