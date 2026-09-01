(function registerSceneApi(root) {
  "use strict";

  const client = root.api.client;
  root.api.scenes = Object.freeze({
    getDraft: () => client.request("/api/scene/draft", { cacheBust: true, cache: "no-store" }),
    getSettings: () => client.request("/api/settings", { cacheBust: true, cache: "no-store" }),
    getTheme: path => client.request(path, { cacheBust: true, cache: "no-store" }),
    publish: payload => client.request("/api/scene/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  });
})(window.MusicOverlay);
