const videoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const gridLimit = 240;
const liveInitialLimit = 140;
const liveChunkSize = 180;
const guideInitialLimit = 80;
const guideChunkSize = 120;
const providerRefreshMs = 1000 * 60 * 60 * 6;
let hlsPlayer = null;
let guideRenderToken = 0;
let liveRenderToken = 0;
let cacheSaveTimer = null;
let searchRenderFrame = null;
let providerSessionReady = false;

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
  { name: "US Channels", special: "us" },
  { name: "English Speaking", special: "english" },
  { name: "International", special: "international" },
  { name: "Women", terms: ["women", "woman", "her", "own", "lifetime", "we tv", "cleo"] },
  { name: "Christmas", terms: ["christmas", "holiday", "xmas", "santa", "hallmark"] },
  { name: "Crime", terms: ["crime", "investigation", "mystery", "court", "law", "justice", "forensic"] },
  { name: "Prime Crime", terms: ["prime crime", "crime stories", "true crime"] },
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
  loadCachedProviderLibrary();
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
}

function loadCachedProviderLibrary() {
  const cache = localStorage.getItem("streamlineProviderCache");
  if (!cache) {
    rebuildLibraryIndex();
    return false;
  }
  try {
    const parsed = JSON.parse(cache);
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
    const parsed = JSON.parse(localStorage.getItem("streamlineProviderCache") || "{}");
    return parsed.library ? parsed : { savedAt: 0 };
  } catch (_error) {
    return { savedAt: 0 };
  }
}

function isTvApp() {
  return new URLSearchParams(window.location.search).get("tvApp") === "1"
    || navigator.userAgent.includes("StreamlineBluTVApp");
}

async function restoreSavedProviderSession() {
  const payloadText = sessionStorage.getItem("streamlineLastProviderPayload") || localStorage.getItem("streamlineRememberedProviderPayload");
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
}

function getProviderPayload() {
  return state.loginMode === "xtream"
    ? {
        mode: "xtream",
        server: $("serverInput").value.trim(),
        username: $("usernameInput").value.trim(),
        password: $("passwordInput").value.trim()
      }
    : {
        mode: "m3u",
        playlistUrl: $("playlistInput").value.trim()
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
  $("loginButton").disabled = true;
  try {
    const payload = getProviderPayload();

    sessionStorage.setItem("streamlineLastProviderPayload", JSON.stringify(payload));
    await loadProviderCatalog(payload);
    setLoginStatus("Provider loaded.");
    showHome();
  } catch (error) {
    setLoginStatus(error.message || "Could not load provider.");
  } finally {
    $("loginButton").disabled = false;
  }
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
  } else {
    $("serverInput").value = payload.server || "";
    $("usernameInput").value = payload.username || "";
    $("passwordInput").value = payload.password || "";
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
  try {
    localStorage.setItem("streamlineProviderCache", JSON.stringify({
      savedAt: Date.now(),
      library
    }));
  } catch (_error) {
    localStorage.removeItem("streamlineProviderCache");
    toast("Full catalog loaded for this session. Cache was too large to save.");
  }
}

function persistProviderCacheSoon() {
  clearTimeout(cacheSaveTimer);
  cacheSaveTimer = setTimeout(() => {
    if (state.usingProviderData) persistProviderCache(data);
  }, 1200);
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
}

function showHome() {
  $("loginScreen").classList.add("hidden");
  $("homeScreen").classList.remove("hidden");
  $("homeScreen").dataset.activeView = state.view;
  $("settingsProvider").textContent = localStorage.getItem("streamlineProviderName") || "Demo Provider";
  updateCacheInfo();
  renderLive();
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
      if (state.view !== "live") {
        event.preventDefault();
        setView("live");
      }
    }
    if (event.key === "Enter" && document.activeElement?.classList.contains("poster-card")) {
      document.activeElement.click();
    }
  });
}

