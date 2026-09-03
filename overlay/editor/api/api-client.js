(function registerApiClient(root) {
  "use strict";

  function withCacheBust(path) {
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}t=${Date.now()}`;
  }

  async function request(path, options = {}) {
    const { cacheBust = false, ...fetchOptions } = options;
    return fetch(cacheBust ? withCacheBust(path) : path, fetchOptions);
  }

  async function json(path, options = {}) {
    const response = await request(path, options);
    const payload = await response.json();
    return { response, payload };
  }

  root.api.client = Object.freeze({ request, json });
})(window.MusicOverlay);
