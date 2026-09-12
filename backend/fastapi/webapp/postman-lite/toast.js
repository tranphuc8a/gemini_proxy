// toast.js - non-blocking notifications.
// Replaces alert(): alert() freezes the page, cannot be stacked, and loses the
// user's scroll position in a long response.
(function (global) {
  const TIMEOUTS = { success: 2600, info: 3200, warn: 5200, error: 7000 };

  function container() {
    let el = document.getElementById('toastContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastContainer';
      el.className = 'toast-container';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function show(message, type = 'info', opts = {}) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const text = document.createElement('div');
    text.className = 'toast-text';
    text.textContent = message;
    el.appendChild(text);

    if (opts.actionLabel && typeof opts.onAction === 'function') {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', () => {
        opts.onAction();
        dismiss(el);
      });
      el.appendChild(btn);
    }

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.textContent = '×';
    close.title = 'Đóng';
    close.addEventListener('click', () => dismiss(el));
    el.appendChild(close);

    container().appendChild(el);
    const ms = opts.duration ?? TIMEOUTS[type] ?? 3200;
    if (ms > 0) setTimeout(() => dismiss(el), ms);
    return el;
  }

  function dismiss(el) {
    if (!el || !el.parentElement) return;
    el.classList.add('toast-leaving');
    setTimeout(() => el.remove(), 180);
  }

  /** Promise-based confirm so callers can `await` it without blocking the page. */
  function confirmDialog(message, { title = 'Xác nhận', danger = true, okLabel = 'Đồng ý' } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal active confirm-modal';
      overlay.innerHTML = `
        <div class="modal-content" style="min-width:340px;max-width:460px">
          <div class="modal-header"><h3></h3></div>
          <div class="modal-body"><p class="confirm-message"></p></div>
          <div class="modal-footer">
            <button class="btn-secondary" data-role="cancel">Hủy</button>
            <button class="${danger ? 'btn-danger' : 'btn-primary'}" data-role="ok"></button>
          </div>
        </div>`;
      overlay.querySelector('h3').textContent = title;
      overlay.querySelector('.confirm-message').textContent = message;
      overlay.querySelector('[data-role="ok"]').textContent = okLabel;

      const finish = (value) => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        resolve(value);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') finish(false);
        if (e.key === 'Enter') finish(true);
      };

      overlay.querySelector('[data-role="cancel"]').addEventListener('click', () => finish(false));
      overlay.querySelector('[data-role="ok"]').addEventListener('click', () => finish(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
      document.addEventListener('keydown', onKey);

      document.body.appendChild(overlay);
      overlay.querySelector('[data-role="ok"]').focus();
    });
  }

  global.Toast = {
    show,
    success: (m, o) => show(m, 'success', o),
    info: (m, o) => show(m, 'info', o),
    warn: (m, o) => show(m, 'warn', o),
    error: (m, o) => show(m, 'error', o),
    confirm: confirmDialog
  };
})(window);
