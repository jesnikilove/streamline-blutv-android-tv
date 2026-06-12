const videoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const gridLimit = 240;
const liveInitialLimit = 140;
const liveChunkSize = 180;
const guideInitialLimit = 80;
const guideChunkSize = 120;
const providerRefreshMs = 1000 * 60 * 60 * 6;
const providerCacheDbName = "StreamlineBluTV";
const providerCacheStore = "providerCache";
let hlsPlayer = null;
let guideRenderToken = 0;
let liveRenderToken = 0;
let cacheSaveTimer = null;
let searchRenderFrame = null;
let providerSessionReady = false;
let channelPreviewTimer = null;
let playbackRequestId = 0;
let backExitArmed = false;
let backExitTimer = null;

const libraryIndex = {
  channelCategoryMap: new Map(),
  smartCategoryMap: new Map(),
  channelCounts: new Map(),
  searchItems: []
};

const internationalCategoryTerms = [
  "africa", "arabic", "argentina", "asia", "australia", "balkan", "brazil", "caribbean", "chile", "colombia",
  "denmark", "dominican", "ecuador", "egypt", "france", "french", "germany", "greece", "haiti", "india",
  "ireland", "irish", "italy", "jamaica", "latino", "mexico", "middle east", "morocco", "pakistan", "philippines",
  "poland", "portugal", "portuguese", "romania", "russia", "spain", "spanish", "turkey", "uk ", "united kingdom",
  "venezuela", "vietnam"
];

const englishSpeakingCategoryTerms = [
  "united states", "usa", "us ", "uk ", "united kingdom", "canada", "ca ", "australia", "ireland", "irish",
  "caribbean", "jamaica"
];

const smartCategoryRules = [
  { name: "Pay-Per-View", special: "ppv" },
  { name: "US Channels", special: "us" },
  { name: "English Speaking", special: "english" },
  { name: "International", special: "international" },
  { name: "Women", terms: ["women", "woman", "her", "own", "lifetime", "we tv", "cleo"] },
  { name: "Christmas", terms: ["christmas", "holiday", "xmas", "santa", "hallmark"] },
  { name: "Crime", terms: ["crime", "investigation", "mystery", "court", "law", "justice", "forensic"] },
  { name: "Prime Crime", terms: [
    "prime crime", "crime stories", "true crime", "chicago p d", "chicago pd",
    "csi crime scene investigation", "csi cyber", "csi miami", "csi ny", "csi vegas",
    "law order", "law and order", "law order criminal intent", "law and order criminal intent",
    "law order organized crime", "law and order organized crime",
    "law order special victims unit", "law and order special victims unit", "svu",
    "law order toronto criminal intent", "law and order toronto criminal intent",
    "law order true crime", "law and order true crime"
  ] },
  { name: "Documentaries", terms: ["documentary", "docu", "history", "smithsonian", "nat geo", "discovery", "science"] },
  { name: "Music", terms: ["music", "mtv", "vh1", "radio", "hits", "jazz", "country"] },
  { name: "Local", terms: ["local", "abc ", "cbs ", "nbc ", "fox ", "cw ", "news 12", "sn1"] },
  { name: "Kids", terms: ["kids", "nick", "disney", "cartoon", "baby", "boomerang"] },
  { name: "Sports", terms: ["sports", "espn", "nfl", "nba", "mlb", "nhl", "tennis", "golf"] },
  { name: "Movies", terms: ["movie", "cinema", "film", "hbo", "starz", "showtime", "flix"] }
];

const state = {
  loginMode: "xtream",
  view: "live",
  category: "All Channels",
  selectedChannelId: "ch-1",
  movieCategory: "Featured",
  selectedMovieId: "mov-1",
  selectedSeriesId: "ser-1",
  favorites: new Set(JSON.parse(localStorage.getItem("streamlineFavorites") || "[]")),
  movieSortAsc: true,
  usingProviderData: false,
  currentMedia: null,
  captionsOn: false,
  wideMode: false,
  controlsTimer: null,
  seekTimer: null
};

let data = {
  categories: ["All Channels", "Entertainment", "News", "Sports", "Kids", "Movies", "24/7", "Faith", "Local"],
  channels: [
    channel("ch-1", "Blu Cinema HD", "Movies", "The Night Premiere", "A feature presentation with surround sound.", "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80"),
    channel("ch-2", "Prime Crime", "Entertainment", "Case Files", "Investigations, courtroom drama, and true crime blocks.", "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1200&q=80"),
    channel("ch-3", "Global News Now", "News", "World Desk", "Headlines, business, and weather every half hour.", "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80"),
    channel("ch-4", "Sunday Faith Network", "Faith", "Morning Service", "Family programming, worship, and inspirational talk.", "https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1200&q=80"),
    channel("ch-5", "Game Day Central", "Sports", "Pregame Live", "Scores, highlights, and live sports coverage.", "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80"),
    channel("ch-6", "Kids Planet", "Kids", "Cartoon Hour", "Animated series and family-safe weekend specials.", "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=80"),
    channel("ch-7", "24/7 Halloween", "24/7", "Halloween Marathon", "Back-to-back seasonal movie chapters.", "https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=1200&q=80"),
    channel("ch-8", "Local Carolina 7", "Local", "Evening Update", "Local news, weather, and community coverage.", "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80")
  ],
  movieTabs: ["Featured", "New Releases", "Action", "Family", "Holiday", "Horror", "Drama"],
  movies: [
    movie("mov-1", "Halloween Chapter One", "Holiday", 1978, "https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=600&q=80"),
    movie("mov-2", "Halloween Chapter Two", "Holiday", 1981, "https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=601&q=80"),
    movie("mov-3", "City of Heroes", "Action", 2026, "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=600&q=80"),
    movie("mov-4", "The Family Cabin", "Family", 2025, "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&q=80"),
    movie("mov-5", "Night Signal", "Horror", 2026, "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80"),
    movie("mov-6", "A December Promise", "Holiday", 2024, "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=600&q=80"),
    movie("mov-7", "Blue River", "Drama", 2023, "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80"),
    movie("mov-8", "Fast Lane Rescue", "Action", 2025, "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80")
  ],
  series: [
    series("ser-1", "Law & Order: Special Victims Unit", "Crime", 26, "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=600&q=80"),
    series("ser-2", "Prime Crime Stories", "Crime", 6, "https://images.unsplash.com/photo-1589578228447-e1a4e481c6c8?auto=format&fit=crop&w=600&q=80"),
    series("ser-3", "Faith Road", "Faith", 4, "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=600&q=80"),
    series("ser-4", "Carolina Kitchen", "Lifestyle", 3, "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80")
  ]
};

function channel(id, name, category, program, description, image) {
  return {
    id,
    name,
    category,
    program,
    description,
    image,
    guide: [
      { time: "7:00 PM", title: program },
      { time: "7:30 PM", title: category + " Tonight" },
      { time: "8:00 PM", title: "Streamline Spotlight" },
      { time: "9:00 PM", title: "Next Up Live" }
    ]
  };
}

function movie(id, title, category, year, image) {
  return { id, title, category, year, image, type: "Movie", streamUrl: videoUrl };
}

function series(id, title, category, seasons, image) {
  const seasonList = [];
  for (let s = 1; s <= Math.min(seasons, 6); s += 1) {
    const episodes = [];
    for (let e = 1; e <= 5; e += 1) {
      episodes.push({ season: s, episode: e, title: `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")} - Episode ${e}`, streamUrl: videoUrl });
    }
    seasonList.push({ season: s, episodes });
  }
  return { id, title, category, seasons, image, type: "Series", seasonList };
}

const $ = (id) => document.getElementById(id);

function init() {
  document.body.classList.toggle("tv-app", isTvApp());
  installTvDebugLogging();
  installBackHandler();
  const hasSyncCache = loadCachedProviderLibrary();
  bindLogin();
  renderPlaylistProfiles();
  bindNavigation();
  bindActions();
  renderAll();
  updateClock();
  setInterval(updateClock, 1000 * 30);

  if (localStorage.getItem("streamlineLoggedIn") === "true") {
    showHome();
    restoreSavedProviderSession();
  } else {
    $("loginButton").focus();
  }
  if (!hasSyncCache) hydrateLargeProviderCache();
}

function installTvDebugLogging() {
  if (!isTvApp()) return;
  window.addEventListener("error", (event) => {
    logTvDebug("window-error", { message: event.message, source: event.filename, line: event.lineno, column: event.colno });
  });
  window.addEventListener("unhandledrejection", (event) => {
    logTvDebug("promise-error", { message: event.reason?.message || String(event.reason || "") });
  });
}

