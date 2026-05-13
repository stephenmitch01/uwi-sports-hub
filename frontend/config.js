(function () {
  "use strict";

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const apiHost = window.location.hostname === "127.0.0.1" ? "127.0.0.1" : "localhost";
  const localApiBase = `http://${apiHost}:4000`;

  window.UWI_API_BASE =
    window.__UWI_API_BASE ||
    window.UWI_API_BASE ||
    (localHosts.has(window.location.hostname) ? localApiBase : "");
})();
