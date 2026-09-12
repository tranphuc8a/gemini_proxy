// search.js - sidebar search box.
// Filters Collections by name/URL and History by method/URL; Sidebar decides
// which, based on the tab currently open.
(function (global) {
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function initSearch() {
    const input = document.getElementById('sidebarSearch');
    if (!input) return;

    const run = debounce(() => Sidebar.filter(input.value.trim().toLowerCase()), 180);
    input.addEventListener('input', run);

    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !input.value) return;
      // Escape clears the filter instead of bubbling up and closing a modal.
      e.stopPropagation();
      input.value = '';
      Sidebar.filter('');
    });
  }

  global.Search = { initSearch };
})(window);