function logTvDebug(event, details = {}) {
  if (!isTvApp()) return;
  const player = $("videoPlayer");
  const payload = {
    event,
    url: location.href,
    view: state.view,
    currentMedia: state.currentMedia,
    playState: $("playState")?.textContent,
    video: player ? {
      src: player.currentSrc || player.src || "",
      readyState: player.readyState,
      networkState: player.networkState,
      paused: player.paused,
      currentTime: player.currentTime,
      videoWidth: player.videoWidth,
      videoHeight: player.videoHeight,
      error: player.error ? { code: player.error.code, message: player.error.message } : null
    } : null,
    details
  };
  fetch("/api/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function installBackHandler() {
  window.streamlineHandleDeviceBack = () => handleAppBack();
  if (!isTvApp()) return;
  try {
    window.history.replaceState({ streamline: true }, "", window.location.href);
    window.history.pushState({ streamline: true, guard: true }, "", window.location.href);
    window.addEventListener("popstate", () => {
      const shouldExit = handleAppBack();
      if (!shouldExit) window.history.pushState({ streamline: true, guard: true }, "", window.location.href);
    });
  } catch (_error) {
    // Browser history is best-effort for TV remotes.
  }
}

function loadCachedProviderLibrary() {
  const cache = localStorage.getItem("streamlineProviderCache");
  if (!cache) {
    rebuildLibraryIndex();
    return false;
  }
  try {
    const parsed = JSON.parse(cache);
    if (!parsed.library && parsed.savedAt) {
      rebuildLibraryIndex();
      return false;
    }
    data = parsed.library || parsed;
    prepareProviderLibrary(data);
    state.usingProviderData = true;
    selectFirstAvailableItems();
    return true;
  } catch (_error) {
    localStorage.removeItem("streamlineProviderCache");
    rebuildLibraryIndex();
    return false;
  }
}

function cachedProviderMeta() {
  try {
    const parsed = JSON.parse(localStorage.getItem("streamlineProviderCacheMeta") || localStorage.getItem("streamlineProviderCache") || "{}");
    return { savedAt: Number(parsed.savedAt || 0) };
  } catch (_error) {
    return { savedAt: 0 };
  }
}

async function hydrateLargeProviderCache() {
  if (!("indexedDB" in window)) return false;
  try {
    const record = await readProviderCacheRecord();
    if (!record?.library) return false;
    data = record.library;
    prepareProviderLibrary(data);
    state.usingProviderData = true;
    selectFirstAvailableItems();
    updateCacheInfo();
    if (localStorage.getItem("streamlineLoggedIn") === "true") {
      showHome();
      restoreSavedProviderSession();
    } else {
      renderAll();
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function isTvApp() {
  return new URLSearchParams(window.location.search).get("tvApp") === "1"
    || navigator.userAgent.includes("StreamlineBluTVApp");
}

async function restoreSavedProviderSession() {
  const payloadText = savedProviderPayloadText();
  if (!payloadText || !state.usingProviderData) return;
  const meta = cachedProviderMeta();
  if (Date.now() - Number(meta.savedAt || 0) < providerRefreshMs) {
    warmProviderSession(JSON.parse(payloadText))
      .then(() => playSelectedChannel(false))
      .catch(() => {});
    updateCacheInfo();
    return;
  }
  try {
    await refreshProviderCatalog(JSON.parse(payloadText), { quiet: true });
  } catch (_error) {
    updateCacheInfo("Saved library ready. Provider refresh will try again later.");
  }
}

function savedProviderPayloadText() {
  return sessionStorage.getItem("streamlineLastProviderPayload") || localStorage.getItem("streamlineRememberedProviderPayload");
}

async function ensureProviderSessionReady() {
  if (!state.usingProviderData || providerSessionReady) return true;
  const payloadText = savedProviderPayloadText();
  if (!payloadText) return false;
  await warmProviderSession(JSON.parse(payloadText));
  return true;
}

async function warmProviderSession(payload) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const parsed = await response.json().catch(() => ({}));
  if (!response.ok || !parsed.ok) throw new Error(parsed.message || "Provider session failed.");
  providerSessionReady = true;
  return parsed.data;
}

function bindLogin() {
  document.querySelectorAll("[data-login-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setLoginMode(btn.dataset.loginMode));
  });
  restoreRememberedLoginForm();
  $("loginButton").addEventListener("click", loginWithProvider);
  $("settingsLoginButton").addEventListener("click", loginWithProvider);
  $("settingsCancelLogin").addEventListener("click", hideSettingsLoginPanel);
  $("savePlaylistButton").addEventListener("click", savePlaylistProfile);
  $("loadPlaylistButton").addEventListener("click", loadSelectedPlaylistProfile);
  $("deletePlaylistButton").addEventListener("click", deleteSelectedPlaylistProfile);
  $("demoButton").addEventListener("click", () => {
    localStorage.setItem("streamlineProviderName", "Demo Provider");
    localStorage.setItem("streamlineLoggedIn", "true");
    state.usingProviderData = false;
    showHome();
  });
}

function setLoginMode(mode) {
  state.loginMode = mode;
  document.querySelectorAll("[data-login-mode]").forEach((btn) => btn.classList.toggle("active", btn.dataset.loginMode === mode));
  $("xtreamForm").classList.toggle("hidden", mode !== "xtream");
  $("m3uForm").classList.toggle("hidden", mode !== "m3u");
  $("settingsXtreamForm").classList.toggle("hidden", mode !== "xtream");
  $("settingsM3uForm").classList.toggle("hidden", mode !== "m3u");
}

function getProviderPayload() {
  const inSettings = isSettingsLoginOpen();
  return state.loginMode === "xtream"
    ? {
        mode: "xtream",
        server: $(inSettings ? "settingsServerInput" : "serverInput").value.trim(),
        username: $(inSettings ? "settingsUsernameInput" : "usernameInput").value.trim(),
        password: $(inSettings ? "settingsPasswordInput" : "passwordInput").value.trim()
      }
    : {
        mode: "m3u",
        playlistUrl: $(inSettings ? "settingsPlaylistInput" : "playlistInput").value.trim()
      };
}

function saveLogin(payload) {
  const provider = payload
    ? payload.server || payload.playlistUrl
    : state.loginMode === "xtream" ? $("serverInput").value.trim() : $("playlistInput").value.trim();
  localStorage.setItem("streamlineProviderName", provider || "Demo Provider");
  localStorage.setItem("streamlineLoginMode", payload?.mode || state.loginMode);
  localStorage.setItem("streamlineLoggedIn", "true");
  if (payload) localStorage.setItem("streamlineRememberedProviderPayload", JSON.stringify(payload));
}

function restoreRememberedLoginForm() {
  const payloadText = localStorage.getItem("streamlineRememberedProviderPayload");
  if (!payloadText) return;
  try {
    applyPlaylistProfile({ name: "Remembered Login", payload: JSON.parse(payloadText) });
  } catch (_error) {
    localStorage.removeItem("streamlineRememberedProviderPayload");
  }
}

async function loginWithProvider() {
  setLoginStatus("Loading provider data...");
  setLoginButtonsDisabled(true);
  try {
    const payload = getProviderPayload();

    sessionStorage.setItem("streamlineLastProviderPayload", JSON.stringify(payload));
    await loadProviderCatalog(payload);
    setLoginStatus("Provider loaded.");
    if (isSettingsLoginOpen()) {
      hideSettingsLoginPanel();
      setView("live");
    } else {
      showHome();
    }
  } catch (error) {
    setLoginStatus(error.message || "Could not load provider.");
  } finally {
    setLoginButtonsDisabled(false);
  }
}

function setLoginButtonsDisabled(disabled) {
  $("loginButton").disabled = disabled;
  $("settingsLoginButton").disabled = disabled;
}

function playlistProfiles() {
  try {
    return JSON.parse(sessionStorage.getItem("streamlinePlaylistProfiles") || "[]");
  } catch (_error) {
    return [];
  }
}

function writePlaylistProfiles(profiles) {
  sessionStorage.setItem("streamlinePlaylistProfiles", JSON.stringify(profiles));
  renderPlaylistProfiles();
}

function renderPlaylistProfiles() {
  const select = $("playlistProfileSelect");
  if (!select) return;
  const profiles = playlistProfiles();
  select.innerHTML = profiles.length
    ? profiles.map((profile, index) => `<option value="${index}">${profile.name}</option>`).join("")
    : `<option value="">No saved playlists</option>`;
}

function savePlaylistProfile() {
  const payload = getProviderPayload();
  const name = $("playlistNameInput").value.trim() || payload.server || payload.playlistUrl || "Playlist";
  const profiles = playlistProfiles();
  const existingIndex = profiles.findIndex((profile) => profile.name.toLowerCase() === name.toLowerCase());
  const profile = { name, payload, updatedAt: Date.now() };
  if (existingIndex >= 0) profiles[existingIndex] = profile;
  else profiles.push(profile);
  writePlaylistProfiles(profiles);
  $("playlistProfileSelect").value = String(existingIndex >= 0 ? existingIndex : profiles.length - 1);
  setLoginStatus(`Added ${name} for this session.`);
}

function loadSelectedPlaylistProfile() {
  const profiles = playlistProfiles();
  const profile = profiles[Number($("playlistProfileSelect").value)];
  if (!profile) {
    setLoginStatus("No playlist selected.");
    return;
  }
  applyPlaylistProfile(profile);
  setLoginStatus(`Loaded ${profile.name}. Press Continue to watch.`);
}

function deleteSelectedPlaylistProfile() {
  const profiles = playlistProfiles();
  const index = Number($("playlistProfileSelect").value);
  if (!profiles[index]) {
    setLoginStatus("No playlist selected.");
    return;
  }
  const [removed] = profiles.splice(index, 1);
  writePlaylistProfiles(profiles);
  setLoginStatus(`Removed ${removed.name}.`);
}

function applyPlaylistProfile(profile) {
  const payload = profile.payload || {};
  $("playlistNameInput").value = profile.name || "My Playlist";
  setLoginMode(payload.mode || "xtream");
  if (payload.mode === "m3u") {
    $("playlistInput").value = payload.playlistUrl || "";
    $("settingsPlaylistInput").value = payload.playlistUrl || "";
  } else {
    $("serverInput").value = payload.server || "";
    $("usernameInput").value = payload.username || "";
    $("passwordInput").value = payload.password || "";
    $("settingsServerInput").value = payload.server || "";
    $("settingsUsernameInput").value = payload.username || "";
    $("settingsPasswordInput").value = payload.password || "";
  }
}

async function loadProviderCatalog(payload) {
  return refreshProviderCatalog(payload, { quiet: false });
}

async function refreshProviderCatalog(payload, options = {}) {
  const quiet = !!options.quiet;
  const response = await fetch("/api/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
  });
  const parsed = await response.json();
  if (!response.ok || !parsed.ok) throw new Error(parsed.message || "Provider login failed.");

  data = parsed.data;
  state.usingProviderData = true;
  providerSessionReady = true;
  prepareProviderLibrary(data);
  selectFirstAvailableItems();
  saveLogin(payload);
  persistProviderCache(parsed.data);
  updateCacheInfo();
  if (quiet) renderCurrentView();
  return parsed.data;
}

function prepareProviderLibrary(library) {
  library.channels = library.channels || [];
  library.movies = sortMoviesForPlayback(library.movies || []);
  library.series = library.series || [];
  repairChannelGuides(library.channels);
  library.categories = buildLiveCategories(library.channels, library.categories || []);
  library.movieTabs = library.movieTabs?.length ? library.movieTabs : ["Featured"];
  rebuildLibraryIndex();
}

function selectFirstAvailableItems() {
  state.category = data.categories.includes(state.category) ? state.category : data.categories[0] || "All Channels";
  state.selectedChannelId = data.channels.some((item) => item.id === state.selectedChannelId) ? state.selectedChannelId : data.channels[0]?.id || "";
  state.movieCategory = data.movieTabs.includes(state.movieCategory) ? state.movieCategory : data.movieTabs[0] || "Featured";
  state.selectedMovieId = data.movies.some((item) => item.id === state.selectedMovieId) ? state.selectedMovieId : data.movies[0]?.id || "";
  state.selectedSeriesId = data.series.some((item) => item.id === state.selectedSeriesId) ? state.selectedSeriesId : data.series[0]?.id || "";
}

function persistProviderCache(library) {
  const record = { savedAt: Date.now(), library };
  try {
    localStorage.setItem("streamlineProviderCacheMeta", JSON.stringify({ savedAt: record.savedAt }));
    localStorage.setItem("streamlineProviderCache", JSON.stringify({ savedAt: record.savedAt }));
  } catch (_error) {
    localStorage.removeItem("streamlineProviderCache");
  }
  writeProviderCacheRecord(record).catch(() => {
    toast("Full catalog loaded for this session. It may refresh again after restart.");
  });
}

function openProviderCacheDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Large local cache is not supported."));
      return;
    }
    const request = indexedDB.open(providerCacheDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(providerCacheStore)) db.createObjectStore(providerCacheStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local cache failed."));
  });
}

