// search.js - sidebar search filtering
(function(global){
  function debounce(fn, ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; }
  function initSearch(){
    const input = document.getElementById('sidebarSearch');
    if(!input) return;
    input.addEventListener('input', debounce(()=>{
      const term = input.value.trim().toLowerCase();
      global.Sidebar.filter(term);
    }, 200));
  }
  global.Search = { initSearch };
})(window);
