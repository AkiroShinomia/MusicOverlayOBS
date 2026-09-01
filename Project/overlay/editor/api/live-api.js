(function registerLiveApi(root, global) {
  "use strict";

  const client = root.api.client;
  root.api.live = Object.freeze({
    getAudioLevel: () => client.request("/api/audiolevel", { cacheBust: true, cache: "no-store" }),
    getNowPlaying: () => client.request("/api/nowplaying", { cacheBust: true, cache: "no-store" }),
    connectEvents(handlers = {}) {
      const protocol = global.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${global.location.host}/ws`);
      if (handlers.open) socket.addEventListener("open", handlers.open);
      if (handlers.message) socket.addEventListener("message", handlers.message);
      if (handlers.close) socket.addEventListener("close", handlers.close);
      if (handlers.error) socket.addEventListener("error", handlers.error);
      return socket;
    }
  });
})(window.MusicOverlay, window);