async function readProviderCacheRecord() {
  const db = await openProviderCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(providerCacheStore, "readonly");
    const store = tx.objectStore(providerCacheStore);
    const request = store.get("catalog");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local cache read failed."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Local cache read failed."));
    };
  });
}

async function writeProviderCacheRecord(record) {
  const db = await openProviderCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(providerCacheStore, "readwrite");
    const store = tx.objectStore(providerCacheStore);
    const request = store.put(record, "catalog");
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("Local cache save failed."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Local cache save failed."));
    };
  });
}

function persistProviderCacheSoon() {
  clearTimeout(cacheSaveTimer);
  cacheSaveTimer = setTimeout(() => {
    if (state.usingProviderData) persistProviderCache(data);
  }, 1200);
}

async function clearProviderCacheRecord() {
  const db = await openProviderCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(providerCacheStore, "readwrite");
    const store = tx.objectStore(providerCacheStore);
    const request = store.delete("catalog");
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("Local cache clear failed."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Local cache clear failed."));
    };
  });
}

function rebuildLibraryIndex() {
  libraryIndex.channelCategoryMap = new Map();
  libraryIndex.smartCategoryMap = new Map();
  libraryIndex.channelCounts = new Map();

  data.channels.forEach((ch) => {
    const category = ch.category || "Live TV";
    if (!libraryIndex.channelCategoryMap.has(category)) libraryIndex.channelCategoryMap.set(category, []);
    libraryIndex.channelCategoryMap.get(category).push(ch);
  });

  data.categories.forEach((cat) => {
    const channels = channelsForCategoryUncached(cat);
    libraryIndex.channelCounts.set(cat, channels.length);
    if (smartCategoryRules.some((rule) => rule.name === cat)) libraryIndex.smartCategoryMap.set(cat, channels);
  });

  libraryIndex.searchItems = [
    ...data.channels.map((item) => ({ title: item.name, subtitle: item.program, type: "Channel", image: item.image, item, searchText: normalizeSearch(`${item.name} ${item.program} ${item.category} Channel`) })),
    ...data.movies.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.year || ""}`, type: "Movie", image: item.image, item, searchText: normalizeSearch(`${item.title} ${item.category} ${item.year || ""} Movie`) })),
    ...data.series.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.seasons} seasons`, type: "Series", image: item.image, item, searchText: normalizeSearch(`${item.title} ${item.category} ${item.seasons} Series`) }))
  ];
}

function sortMoviesForPlayback(movies) {
  return [...movies].sort((a, b) => {
    const titleCompare = normalizeMovieTitle(a.title).localeCompare(normalizeMovieTitle(b.title));
    if (titleCompare !== 0) return titleCompare;
    return containerRank(a) - containerRank(b);
  });
}

function normalizeMovieTitle(title) {
  return normalizeSearch(title);
}

function containerRank(movie) {
  const source = `${movie.container || ""} ${movie.streamUrl || ""}`.toLowerCase();
  if (source.includes(".mp4") || source.includes("mp4")) return 0;
  if (source.includes(".m3u8")) return 1;
  if (source.includes(".mkv") || source.includes("mkv")) return 3;
  return 2;
}

function buildLiveCategories(channels, existingCategories) {
  const categories = ["All Channels"];
  smartCategoryRules.forEach((rule) => {
    if (!categories.includes(rule.name) && channels.some((ch) => matchesSmartCategory(ch, rule))) {
      categories.push(rule.name);
    }
  });
  existingCategories.forEach((cat) => {
    if (cat === "All Channels" || categories.includes(cat) || isHiddenProviderCategory(cat)) return;
    if (channels.some((ch) => ch.category === cat)) categories.push(cat);
  });
  return categories;
}

function repairChannelGuides(channels) {
  channels.forEach((ch) => {
    if (!ch.guide?.length || isGenericGuide(ch.guide)) {
      ch.guide = fallbackGuideForChannel(ch);
      ch.program = ch.program && ch.program !== "Live now" ? ch.program : ch.guide[0].title;
      ch.description = ch.description || ch.name;
    }
  });
}

function isGenericGuide(guide) {
  const titles = guide.map((item) => item.title).join(" ").toLowerCase();
  return titles.includes("up next") || titles.includes("prime block") || titles.includes("late night") || titles === "live now";
}

function fallbackGuideForChannel(ch) {
  const title = ch.program && ch.program !== "Live now" ? ch.program : ch.name;
  const category = ch.category || "Live TV";
  return [
    { time: "Now", title },
    { time: "Next", title: `${title} continues` },
    { time: "Later", title: `${category} programming` },
    { time: "Tonight", title }
  ];
}

function setLoginStatus(message) {
  const status = $("loginStatus");
  if (status) status.textContent = message;
  const settingsStatus = $("settingsLoginStatus");
  if (settingsStatus) settingsStatus.textContent = message;
}

function isSettingsLoginOpen() {
  return !$("settingsLoginPanel")?.classList.contains("hidden");
}

function showSettingsLoginPanel() {
  restoreRememberedLoginForm();
  $("settingsLoginPanel").classList.remove("hidden");
  $("sectionKicker").textContent = "Settings";
  $("sectionTitle").textContent = "Provider Login";
  setLoginStatus("");
  setTimeout(() => {
    const target = state.loginMode === "m3u" ? $("settingsPlaylistInput") : $("settingsServerInput");
    target.focus();
  }, 0);
}

