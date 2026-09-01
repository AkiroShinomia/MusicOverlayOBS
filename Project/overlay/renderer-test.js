const { SceneRenderer, validateScene } = window.MusicOverlaySceneRenderer;
const registry = window.MusicOverlayComponentRegistry.createDefaultComponentRegistry();
const renderer = new SceneRenderer(document.getElementById("sceneMount"), { mode: "verification", registry });
const $ = id => document.getElementById(id);

let currentScene = null;
let playing = false;
let animationFrame = 0;
let startedAt = 0;
let startedTime = 0;

const sampleData = {
  title: "ULTRAKILL — Tenebre Rosso Sangue",
  artist: "The Divergent Composer",
  position: 64,
  duration: 241,
  thumbnail: "/assets/default-cover.png",
  audioBins: Array.from({ length: 128 }, (_, index) => Math.max(.03, Math.pow(Math.abs(Math.sin(index * .31) * Math.cos(index * .073)), .72)))
};

function themeScenePath(theme) {
  return theme.type === "custom"
    ? `/api/scene/theme/custom/${encodeURIComponent(theme.id.replace(/^custom\//, ""))}`
    : `/api/scene/theme/builtin/${encodeURIComponent(theme.id)}`;
}

async function readJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function populateSources() {
  const themes = await readJson("/api/themes");
  themes.forEach(theme => {
    const option = document.createElement("option");
    option.value = `theme:${theme.type}:${theme.id}`;
    option.textContent = `${theme.type === "custom" ? "Custom" : "Theme"} · ${theme.name}`;
    option.dataset.path = themeScenePath(theme);
    $("sceneSource").appendChild(option);
  });
}

function selectedSourcePath() {
  const option = $("sceneSource").selectedOptions[0];
  if (option.dataset.path) return option.dataset.path;
  if (option.value === "published") return "/api/scene/published";
  if (option.value === "default") return "/default.scene.json";
  return "/api/scene/draft";
}

function renderReport() {
  const diagnostics = renderer.getDiagnostics();
  $("rendererReport").textContent = JSON.stringify(diagnostics, null, 2);
  const tree = $("sceneTree");
  tree.textContent = "";
  renderer.inspect().forEach(item => {
    const row = document.createElement("li");
    row.style.setProperty("--depth", String(item.depth));
    row.className = item.visible ? "visible" : "hidden";
    if (diagnostics.unsupportedKinds.includes(item.kind)) row.classList.add("unsupported");
    row.textContent = `#${item.order + 1} z${item.zIndex} ${item.kind} · ${item.id}`;
    tree.appendChild(row);
  });
}

function setTime(value) {
  const duration = Number(currentScene?.timeline?.durationMs) || 30000;
  const time = Math.min(duration, Math.max(0, Number(value) || 0));
  $("sceneTime").value = String(time);
  $("sceneTimeLabel").textContent = `${(time / 1000).toFixed(3)}s`;
  renderer.setTime(time);
  renderReport();
}

async function loadSelectedScene() {
  stop();
  $("checkStatus").textContent = "Загрузка…";
  currentScene = $("sceneSource").value === "nested" ? createNestedFixture() : await readJson(selectedSourcePath());
  validateScene(currentScene);
  renderer.setScene(currentScene).setData(sampleData);
  const duration = Math.max(1000, Number(currentScene.timeline?.durationMs) || 30000);
  $("sceneTime").max = String(duration);
  setTime(0);
  $("checkStatus").textContent = `${currentScene.metadata?.name || currentScene.id} · ${currentScene.nodes.length} nodes · native geometry`;
}

function tick(now) {
  if (!playing) return;
  const duration = Number(currentScene?.timeline?.durationMs) || 30000;
  const time = Math.min(duration, startedTime + now - startedAt);
  setTime(time);
  if (time >= duration) stop(); else animationFrame = requestAnimationFrame(tick);
}

function play() {
  if (!currentScene || playing) return;
  playing = true;
  startedAt = performance.now();
  startedTime = Number($("sceneTime").value) || 0;
  if (startedTime >= Number($("sceneTime").max)) startedTime = 0;
  animationFrame = requestAnimationFrame(tick);
}

function stop() {
  playing = false;
  cancelAnimationFrame(animationFrame);
}

