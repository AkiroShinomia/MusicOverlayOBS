(function registerI18n(root) {
  "use strict";

  function create(catalog, initialLanguage = "ru") {
    let language = initialLanguage;
    return Object.freeze({
      get language() { return language; },
      setLanguage(value) { language = value === "en" ? "en" : "ru"; return language; },
      text(key, fallback = key) { return catalog[key]?.[language] ?? catalog[key]?.ru ?? fallback; }
    });
  }

  root.core.i18n = Object.freeze({ create });
})(window.MusicOverlay);