function hideSettingsLoginPanel() {
  $("settingsLoginPanel").classList.add("hidden");
  $("sectionKicker").textContent = labelForView("settings");
  $("sectionTitle").textContent = titleForView("settings");
  setLoginStatus("");
  $("changeLogin").focus();
}

function showHome() {
  $("loginScreen").classList.add("hidden");
  $("homeScreen").classList.remove("hidden");
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  $("settingsProvider").textContent = localStorage.getItem("streamlineProviderName") || "Demo Provider";
  updateCacheInfo();
  setView("live");
  if (!state.usingProviderData || providerSessionReady) playSelectedChannel(false);
  document.querySelector(".nav-item.active").focus();
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  document.addEventListener("keydown", (event) => {
    if ($("homeScreen").classList.contains("hidden")) return;
    if (isTypingField(document.activeElement)) return;
    if (handlePlayerKeys(event)) return;
    if (handleTvFocusKeys(event)) return;
    if (event.key === "Backspace" || event.key === "Escape") {
      event.preventDefault();
      handleAppBack();
      return;
    }
    if (event.key === "Enter" && document.activeElement?.classList.contains("poster-card")) {
      document.activeElement.click();
    }
  });
}

function handleAppBack() {
  if (!$("homeScreen") || $("homeScreen").classList.contains("hidden")) return false;
  if (document.body.classList.contains("tv-player-open")) {
    exitPlayerFullscreen();
    return false;
  }
  if (state.view !== "live") {
    setView("live");
    document.querySelector('[data-view="live"]')?.focus();
    return false;
  }
  if (!backExitArmed) {
    backExitArmed = true;
    clearTimeout(backExitTimer);
    backExitTimer = setTimeout(() => {
      backExitArmed = false;
    }, 1600);
    toast("Press Back again to exit");
    return false;
  }
  backExitArmed = false;
  return true;
}

function handlePlayerKeys(event) {
  const playerOpen = document.body.classList.contains("tv-player-open") || document.fullscreenElement || document.webkitFullscreenElement;
  const watching = state.currentMedia?.type === "Channel" || playerOpen;
  if (!watching) return false;
  const playerFocused = $("videoFrame").contains(document.activeElement) || $("playerControls").contains(document.activeElement);
  if (isTvApp() && !playerFocused) return false;
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    if (!playerOpen || state.currentMedia?.type !== "Channel") return false;
    event.preventDefault();
    surfChannel(event.key === "ArrowUp" ? -1 : 1);
    return true;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    showPlayerControls(true);
    return true;
  }
  return false;
}

function handleTvFocusKeys(event) {
  if (!isTvApp() || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return false;
  if (handleLiveDirectionalFocus(event)) return true;
  const focusables = visibleFocusables();
  if (!focusables.length) return false;
  const current = document.activeElement;
  if (!focusables.includes(current)) {
    focusables[0].focus();
    return true;
  }
  const currentRect = current.getBoundingClientRect();
  const currentCenter = rectCenter(currentRect);
  const candidates = focusables.filter((item) => item !== current).map((item) => {
    const rect = item.getBoundingClientRect();
    const center = rectCenter(rect);
    return { item, rect, center };
  }).filter(({ rect, center }) => {
    if (event.key === "ArrowRight") return center.x > currentCenter.x + 6;
    if (event.key === "ArrowLeft") return center.x < currentCenter.x - 6;
    if (event.key === "ArrowDown") return center.y > currentCenter.y + 6;
    return center.y < currentCenter.y - 6;
  });
  if (!candidates.length) return false;
  const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
  candidates.sort((a, b) => {
    const primaryA = horizontal ? Math.abs(a.center.x - currentCenter.x) : Math.abs(a.center.y - currentCenter.y);
    const primaryB = horizontal ? Math.abs(b.center.x - currentCenter.x) : Math.abs(b.center.y - currentCenter.y);
    const secondaryA = horizontal ? Math.abs(a.center.y - currentCenter.y) : Math.abs(a.center.x - currentCenter.x);
    const secondaryB = horizontal ? Math.abs(b.center.y - currentCenter.y) : Math.abs(b.center.x - currentCenter.x);
    return (primaryA + secondaryA * 1.8) - (primaryB + secondaryB * 1.8);
  });
  event.preventDefault();
  candidates[0].item.focus();
  candidates[0].item.scrollIntoView({ block: "nearest", inline: "nearest" });
  handleFocusedLiveItem(candidates[0].item);
  return true;
}

function handleLiveDirectionalFocus(event) {
  if (state.view !== "live") return false;
  const current = document.activeElement;
  const inCategories = $("liveCategories").contains(current);
  const inChannels = $("channelList").contains(current);
  const inVideoFrame = $("videoFrame").contains(current);
  const favoriteFocused = current?.id === "favoriteButton";
  if (!inCategories && !inChannels && !inVideoFrame && !favoriteFocused) return false;

  if (inCategories && event.key === "ArrowRight") {
    event.preventDefault();
    return focusActiveLiveRow("channelList", "channelId", state.selectedChannelId);
  }
  if (inChannels && event.key === "ArrowLeft") {
    event.preventDefault();
    return focusActiveLiveRow("liveCategories", "category", state.category);
  }
  if (inChannels && event.key === "ArrowRight") {
    event.preventDefault();
    $("videoFrame").focus();
    return true;
  }
  if (inVideoFrame && event.key === "ArrowRight") {
    event.preventDefault();
    $("favoriteButton").focus();
    return true;
  }
  if (favoriteFocused && event.key === "ArrowLeft") {
    event.preventDefault();
    $("videoFrame").focus();
    return true;
  }
  if ((inCategories || inChannels) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    const containerId = inCategories ? "liveCategories" : "channelList";
    const container = $(containerId);
    let rows = [...container.querySelectorAll(".list-row")];
    if (!rows.length) return true;
    const currentIndex = Math.max(0, rows.indexOf(current));
    const direction = event.key === "ArrowDown" ? 1 : -1;
    if (inChannels && direction > 0 && currentIndex >= rows.length - 1) {
      appendMoreChannelRows(container, liveRenderToken);
      rows = [...container.querySelectorAll(".list-row")];
    }
    const next = rows[(currentIndex + direction + rows.length) % rows.length];
    next.focus();
    next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    handleFocusedLiveItem(next);
    return true;
  }
  return false;
}

function focusActiveLiveRow(containerId, dataKey, value) {
  const attr = dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const row = $(`${containerId}`).querySelector(`[data-${attr}="${cssEscape(value)}"]`) || $(`${containerId}`).querySelector(".list-row");
  if (!row) return true;
  row.focus();
  row.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  handleFocusedLiveItem(row);
  return true;
}

function cssEscape(value) {
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function handleFocusedLiveItem(item) {
  if (state.view !== "live") return;
  const category = item.dataset?.category;
  const channelId = item.dataset?.channelId;
  if (category) {
    selectLiveCategory(category);
    return;
  }
  if (channelId) {
    previewChannelById(channelId, { play: true });
  }
}

function visibleFocusables() {
  return [...document.querySelectorAll(".focusable:not([disabled])")].filter((item) => {
    const rect = item.getBoundingClientRect();
    const style = window.getComputedStyle(item);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  });
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function isTypingField(element) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName) || element?.isContentEditable;
}

function setView(view) {
  document.body.classList.remove("tv-player-open");
  state.view = view;
  $("homeScreen").dataset.activeView = view;
  document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.remove("active"));
  $(`view${capitalize(view)}`).classList.add("active");
  $("sectionKicker").textContent = labelForView(view);
  $("sectionTitle").textContent = titleForView(view);
  if (view === "live") renderLive();
  if (view === "guide") renderGuide();
  if (view === "movies") renderMovies();
  if (view === "series") renderSeries();
  if (view === "favorites") renderFavorites();
  if (view === "search") {
    renderSearch();
    setTimeout(() => $("searchInput").focus(), 0);
  }
}