function verifyOrdering(scene) {
  const inspection = renderer.inspect();
  const byParent = new Map();
  inspection.forEach(item => {
    const key = item.parentId || "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  });
  byParent.forEach(siblings => {
    const ordered = [...siblings].sort((a, b) => a.order - b.order);
    for (let index = 1; index < ordered.length; index++) {
      if (ordered[index - 1].zIndex <= ordered[index].zIndex) throw new Error(`Z-order mismatch in ${scene.id}`);
    }
  });
}

function createNestedFixture() {
  const effects = [{ type: "opacity", enabled: true, value: 100 }];
  const animations = { in: { type: "fade", durationMs: 100, easing: "linear" }, out: { type: "fade", durationMs: 100, easing: "linear" } };
  const transform = (x, y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0, anchorX: .5, anchorY: .5 });
  return {
    schemaVersion: 2,
    documentType: "music-overlay.scene",
    id: "stage2a-nested-fixture",
    revision: 1,
    metadata: { name: "Nested fixture" },
    canvas: { width: 1920, height: 1080, backgroundColor: "#10223b" },
    timeline: { durationMs: 4000, restartOnPublish: true },
    appearance: { colors: { text: "#ffffff", background: "#16243a" } },
    nodes: [
      { id: "fixture-root", nodeType: "group", name: "Root", parentId: null, order: 0, visible: true, transform: transform(300, 200), timing: { startMs: 0, endMode: "fixed", durationMs: 3000 }, effects, animations, component: { kind: "group", properties: {} } },
      { id: "fixture-nested", nodeType: "group", name: "Nested", parentId: "fixture-root", order: 0, visible: true, transform: transform(100, 80), timing: { startMs: 500, endMode: "parentEnd", durationMs: null }, effects, animations, component: { kind: "group", properties: {} } },
      { id: "fixture-text", nodeType: "component", name: "Nested text", parentId: "fixture-nested", order: 0, visible: true, transform: transform(30, 30), timing: { startMs: 250, endMode: "parentEnd", durationMs: null }, effects, animations, component: { kind: "text", templateId: null, properties: { binding: "custom", text: "Nested group works", width: 360, fontSize: 32, color: "#74ff70" } } },
      { id: "fixture-block", nodeType: "component", name: "Nested block", parentId: "fixture-nested", order: 1, visible: true, transform: transform(0, 0), timing: { startMs: 0, endMode: "parentEnd", durationMs: null }, effects, animations, component: { kind: "block", templateId: null, properties: { width: 430, height: 100, borderRadius: 18, color: "#16243a" } } }
    ]
  };
}

async function runChecks() {
  stop();
  const status = $("checkStatus");
  status.textContent = "Проверка…";
  const themes = await readJson("/api/themes");
  const sources = [
    { name: "Draft", path: "/api/scene/draft" },
    { name: "Published", path: "/api/scene/published" },
    { name: "Default", path: "/default.scene.json" },
    { name: "Nested fixture", scene: createNestedFixture() },
    ...themes.map(theme => ({ name: theme.name, path: themeScenePath(theme) }))
  ];
  const failures = [];
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    status.textContent = `${index + 1}/${sources.length} · ${source.name}`;
    try {
      const scene = source.scene || await readJson(source.path);
      validateScene(scene);
      renderer.setScene(scene).setData(sampleData);
      const duration = Number(scene.timeline?.durationMs) || 30000;
      for (const time of [0, Math.min(1000, duration / 2), Math.max(0, duration - 1)]) renderer.setTime(time);
      verifyOrdering(scene);
      if (scene.id === "stage2a-nested-fixture") {
        const nested = renderer.inspect().find(item => item.id === "fixture-text");
        if (nested?.depth !== 2 || nested.window.startMs !== 750 || nested.window.endMs !== 3000) {
          throw new Error("Nested transform/timing contract failed");
        }
      }
      const diagnostics = renderer.getDiagnostics();
      if (diagnostics.errors.length || diagnostics.mountedNodes !== scene.nodes.length) throw new Error(JSON.stringify(diagnostics));
    } catch (error) {
      failures.push(`${source.name}: ${error.message}`);
    }
  }
  await loadSelectedScene();
  if (failures.length) {
    status.textContent = `FAIL · ${failures.length}/${sources.length}`;
    $("rendererReport").textContent = failures.join("\n");
  } else {
    status.textContent = `PASS · ${sources.length}/${sources.length} scenes`;
  }
}

$("sceneSource").addEventListener("change", () => loadSelectedScene().catch(showError));
$("reloadScene").addEventListener("click", () => loadSelectedScene().catch(showError));
$("playScene").addEventListener("click", play);
$("stopScene").addEventListener("click", () => { stop(); setTime(0); });
$("runChecks").addEventListener("click", () => runChecks().catch(showError));
$("sceneTime").addEventListener("input", event => { stop(); setTime(event.target.value); });
$("sceneScale").addEventListener("input", event => {
  $("sceneMount").style.transform = `scale(${Number(event.target.value) / 100})`;
});

function showError(error) {
  $("checkStatus").textContent = "FAIL";
  $("rendererReport").textContent = error?.stack || error?.message || String(error);
}

$("sceneMount").style.transform = `scale(${Number($("sceneScale").value) / 100})`;
populateSources().then(loadSelectedScene).catch(showError);
