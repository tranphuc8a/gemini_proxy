// env.js - environment variables management
(function(global){
  const KEY = 'postmanLite:environments';
  function load(){
    try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; }
  }
  function save(list){ localStorage.setItem(KEY, JSON.stringify(list)); }
  function upsertEnvironment(name, vars){
    let list = load();
    const idx = list.findIndex(e=>e.name===name);
    if(idx>-1) list[idx].vars = vars; else list.push({ name, vars });
    save(list);
    return list;
  }
  function deleteEnvironment(name){
    let list = load().filter(e=>e.name!==name);
    save(list); return list;
  }
  function getEnvironment(name){ return load().find(e=>e.name===name); }
  function listEnvironments(){ return load(); }

  function substitute(str, vars){
    if(!str) return str;
    return str.replace(/\{\{([A-Za-z0-9_\-]+)\}\}/g,(m,k)=> vars[k]!==undefined?vars[k]:m);
  }
  function applyEnvironmentToRequest(envName){
    const env = getEnvironment(envName); if(!env) return;
    const vars = env.vars||{};
    // URL
    const urlEl = document.getElementById('url');
    urlEl.value = substitute(urlEl.value, vars);
    // Headers
    document.querySelectorAll('#headersContainer .kv-pair').forEach(row=>{
      row.children[0].value = substitute(row.children[0].value, vars);
      row.children[1].value = substitute(row.children[1].value, vars);
    });
    // Params
    document.querySelectorAll('#paramsContainer .kv-pair').forEach(row=>{
      row.children[0].value = substitute(row.children[0].value, vars);
      row.children[1].value = substitute(row.children[1].value, vars);
    });
    // Body
    const bodyEl = document.getElementById('bodyContent');
    bodyEl.value = substitute(bodyEl.value, vars);
  }

  global.EnvManager = { upsertEnvironment, deleteEnvironment, listEnvironments, getEnvironment, applyEnvironmentToRequest };
})(window);