function resetLiveSelection() {
  state.category = "All Channels";
  state.selectedChannelId = data.channels[0]?.id || "";
  $("sectionTitle").textContent = state.category;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelForView(view) {
  return {
    live: "Live TV",
    guide: "Program Guide",
    movies: "VOD Library",
    series: "Series Library",
    favorites: "Saved Items",
    search: "Search",
    settings: "Settings"
  }[view];
}

function titleForView(view) {
  return {
    live: state.category,
    guide: "Tonight",
    movies: state.movieCategory,
    series: "All Series",
    favorites: "Favorites",
    search: "Find Content",
    settings: "Preferences"
  }[view];
}

function bindActions() {
  $("favoriteButton").addEventListener("click", toggleSelectedFavorite);
  $("fullscreenButton").addEventListener("click", toggleFullscreen);
  $("rewindButton").addEventListener("click", () => seekPlayer(-15));
  $("playerPlayPause").addEventListener("click", togglePlayerPlayback);
  $("forwardButton").addEventListener("click", () => seekPlayer(30));
  $("seekBar").addEventListener("input", scrubPlayer);
  $("ccButton").addEventListener("click", toggleCaptions);
  $("wideButton").addEventListener("click", toggleWideMode);
  $("exitFullscreenButton").addEventListener("click", exitPlayerFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
  $("sortMovies").addEventListener("click", () => {
    state.movieSortAsc = !state.movieSortAsc;
    $("sortMovies").textContent = state.movieSortAsc ? "A-Z" : "Z-A";
    renderMovies();
  });
  $("searchInput").addEventListener("input", scheduleSearchRender);
  $("changeLogin").addEventListener("click", () => {
    clearTimeout(channelPreviewTimer);
    $("videoPlayer").pause();
    showSettingsLoginPanel();
  });
  $("reloadProvider").addEventListener("click", reloadProviderCatalog);
  $("clearCache").addEventListener("click", () => {
    localStorage.removeItem("streamlineFavorites");
    localStorage.removeItem("streamlineProviderCache");
    localStorage.removeItem("streamlineProviderCacheMeta");
    localStorage.removeItem("streamlineRememberedProviderPayload");
    clearProviderCacheRecord().catch(() => {});
    state.favorites = new Set();
    renderAll();
    toast("Local cache cleared");
  });
  updateCacheInfo();
}

async function toggleFullscreen() {
  if (isTvApp() && document.body.classList.contains("tv-player-open")) {
    await exitPlayerFullscreen();
    return;
  }
  if (state.view !== "live") setView("live");
  await openPlayerFullscreen(false);
}

async function openPlayerFullscreen(showControls = false, forceVideo = false) {
  if (isTvApp()) {
    if (state.view !== "live") setView("live");
    document.body.classList.add("tv-player-open");
    showPlayerControls(showControls);
    syncFullscreenButton();
    $("videoFrame").focus?.();
    return;
  }
  try {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    const target = $("videoFrame");
    if (fullscreenElement && fullscreenElement !== target && forceVideo) {
      await exitPlayerFullscreen();
    }
    const activeFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!activeFullscreen) {
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      } else {
        throw new Error("Fullscreen unsupported");
      }
      showPlayerControls(showControls);
    } else if (!forceVideo) {
      await exitPlayerFullscreen();
    } else {
      showPlayerControls(showControls);
    }
    syncFullscreenButton();
  } catch (_error) {
    showPlayerControls(showControls);
    toast("Fullscreen is blocked by this browser.");
  }
}

async function exitPlayerFullscreen() {
  if (isTvApp()) {
    document.body.classList.remove("tv-player-open");
    showPlayerControls(false);
    syncFullscreenButton();
    return;
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen();
  } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
  showPlayerControls(false);
}

function syncFullscreenButton() {
  if (isTvApp()) {
    $("fullscreenButton").textContent = document.body.classList.contains("tv-player-open") ? "Exit Player" : "Player";
    return;
  }
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  $("fullscreenButton").textContent = fullscreenElement ? "Exit Player" : "Player Fullscreen";
  if (!fullscreenElement) showPlayerControls(false);
}

function showPlayerControls(show) {
  clearTimeout(state.controlsTimer);
  $("playerControls").classList.toggle("hidden", !show);
  $("videoFrame").classList.toggle("controls-open", show);
  $("controlMediaTitle").textContent = state.currentMedia?.title || $("nowTitle").textContent || "Paused";
  $("playerPlayPause").textContent = $("videoPlayer").paused ? "Play" : "Pause";
  updatePlayerOptionStates();
  if (show) {
    updateSeekBar();
    clearInterval(state.seekTimer);
    state.seekTimer = setInterval(updateSeekBar, 1000);
    $("playerPlayPause").focus();
    state.controlsTimer = setTimeout(() => showPlayerControls(false), 4500);
  } else {
    clearInterval(state.seekTimer);
  }
}

function updatePlayerOptionStates() {
  const player = $("videoPlayer");
  const seekable = player.seekable?.length ? player.seekable.end(player.seekable.length - 1) - player.seekable.start(0) > 60 : false;
  $("rewindButton").disabled = !seekable;
  $("forwardButton").disabled = !seekable;
  $("seekBar").disabled = !seekable;
  $("ccButton").classList.toggle("disabled", !hasCaptionTracks());
  $("ccButton").textContent = hasCaptionTracks() ? (state.captionsOn ? "CC On" : "CC Off") : "No CC";
}

function togglePlayerPlayback() {
  const player = $("videoPlayer");
  if (player.paused) {
    player.play().then(() => showPlayerControls(true)).catch(() => toast("Playback is blocked by this browser."));
  } else {
    player.pause();
    showPlayerControls(true);
  }
}

function enableHardwareVolume() {
  const player = $("videoPlayer");
  player.muted = false;
  player.volume = 1;
}

function seekPlayer(seconds) {
  const player = $("videoPlayer");
  if (!player.seekable?.length) {
    toast("This live channel cannot rewind or fast-forward.");
    return;
  }
  const start = player.seekable.start(0);
  const end = player.seekable.end(player.seekable.length - 1);
  const nextTime = Math.min(end, Math.max(start, player.currentTime + seconds));
  if (!Number.isFinite(nextTime) || Math.abs(nextTime - player.currentTime) < 0.25) {
    toast("This stream does not have DVR controls.");
    return;
  }
  player.currentTime = nextTime;
  showPlayerControls(true);
}

function scrubPlayer() {
  const player = $("videoPlayer");
  if (!player.seekable?.length) return;
  const start = player.seekable.start(0);
  const end = player.seekable.end(player.seekable.length - 1);
  const percent = Number($("seekBar").value) / 1000;
  player.currentTime = start + ((end - start) * percent);
  showPlayerControls(true);
}

function updateSeekBar() {
  const player = $("videoPlayer");
  if (!player.seekable?.length) {
    $("seekBar").value = 0;
    return;
  }
  const start = player.seekable.start(0);
  const end = player.seekable.end(player.seekable.length - 1);
  const span = end - start;
  if (!Number.isFinite(span) || span <= 0) {
    $("seekBar").value = 0;
    return;
  }
  $("seekBar").value = Math.round(((player.currentTime - start) / span) * 1000);
}

function toggleCaptions() {
  if (!hasCaptionTracks()) {
    toast("No captions are available on this stream.");
    return;
  }
  state.captionsOn = !state.captionsOn;
  [...$("videoPlayer").textTracks].forEach((track) => {
    track.mode = state.captionsOn ? "showing" : "disabled";
  });
  if (hlsPlayer) {
    hlsPlayer.subtitleDisplay = state.captionsOn;
    if (hlsPlayer.subtitleTracks?.length) hlsPlayer.subtitleTrack = state.captionsOn ? 0 : -1;
  }
  $("ccButton").textContent = state.captionsOn ? "CC On" : "CC Off";
  toast(state.captionsOn ? "Captions on" : "Captions off");
}

function hasCaptionTracks() {
  const tracks = $("videoPlayer").textTracks;
  return (tracks && tracks.length > 0) || !!hlsPlayer?.subtitleTracks?.length;
}

function toggleWideMode() {
  state.wideMode = !state.wideMode;
  $("videoFrame").classList.toggle("wide-mode", state.wideMode);
  $("wideButton").textContent = state.wideMode ? "Fit" : "Wide";
}

function renderAll() {
  renderLive();
  renderMovies();
  renderSeries();
  renderFavorites();
  renderSearch();
}

function renderCurrentView() {
  if (state.view === "live") renderLive();
  if (state.view === "guide") renderGuide();
  if (state.view === "movies") renderMovies();
  if (state.view === "series") renderSeries();
  if (state.view === "favorites") renderFavorites();
  if (state.view === "search") renderSearch();
  updateCacheInfo();
}

function renderLive() {
  renderLiveCategories();
  renderChannelList();
  renderSelectedChannel();
}

function renderLiveCategories() {
  const categoryBox = $("liveCategories");
  categoryBox.innerHTML = "";
  data.categories.forEach((cat) => {
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.category = cat;
    row.className = "list-row focusable" + (state.category === cat ? " active" : "");
    row.innerHTML = `<span class="row-title">${cat}</span><span class="row-sub">${countChannels(cat)} channels</span>`;
    row.addEventListener("focus", () => selectLiveCategory(cat));
    row.addEventListener("click", () => selectLiveCategory(cat));
    categoryBox.appendChild(row);
  });
}

function renderChannelList() {
  const token = ++liveRenderToken;
  const channels = filteredChannels();
  if (!channels.some((ch) => ch.id === state.selectedChannelId) && channels[0]) state.selectedChannelId = channels[0].id;
  const list = $("channelList");
  list.innerHTML = "";
  list._channels = channels;
  list.dataset.renderedEnd = "0";
  list.onscroll = () => {
    const nearBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 220;
    if (nearBottom) appendMoreChannelRows(list, token);
  };
  appendChannelRows(list, channels, 0, liveInitialLimit, token);
}

function appendMoreChannelRows(list, token) {
  if (token !== liveRenderToken) return;
  const channels = list._channels || [];
  const start = Number(list.dataset.renderedEnd || 0);
  if (start >= channels.length) return;
  appendChannelRows(list, channels, start, liveChunkSize, token);
}