function handlePlayerKeys(event) {
  const watching = state.currentMedia?.type === "Channel" || document.fullscreenElement || document.webkitFullscreenElement;
  if (!watching) return false;
  const playerFocused = $("videoFrame").contains(document.activeElement) || $("playerControls").contains(document.activeElement);
  if (isTvApp() && !playerFocused) return false;
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
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
  return true;
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
  state.view = view;
  $("homeScreen").dataset.activeView = view;
  document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.remove("active"));
  $(`view${capitalize(view)}`).classList.add("active");
  $("sectionKicker").textContent = labelForView(view);
  $("sectionTitle").textContent = titleForView(view);
  if (view === "guide") renderGuide();
  if (view === "movies") renderMovies();
  if (view === "series") renderSeries();
  if (view === "favorites") renderFavorites();
  if (view === "search") {
    renderSearch();
    setTimeout(() => $("searchInput").focus(), 0);
  }
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
    localStorage.removeItem("streamlineLoggedIn");
    $("homeScreen").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");
    $("loginButton").focus();
  });
  $("reloadProvider").addEventListener("click", reloadProviderCatalog);
  $("clearCache").addEventListener("click", () => {
    localStorage.removeItem("streamlineFavorites");
    localStorage.removeItem("streamlineProviderCache");
    localStorage.removeItem("streamlineRememberedProviderPayload");
    state.favorites = new Set();
    renderAll();
    toast("Local cache cleared");
  });
  updateCacheInfo();
}

async function toggleFullscreen() {
  if (state.view !== "live") setView("live");
  await openPlayerFullscreen(false);
}

async function openPlayerFullscreen(showControls = false, forceVideo = false) {
  if (isTvApp()) {
    if (state.view !== "live") setView("live");
    showPlayerControls(showControls);
    syncFullscreenButton();
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
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen();
  } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
  showPlayerControls(false);
}

function syncFullscreenButton() {
  if (isTvApp()) {
    $("fullscreenButton").textContent = "Player";
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
  const token = ++liveRenderToken;
  const categoryBox = $("liveCategories");
  categoryBox.innerHTML = "";
  data.categories.forEach((cat) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "list-row focusable" + (state.category === cat ? " active" : "");
    row.innerHTML = `<span class="row-title">${cat}</span><span class="row-sub">${countChannels(cat)} channels</span>`;
    row.addEventListener("click", () => {
      state.category = cat;
      $("sectionTitle").textContent = cat;
      renderLive();
    });
    categoryBox.appendChild(row);
  });

  const channels = filteredChannels();
  if (!channels.some((ch) => ch.id === state.selectedChannelId) && channels[0]) state.selectedChannelId = channels[0].id;
  const list = $("channelList");
  list.innerHTML = "";
  appendChannelRows(list, channels, 0, liveInitialLimit, token);

  renderSelectedChannel();
}

function appendChannelRows(list, channels, start, size, token) {
  if (token !== liveRenderToken) return;
  const fragment = document.createDocumentFragment();
  const end = Math.min(start + size, channels.length);
  for (let index = start; index < end; index += 1) {
    const ch = channels[index];
    const row = document.createElement("button");
    row.type = "button";
    row.className = "list-row focusable" + (ch.id === state.selectedChannelId ? " active" : "");
    row.innerHTML = `<span class="row-title">${isFavorite(ch.id) ? "Star " : ""}${ch.name}</span><span class="row-sub">${ch.program}</span>`;
    row.addEventListener("click", () => {
      const openingSelectedChannel = state.selectedChannelId === ch.id;
      state.selectedChannelId = ch.id;
      renderLive();
      playSelectedChannel(false);
      if (openingSelectedChannel) {
        setTimeout(() => openPlayerFullscreen(false), 80);
      }
    });
    fragment.appendChild(row);
  }
  list.appendChild(fragment);
  if (end < channels.length) {
    scheduleIdle(() => appendChannelRows(list, channels, end, liveChunkSize, token));
  }
}

function filteredChannels() {
  return channelsForCategory(state.category);
}

function channelsForCategory(cat) {
  if (cat === "All Channels") return data.channels;
  if (libraryIndex.smartCategoryMap.has(cat)) return libraryIndex.smartCategoryMap.get(cat);
  return libraryIndex.channelCategoryMap.get(cat) || channelsForCategoryUncached(cat);
}

function channelsForCategoryUncached(cat) {
  if (cat === "All Channels") return data.channels;
  const smart = smartCategoryRules.find((rule) => rule.name === cat);
  if (smart) return data.channels.filter((ch) => matchesSmartCategory(ch, smart));
  return data.channels.filter((ch) => ch.category === cat);
}

