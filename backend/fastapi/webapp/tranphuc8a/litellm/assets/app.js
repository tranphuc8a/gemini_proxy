(function () {
  "use strict";
  var L = window.LiteLLMStudioLogic;
  var $ = function (id) { return document.getElementById(id); };
  var config = window.__WEBAPP_CONFIG__ || {};
  var baseKey = "litellm.studio@" + location.origin + location.pathname;
  var apiBase = L.normalizeBase(config.apiBase || "");
  var models = [];
  var messages = [];
  var currentUserKey = "";
  var currentAdminToken = "";
  var busy = false;
  var toastTimer = 0;

  function safeStorage(kind, key, value) {
    try {
      var storage = kind === "local" ? window.localStorage : window.sessionStorage;
      if (arguments.length < 3) return storage.getItem(key);
      if (value == null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (e) {
      return null;
    }
    return value;
  }
  function userToken() {
    return currentUserKey || safeStorage("session", baseKey + ".user-key") ||
      safeStorage("local", baseKey + ".user-key") || "";
  }
  function adminToken() { return currentAdminToken || safeStorage("session", baseKey + ".admin-session") || ""; }
  function toast(text) {
    var el = $("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }
  function showStatus(text, connected) {
    $("status-text").textContent = text;
    $("top-status").classList.toggle("connected", !!connected);
  }
  function apiUrl(path) { return L.apiPath(apiBase, path); }
  function request(path, options) {
    var opts = options || {};
    opts.headers = Object.assign({ "Accept": "application/json" }, opts.headers || {});
    opts.cache = "no-store";
    opts.credentials = "same-origin";
    return fetch(apiUrl(path), opts).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var error = new Error(body.message || (body.data && body.data.message) || "Lỗi máy chủ (" + response.status + ")");
          error.code = (body.data && body.data.code) || body.code || "";
          error.status = response.status;
          throw error;
        }
        return body;
      });
    });
  }
  function userHeaders() {
    return { "Authorization": "Bearer " + userToken() };
  }
  function setApiBase(value) {
    apiBase = L.normalizeBase(value);
    safeStorage("session", baseKey + ".api-base", apiBase);
    refreshMcpConfig();
  }
  function setConnected(connected) {
    $("send-button").disabled = !connected || busy;
    $("prompt").disabled = !connected || busy;
    $("model-select").disabled = !connected || models.length === 0;
    $("clear-chat").disabled = busy;
  }
  function renderModels(items) {
    models = items.filter(function (item) {
      return item && typeof item.id === "string" && item.id.length <= 128;
    });
    var select = $("model-select");
    select.replaceChildren();
    if (!models.length) {
      select.add(new Option("Không có model được cấp quyền", ""));
      $("provider-pill").textContent = "Không có model";
      setConnected(false);
      return;
    }
    models.forEach(function (model) {
      select.add(new Option(model.label && model.label !== model.id ? model.label + " · " + model.id : model.id, model.id));
    });
    $("provider-pill").textContent = L.providerName(models[0].id);
    select.onchange = function () { $("provider-pill").textContent = L.providerName(select.value); };
    setConnected(true);
  }
  function setNote(text, kind) {
    var el = $("connection-note");
    el.textContent = text;
    el.className = "connection-note" + (kind ? " " + kind : "");
  }
  function connect() {
    var base = L.normalizeBase($("api-base").value);
    var key = $("user-key").value.trim();
    if (!base) { setNote("Nhập địa chỉ API của backend trước.", "error"); return; }
    if (!L.isSecureBase(base, location.href)) {
      setNote("Dùng HTTPS cho API; HTTP chỉ được phép với localhost. Không gửi virtual key qua kết nối không an toàn.", "error");
      return;
    }
    if (!key) { setNote("Nhập LiteLLM virtual key của bạn.", "error"); return; }
    setApiBase(base);
    $("connect-button").disabled = true;
    $("connect-button").textContent = "Đang kiểm tra…";
    setNote("Đang xác thực key và tải danh sách model…", "");
    fetch(apiUrl("litellm/models"), { headers: { "Accept": "application/json", "Authorization": "Bearer " + key }, cache: "no-store" })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error(body.message || "Không thể xác thực virtual key (" + response.status + ")");
          return body;
        });
      })
      .then(function (body) {
        if (!Array.isArray(body.models)) throw new Error("Máy chủ trả danh sách model không hợp lệ.");
        currentUserKey = key;
        safeStorage("session", baseKey + ".user-key", null);
        safeStorage("local", baseKey + ".user-key", null);
        var storage = $("remember-key").checked ? "local" : "session";
        var saved = safeStorage(storage, baseKey + ".user-key", key);
        $("user-key").value = key;
        renderModels(body.models);
        showStatus("Đã kết nối · " + body.models.length + " model", true);
        setNote(saved === null ? "Đã kết nối; trình duyệt chặn lưu trữ nên token chỉ giữ trong bộ nhớ tab này." :
          "Đã kết nối an toàn. Token được giữ " + ($("remember-key").checked ? "trên thiết bị này." : "trong phiên tab này."), "success");
        toast("Đã tải " + body.models.length + " model");
      })
      .catch(function (error) {
        models = [];
        setConnected(false);
        showStatus("Kết nối thất bại", false);
        setNote(error.message || "Không thể kết nối đến LiteLLM.", "error");
      })
      .finally(function () {
        $("connect-button").disabled = false;
        $("connect-button").textContent = "Kết nối & tải model";
      });
  }
  function renderMessages() {
    var box = $("messages");
    box.replaceChildren();
    if (!messages.length) {
      var welcome = document.createElement("div");
      welcome.className = "welcome";
      welcome.id = "welcome";
      welcome.innerHTML = '<span class="welcome-mark">✳</span><h2>Một không gian cho mọi model</h2><p>Kết nối bằng virtual key để trò chuyện với các model được cấp quyền — Gemini, GPT, Claude, DeepSeek và nhiều model khác.</p>';
      box.appendChild(welcome);
      return;
    }
    messages.forEach(function (item) {
      var bubble = document.createElement("div");
      bubble.className = "bubble " + (item.role === "user" ? "user" : "assistant") + (item.error ? " error" : "");
      bubble.textContent = item.content;
      box.appendChild(bubble);
    });
    box.scrollTop = box.scrollHeight;
  }
  function sendMessage(event) {
    event.preventDefault();
    var prompt = $("prompt").value.trim();
    var model = $("model-select").value;
    if (!prompt || !model || busy) return;
    messages.push({ role: "user", content: prompt });
    renderMessages();
    $("prompt").value = "";
    $("char-count").textContent = "0 / 12.000";
    busy = true;
    setConnected(true);
    $("send-button").disabled = true;
    $("send-button").textContent = "Đang trả lời…";
    var turns = messages.slice(-20).map(function (item) { return { role: item.role, content: item.content }; });
    request("litellm/chat", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, userHeaders()),
      body: JSON.stringify({ model: model, messages: turns })
    })
      .then(function (body) {
        messages.push({ role: "assistant", content: body.text || "(Model trả về câu trả lời rỗng)" });
      })
      .catch(function (error) {
        messages.push({ role: "assistant", content: error.message || "Không thể gọi model.", error: true });
        if (error.code === "litellm_key_rejected") {
          showStatus("Key không hợp lệ", false);
          setNote("Virtual key không hợp lệ hoặc hết quyền. Kiểm tra lại key với quản trị viên LiteLLM.", "error");
        }
      })
      .finally(function () {
        busy = false;
        $("send-button").innerHTML = "Gửi <span>↗</span>";
        setConnected(models.length > 0);
        renderMessages();
        $("prompt").focus();
      });
  }
  function refreshMcpConfig() {
    var url = "";
    try { url = new URL(apiUrl("mcp"), location.href).href; } catch (e) { url = apiUrl("mcp"); }
    $("mcp-url").textContent = url || "Nhập địa chỉ API để hiển thị endpoint";
    $("mcp-config").textContent = JSON.stringify(L.mcpConfig(url), null, 2);
  }
  function copyText(text, label) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) { toast("Trình duyệt không hỗ trợ sao chép tự động"); return; }
    navigator.clipboard.writeText(text).then(function () { toast(label + " đã sao chép"); }, function () { toast("Không thể sao chép — hãy chọn và sao chép thủ công"); });
  }
  function switchPage(name) {
    document.querySelectorAll(".nav-item").forEach(function (button) {
      button.classList.toggle("active", button.dataset.page === name);
    });
    document.querySelectorAll(".page").forEach(function (page) {
      var active = page.id === "page-" + name;
      page.classList.toggle("active", active);
      page.hidden = !active;
    });
    var titles = { chat: "Chat playground", mcp: "MCP server", keys: "Cấp virtual key" };
    $("page-title").textContent = titles[name] || titles.chat;
    if (name === "keys" && adminToken()) showKeyManager();
  }
  function showKeyManager() {
    $("admin-login").hidden = true;
    $("key-manager").hidden = false;
    loadAdminModels();
  }
  function loadAdminModels() {
    $("admin-model-count").textContent = "Đang tải…";
    request("litellm/admin/models", { headers: { "X-Admin-Session": adminToken() } })
      .then(function (body) { renderAdminModels(body.models || []); })
      .catch(function (error) {
        $("admin-model-count").textContent = error.message || "Không tải được model.";
        if (error.status === 403) {
          currentAdminToken = "";
          safeStorage("session", baseKey + ".admin-session", null);
          $("admin-login").hidden = false;
          $("key-manager").hidden = true;
        }
      });
  }
  function renderAdminModels(items) {
    var box = $("admin-models");
    box.replaceChildren();
    items.forEach(function (model) {
      if (!model || typeof model.id !== "string" || !model.id) return;
      var label = document.createElement("label");
      label.className = "model-option";
      var check = document.createElement("input");
      check.type = "checkbox";
      check.name = "allowed-model";
      check.value = model.id;
      var title = document.createElement("span");
      title.textContent = model.label && model.label !== model.id ? model.label + " · " + model.id : model.id;
      label.append(check, title);
      box.appendChild(label);
    });
    $("admin-model-count").textContent = items.length ? items.length + " model trên proxy" : "Proxy chưa cấu hình model.";
  }
  function adminLogin() {
    var key = $("admin-key").value.trim();
    if (!key) { $("admin-message").textContent = "Nhập khóa quản trị."; return; }
    $("admin-login-button").disabled = true;
    $("admin-message").textContent = "Đang xác thực…";
    fetch(apiUrl("courses/admin/verify"), {
      method: "POST",
      headers: { "X-Admin-Key": key, "Accept": "application/json" },
      cache: "no-store"
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.message || "Không xác thực được khóa quản trị.");
        return body;
      });
    }).then(function (body) {
      if (!body.session) throw new Error("Máy chủ không cấp phiên quản trị.");
      currentAdminToken = body.session;
      var saved = safeStorage("session", baseKey + ".admin-session", body.session);
      $("admin-key").value = "";
      $("admin-message").textContent = saved === null ?
        "Đã mở khóa; trình duyệt chặn lưu trữ nên phiên chỉ giữ trong bộ nhớ tab này." :
        "Đã mở khóa quản trị trong phiên tab này.";
      showKeyManager();
    }).catch(function (error) {
      $("admin-message").textContent = error.message;
    }).finally(function () { $("admin-login-button").disabled = false; });
  }
  function createKey(event) {
    event.preventDefault();
    var selected = Array.prototype.slice.call(document.querySelectorAll('input[name="allowed-model"]:checked'))
      .map(function (item) { return item.value; });
    if (!selected.length) { $("key-message").textContent = "Chọn ít nhất một model."; return; }
    var body = { alias: $("key-alias").value.trim(), models: selected, duration: $("key-duration").value };
    var budget = $("key-budget").value.trim();
    if (budget) body.maxBudget = Number(budget);
    $("create-key-button").disabled = true;
    $("key-message").textContent = "Đang tạo token…";
    $("issued-key").hidden = true;
    request("litellm/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Session": adminToken() },
      body: JSON.stringify(body)
    }).then(function (result) {
      $("issued-key-value").textContent = result.key;
      $("issued-key").hidden = false;
      $("key-message").textContent = "Đã tạo key " + result.alias + " cho " + result.models.length + " model.";
      $("key-alias").value = "";
      $("key-budget").value = "";
      document.querySelectorAll('input[name="allowed-model"]:checked').forEach(function (item) { item.checked = false; });
      $("issued-key").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }).catch(function (error) {
      $("key-message").textContent = error.message;
      if (error.status === 403) {
        currentAdminToken = "";
        safeStorage("session", baseKey + ".admin-session", null);
        $("admin-login").hidden = false;
        $("key-manager").hidden = true;
      }
    }).finally(function () { $("create-key-button").disabled = false; });
  }
  function start() {
    var savedBase = safeStorage("session", baseKey + ".api-base");
    if (savedBase) apiBase = L.normalizeBase(savedBase);
    $("api-base").value = apiBase;
    refreshMcpConfig();
    var savedKey = userToken();
    if (savedKey) {
      currentUserKey = savedKey;
      $("user-key").value = savedKey;
      $("remember-key").checked = !!safeStorage("local", baseKey + ".user-key");
      connect();
    }
    document.querySelectorAll(".nav-item").forEach(function (button) {
      button.addEventListener("click", function () { switchPage(button.dataset.page); });
    });
    $("api-base").addEventListener("change", function () { setApiBase($("api-base").value); });
    $("user-key").addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); connect(); }
    });
    $("toggle-key").addEventListener("click", function () {
      $("user-key").type = $("user-key").type === "password" ? "text" : "password";
    });
    $("connect-button").addEventListener("click", connect);
    $("chat-form").addEventListener("submit", sendMessage);
    $("prompt").addEventListener("input", function () {
      $("char-count").textContent = $("prompt").value.length.toLocaleString("vi-VN") + " / 12.000";
    });
    $("prompt").addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendMessage(event);
    });
    $("clear-chat").addEventListener("click", function () {
      messages = [];
      renderMessages();
    });
    $("copy-url").addEventListener("click", function () { copyText($("mcp-url").textContent, "Endpoint"); });
    $("copy-config").addEventListener("click", function () { copyText($("mcp-config").textContent, "Cấu hình MCP"); });
    $("admin-login-button").addEventListener("click", adminLogin);
    $("admin-key").addEventListener("keydown", function (event) { if (event.key === "Enter") adminLogin(); });
    $("reload-admin-models").addEventListener("click", loadAdminModels);
    $("admin-logout").addEventListener("click", function () {
      currentAdminToken = "";
      safeStorage("session", baseKey + ".admin-session", null);
      $("admin-login").hidden = false;
      $("key-manager").hidden = true;
      $("admin-message").textContent = "Đã khóa lại.";
    });
    $("key-form").addEventListener("submit", createKey);
    $("copy-issued-key").addEventListener("click", function () { copyText($("issued-key-value").textContent, "Virtual key"); });
  }
  start();
})();