function appendChannelRows(list, channels, start, size, token) {
  if (token !== liveRenderToken) return;
  const fragment = document.createDocumentFragment();
  const end = Math.min(start + size, channels.length);
  for (let index = start; index < end; index += 1) {
    const ch = channels[index];
    const row = document.createElement("button");
    row.type = "button";
    row.dataset.channelId = ch.id;
    row.className = "list-row focusable" + (ch.id === state.selectedChannelId ? " active" : "");
    row.innerHTML = `<span class="row-title">${isFavorite(ch.id) ? "Star " : ""}${ch.name}</span><span class="row-sub">${ch.program}</span>`;
    row.addEventListener("focus", () => previewChannel(ch, { play: true }));
    row.addEventListener("click", () => {
      clearTimeout(channelPreviewTimer);
      previewChannel(ch, { play: false });
      playSelectedChannel(false);
      setTimeout(() => openPlayerFullscreen(false), 80);
    });
    fragment.appendChild(row);
  }
  list.appendChild(fragment);
  list.dataset.renderedEnd = String(end);
}

function selectLiveCategory(cat) {
  if (!cat || state.category === cat) return;
  clearTimeout(channelPreviewTimer);
  state.category = cat;
  $("sectionTitle").textContent = cat;
  updateActiveRows("liveCategories", "category", cat);
  renderChannelList();
  renderSelectedChannel({ loadGuide: false });
  const firstChannel = selectedChannel();
  if (firstChannel) scheduleChannelPreview(firstChannel);
}

function previewChannelById(channelId, options = {}) {
  const channel = data.channels.find((ch) => ch.id === channelId);
  if (channel) previewChannel(channel, options);
}

function previewChannel(ch, options = {}) {
  if (!ch) return;
  state.selectedChannelId = ch.id;
  updateActiveRows("channelList", "channelId", ch.id);
  renderSelectedChannel({ loadGuide: false });
  if (options.play) scheduleChannelPreview(ch);
}

function scheduleChannelPreview(ch) {
  clearTimeout(channelPreviewTimer);
  channelPreviewTimer = setTimeout(async () => {
    if (state.view === "live" && state.selectedChannelId === ch.id) {
      loadChannelGuide(ch);
      try {
        const ready = await ensureProviderSessionReady();
        if (!ready) {
          toast("Provider is still waking up.");
          return;
        }
      } catch (_error) {
        toast("Provider is still waking up.");
        return;
      }
      playChannel(ch, false, { preview: true });
    }
  }, 320);
}

function updateActiveRows(containerId, dataKey, value) {
  const attr = dataKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  document.querySelectorAll(`#${containerId} .list-row`).forEach((row) => {
    row.classList.toggle("active", row.dataset[dataKey] === value || row.getAttribute(`data-${attr}`) === value);
  });
}

function filteredChannels() {
  return channelsForCategory(state.category);
}

function channelsForCategory(cat) {
  if (cat === "All Channels") return visibleLiveChannels();
  if (libraryIndex.smartCategoryMap.has(cat)) return libraryIndex.smartCategoryMap.get(cat);
  return libraryIndex.channelCategoryMap.get(cat) || channelsForCategoryUncached(cat);
}

function channelsForCategoryUncached(cat) {
  if (cat === "All Channels") return visibleLiveChannels();
  const smart = smartCategoryRules.find((rule) => rule.name === cat);
  if (smart) return data.channels.filter((ch) => matchesSmartCategory(ch, smart));
  return data.channels.filter((ch) => ch.category === cat);
}

function visibleLiveChannels() {
  return data.channels.filter((ch) => !isPayPerViewChannel(ch));
}

function countChannels(cat) {
  if (libraryIndex.channelCounts.has(cat)) return libraryIndex.channelCounts.get(cat);
  const count = channelsForCategory(cat).length;
  libraryIndex.channelCounts.set(cat, count);
  return count;
}

function matchesSmartCategory(channel, rule) {
  const haystack = normalizeSearch(`${channel.name} ${channel.category} ${channel.program}`);
  if (rule.special === "ppv") return isPayPerViewChannel(channel);
  if (rule.special === "international") return isInternationalChannel(channel) && !isUsChannel(channel);
  if (rule.special === "english") return isEnglishSpeakingChannel(channel);
  if (rule.special === "us") return isUsChannel(channel);
  return rule.terms.some((term) => haystack.includes(normalizeSearch(term)));
}

function isHiddenProviderCategory(category) {
  return hasCategoryTerm(category, internationalCategoryTerms) || isPayPerViewText(category);
}

function isInternationalChannel(channel) {
  return hasCategoryTerm(`${channel.category} ${channel.name}`, internationalCategoryTerms);
}

function isEnglishSpeakingChannel(channel) {
  if (isPayPerViewChannel(channel)) return false;
  const value = `${channel.category} ${channel.name}`;
  return isUsChannel(channel) || hasCategoryTerm(value, englishSpeakingCategoryTerms);
}

function isUsChannel(channel) {
  if (isPayPerViewChannel(channel)) return false;
  const value = normalizeSearch(`${channel.category} ${channel.name}`);
  if (value.includes("united states") || value.includes(" usa ") || value.startsWith("usa ")) return true;
  if (value.includes(" us ") || value.startsWith("us ") || value.endsWith(" us")) return true;
  if (value.includes("local") || value.includes("locals")) return true;
  if (value.includes("nba") || value.includes("nfl") || value.includes("mlb") || value.includes("nhl")) return true;
  if (value.includes("espn") || value.includes("fox ") || value.includes("nbc ") || value.includes("abc ") || value.includes("cbs ")) return true;
  return !isInternationalChannel(channel);
}

function isPayPerViewChannel(channel) {
  return isPayPerViewText(`${channel.category} ${channel.name} ${channel.program}`);
}

function isPayPerViewText(value) {
  const normalized = normalizeSearch(value);
  return normalized.includes("ppv") || normalized.includes("pay per view") || normalized.includes("payperview") || normalized.includes("live event");
}

function hasCategoryTerm(value, terms) {
  const normalized = ` ${normalizeSearch(value)} `;
  return terms.some((term) => {
    const searchTerm = normalizeSearch(term);
    if (searchTerm.length <= 3) return normalized.includes(` ${searchTerm} `);
    return normalized.includes(` ${searchTerm} `) || normalized.includes(searchTerm);
  });
}

function selectedChannel() {
  return data.channels.find((ch) => ch.id === state.selectedChannelId) || data.channels[0];
}

function renderSelectedChannel(options = {}) {
  const loadGuide = options.loadGuide !== false;
  const ch = selectedChannel();
  if (!ch) return;
  $("nowCategory").textContent = ch.category;
  $("nowTitle").textContent = ch.name;
  $("nowDesc").textContent = `${ch.program}. ${ch.description}`;
  $("favoriteButton").textContent = isFavorite(ch.id) ? "Unfavorite" : "Favorite";
  const guide = $("miniGuide");
  guide.innerHTML = "";
  ch.guide.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "guide-item focusable";
    row.innerHTML = `<span>${item.time}</span><span>${item.title}</span>`;
    row.addEventListener("click", () => playChannel(ch, true));
    guide.appendChild(row);
  });
  if (loadGuide) loadChannelGuide(ch);
}

function playSelectedChannel(showToast) {
  const ch = selectedChannel();
  playChannel(ch, showToast);
}

async function playChannel(ch, showToast, options = {}) {
  if (!ch) return;
  const preview = !!options.preview;
  const requestId = ++playbackRequestId;
  try {
    const ready = await ensureProviderSessionReady();
    if (!ready) {
      if (requestId === playbackRequestId) toast("Provider is still waking up.");
      return;
    }
  } catch (_error) {
    if (requestId === playbackRequestId) toast("Provider is still waking up.");
    return;
  }
  if (requestId !== playbackRequestId) return;
  state.currentMedia = { id: ch.id, title: ch.name, type: "Channel" };
  logTvDebug("play-channel-start", { id: ch.id, streamId: ch.streamId, name: ch.name, source: playableChannelSource(ch), preview });
  const player = $("videoPlayer");
  enableHardwareVolume();
  player.poster = "";
  clearVideoError();
  player.addEventListener("loadeddata", () => {
    if (requestId === playbackRequestId) clearVideoError();
  }, { once: true });
  player.addEventListener("canplay", () => {
    if (requestId === playbackRequestId) clearVideoError();
  }, { once: true });
  player.addEventListener("playing", () => {
    if (requestId !== playbackRequestId) return;
    clearVideoError();
    $("playState").textContent = preview ? "Preview" : "Playing";
  }, { once: true });
  await loadVideoSource(player, playableChannelSource(ch));
  player.onerror = () => {
    logTvDebug("channel-video-error", { id: ch.id, name: ch.name });
    if (requestId === playbackRequestId && !preview) showVideoError(`${ch.name} is not available right now.`);
  };
  if ($("autoplayToggle")?.checked !== false) {
    $("playState").textContent = preview ? "Preview" : "Loading";
    player.play().then(() => {
      if (requestId !== playbackRequestId) return;
      $("playState").textContent = preview ? "Preview" : "Playing";
      showPlayerControls(false);
    }).catch(() => {
      logTvDebug("channel-play-rejected", { id: ch.id, name: ch.name });
      if (requestId === playbackRequestId && !preview) showVideoError(`${ch.name} could not start.`);
    });
  }
}

