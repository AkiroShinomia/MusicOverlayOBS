(function registerThemeApi(root) {
  "use strict";

  const client = root.api.client;
  root.api.themes = Object.freeze({
    list: () => client.request("/api/themes", { cacheBust: true, cache: "no-store" }),
    create: payload => client.request("/api/themes/custom", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    }),
    update: (id, payload) => client.request(`/api/themes/custom/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    }),
    remove: id => client.request(`/api/themes/custom/${encodeURIComponent(id)}`, { method: "DELETE" })
  });
})(window.MusicOverlay);