function countChannels(cat) {
  if (libraryIndex.channelCounts.has(cat)) return libraryIndex.channelCounts.get(cat);
  const count = channelsForCategory(cat).length;
  libraryIndex.channelCounts.set(cat, count);
  return count;
}

function matchesSmartCategory(channel, rule) {
  const haystack = normalizeSearch(`${channel.name} ${channel.category} ${channel.program}`);
  if (rule.special === "international") return isInternationalChannel(channel) && !isUsChannel(channel);
  if (rule.special === "english") return isEnglishSpeakingChannel(channel);
  if (rule.special === "us") return isUsChannel(channel);
  return rule.terms.some((term) => haystack.includes(normalizeSearch(term)));
}

function isHiddenProviderCategory(category) {
  return hasCategoryTerm(category, internationalCategoryTerms);
}

function isInternationalChannel(channel) {
  return hasCategoryTerm(`${channel.category} ${channel.name}`, internationalCategoryTerms);
}

function isEnglishSpeakingChannel(channel) {
  const value = `${channel.category} ${channel.name}`;
  return isUsChannel(channel) || hasCategoryTerm(value, englishSpeakingCategoryTerms);
}

function isUsChannel(channel) {
  const value = normalizeSearch(`${channel.category} ${channel.name}`);
  if (value.includes("united states") || value.includes(" usa ") || value.startsWith("usa ")) return true;
  if (value.includes(" us ") || value.startsWith("us ") || value.endsWith(" us")) return true;
  if (value.includes("local") || value.includes("locals")) return true;
  if (value.includes("nba") || value.includes("nfl") || value.includes("mlb") || value.includes("nhl")) return true;
  if (value.includes("espn") || value.includes("fox ") || value.includes("nbc ") || value.includes("abc ") || value.includes("cbs ")) return true;
  return !isInternationalChannel(channel);
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

function renderSelectedChannel() {
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
  loadChannelGuide(ch);
}

function playSelectedChannel(showToast) {
  const ch = selectedChannel();
  playChannel(ch, showToast);
}

async function playChannel(ch, showToast) {
  if (!ch) return;
  state.currentMedia = { id: ch.id, title: ch.name, type: "Channel" };
  const player = $("videoPlayer");
  enableHardwareVolume();
  player.poster = "";
  clearVideoError();
  await loadVideoSource(player, ch.streamUrl);
  player.onerror = () => {
    showVideoError(`${ch.name} is not available right now.`);
  };
  if ($("autoplayToggle")?.checked !== false) {
    $("playState").textContent = "Loading";
    player.play().then(() => {
      $("playState").textContent = "Playing";
      showPlayerControls(false);
    }).catch(() => {
      showVideoError(`${ch.name} could not start.`);
    });
  }
}

async function playMedia(item, showToast = true) {
  const title = item.title || item.name || "Selected title";
  state.currentMedia = { ...item, title };
  $("nowCategory").textContent = item.category || item.type || "Now Playing";
  $("nowTitle").textContent = title;
  $("nowDesc").textContent = item.description || item.program || `${item.type || "Video"} playback`;
  $("favoriteButton").textContent = isFavorite(item.id) ? "Unfavorite" : "Favorite";

  const player = $("videoPlayer");
  enableHardwareVolume();
  player.poster = item.image || "";
  clearVideoError();
  await loadVideoSource(player, playableMediaSource(item));
  enableHardwareVolume();
  player.onerror = () => {
    showVideoError(`${title} is not available right now.`);
  };
  $("playState").textContent = "Loading";
  player.play().then(() => {
    $("playState").textContent = "Playing";
    showPlayerControls(false);
  }).catch(() => {
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
  const source = `${item.container || ""} ${url}`.toLowerCase();
  if (source.includes(".mkv") || source.includes("mkv")) {
    return `/api/transcode-movie?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function loadVideoSource(player, source) {
  const url = source || "";
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

function showVideoError(message) {
  const player = $("videoPlayer");
  $("playState").textContent = "Unavailable";
  player.removeAttribute("src");
  player.load();
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
    state.selectedSeriesId = item.id;
    renderSeriesDetail();
    loadSeriesEpisodes(item).catch(() => {});
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
    renderAll();
    toast(`Loaded ${data.movies.length} movies and ${data.series.length} series`);
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