async function playMedia(item, showToast = true) {
  const title = item.title || item.name || "Selected title";
  state.currentMedia = { ...item, title };
  const mediaSource = playableMediaSource(item);
  logTvDebug("play-media-start", { id: item.id, title, type: item.type, container: item.container, source: mediaSource });
  $("nowCategory").textContent = item.category || item.type || "Now Playing";
  $("nowTitle").textContent = title;
  $("nowDesc").textContent = item.description || item.program || `${item.type || "Video"} playback`;
  $("favoriteButton").textContent = isFavorite(item.id) ? "Unfavorite" : "Favorite";

  const player = $("videoPlayer");
  enableHardwareVolume();
  player.poster = item.image || "";
  clearVideoError();
  await loadVideoSource(player, mediaSource);
  enableHardwareVolume();
  player.onerror = () => {
    logTvDebug("media-video-error", { id: item.id, title, type: item.type });
    showVideoError(`${title} is not available right now.`);
  };
  $("playState").textContent = "Loading";
  player.play().then(() => {
    $("playState").textContent = "Playing";
    showPlayerControls(false);
  }).catch(() => {
    logTvDebug("media-play-rejected", { id: item.id, title, type: item.type });
    showVideoError(`Press play to start ${title}.`);
  });
  setView("live");
  $("sectionKicker").textContent = item.type || "Video";
  $("sectionTitle").textContent = title;
  $("miniGuide").innerHTML = "";
  if (showToast) toast(`Opening ${title}`);
  setTimeout(() => openPlayerFullscreen(false), 80);
}

function playableMediaSource(item) {
  const url = item.streamUrl || videoUrl;
  if (!isProviderLocalUrl(url)) return url;
  return `/api/movie-hls/${encodeURIComponent(item.id || item.title || "movie")}/playlist.m3u8?url=${encodeURIComponent(url)}`;
}

function playableChannelSource(ch) {
  return ch?.streamUrl || "";
}

function isProviderLocalUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function loadVideoSource(player, source) {
  const url = source || "";
  if (url && sameVideoSource(player, url) && player.readyState >= 1) return Promise.resolve();
  logTvDebug("load-video-source", { source: url });
  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }
  player.removeAttribute("src");
  player.load();
  if (!url) {
    showVideoError("No stream URL for this channel.");
    return Promise.resolve();
  }
  if (isHlsUrl(url) && window.Hls?.isSupported()) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      hlsPlayer = new window.Hls({ enableWorker: true, lowLatencyMode: true });
      hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, finish);
      hlsPlayer.on(window.Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        hlsPlayer.destroy();
        hlsPlayer = null;
        player.src = url;
        player.load();
        finish();
      });
      hlsPlayer.loadSource(url);
      hlsPlayer.attachMedia(player);
      setTimeout(finish, 1500);
    });
  } else {
    player.src = url;
    player.load();
    return new Promise((resolve) => {
      if (player.readyState >= 1) resolve();
      else player.addEventListener("loadedmetadata", resolve, { once: true });
      setTimeout(resolve, 1000);
    });
  }
}

function sameVideoSource(player, source) {
  const current = player.currentSrc || player.src;
  if (!current || !source) return false;
  try {
    return new URL(current, location.href).href === new URL(source, location.href).href;
  } catch (_error) {
    return current === source;
  }
}

function showVideoError(message) {
  const player = $("videoPlayer");
  logTvDebug("show-video-error", { message });
  $("playState").textContent = "Unavailable";
  if (player.readyState === 0) {
    player.removeAttribute("src");
    player.load();
  }
  $("videoOverlay").classList.add("visible");
  showPlayerControls(false);
  toast(message);
}

function clearVideoError() {
  $("playState").textContent = "Loading";
  $("videoOverlay").classList.remove("visible");
}

function isHlsUrl(url) {
  return /\.m3u8($|\?)/i.test(String(url || ""));
}

async function loadChannelGuide(ch) {
  if (!ch?.streamId || ch.epgLoaded || ch.epgLoading) return;
  ch.epgLoading = true;
  try {
    const response = await fetch("/api/channel-epg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamId: ch.streamId })
    });
    const parsed = await response.json();
    if (!response.ok || !parsed.ok) throw new Error(parsed.message || "Guide failed.");
    if (parsed.data.guide?.length) {
      ch.guide = parsed.data.guide;
      ch.program = ch.guide[0].title || ch.program;
      ch.description = ch.guide[0].description || ch.description;
      ch.epgLoaded = true;
      if (state.selectedChannelId === ch.id) renderSelectedChannel();
      if (state.view === "guide") updateGuideRow(ch);
      persistProviderCacheSoon();
    }
  } catch (_error) {
    ch.epgLoaded = true;
  } finally {
    ch.epgLoading = false;
  }
}

function surfChannel(direction) {
  const channels = filteredChannels();
  if (!channels.length) return;
  const currentIndex = Math.max(0, channels.findIndex((ch) => ch.id === state.selectedChannelId));
  const next = channels[(currentIndex + direction + channels.length) % channels.length];
  state.selectedChannelId = next.id;
  renderSelectedChannel();
  playChannel(next, false);
  if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
    setTimeout(() => openPlayerFullscreen(false), 80);
  }
}

function toggleSelectedFavorite() {
  const ch = selectedChannel();
  toggleFavorite(ch.id);
  renderLive();
  renderFavorites();
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    toast("Removed from favorites");
  } else {
    state.favorites.add(id);
    toast("Added to favorites");
  }
  localStorage.setItem("streamlineFavorites", JSON.stringify([...state.favorites]));
}

function isFavorite(id) {
  return state.favorites.has(id);
}

function renderGuide() {
  const token = ++guideRenderToken;
  const channels = data.channels;
  channels.slice(0, guideInitialLimit).forEach(loadChannelGuide);
  $("guideTimes").innerHTML = ["Now", "Next", "Later", "Tonight"].map((t) => `<div>${t}</div>`).join("");
  const rows = $("guideRows");
  rows.innerHTML = "";
  appendGuideRows(rows, channels, 0, guideInitialLimit, token);
}

function appendGuideRows(rows, channels, start, size, token) {
  if (token !== guideRenderToken) return;
  const fragment = document.createDocumentFragment();
  const end = Math.min(start + size, channels.length);
  for (let index = start; index < end; index += 1) {
    const ch = channels[index];
    const row = document.createElement("div");
    row.className = "guide-row";
    row.dataset.channelId = ch.id;
    const channelButton = document.createElement("button");
    channelButton.type = "button";
    channelButton.className = "guide-channel focusable";
    channelButton.textContent = ch.name;
    channelButton.addEventListener("click", () => openChannelFromGuide(ch));
    row.appendChild(channelButton);
    appendGuidePrograms(row, ch);
    fragment.appendChild(row);
  }
  rows.appendChild(fragment);
  if (end < channels.length) {
    scheduleIdle(() => {
      channels.slice(end, Math.min(end + guideChunkSize, channels.length)).forEach(loadChannelGuide);
      appendGuideRows(rows, channels, end, guideChunkSize, token);
    });
  }
}

function appendGuidePrograms(row, ch) {
  ch.guide.slice(0, 4).forEach((g, i) => {
    const block = document.createElement("button");
    block.type = "button";
    block.className = `program-block focusable ${i === 0 ? "now" : ""}`;
    block.innerHTML = `<strong>${g.title}</strong><span>${g.time}</span>`;
    block.addEventListener("click", () => openChannelFromGuide(ch));
    row.appendChild(block);
  });
}

function updateGuideRow(ch) {
  const row = document.querySelector(`.guide-row[data-channel-id="${ch.id}"]`);
  if (!row) return;
  row.querySelectorAll(".program-block").forEach((block) => block.remove());
  appendGuidePrograms(row, ch);
}

async function openChannelFromGuide(ch) {
  state.selectedChannelId = ch.id;
  setView("live");
  renderSelectedChannel();
  await openPlayerFullscreen(false, true);
  await playChannel(ch, false);
}

function renderMovies() {
  const tabs = $("movieTabs");
  tabs.innerHTML = "";
  data.movieTabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip focusable" + (state.movieCategory === tab ? " active" : "");
    btn.textContent = tab;
    btn.addEventListener("click", () => {
      state.movieCategory = tab;
      $("sectionTitle").textContent = tab;
      renderMovies();
    });
    tabs.appendChild(btn);
  });

  let movies = state.movieCategory === "Featured" ? [...data.movies] : data.movies.filter((m) => m.category === state.movieCategory);
  movies.sort((a, b) => {
    const titleCompare = a.title.localeCompare(b.title);
    if (titleCompare !== 0) return state.movieSortAsc ? titleCompare : -titleCompare;
    return containerRank(a) - containerRank(b);
  });
  renderPosterGrid($("movieGrid"), movies, openMovieDetail, gridLimit);
  renderMovieDetail();
}

