(function (root) {
  "use strict";
  function normalizeBase(value) { return String(value || "").trim().replace(/\/+$/, ""); }
  function apiPath(base, path) { return normalizeBase(base) + "/" + String(path || "").replace(/^\/+/, ""); }
  function isSecureBase(value, pageUrl) {
    try {
      var target = new URL(normalizeBase(value), pageUrl);
      var localHttp = target.protocol === "http:" &&
        (target.hostname === "localhost" || target.hostname === "127.0.0.1" || target.hostname === "[::1]");
      return (target.protocol === "https:" || localHttp) &&
        !target.username && !target.password && !target.search && !target.hash;
    } catch (e) {
      return false;
    }
  }
  function providerName(id) {
    var value = String(id || "").toLowerCase();
    if (/gemini|google/.test(value)) return "Google";
    if (/claude|anthropic/.test(value)) return "Anthropic";
    if (/deepseek/.test(value)) return "DeepSeek";
    if (/gpt|openai/.test(value)) return "OpenAI";
    if (/mistral/.test(value)) return "Mistral";
    if (/qwen|alibaba/.test(value)) return "Qwen";
    if (/hive/.test(value)) return "Hive";
    return "LiteLLM";
  }
  function mcpConfig(endpoint) {
    return {
      mcpServers: {
        litellm: {
          type: "http",
          url: endpoint,
          headers: { Authorization: "Bearer YOUR_LITELLM_VIRTUAL_KEY" }
        }
      }
    };
  }
  root.LiteLLMStudioLogic = {
    normalizeBase: normalizeBase,
    apiPath: apiPath,
    isSecureBase: isSecureBase,
    providerName: providerName,
    mcpConfig: mcpConfig
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.LiteLLMStudioLogic;
})(typeof globalThis !== "undefined" ? globalThis : this);
