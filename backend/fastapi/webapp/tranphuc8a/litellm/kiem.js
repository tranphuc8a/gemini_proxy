"use strict";

var logic = require("./assets/logic.js");
var failed = 0;
function kiem(name, condition) {
  var passed = typeof condition === "function" ? condition() : condition;
  console.log("  " + (passed ? "[ok]  " : "[SAI] ") + name);
  if (!passed) failed += 1;
}

kiem("normalizeBase trims trailing slashes", function () {
  return logic.normalizeBase(" https://api.example.com/api/v1/// ") === "https://api.example.com/api/v1";
});
kiem("apiPath preserves the configured API prefix", function () {
  return logic.apiPath("https://api.example.com/api/v1", "/mcp") === "https://api.example.com/api/v1/mcp";
});
kiem("API base requires HTTPS except for loopback development", function () {
  return logic.isSecureBase("https://api.example.com/api/v1", "https://studio.example") &&
    logic.isSecureBase("http://127.0.0.1:6789/api/v1", "file:///studio/index.html") &&
    !logic.isSecureBase("http://api.example.com/api/v1", "https://studio.example");
});
kiem("providerName recognizes supported providers", function () {
  return logic.providerName("claude-3-7-sonnet") === "Anthropic" &&
    logic.providerName("hive-deepseek-v4") === "DeepSeek";
});
kiem("MCP config uses an HTTP endpoint and personal bearer key", function () {
  var config = logic.mcpConfig("https://api.example.com/api/v1/mcp");
  return config.mcpServers.litellm.type === "http" &&
    config.mcpServers.litellm.url.endsWith("/mcp") &&
    config.mcpServers.litellm.headers.Authorization.indexOf("Bearer ") === 0;
});
if (failed) process.exit(1);