function openMovieDetail(movie) {
  if (!movie) return;
  state.selectedMovieId = movie.id;
  $("videoPlayer").pause();
  showPlayerControls(false);
  setView("movies");
  $("sectionKicker").textContent = "Movie Info";
  $("sectionTitle").textContent = movie.title;
  renderMovieDetail();
  $("movieDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  const playButton = $("moviePlayButton");
  if (playButton) playButton.focus();
}

function renderMovieDetail() {
  const movie = data.movies.find((item) => item.id === state.selectedMovieId);
  const panel = $("movieDetail");
  if (!movie) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="movie-backdrop" style="background-image:url('${movie.image}')"></div>
    <div class="movie-copy">
      <p class="kicker">${movie.category || "Movie"} ${movie.year || ""}</p>
      <h3>${movie.title}</h3>
      <p>${movie.description || "Movie details from the provider library."}</p>
      ${containerRank(movie) >= 3 ? `<p class="stream-note">This provider copy is an MKV file. If it has picture but no sound, the audio track is not browser-compatible.</p>` : ""}
      <div class="movie-actions">
        <button id="moviePlayButton" class="primary-btn focusable" type="button">Play Movie</button>
        <button id="movieFavoriteButton" class="ghost-btn focusable" type="button">${isFavorite(movie.id) ? "Unfavorite" : "Favorite"}</button>
      </div>
    </div>
  `;
  $("moviePlayButton").addEventListener("click", () => playMedia(movie));
  $("movieFavoriteButton").addEventListener("click", () => {
    toggleFavorite(movie.id);
    renderMovieDetail();
    renderFavorites();
  });
}

function renderSeries() {
  renderPosterGrid($("seriesGrid"), data.series, (item) => {
    logTvDebug("series-card-click", { id: item.id, title: item.title, seriesId: item.seriesId });
    state.selectedSeriesId = item.id;
    renderSeriesDetail();
    loadSeriesEpisodes(item).catch((error) => {
      logTvDebug("series-episodes-error", { id: item.id, title: item.title, message: error.message });
    });
  }, gridLimit);
  renderSeriesDetail();
}

function renderSeriesDetail() {
  const show = data.series.find((item) => item.id === state.selectedSeriesId) || data.series[0];
  const panel = $("seriesDetail");
  panel.innerHTML = `
    <div class="detail-poster" style="background-image:url('${show.image}')"></div>
    <p class="kicker">${show.category}</p>
    <h3>${show.title}</h3>
    <p>${show.seasons} seasons available in provider library.</p>
    <div id="episodeList"></div>
  `;
  const episodes = panel.querySelector("#episodeList");
  show.seasonList.forEach((season) => {
    const header = document.createElement("p");
    header.className = "kicker";
    header.textContent = `Season ${season.season}`;
    episodes.appendChild(header);
    season.episodes.forEach((ep) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "episode-row focusable";
      row.innerHTML = `<span>${ep.title}</span><span>Play</span>`;
      row.addEventListener("click", async () => {
        let episode = ep;
        if (!episode.streamUrl && show.seriesId) {
          row.querySelector("span:last-child").textContent = "Loading";
          try {
            await loadSeriesEpisodes(show);
            const season = show.seasonList.find((item) => Number(item.season) === Number(ep.season));
            episode = season?.episodes.find((item) => Number(item.episode) === Number(ep.episode)) || season?.episodes[0] || ep;
          } catch (error) {
            toast(error.message || "Playing preview.");
            row.querySelector("span:last-child").textContent = "Play";
          }
        }
        playMedia({
          id: `${show.id}-${episode.season}-${episode.episode}`,
          title: `${show.title} ${episode.title}`,
          category: show.category,
          image: show.image,
          type: "Episode",
          streamUrl: episode.streamUrl
        });
      });
      episodes.appendChild(row);
    });
  });
}

async function loadSeriesEpisodes(show) {
  if (!show.seriesId) return show.seasonList;
  const response = await fetch("/api/series-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesId: show.seriesId })
  });
  const parsed = await response.json();
  if (!response.ok || !parsed.ok) throw new Error(parsed.message || "Series details failed.");
  show.seasonList = parsed.data.seasonList || show.seasonList;
  show.seasons = show.seasonList.length || show.seasons;
  renderSeriesDetail();
  return show.seasonList;
}

function renderPosterGrid(container, items, handler, limit = Infinity) {
  container.innerHTML = "";
  const visibleItems = items.slice(0, limit);
  const fragment = document.createDocumentFragment();
  visibleItems.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "poster-card focusable";
    card.innerHTML = `
      <div class="poster-art" style="background-image:url('${item.image}')"></div>
      <div class="poster-info"><strong>${item.title}</strong><span>${item.category} ${item.year || ""}</span></div>
    `;
    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (handler) handler(item);
      else playMedia(item);
    });
    fragment.appendChild(card);
  });
  container.appendChild(fragment);
  if (items.length > visibleItems.length) {
    const note = document.createElement("div");
    note.className = "empty-state grid-note";
    note.textContent = `Showing first ${visibleItems.length} of ${items.length}. Use Search to jump straight to a title.`;
    container.appendChild(note);
  }
}

function renderFavorites() {
  const favs = [
    ...data.channels.filter((item) => isFavorite(item.id)).map((item) => ({ ...item, title: item.name, type: "Channel", year: "" })),
    ...data.movies.filter((item) => isFavorite(item.id)),
    ...data.series.filter((item) => isFavorite(item.id))
  ];
  $("favoritesEmpty").classList.toggle("hidden", favs.length > 0);
  renderPosterGrid($("favoritesGrid"), favs);
}

function renderSearch() {
  const q = normalizeSearch($("searchInput")?.value || "");
  const suggestions = ["law and order", "halloween", "prime crime", "faith", "sports", "kids"];
  const suggestionRow = $("suggestionRow");
  suggestionRow.innerHTML = "";
  suggestions.forEach((text) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip focusable";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      $("searchInput").value = text;
      renderSearch();
    });
    suggestionRow.appendChild(btn);
  });

  const terms = q.split(" ").filter(Boolean);
  const results = (q ? libraryIndex.searchItems.filter((item) => {
    return terms.every((term) => item.searchText.includes(term));
  }) : libraryIndex.searchItems).slice(0, 80);
  const box = $("searchResults");
  box.innerHTML = "";
  if (results.length === 0) {
    box.innerHTML = `<div class="empty-state">No results found.</div>`;
    return;
  }
  results.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "poster-card search-card focusable";
    card.innerHTML = `
      <div class="poster-art" style="background-image:url('${item.image}')">
        <span class="search-badge">${item.type}</span>
      </div>
      <div class="poster-info"><strong>${item.title}</strong><span>${item.subtitle}</span></div>
    `;
    card.addEventListener("click", () => openSearchResult(item));
    box.appendChild(card);
  });
}

function scheduleSearchRender() {
  cancelAnimationFrame(searchRenderFrame);
  searchRenderFrame = requestAnimationFrame(renderSearch);
}

function openSearchResult(result) {
  if (result.type === "Channel") {
    state.category = "All Channels";
    state.selectedChannelId = result.item.id;
    setView("live");
    renderLive();
    playSelectedChannel(true);
    return;
  }
  if (result.type === "Movie") {
    openMovieDetail(result.item);
    return;
  }
  if (result.type === "Series") {
    state.selectedSeriesId = result.item.id;
    setView("series");
    renderSeriesDetail();
    toast(`Opening ${result.item.title}`);
  }
}

async function reloadProviderCatalog() {
  const payloadText = sessionStorage.getItem("streamlineLastProviderPayload") || localStorage.getItem("streamlineRememberedProviderPayload");
  if (!payloadText) {
    toast("Use Change Login once, then reload the catalog.");
    return;
  }
  const button = $("reloadProvider");
  button.disabled = true;
  button.textContent = "Loading Catalog";
  try {
    await loadProviderCatalog(JSON.parse(payloadText));
    resetLiveSelection();
    setView("live");
    toast(`Loaded ${data.channels.length} channels, ${data.movies.length} movies, and ${data.series.length} series`);
  } catch (error) {
    toast(error.message || "Catalog reload failed.");
  } finally {
    button.disabled = false;
    button.textContent = "Reload Provider Catalog";
  }
}

function updateCacheInfo(message) {
  const info = $("cacheInfo");
  if (!info) return;
  if (message) {
    info.textContent = message;
    return;
  }
  const meta = cachedProviderMeta();
  const savedAt = Number(meta.savedAt || 0);
  const savedText = savedAt ? ` Saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : "";
  info.textContent = `${data.channels.length} channels, ${data.movies.length} movies, ${data.series.length} series loaded.${savedText}`;
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scheduleIdle(task) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(task, { timeout: 450 });
  } else {
    setTimeout(task, 16);
  }
}

function updateClock() {
  $("clockText").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add("hidden"), 1800);
}

init();
