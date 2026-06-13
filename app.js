const videoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const gridLimit = 120;
const liveInitialLimit = 140;
const liveChunkSize = 180;
const guideInitialLimit = 80;
const guideChunkSize = 120;
const providerRefreshMs = 1000 * 60 * 60 * 6;
const previewDelayMs = 250;
const providerCacheDbName = "StreamlineBluTV";
const providerCacheStore = "providerCache";
let hlsPlayer = null;
let guideRenderToken = 0;
let liveRenderToken = 0;
let cacheSaveTimer = null;
let searchRenderFrame = null;
let providerSessionReady = false;
let sessionWarmPromise = null;
let channelPreviewTimer = null;
let playbackRequestId = 0;
let playMediaLockUntil = 0;
let playMediaLastKey = "";
let suppressEnterUntil = 0;
let backExitArmed = false;
let backExitTimer = null;
let nativePlayerActive = false;
let nativePlayerPlaying = false;
let nativeVodDisabled = false;
let nativeVodRetry = false;
let previewPlaybackKey = "";
let channelInfoTimer = null;
let controlsVisible = false;
let nativeMenuPauseRequested = false;
let lastNativeDurationMs = 0;
let seekBarEditing = false;
let seekBarRefreshTimer = null;
let nativeDurationPollTimer = null;
let seekBarAnchorValue = 0;
let seekBarAnchorPositionMs = 0;
let pendingNativeSeekMs = null;
let nativeVodRestartTargetMs = null;
let nativeVodRestartAt = 0;
const nativeVodRestartThresholdMs = 90000;
const nativeVodNearTargetMs = 15000;
let tvDebugLogAt = 0;
let previewLayoutObserver = null;

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
  seriesScreen: "grid",
  returnView: null,
  returnSeriesScreen: null,
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
    streamUrl: videoUrl,
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
  if (localStorage.getItem("streamlineLoggedIn") === "true") {
    document.documentElement.classList.add("streamline-autologin");
  }
  document.body.classList.toggle("tv-app", isTvApp());
  installTvDebugLogging();
  installBackHandler();
  installNativePlayerBridge();
  restoreAppSavedLogin();
  if (isTvApp()) {
    const player = $("videoPlayer");
    player?.removeAttribute("loop");
    installPreviewFrameLayoutWatcher();
    installTvSeekControls();
  }
  bindLogin();
  renderPlaylistProfiles();
  bindNavigation();
  bindActions();
  updateClock();
  setInterval(updateClock, 1000 * 30);
  void bootstrapApp();
}

function showBootScreen(message = "Loading your library...") {
  $("bootStatus").textContent = message;
  $("bootScreen").classList.remove("hidden");
  $("loginScreen").classList.add("hidden");
  $("homeScreen").classList.add("hidden");
}

function hideBootScreen() {
  $("bootScreen").classList.add("hidden");
  document.documentElement.classList.remove("streamline-autologin");
}

function installTvSeekControls() {
  if (!isTvApp()) {
    $("seekBar")?.classList.add("focusable");
    $("seekBar")?.setAttribute("tabindex", "0");
    $("seekBarFocus")?.classList.add("hidden");
    return;
  }
  $("seekBar")?.classList.remove("focusable");
  $("seekBar")?.setAttribute("tabindex", "-1");
}

function isSeekControlFocused() {
  const active = document.activeElement;
  if (active?.id === "seekBar" || active?.id === "seekBarFocus") return true;
  return !!$("seekBarFocus")?.contains(active);
}

function updateSeekBarHint() {
  const hint = $("seekBarHint");
  if (!hint) return;
  const durationMs = getNativeDurationMs();
  const percent = Number($("seekBar")?.value || 0) / 10;
  hint.textContent = durationMs > 0
    ? `Timeline ${percent.toFixed(0)}% · Left/Right move · Select or Up jumps`
    : "Timeline · Down opens · Left/Right move · Select or Up jumps";
}

function syncTvSeekUi() {
  if (!isTvApp()) return;
  const wrap = $("seekBarFocus");
  if (!wrap) return;
  const show = nativeMenuOverlayActive() && isVodPlaybackActive();
  wrap.classList.toggle("hidden", !show);
}

function bumpSeekBarForNativeSeek(seconds) {
  const durationMs = getNativeDurationMs();
  if (durationMs > 0) {
    const nextSec = Math.max(0, Math.min(durationMs / 1000, getNativeCurrentTimeSec() + seconds));
    $("seekBar").value = String(Math.round((nextSec / (durationMs / 1000)) * 1000));
  } else {
    bumpSeekBarRelative(seconds > 0 ? 35 : -18);
  }
  if (isSeekControlFocused()) updateSeekBarHint();
}

function bumpSeekBarRelative(units) {
  const bar = $("seekBar");
  if (!bar || bar.disabled) return;
  const next = Math.max(0, Math.min(1000, Number(bar.value) + units));
  bar.value = String(next);
}

function beginNativeDurationPoll() {
  stopNativeDurationPoll();
  let attempts = 0;
  nativeDurationPollTimer = setInterval(() => {
    attempts += 1;
    const durationMs = getNativeDurationMs();
    if (durationMs > 0) {
      if (!seekBarEditing && !isSeekControlFocused()) updateSeekBar();
      updatePlayerOptionStates();
    }
    if (durationMs > 0 || attempts >= 60) stopNativeDurationPoll();
  }, 500);
}

function stopNativeDurationPoll() {
  clearInterval(nativeDurationPollTimer);
  nativeDurationPollTimer = null;
}

async function bootstrapApp() {
  const loggedIn = localStorage.getItem("streamlineLoggedIn") === "true";
  const wantsProvider = loggedIn && !!savedProviderPayloadText() && localStorage.getItem("streamlineProviderName") !== "Demo Provider";

  if (loggedIn && wantsProvider) {
    showBootScreen("Loading your library...");
  } else if (loggedIn) {
    showBootScreen("Starting Streamline BluTV...");
  }

  const hasSyncCache = loadCachedProviderLibrary({ skipDemoFallback: wantsProvider });

  if (!loggedIn || !wantsProvider) {
    if (!state.usingProviderData) rebuildLibraryIndex();
    renderAll();
  }

  if (!loggedIn) {
    hideBootScreen();
    $("loginScreen").classList.remove("hidden");
    $("loginButton").focus();
    return;
  }

  if (!wantsProvider) {
    hideBootScreen();
    showHome();
    return;
  }

  try {
    if (!hasSyncCache) {
      const hydrated = await hydrateLargeProviderCache();
      if (!hydrated && !state.usingProviderData) {
        showBootScreen("Connecting to provider...");
        await refreshProviderCatalog(JSON.parse(savedProviderPayloadText()), { quiet: true });
      }
    }
    if (!state.usingProviderData) {
      showBootScreen("Could not load your library. Check Settings to sign in again.");
      return;
    }
    renderAll();
    hideBootScreen();
    showHome();
    await restoreSavedProviderSession();
  } catch (_error) {
    if (state.usingProviderData) {
      renderAll();
      hideBootScreen();
      showHome();
      restoreSavedProviderSession();
      return;
    }
    showBootScreen("Could not load your library. Check Settings to sign in again.");
  }
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
  const noisy = /play-channel-start|native-player-ready|load-video-source/.test(event);
  const now = Date.now();
  if (noisy && now - tvDebugLogAt < 2500) return;
  if (noisy) tvDebugLogAt = now;
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
  window.streamlineHandleDeviceSelect = () => handleDeviceSelect();
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

function loadCachedProviderLibrary(options = {}) {
  const skipDemoFallback = !!options.skipDemoFallback;
  const cache = localStorage.getItem("streamlineProviderCache");
  if (!cache) {
    if (!skipDemoFallback) rebuildLibraryIndex();
    return false;
  }
  try {
    const parsed = JSON.parse(cache);
    if (!parsed.library && parsed.savedAt) {
      if (!skipDemoFallback) rebuildLibraryIndex();
      return false;
    }
    data = parsed.library || parsed;
    prepareProviderLibrary(data);
    state.usingProviderData = true;
    selectFirstAvailableItems();
    startProviderSessionWarm();
    return true;
  } catch (_error) {
    localStorage.removeItem("streamlineProviderCache");
    if (!skipDemoFallback) rebuildLibraryIndex();
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
    startProviderSessionWarm();
    return true;
  } catch (_error) {
    return false;
  }
}

function isTvApp() {
  return new URLSearchParams(window.location.search).get("tvApp") === "1"
    || navigator.userAgent.includes("StreamlineBluTVApp");
}

function hasNativePlayer() {
  try {
    return isTvApp() && window.StreamlineNativePlayer?.isAvailable?.() === true;
  } catch (_error) {
    return false;
  }
}

function useNativePlayerForVod() {
  return hasNativePlayer() && !nativeVodDisabled;
}

function channelNeedsTranscodedPreview(ch) {
  const name = String(ch?.name || "");
  return /\b(4k|uhd|uhd4|2160|hevc)\b/i.test(name);
}

function channelPrefersTranscodedLive(ch) {
  return isTvApp() && channelNeedsTranscodedPreview(ch);
}

function shouldUseNativeLivePlayer(options = {}) {
  return hasNativePlayer() && !options.forceWeb;
}

function setPreviewFramePoster(ch) {
  const frame = $("videoFrame");
  if (!frame || !ch?.image) return;
  frame.style.backgroundImage = `url("${ch.image}")`;
  frame.style.backgroundSize = "cover";
  frame.style.backgroundPosition = "center";
  frame.style.backgroundColor = "transparent";
}

function clearPreviewFramePoster() {
  const frame = $("videoFrame");
  if (!frame) return;
  frame.style.backgroundImage = "";
  frame.style.backgroundSize = "";
  frame.style.backgroundPosition = "";
}

function getNativePlayerLayout(fullscreen = false) {
  if (fullscreen) {
    return { left: 0, top: 0, width: 0, height: 0, fullscreen: 1 };
  }
  const frame = $("videoFrame");
  if (!frame) return null;
  const rect = frame.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || 1;
  const vh = window.innerHeight || document.documentElement.clientHeight || 1;
  const toBp = (value, total) => Math.max(1, Math.round((value / total) * 10000));
  return {
    left: toBp(rect.left, vw),
    top: toBp(rect.top, vh),
    width: toBp(Math.ceil(rect.width), vw),
    height: toBp(Math.ceil(rect.height), vh),
    fullscreen: 0
  };
}

function installPreviewFrameLayoutWatcher() {
  const frame = $("videoFrame");
  if (!frame || previewLayoutObserver || !("ResizeObserver" in window)) return;
  previewLayoutObserver = new ResizeObserver(() => {
    if (nativePlayerActive && !document.body.classList.contains("tv-player-open") && !nativeMenuOverlayActive()) {
      repositionNativePlayer(false);
    }
  });
  previewLayoutObserver.observe(frame);
}

function syncNativePlayingState() {
  if (!hasNativePlayer() || !nativePlayerActive) return;
  if (nativeMenuPauseRequested) {
    nativePlayerPlaying = false;
    return;
  }
  try {
    if (typeof window.StreamlineNativePlayer?.isPlaying === "function") {
      nativePlayerPlaying = window.StreamlineNativePlayer.isPlaying();
    }
  } catch (_error) {}
}

function callNativePlayWithLayout(url, fullscreen = false) {
  const layout = getNativePlayerLayout(fullscreen);
  if (!layout) return false;
  window.StreamlineNativePlayer.playWithLayout(
    absoluteStreamUrl(url),
    Math.round(layout.left),
    Math.round(layout.top),
    Math.round(layout.width),
    Math.round(layout.height),
    layout.fullscreen
  );
  return true;
}

function nativeMenuOverlayActive() {
  return controlsVisible || document.body.classList.contains("tv-player-menu-open");
}

function repositionNativePlayer(fullscreen = false) {
  if (!hasNativePlayer() || !nativePlayerActive) return;
  if (nativeMenuOverlayActive()) return;
  const layout = getNativePlayerLayout(fullscreen);
  if (!layout) return;
  try {
    window.StreamlineNativePlayer.repositionLayout(
      Math.round(layout.left),
      Math.round(layout.top),
      Math.round(layout.width),
      Math.round(layout.height),
      layout.fullscreen
    );
  } catch (_error) {}
}

function invokeNativePlay(url, fullscreen = false) {
  if (window.StreamlineNativePlayer?.playWithLayout) {
    callNativePlayWithLayout(url, fullscreen);
  } else if (window.StreamlineNativePlayer?.playLive) {
    window.StreamlineNativePlayer.playLive(absoluteStreamUrl(url), fullscreen ? 1 : 0);
  } else {
    window.StreamlineNativePlayer.play(absoluteStreamUrl(url));
  }
}

function startNativePlayer(url, fullscreen = false) {
  if (!hasNativePlayer() || !url) return false;
  try {
    nativePlayerActive = true;
    nativePlayerPlaying = false;
    document.body.classList.add("native-live-active");
    if (fullscreen) {
      invokeNativePlay(url, true);
    } else {
      const layout = getNativePlayerLayout(false);
      const startPreview = () => {
        if (!nativePlayerActive) return;
        invokeNativePlay(url, false);
        requestAnimationFrame(() => repositionNativePlayer(false));
      };
      if (layout && layout.width > 50 && layout.height > 50) {
        startPreview();
      } else {
        requestAnimationFrame(() => requestAnimationFrame(startPreview));
      }
    }
    return true;
  } catch (error) {
    nativePlayerActive = false;
    nativePlayerPlaying = false;
    document.body.classList.remove("native-live-active");
    logTvDebug("native-player-start-error", { message: error?.message || String(error) });
    return false;
  }
}

function stopNativePlayer() {
  nativePlayerActive = false;
  nativePlayerPlaying = false;
  nativeMenuPauseRequested = false;
  pendingNativeSeekMs = null;
  nativeVodRestartTargetMs = null;
  nativeVodRestartAt = 0;
  stopNativeDurationPoll();
  document.body.classList.remove("native-live-active");
  clearPreviewFramePoster();
  try {
    window.StreamlineNativePlayer?.stop?.();
  } catch (_error) {}
}

function autoPlayLiveOnStartup() {
  if (isTvApp()) {
    const ch = selectedChannel();
    if (ch) scheduleChannelPreview(ch);
    return;
  }
  playSelectedChannel(false);
}

function absoluteStreamUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, window.location.href).href;
  } catch (_error) {
    return url;
  }
}

function installNativePlayerBridge() {
  if (!isTvApp()) return;
  const openPlayerMenuImpl = openPlayerMenu;
  window.openPlayerMenu = () => openPlayerMenuImpl();
  window.streamlineNativeOnReady = () => {
    nativePlayerActive = true;
    const menuOpen = nativeMenuOverlayActive() || nativeMenuPauseRequested;
    nativePlayerPlaying = !menuOpen;
    document.body.classList.add("native-live-active");
    document.body.classList.remove("channel-unavailable");
    clearVideoError();
    if (menuOpen) {
      try {
        window.StreamlineNativePlayer?.pause?.();
        hideNativePlayerForMenu();
      } catch (_error) {}
    } else if (!nativeMenuOverlayActive()) {
      repositionNativePlayer(document.body.classList.contains("tv-player-open"));
      requestAnimationFrame(() => {
        if (!nativeMenuOverlayActive()) {
          repositionNativePlayer(document.body.classList.contains("tv-player-open"));
        }
      });
    }
    try {
      if (!menuOpen) window.StreamlineNativePlayer?.setVolume?.(1);
    } catch (_error) {}
    if (!menuOpen) clearPreviewFramePoster();
    $("playState").textContent = menuOpen
      ? "Paused"
      : (document.body.classList.contains("tv-player-open") ? "Playing" : "Preview");
    if (!menuOpen) showPlayerControls(false);
    else if (controlsVisible) showPlayerControls(true, { focusId: "playerPlayPause" });
    updatePlayerOptionStates();
    if (isVodPlaybackActive()) beginNativeDurationPoll();
    if (nativeVodRestartTargetMs != null && Date.now() - nativeVodRestartAt < 30000) {
      seekBarAnchorPositionMs = nativeVodRestartTargetMs;
      syncSeekBarAnchor();
      scheduleSeekBarRefresh();
    }
    logTvDebug("native-player-ready", {
      menuOpen,
      durationMs: getNativeDurationMs(),
      positionMs: window.StreamlineNativePlayer?.getCurrentPosition?.() || 0,
      restartTargetMs: nativeVodRestartTargetMs
    });
    if (nativeVodRestartTargetMs != null && Date.now() - nativeVodRestartAt < 30000) {
      nativeVodRestartTargetMs = null;
    }
    if (state.currentMedia?.type === "Channel") {
      const ch = data.channels.find((item) => item.id === state.currentMedia.id) || selectedChannel();
      if (ch) renderSelectedChannel({ loadGuide: false });
    }
  };
  window.streamlineNativeOnError = (message) => {
    logTvDebug("native-player-error", { message: message || "" });
    const media = state.currentMedia;
    if (media?.type === "Channel" && media.id) {
      const ch = data.channels.find((item) => item.id === media.id) || selectedChannel();
      if (ch && !media.nativeTranscodeTried && !channelPrefersTranscodedLive(ch)) {
        state.currentMedia = { ...media, nativeTranscodeTried: true };
        $("playState").textContent = "Loading";
        playChannel(ch, false, {
          preview: !document.body.classList.contains("tv-player-open"),
          useTranscoded: true
        }).catch(() => showChannelPlaybackError(message || "Playback failed.", ch));
        return;
      }
      showChannelPlaybackError(message || "Playback failed.", ch);
      return;
    }
    nativePlayerActive = false;
    nativePlayerPlaying = false;
    document.body.classList.remove("native-live-active");
    if ((media?.type === "Movie" || media?.type === "Episode") && !media.nativeTranscodeTried) {
      state.currentMedia = { ...media, nativeTranscodeTried: true };
      playMedia({ ...media, forceTranscode: true }, false).finally(() => {
        nativeVodRetry = false;
      });
      return;
    }
    if ((media?.type === "Movie" || media?.type === "Episode") && !nativeVodRetry) {
      nativeVodRetry = true;
      nativeVodDisabled = true;
      playMedia(media, false).finally(() => {
        nativeVodRetry = false;
      });
      return;
    }
    showVideoError(message || "Playback failed.");
  };
  window.streamlineNativeOnStopped = () => {
    nativePlayerActive = false;
    nativePlayerPlaying = false;
    document.body.classList.remove("native-live-active");
    clearPreviewFramePoster();
  };
}

async function restoreSavedProviderSession() {
  const payloadText = savedProviderPayloadText();
  if (!payloadText || !state.usingProviderData) return;
  startProviderSessionWarm();
  const meta = cachedProviderMeta();
  if (Date.now() - Number(meta.savedAt || 0) < providerRefreshMs) {
    startProviderSessionWarm()
      .then(() => autoPlayLiveOnStartup())
      .catch(() => {});
    updateCacheInfo();
    return;
  }
  try {
    await refreshProviderCatalog(JSON.parse(payloadText), { quiet: true });
    autoPlayLiveOnStartup();
  } catch (_error) {
    updateCacheInfo("Saved library ready. Provider refresh will try again later.");
    startProviderSessionWarm()
      .then(() => autoPlayLiveOnStartup())
      .catch(() => {});
  }
}

function savedProviderPayloadText() {
  return sessionStorage.getItem("streamlineLastProviderPayload") || localStorage.getItem("streamlineRememberedProviderPayload");
}

function startProviderSessionWarm() {
  if (providerSessionReady) return Promise.resolve(true);
  if (sessionWarmPromise) return sessionWarmPromise;
  const payloadText = savedProviderPayloadText();
  if (!payloadText || !state.usingProviderData) return Promise.resolve(false);
  sessionWarmPromise = warmProviderSession(JSON.parse(payloadText))
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      sessionWarmPromise = null;
    });
  return sessionWarmPromise;
}

async function ensureProviderSessionReady() {
  if (!state.usingProviderData || providerSessionReady) return true;
  await startProviderSessionWarm();
  return providerSessionReady;
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
  if (payload) {
    localStorage.setItem("streamlineRememberedProviderPayload", JSON.stringify(payload));
    persistAppSavedLogin(payload);
  }
}

function persistAppSavedLogin(payload) {
  if (!isTvApp() || !payload) return;
  try {
    window.StreamlineAppStorage?.saveLogin?.(JSON.stringify(payload));
  } catch (_error) {}
}

function restoreAppSavedLogin() {
  if (!isTvApp()) return false;
  const payloadText = localStorage.getItem("streamlineRememberedProviderPayload");
  if (localStorage.getItem("streamlineLoggedIn") === "true" && payloadText) {
    try {
      persistAppSavedLogin(JSON.parse(payloadText));
    } catch (_error) {}
    return false;
  }
  try {
    const saved = window.StreamlineAppStorage?.readLogin?.();
    if (!saved) return false;
    const payload = JSON.parse(saved);
    localStorage.setItem("streamlineRememberedProviderPayload", saved);
    localStorage.setItem("streamlineLoggedIn", "true");
    localStorage.setItem("streamlineProviderName", payload.server || payload.playlistUrl || "Provider");
    localStorage.setItem("streamlineLoginMode", payload.mode || "xtream");
    return true;
  } catch (_error) {
    return false;
  }
}

function clearAppSavedLogin() {
  if (!isTvApp()) return;
  try {
    window.StreamlineAppStorage?.clearLogin?.();
  } catch (_error) {}
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
  startProviderSessionWarm();
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
  libraryIndex.searchItems = null;

  data.channels.forEach((ch) => {
    const category = ch.category || "Live TV";
    if (!libraryIndex.channelCategoryMap.has(category)) libraryIndex.channelCategoryMap.set(category, []);
    libraryIndex.channelCategoryMap.get(category).push(ch);
  });
}

function ensureSearchIndex() {
  if (libraryIndex.searchItems) return;
  libraryIndex.searchItems = [
    ...data.channels.map((item) => ({ title: item.name, subtitle: item.program, type: "Channel", image: item.image, item, searchText: normalizeSearch(`${item.name} ${item.program} ${item.category} Channel`) })),
    ...data.movies.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.year || ""}`, type: "Movie", image: item.image, item, searchText: normalizeSearch(`${item.title} ${item.category} ${item.year || ""} Movie`) })),
    ...data.series.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.seasons} seasons`, type: "Series", image: item.image, item, searchText: normalizeSearch(`${item.title} ${item.category} ${item.seasons} Series`) }))
  ];
}

function englishMovieRank(movie) {
  const title = movie?.title || "";
  const category = movie?.category || "";
  const haystack = `${title} ${category}`;
  if (hasCategoryTerm(category, englishSpeakingCategoryTerms)) return 0;
  if (/\benglish\b|\busa\b|\bus\b|\bamerican\b/.test(normalizeSearch(category))) return 0;
  if (hasCategoryTerm(category, internationalCategoryTerms)) return 3;
  if (hasCategoryTerm(haystack, internationalCategoryTerms)) return 3;
  if (isLikelyEnglishTitle(title)) return 1;
  if (hasNonLatinScript(title)) return 3;
  return 2;
}

function isLikelyEnglishTitle(title) {
  const trimmed = String(title || "").trim();
  if (!trimmed) return false;
  const ascii = trimmed.replace(/[^a-zA-Z0-9\s:,'\-!?.&]/g, "");
  return ascii.length / trimmed.length >= 0.85;
}

function hasNonLatinScript(title) {
  return /[\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\uAC00-\uD7AF]/.test(String(title || ""));
}

function compareMoviesForDisplay(a, b, options = {}) {
  const englishCompare = englishMovieRank(a) - englishMovieRank(b);
  if (englishCompare !== 0) return englishCompare;
  const titleCompare = normalizeMovieTitle(a.title).localeCompare(normalizeMovieTitle(b.title));
  if (titleCompare !== 0) return options.titleAsc === false ? -titleCompare : titleCompare;
  return containerRank(a) - containerRank(b);
}

function sortMoviesForPlayback(movies) {
  return [...movies].sort((a, b) => compareMoviesForDisplay(a, b));
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
  if (state.usingProviderData) startProviderSessionWarm();
  if (!state.usingProviderData || providerSessionReady) autoPlayLiveOnStartup();
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
    if (isPlayerActionKey(event)) {
      if (Date.now() < suppressEnterUntil) {
        event.preventDefault();
        return;
      }
      if (isFullscreenPlayerOpen()) {
        event.preventDefault();
        handleFullscreenPlayerEnter(event);
        return;
      }
      if (shouldOfferPlayerMenu()) {
        event.preventDefault();
        handlePlaybackMenuKey(event);
        return;
      }
      if (document.activeElement?.classList.contains("poster-card")) {
        suppressEnterUntil = Date.now() + 500;
        event.preventDefault();
        document.activeElement.click();
      }
    }
  });
}

function handleAppBack() {
  if (!$("homeScreen") || $("homeScreen").classList.contains("hidden")) return false;
  const playerOpen = document.body.classList.contains("tv-player-open");
  const menuFocused = $("playerControls")?.contains(document.activeElement);
  const menuUserOpen = controlsVisible || menuFocused;
  const hasReturnView = state.returnView && state.returnView !== "live";
  if (playerOpen && menuUserOpen) {
    if (isSeekControlFocused()) {
      leaveSeekBarFocus("playerPlayPause");
      return false;
    }
    closePlayerMenu();
    return false;
  }
  if (playerOpen || hasReturnView) {
    exitFullscreenToBrowse();
    return false;
  }
  if (state.view === "series") {
    if (state.seriesScreen === "detail") {
      state.seriesScreen = "grid";
      focusSeriesGrid();
      return false;
    }
    state.returnView = null;
    state.returnSeriesScreen = null;
    setView("live");
    document.querySelector('[data-view="live"]')?.focus();
    return false;
  }
  if (state.view !== "live") {
    clearPreviewPlayer();
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

function isInPlayerSurface() {
  const active = document.activeElement;
  const inVideoFrame = active?.id === "videoFrame" || $("videoFrame")?.contains(active);
  const inControls = controlsVisible && $("playerControls")?.contains(active);
  return !!(inControls || inVideoFrame);
}

function canOpenPlayerMenu() {
  if (!$("homeScreen") || $("homeScreen").classList.contains("hidden")) return false;
  if (document.body.classList.contains("tv-player-open") || document.fullscreenElement || document.webkitFullscreenElement) return true;
  if (isVodPlaybackActive()) return true;
  if (nativePlayerActive && state.currentMedia) return true;
  const player = $("videoPlayer");
  if (player?.src && !player.paused && player.readyState >= 2) return true;
  return false;
}

function shouldOfferPlayerMenu(active = document.activeElement) {
  if (!canOpenPlayerMenu()) return false;
  if (isFullscreenPlayerOpen()) return true;
  if ($("playerControls")?.contains(active)) return true;
  if (active?.id === "videoFrame" || $("videoFrame")?.contains(active)) return true;
  return false;
}

function isFullscreenPlayerOpen() {
  return document.body.classList.contains("tv-player-open") || !!document.fullscreenElement || !!document.webkitFullscreenElement;
}

function handleFullscreenPlayerEnter(event = {}) {
  if (event.key === "MediaPlayPause") {
    togglePlayerPlayback();
    return true;
  }
  if ($("playerControls")?.contains(document.activeElement)) return handlePlaybackMenuKey(event);
  return openPlayerMenu();
}

function openPlayerMenu(options = {}) {
  if (!canOpenPlayerMenu()) return false;
  clearTimeout(channelPreviewTimer);
  const playerOpen = document.body.classList.contains("tv-player-open");
  pauseForPlayerMenu();
  if (isTvApp() && !playerOpen) {
    openPlayerFullscreen(true);
    return true;
  }
  showPlayerControls(true, { focusId: options.focusId || "playerPlayPause" });
  return true;
}

function pauseForPlayerMenu() {
  if (hasNativePlayer() && nativePlayerActive) {
    nativeMenuPauseRequested = true;
    nativePlayerPlaying = false;
    try {
      hideNativePlayerForMenu();
      window.StreamlineNativePlayer?.pause?.();
    } catch (_error) {}
    requestAnimationFrame(() => {
      if (nativeMenuPauseRequested) hideNativePlayerForMenu();
      syncNativePlayingState();
    });
    return;
  }
  const player = $("videoPlayer");
  if (player && !player.paused) {
    try {
      player.pause();
    } catch (_error) {}
  }
}

let playerControlsAnchor = null;

function mountPlayerControlsForTv(show) {
  const controls = $("playerControls");
  const panel = document.querySelector(".player-panel");
  if (!controls || !isTvApp()) return;
  if (show) {
    if (controls.parentElement !== document.body) {
      playerControlsAnchor = panel?.querySelector(".now-card") || null;
      document.body.appendChild(controls);
    }
    controls.classList.add("tv-player-menu");
    document.body.classList.add("tv-player-menu-open");
    return;
  }
  controls.classList.remove("tv-player-menu");
  document.body.classList.remove("tv-player-menu-open");
  if (controls.parentElement === document.body && panel) {
    if (playerControlsAnchor) panel.insertBefore(controls, playerControlsAnchor);
    else panel.insertBefore(controls, panel.querySelector(".now-card"));
  }
}

function hideNativePlayerForMenu() {
  if (!isTvApp() || !hasNativePlayer() || !nativePlayerActive) return;
  try {
    if (typeof window.StreamlineNativePlayer?.setControlsOverlayMode === "function") {
      window.StreamlineNativePlayer.setControlsOverlayMode(1);
      return;
    }
    window.StreamlineNativePlayer?.repositionLayout?.(0, 0, 0, 0, 0);
  } catch (_error) {}
}

function showNativePlayerAfterMenu() {
  if (!isTvApp() || !hasNativePlayer() || !nativePlayerActive) return;
  try {
    if (typeof window.StreamlineNativePlayer?.setControlsOverlayMode === "function") {
      window.StreamlineNativePlayer.setControlsOverlayMode(0);
    }
    const fullscreen = document.body.classList.contains("tv-player-open");
    repositionNativePlayer(fullscreen);
    requestAnimationFrame(() => {
      if (!nativeMenuOverlayActive() && !nativeMenuPauseRequested) {
        repositionNativePlayer(fullscreen);
      }
    });
  } catch (_error) {}
}

function resumeNativePlayback() {
  nativeMenuPauseRequested = false;
  nativePlayerPlaying = true;
  const restartPending = nativeVodRestartTargetMs != null && Date.now() - nativeVodRestartAt < 30000;
  if (isVodPlaybackActive() && !restartPending && (pendingNativeSeekMs != null || seekBarWasEdited())) {
    markPendingSeekFromBar();
  }
  const targetMs = restartPending ? null : pendingNativeSeekMs;
  showNativePlayerAfterMenu();
  clearPreviewFramePoster();
  if (targetMs != null && isVodPlaybackActive()) {
    applyPendingNativeSeek(targetMs);
  } else {
    try {
      window.StreamlineNativePlayer?.resume?.();
    } catch (_error) {}
  }
  seekBarEditing = false;
  showPlayerControls(false);
  requestAnimationFrame(() => syncNativePlayingState());
}

function pauseNativeForMenu() {
  nativeMenuPauseRequested = true;
  nativePlayerPlaying = false;
  setPausedPoster();
  hideNativePlayerForMenu();
  try {
    window.StreamlineNativePlayer?.pause?.();
  } catch (_error) {}
  showPlayerControls(true, { focusId: "playerPlayPause" });
}

function syncNativeMenuOverlay(show) {
  if (!isTvApp() || !hasNativePlayer() || !nativePlayerActive) return;
  if (show) {
    setPausedPoster();
    hideNativePlayerForMenu();
    requestAnimationFrame(() => {
      if (nativeMenuOverlayActive()) hideNativePlayerForMenu();
    });
    return;
  }
  if (nativeMenuPauseRequested) {
    setPausedPoster();
    hideNativePlayerForMenu();
    return;
  }
  showNativePlayerAfterMenu();
  clearPreviewFramePoster();
}

function setPausedPoster() {
  const media = state.currentMedia;
  let image = media?.image;
  if (!image && media?.id) {
    image = data.channels.find((item) => item.id === media.id)?.image
      || data.movies.find((item) => item.id === media.id)?.image
      || data.series.find((item) => item.id === media.id)?.image;
  }
  if (!image) image = selectedChannel()?.image;
  if (image) setPreviewFramePoster({ image });
}

function closePlayerMenu() {
  controlsVisible = false;
  showPlayerControls(false, { force: true });
  const playerOpen = document.body.classList.contains("tv-player-open");
  if (playerOpen) {
    $("videoFrame")?.focus({ preventScroll: true });
  }
}

function exitFullscreenToBrowse() {
  if (isVodPlaybackActive()) stopVideoPlayback();
  exitPlayerFullscreen();
  restoreViewAfterPlayer();
  focusLiveBrowse();
}

function focusLiveBrowse() {
  if (state.view !== "live") return;
  const row = $("channelList")?.querySelector(`[data-channel-id="${cssEscape(state.selectedChannelId)}"]`);
  if (row) {
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }
  focusActiveLiveRow("channelList", "channelId", state.selectedChannelId);
}

function isPlayerActionKey(event) {
  const key = event.key || "";
  if (key === "Enter" || key === " " || key === "Select" || key === "MediaPlayPause") return true;
  const code = event.keyCode || event.which || 0;
  return code === 13 || code === 23 || code === 66 || code === 160;
}

function handlePlaybackMenuKey(event = {}) {
  const active = document.activeElement;
  if ($("playerControls")?.contains(active)) {
    if (isSeekControlFocused()) {
      if (isVodPlaybackActive()) {
        scrubPlayer();
        leaveSeekBarFocus("playerPlayPause");
      } else {
        toast("Live channels use RW and FF instead of the timeline.");
        leaveSeekBarFocus("playerPlayPause");
      }
      return true;
    }
    if (active?.tagName === "BUTTON" && !active.disabled) {
      active.click();
      return true;
    }
  }
  if (event.key === "MediaPlayPause") {
    togglePlayerPlayback();
    return true;
  }
  if (controlsVisible) return true;
  return openPlayerMenu();
}

function handleDeviceSelect() {
  if ($("homeScreen")?.classList.contains("hidden")) return false;
  if (isTypingField(document.activeElement)) return false;
  if (controlsVisible) return handlePlaybackMenuKey({ key: "Enter" });
  if (!canOpenPlayerMenu()) return false;
  return handlePlaybackMenuKey({ key: "Enter" });
}

function handlePlayerKeys(event) {
  const active = document.activeElement;
  const inVideoFrame = active?.id === "videoFrame" || $("videoFrame")?.contains(active);
  const inControls = controlsVisible && $("playerControls")?.contains(active);
  if (!inVideoFrame && !inControls) return false;
  const playerOpen = document.body.classList.contains("tv-player-open") || document.fullscreenElement || document.webkitFullscreenElement;

  if (inControls) {
    const controlButtons = [...($("playerControls")?.querySelectorAll(".control-row .focusable:not([disabled])") || [])]
      .filter((item) => !item.classList.contains("hidden"));
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && isSeekControlFocused()) {
      if (!$("seekBar").disabled) {
        event.preventDefault();
        adjustSeekBarStep(event.key === "ArrowRight" ? 1 : -1);
        updateSeekBarHint();
      }
      return true;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const idx = controlButtons.indexOf(document.activeElement);
      if (idx !== -1) {
        const dir = event.key === "ArrowRight" ? 1 : -1;
        controlButtons[(idx + dir + controlButtons.length) % controlButtons.length]?.focus();
      }
      return true;
    }
    if (event.key === "ArrowDown" && !isSeekControlFocused()) {
      event.preventDefault();
      if (isTvApp() && isVodPlaybackActive()) focusSeekBar();
      else if (!$("seekBar")?.disabled) focusSeekBar();
      return true;
    }
    if (event.key === "ArrowUp" && isSeekControlFocused()) {
      event.preventDefault();
      leaveSeekBarFocus("playerPlayPause");
      return true;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      return true;
    }
  }
  if ((event.key === "ArrowUp" || event.key === "ArrowDown") && inVideoFrame && !inControls) {
    if (isVodPlaybackActive() || (playerOpen && state.currentMedia?.type !== "Channel")) {
      event.preventDefault();
      return true;
    }
    if (state.view === "live" && state.currentMedia?.type === "Channel") {
      event.preventDefault();
      changeChannel(event.key === "ArrowDown" ? 1 : -1, { preview: !playerOpen });
      return true;
    }
    return false;
  }
  if (isPlayerActionKey(event) && (inVideoFrame || inControls)) {
    event.preventDefault();
    return handlePlaybackMenuKey(event);
  }
  return false;
}

function handleTvFocusKeys(event) {
  if (!isTvApp() || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return false;
  if (handleLiveDirectionalFocus(event)) return true;
  if (handleSeriesDirectionalFocus(event)) return true;
  if (handleMoviesDirectionalFocus(event)) return true;
  if (handleNavDirectionalFocus(event)) return true;
  const focusables = visibleFocusables();
  if (!focusables.length) return false;
  const current = document.activeElement;
  if (!focusables.includes(current)) {
    event.preventDefault();
    if (state.view === "movies") focusMovieCategoryTab();
    else focusables[0].focus();
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
  if (!candidates.length) {
    if (state.view === "series" || state.view === "movies") {
      event.preventDefault();
      return true;
    }
    return false;
  }
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

function handleSeriesDirectionalFocus(event) {
  if (state.view !== "series") return false;
  const current = document.activeElement;
  const grid = $("seriesGrid");
  const detail = $("seriesDetail");
  const inGrid = grid?.contains(current);
  const inDetail = detail?.contains(current);

  if (state.seriesScreen === "grid") {
    if (inDetail) {
      event.preventDefault();
      focusSeriesGrid();
      return true;
    }
    if (inGrid) {
      const moved = moveDirectionalFocusIn(grid, current, event);
      if (moved) {
        const nextId = document.activeElement?.dataset?.itemId;
        if (nextId) state.selectedSeriesId = nextId;
      }
      return moved;
    }
    return false;
  }

  if (!inGrid && !inDetail) return false;

  if (inDetail) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.seriesScreen = "grid";
      focusSeriesGrid();
      return true;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const items = [...detail.querySelectorAll("h3[tabindex], .episode-row")];
      const idx = items.indexOf(current);
      const dir = event.key === "ArrowDown" ? 1 : -1;
      const next = idx === -1 ? items[0] : items[idx + dir];
      if (next) {
        next.focus();
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      return true;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      return true;
    }
  }

  if (inGrid) {
    return moveDirectionalFocusIn(grid, current, event);
  }
  return false;
}

function handleMoviesDirectionalFocus(event) {
  if (state.view !== "movies") return false;
  const current = document.activeElement;
  const detail = $("movieDetail");
  const grid = $("movieGrid");
  const toolbar = document.querySelector("#viewMovies .content-toolbar");
  const detailVisible = detail && !detail.classList.contains("hidden");
  const inDetail = detailVisible && detail.contains(current);
  const inGrid = grid?.contains(current);
  const inToolbar = toolbar?.contains(current);
  if (!inDetail && !inGrid && !inToolbar) return false;

  const playBtn = $("moviePlayButton");
  const favBtn = $("movieFavoriteButton");
  const activeTab = () => $("movieTabs")?.querySelector(".chip.active") || $("movieTabs")?.querySelector(".chip");
  const movieChips = () => [...($("movieTabs")?.querySelectorAll(".chip") || [])];
  const focusFirstGridCard = () => {
    const card = grid?.querySelector(".poster-card");
    card?.focus();
    card?.scrollIntoView({ block: "nearest", inline: "start" });
  };
  const hasGridMove = (direction) => {
    if (!grid || !current) return false;
    const focusables = focusablesIn(grid);
    if (!focusables.includes(current)) return false;
    const currentCenter = rectCenter(current.getBoundingClientRect());
    return focusables.some((item) => {
      if (item === current) return false;
      const center = rectCenter(item.getBoundingClientRect());
      if (direction === "up") return center.y < currentCenter.y - 6;
      if (direction === "down") return center.y > currentCenter.y + 6;
      if (direction === "left") return center.x < currentCenter.x - 6;
      return center.x > currentCenter.x + 6;
    });
  };

  if (inDetail) {
    const actions = [playBtn, favBtn].filter(Boolean);
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && actions.includes(current)) {
      event.preventDefault();
      const idx = actions.indexOf(current);
      const dir = event.key === "ArrowRight" ? 1 : -1;
      actions[(idx + dir + actions.length) % actions.length]?.focus();
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (current === favBtn && playBtn) playBtn.focus();
      return true;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeTab()?.focus();
      return true;
    }
  }

  if (inToolbar) {
    const chips = movieChips();
    if (chips.includes(current) && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const idx = chips.indexOf(current);
      const dir = event.key === "ArrowRight" ? 1 : -1;
      const next = chips[idx + dir];
      if (next) {
        next.focus();
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      return true;
    }
    if (event.key === "ArrowLeft" && current?.id === "sortMovies") {
      event.preventDefault();
      chips[chips.length - 1]?.focus();
      return true;
    }
    if (event.key === "ArrowRight" && chips.includes(current) && current === chips[chips.length - 1]) {
      event.preventDefault();
      $("sortMovies")?.focus();
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (detailVisible && playBtn) playBtn.focus();
      return true;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusFirstGridCard();
      return true;
    }
  }

  if (inGrid) {
    if (event.key === "ArrowUp") {
      if (hasGridMove("up")) return moveDirectionalFocusIn(grid, current, event);
      event.preventDefault();
      activeTab()?.focus();
      return true;
    }
    return moveDirectionalFocusIn(grid, current, event);
  }

  return false;
}

function handleNavDirectionalFocus(event) {
  const current = document.activeElement;
  if (!current?.classList.contains("nav-item")) return false;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusViewEntry(state.view);
    return true;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    const navItems = [...document.querySelectorAll(".nav-item")];
    const idx = navItems.indexOf(current);
    const dir = event.key === "ArrowDown" ? 1 : -1;
    navItems[(idx + dir + navItems.length) % navItems.length]?.focus();
    return true;
  }
  return false;
}

function focusViewEntry(view) {
  if (view === "series") {
    state.seriesScreen = "grid";
    focusSeriesGrid();
    return;
  }
  if (view === "live") {
    focusActiveLiveRow("liveCategories", "category", state.category);
    return;
  }
  if (view === "movies") {
    if ($("movieDetail") && !$("movieDetail").classList.contains("hidden") && $("moviePlayButton")) {
      $("moviePlayButton").focus();
      return;
    }
    $("movieTabs")?.querySelector(".chip.active")?.focus()
      || $("movieTabs")?.querySelector(".chip")?.focus()
      || $("movieGrid")?.querySelector(".poster-card")?.focus();
    return;
  }
  if (view === "guide") {
    $("guideRows")?.querySelector(".guide-channel")?.focus();
    return;
  }
  if (view === "favorites") {
    $("favoritesGrid")?.querySelector(".poster-card")?.focus();
    return;
  }
  if (view === "search") {
    $("searchInput")?.focus();
    return;
  }
  if (view === "settings") {
    $("changeLogin")?.focus();
  }
}

function moveDirectionalFocusIn(container, current, event) {
  const focusables = focusablesIn(container);
  if (!focusables.includes(current)) return false;
  const currentRect = current.getBoundingClientRect();
  const currentCenter = rectCenter(currentRect);
  const candidates = focusables.filter((item) => item !== current).map((item) => {
    const rect = item.getBoundingClientRect();
    return { item, center: rectCenter(rect) };
  }).filter(({ center }) => {
    if (event.key === "ArrowRight") return center.x > currentCenter.x + 6;
    if (event.key === "ArrowLeft") return center.x < currentCenter.x - 6;
    if (event.key === "ArrowDown") return center.y > currentCenter.y + 6;
    return center.y < currentCenter.y - 6;
  });
  if (!candidates.length) {
    event.preventDefault();
    return true;
  }
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

function focusablesIn(container) {
  return [...container.querySelectorAll(".focusable:not([disabled])")].filter((item) => {
    const rect = item.getBoundingClientRect();
    const style = window.getComputedStyle(item);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  });
}

function handleLiveDirectionalFocus(event) {
  if (state.view !== "live") return false;
  const current = document.activeElement;
  if ($("playerControls")?.contains(current)) return false;
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
  if (inVideoFrame && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    if (isVodPlaybackActive() || (document.body.classList.contains("tv-player-open") && state.currentMedia?.type !== "Channel")) {
      return false;
    }
    event.preventDefault();
    changeChannel(event.key === "ArrowDown" ? 1 : -1, { preview: !document.body.classList.contains("tv-player-open") });
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
  const scopes = [document.querySelector(".rail")].filter(Boolean);
  if (state.view !== "movies") {
    const topbar = document.querySelector(".topbar");
    if (topbar) scopes.push(topbar);
  }
  const activeView = document.querySelector(".view.active");
  if (activeView) {
    if (state.view === "series" && state.seriesScreen === "grid") {
      const gridWrap = $("seriesGrid")?.parentElement;
      if (gridWrap) scopes.push(gridWrap);
    } else if (state.view === "series" && state.seriesScreen === "detail") {
      const detail = $("seriesDetail");
      if (detail) scopes.push(detail);
    } else if (state.view === "movies") {
      const detail = $("movieDetail");
      if (detail && !detail.classList.contains("hidden")) scopes.push(detail);
      const toolbar = document.querySelector("#viewMovies .content-toolbar");
      if (toolbar) scopes.push(toolbar);
      const grid = $("movieGrid");
      if (grid) scopes.push(grid);
    } else {
      scopes.push(activeView);
    }
  }
  return scopes.flatMap((scope) => focusablesIn(scope));
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function isTypingField(element) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName) || element?.isContentEditable;
}

function setView(view, options = {}) {
  if (!options.keepPlayerOpen) document.body.classList.remove("tv-player-open");
  if (state.view === "live" && view !== "live" && !options.keepPlayerOpen) stopVideoPlayback();
  if (view === "series" && !options.preserveSeriesScreen) state.seriesScreen = "grid";
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
  if (view === "series" && isTvApp()) {
    setTimeout(() => focusSeriesGrid(), 0);
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
  const seekBar = $("seekBar");
  if (isTvApp()) {
    $("seekBarFocus")?.addEventListener("focus", () => {
      seekBarEditing = true;
      updateSeekBarHint();
    });
    $("seekBarFocus")?.addEventListener("blur", () => {
      seekBarEditing = false;
      updateSeekBar();
    });
  } else {
    seekBar.addEventListener("input", scrubPlayer);
    seekBar.addEventListener("change", scrubPlayer);
  }
  $("ccButton").addEventListener("click", toggleCaptions);
  $("wideButton").addEventListener("click", toggleWideMode);
  $("exitFullscreenButton").addEventListener("click", () => {
    if (isTvApp()) exitFullscreenToBrowse();
    else exitPlayerFullscreen();
  });
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
    clearAppSavedLogin();
    clearProviderCacheRecord().catch(() => {});
    state.favorites = new Set();
    renderAll();
    toast("Local cache cleared");
  });
  updateCacheInfo();
}

async function toggleFullscreen() {
  if (isTvApp() && document.body.classList.contains("tv-player-open")) {
    exitFullscreenToBrowse();
    return;
  }
  if (state.view !== "live") setView("live");
  await openPlayerFullscreen(false);
}

async function openPlayerFullscreen(showControls = false, forceVideo = false) {
  if (isTvApp()) {
    if (!isVodPlaybackActive() && state.view !== "live") setView("live");
    clearTimeout(channelPreviewTimer);
    document.body.classList.add("tv-player-open");
    document.body.classList.remove("tv-controls-open");
    if (showControls) pauseForPlayerMenu();
    showPlayerControls(showControls);
    if (nativePlayerActive && !showControls && !nativeMenuOverlayActive()) {
      repositionNativePlayer(true);
      requestAnimationFrame(() => {
        if (!nativeMenuOverlayActive()) repositionNativePlayer(true);
      });
    }
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
    syncNativeMenuOverlay(false);
    document.body.classList.remove("tv-player-open");
    document.body.classList.remove("tv-controls-open");
    controlsVisible = false;
    if (nativePlayerActive) {
      repositionNativePlayer(false);
      requestAnimationFrame(() => repositionNativePlayer(false));
    }
    showPlayerControls(false, { force: true });
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

function showPlayerControls(show, options = {}) {
  clearTimeout(state.controlsTimer);
  const wasVisible = controlsVisible;
  const playerOpen = document.body.classList.contains("tv-player-open");
  const visible = options.force ? false : !!show;
  controlsVisible = visible;
  syncNativePlayingState();
  syncNativeMenuOverlay(visible);
  const paused = (hasNativePlayer() && nativePlayerActive) ? !nativePlayerPlaying : $("videoPlayer").paused;
  document.body.classList.toggle("tv-controls-open", visible && isTvApp());
  $("playerControls").classList.toggle("hidden", !visible);
  $("videoFrame").classList.toggle("controls-open", visible);
  mountPlayerControlsForTv(visible);
  $("controlMediaTitle").textContent = state.currentMedia?.title || $("nowTitle").textContent || "Paused";
  if (hasNativePlayer() && nativePlayerActive) {
    $("playerPlayPause").textContent = nativePlayerPlaying ? "Pause" : "Play";
  } else {
    $("playerPlayPause").textContent = $("videoPlayer").paused ? "Play" : "Pause";
  }
  updatePlayerOptionStates();
  if (visible) {
    syncTvSeekUi();
    updateSeekBar();
    clearInterval(state.seekTimer);
    state.seekTimer = setInterval(updateSeekBar, 1000);
    const focusId = options.focusId || (show && !wasVisible ? "playerPlayPause" : null);
    if (focusId && $(focusId)) {
      requestAnimationFrame(() => $(focusId).focus());
    }
    if (show && !paused) {
      state.controlsTimer = setTimeout(() => {
        if (!$("playerControls")?.contains(document.activeElement)) showPlayerControls(false);
      }, playerOpen ? 8000 : 4500);
    }
  } else {
    clearInterval(state.seekTimer);
  }
}

function togglePlayerPlayback() {
  if (isVodPlaybackActive()) {
    if (hasNativePlayer() && nativePlayerActive) {
      try {
        if (nativeMenuPauseRequested) resumeNativePlayback();
        else pauseNativeForMenu();
      } catch (_error) {}
      return;
    }
    const player = $("videoPlayer");
    if (player.paused) {
      player.play().then(() => showPlayerControls(false)).catch(() => toast("Playback is blocked by this browser."));
    } else {
      player.pause();
      showPlayerControls(true, { focusId: "playerPlayPause" });
    }
    return;
  }
  if (hasNativePlayer() && nativePlayerActive && state.currentMedia?.type === "Channel") {
    try {
      if (nativeMenuPauseRequested) resumeNativePlayback();
      else pauseNativeForMenu();
    } catch (_error) {}
    return;
  }
  if (state.currentMedia?.type === "Channel") {
    const player = $("videoPlayer");
    if (player.paused) {
      player.play().then(() => showPlayerControls(false)).catch(() => toast("Playback is blocked by this browser."));
    } else {
      player.pause();
      showPlayerControls(true, { focusId: "playerPlayPause" });
    }
  }
}

function updateFavoriteUiForChannel(channelId) {
  const ch = data.channels.find((item) => item.id === channelId);
  if (!ch) return;
  $("favoriteButton").textContent = isFavorite(channelId) ? "Unfavorite" : "Favorite";
  const row = $("channelList")?.querySelector(`[data-channel-id="${cssEscape(channelId)}"]`);
  if (row) {
    row.innerHTML = `<span class="row-title">${isFavorite(channelId) ? "Star " : ""}${ch.name}</span><span class="row-sub">${ch.program}</span>`;
    row.classList.toggle("active", channelId === state.selectedChannelId);
  }
  if (state.view === "favorites") renderFavorites();
}

function updatePlayerOptionStates() {
  const player = $("videoPlayer");
  const liveChannel = state.currentMedia?.type === "Channel" && !isVodPlaybackActive();
  const liveNative = liveChannel && nativePlayerActive && hasNativePlayer();
  const nativeVod = isVodPlaybackActive() && nativePlayerActive;
  const liveMenu = liveChannel && isTvApp() && nativeMenuOverlayActive();
  const vodMenu = nativeVod && isTvApp() && nativeMenuOverlayActive();
  const tvNativeMenu = isTvApp() && nativeMenuOverlayActive() && nativePlayerActive && hasNativePlayer();
  let rwFfEnabled = false;
  let scrubEnabled = false;
  if (liveNative) {
    rwFfEnabled = true;
    scrubEnabled = getNativeDurationMs() > 0;
  } else if (liveChannel) {
    rwFfEnabled = false;
  } else if (nativeVod) {
    scrubEnabled = getNativeDurationMs() > 0 || lastNativeDurationMs > 0;
    rwFfEnabled = true;
  } else {
    scrubEnabled = player.seekable?.length
      ? player.seekable.end(player.seekable.length - 1) - player.seekable.start(0) > 60
      : false;
    rwFfEnabled = scrubEnabled;
  }
  if (tvNativeMenu) {
    rwFfEnabled = true;
    scrubEnabled = isVodPlaybackActive();
  }
  $("rewindButton").disabled = tvNativeMenu ? false : !rwFfEnabled;
  $("forwardButton").disabled = tvNativeMenu ? false : !rwFfEnabled;
  $("seekBar").disabled = tvNativeMenu ? !isVodPlaybackActive() : !scrubEnabled;
  $("rewindButton").classList.toggle("live-muted", liveMenu && !rwFfEnabled && !tvNativeMenu);
  $("forwardButton").classList.toggle("live-muted", liveMenu && !rwFfEnabled && !tvNativeMenu);
  $("seekBar").classList.toggle("live-muted", (liveMenu || vodMenu) && !scrubEnabled && !tvNativeMenu);
  const nativeCaptions = hasNativePlayer() && nativePlayerActive;
  const ccAvailable = nativeCaptions || hasCaptionTracks();
  $("ccButton").disabled = !ccAvailable;
  $("ccButton").classList.toggle("disabled", !ccAvailable);
  $("ccButton").textContent = ccAvailable ? (state.captionsOn ? "CC On" : "CC Off") : "No CC";
  $("wideButton").classList.toggle("hidden", nativePlayerActive || isVodPlaybackActive());
  $("playerControls")?.classList.toggle("live-player-menu", liveMenu);
  $("playerControls")?.classList.toggle("vod-player-menu", vodMenu);
  syncTvSeekUi();
}

function nativePlayerSeekable() {
  if (!hasNativePlayer() || !nativePlayerActive) return false;
  try {
    if (typeof window.StreamlineNativePlayer?.isSeekable === "function") {
      return window.StreamlineNativePlayer.isSeekable();
    }
    const durationMs = window.StreamlineNativePlayer?.getDuration?.() || 0;
    return durationMs > 60000;
  } catch (_error) {
    return false;
  }
}

function getNativeDurationMs() {
  try {
    let ms = Number(window.StreamlineNativePlayer?.getDuration?.() || 0);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 86400000 * 6) ms = 0;
    if (ms > 0) {
      lastNativeDurationMs = ms;
      return ms;
    }
  } catch (_error) {}
  return lastNativeDurationMs;
}

function getNativeDurationSec() {
  const ms = getNativeDurationMs();
  return ms > 0 ? ms / 1000 : 0;
}

function focusSeekBar() {
  if (isTvApp()) {
    const wrap = $("seekBarFocus");
    if (!wrap || wrap.classList.contains("hidden") || $("seekBar")?.disabled) return false;
    seekBarEditing = false;
    updateSeekBar();
    try {
      seekBarAnchorPositionMs = window.StreamlineNativePlayer?.getCurrentPosition?.() || seekBarAnchorPositionMs;
    } catch (_error) {}
    syncSeekBarAnchor();
    seekBarEditing = true;
    updateSeekBarHint();
    wrap.focus({ preventScroll: true });
    return true;
  }
  const bar = $("seekBar");
  if (!bar || bar.disabled) return false;
  seekBarEditing = true;
  bar.focus({ preventScroll: true });
  return true;
}

function leaveSeekBarFocus(targetId = "playerPlayPause") {
  if (isVodPlaybackActive() && seekBarWasEdited()) markPendingSeekFromBar();
  seekBarEditing = false;
  const target = $(targetId);
  if (target && !target.disabled) {
    target.focus({ preventScroll: true });
    return true;
  }
  $("rewindButton")?.focus({ preventScroll: true });
  return false;
}

function syncSeekBarAnchor() {
  seekBarAnchorValue = Number($("seekBar")?.value || 0);
  try {
    seekBarAnchorPositionMs = window.StreamlineNativePlayer?.getCurrentPosition?.() || 0;
  } catch (_error) {
    seekBarAnchorPositionMs = 0;
  }
}

function seekBarWasEdited() {
  return Math.abs(Number($("seekBar")?.value || 0) - seekBarAnchorValue) >= 8;
}

function computeTargetMsFromBar() {
  const barValue = Number($("seekBar")?.value || 0);
  let durationMs = getNativeDurationMs();
  if (durationMs <= 0) durationMs = lastNativeDurationMs;
  const deltaUnits = barValue - seekBarAnchorValue;
  if (durationMs > 0 && seekBarAnchorPositionMs > 0) {
    return Math.max(0, Math.round(seekBarAnchorPositionMs + ((deltaUnits / 1000) * durationMs)));
  }
  if (nativeVodRestartTargetMs != null && Date.now() - nativeVodRestartAt < 30000) {
    return nativeVodRestartTargetMs;
  }
  const percent = Math.max(0, Math.min(1, barValue / 1000));
  if (durationMs <= 0) durationMs = Math.max(seekBarAnchorPositionMs + 120000, 5400000);
  return Math.round(durationMs * percent);
}

function nativeVodUsesTranscodePipe() {
  if (!isVodPlaybackActive() || !nativePlayerActive) return false;
  if (isTvApp()) return true;
  const url = state.currentMedia?.streamUrl || "";
  const source = `${state.currentMedia?.container || ""} ${url}`.toLowerCase();
  return source.includes(".mkv") || source.includes("mkv");
}

function restartNativeVodAt(positionMs, options = {}) {
  const media = state.currentMedia;
  if (!media || !hasNativePlayer() || !nativeVodUsesTranscodePipe()) return false;
  const targetMs = Math.max(0, Math.round(positionMs));
  let currentMs = seekBarAnchorPositionMs;
  try {
    currentMs = window.StreamlineNativePlayer?.getCurrentPosition?.() || currentMs;
  } catch (_error) {}
  if (nativeVodRestartTargetMs != null && Math.abs(targetMs - nativeVodRestartTargetMs) < nativeVodNearTargetMs) {
    return true;
  }
  if (Math.abs(targetMs - currentMs) < nativeVodNearTargetMs) {
    syncSeekBarAnchor();
    return true;
  }
  const startSeconds = Math.max(0, Math.round(targetMs / 1000));
  const source = playableMediaSource(media, {
    forceTranscode: !!media.forceTranscode,
    startSeconds
  });
  if (!source.includes("transcode-movie") || !source.includes(`start=${startSeconds}`)) return false;
  const stayPaused = !!options.stayPaused;
  if (stayPaused) nativeMenuPauseRequested = true;
  pendingNativeSeekMs = null;
  nativeVodRestartTargetMs = targetMs;
  nativeVodRestartAt = Date.now();
  logTvDebug("native-vod-restart-at", { startSeconds, stayPaused, targetMs });
  try {
    window.StreamlineNativePlayer?.setControlsOverlayMode?.(0);
    callNativePlayWithLayout(source, true);
    nativePlayerActive = true;
    nativePlayerPlaying = !stayPaused && !nativeMenuPauseRequested;
    if (stayPaused || nativeMenuPauseRequested) {
      hideNativePlayerForMenu();
      window.StreamlineNativePlayer?.pause?.();
    } else {
      showNativePlayerAfterMenu();
    }
    beginNativeDurationPoll();
  } catch (_error) {
    nativeVodRestartTargetMs = null;
    return false;
  }
  seekBarAnchorValue = Number($("seekBar")?.value || 0);
  seekBarAnchorPositionMs = targetMs;
  scheduleSeekBarRefresh();
  return true;
}

function markPendingSeekFromBar() {
  if (!isVodPlaybackActive()) return;
  pendingNativeSeekMs = computeTargetMsFromBar();
}

function applyPendingNativeSeek(targetMs, options = {}) {
  if (targetMs == null || targetMs < 0) return;
  const target = Math.max(0, Math.round(targetMs));
  let currentMs = seekBarAnchorPositionMs;
  try {
    currentMs = window.StreamlineNativePlayer?.getCurrentPosition?.() || currentMs;
  } catch (_error) {}
  const deltaMs = target - currentMs;
  if (nativeVodRestartTargetMs != null && Math.abs(target - nativeVodRestartTargetMs) < nativeVodNearTargetMs) {
    pendingNativeSeekMs = null;
    syncSeekBarAnchor();
    scheduleSeekBarRefresh();
    return;
  }
  if (nativeVodUsesTranscodePipe() && Math.abs(deltaMs) >= nativeVodRestartThresholdMs) {
    if (restartNativeVodAt(target, options)) return;
  }
  const seek = () => {
    try {
      if (Math.abs(deltaMs) >= 500 && typeof window.StreamlineNativePlayer?.seekBySeconds === "function") {
        window.StreamlineNativePlayer.seekBySeconds(Math.round(deltaMs / 1000));
      } else {
        window.StreamlineNativePlayer?.seekTo?.(target);
      }
      if (options.stayPaused) window.StreamlineNativePlayer?.pause?.();
      else window.StreamlineNativePlayer?.resume?.();
    } catch (_error) {}
  };
  seek();
  if (options.stayPaused) {
    pendingNativeSeekMs = null;
    syncSeekBarAnchor();
    scheduleSeekBarRefresh();
    return;
  }
  setTimeout(seek, 150);
  setTimeout(seek, 450);
  setTimeout(() => {
    seek();
    pendingNativeSeekMs = null;
    syncSeekBarAnchor();
    scheduleSeekBarRefresh();
  }, 900);
}

function scheduleSeekBarRefresh() {
  clearTimeout(seekBarRefreshTimer);
  seekBarRefreshTimer = setTimeout(updateSeekBar, 300);
  setTimeout(updateSeekBar, 900);
}

function adjustSeekBarStep(direction) {
  const bar = $("seekBar");
  if (!bar || bar.disabled) return;
  seekBarEditing = true;
  const step = 25;
  const next = Math.max(0, Math.min(1000, Number(bar.value) + (direction * step)));
  bar.value = String(next);
  markPendingSeekFromBar();
  updateSeekBarHint();
}

function nativeSeekToPercent(percent) {
  if (!hasNativePlayer() || !nativePlayerActive) return false;
  const clamped = Math.max(0, Math.min(1, percent));
  try {
    const durationMs = getNativeDurationMs();
    if (durationMs > 0 && typeof window.StreamlineNativePlayer?.seekTo === "function") {
      window.StreamlineNativePlayer.seekTo(Math.round(durationMs * clamped));
      return true;
    }
    const targetValue = Math.round(clamped * 1000);
    const deltaUnits = targetValue - seekBarAnchorValue;
    const refMs = durationMs > 0
      ? durationMs
      : Math.max(seekBarAnchorPositionMs + 60000, lastNativeDurationMs, 5400000);
    const targetMs = durationMs > 0 ? durationMs * clamped : seekBarAnchorPositionMs + ((deltaUnits / 1000) * refMs);
    if (typeof window.StreamlineNativePlayer?.seekTo === "function") {
      window.StreamlineNativePlayer.seekTo(Math.max(0, Math.round(targetMs)));
      return true;
    }
    if (typeof window.StreamlineNativePlayer?.seekBySeconds === "function") {
      const currentMs = window.StreamlineNativePlayer.getCurrentPosition?.() || 0;
      const deltaSec = Math.round((targetMs - currentMs) / 1000);
      if (deltaSec !== 0) {
        window.StreamlineNativePlayer.seekBySeconds(deltaSec);
        return true;
      }
    }
  } catch (_error) {}
  return false;
}

function getNativeCurrentTimeSec() {
  try {
    return (window.StreamlineNativePlayer?.getCurrentPosition?.() || 0) / 1000;
  } catch (_error) {
    return 0;
  }
}

function nativeSeekToSeconds(seconds) {
  if (!hasNativePlayer() || !nativePlayerActive) return false;
  try {
    if (isVodPlaybackActive() && nativeVodUsesTranscodePipe()) {
      const nativeMs = window.StreamlineNativePlayer?.getCurrentPosition?.() || 0;
      const currentMs = Math.max(nativeMs, nativeVodRestartTargetMs || 0, seekBarAnchorPositionMs || 0);
      const targetMs = Math.max(0, currentMs + Math.round(seconds * 1000));
      seekBarAnchorPositionMs = targetMs;
      pendingNativeSeekMs = targetMs;
      if (restartNativeVodAt(targetMs)) {
        pendingNativeSeekMs = null;
        return true;
      }
    }
    if (typeof window.StreamlineNativePlayer?.seekBySeconds === "function") {
      window.StreamlineNativePlayer.seekBySeconds(Math.round(seconds));
      return true;
    }
    if (typeof window.StreamlineNativePlayer?.seekTo === "function") {
      const currentMs = window.StreamlineNativePlayer.getCurrentPosition?.() || 0;
      window.StreamlineNativePlayer.seekTo(Math.max(0, currentMs + Math.round(seconds * 1000)));
      return true;
    }
  } catch (_error) {}
  return false;
}

function enableHardwareVolume() {
  const player = $("videoPlayer");
  player.muted = false;
  player.volume = 1;
}

function seekPlayer(seconds) {
  if (nativePlayerActive && state.currentMedia?.type === "Channel" && !isVodPlaybackActive()) {
    try {
      if (typeof window.StreamlineNativePlayer?.seekBySeconds === "function") {
        window.StreamlineNativePlayer.seekBySeconds(Math.round(seconds));
        scheduleSeekBarRefresh();
        return;
      }
    } catch (_error) {}
    toast("This live channel cannot rewind or fast-forward.");
    return;
  }
  if (isVodPlaybackActive() && nativePlayerActive) {
    if (!nativeSeekToSeconds(seconds)) {
      toast("Rewind and fast-forward are not available for this stream yet.");
      return;
    }
    bumpSeekBarForNativeSeek(seconds);
    scheduleSeekBarRefresh();
    return;
  }
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
  if (hasNativePlayer() && nativePlayerActive) {
    if (!isVodPlaybackActive()) {
      toast("Live channels use RW and FF instead of the timeline.");
      return;
    }
    markPendingSeekFromBar();
    if (pendingNativeSeekMs == null) {
      toast("This title is still loading seek controls.");
      return;
    }
    applyPendingNativeSeek(pendingNativeSeekMs, { stayPaused: true });
    seekBarEditing = false;
    scheduleSeekBarRefresh();
    return;
  }
  const player = $("videoPlayer");
  if (!player.seekable?.length) return;
  const start = player.seekable.start(0);
  const end = player.seekable.end(player.seekable.length - 1);
  const percent = Number($("seekBar").value) / 1000;
  player.currentTime = start + ((end - start) * percent);
  showPlayerControls(true);
}

function updateSeekBar() {
  if (seekBarEditing || isSeekControlFocused()) return;
  if (hasNativePlayer() && nativePlayerActive && (isVodPlaybackActive() || state.currentMedia?.type === "Channel")) {
    const durationMs = getNativeDurationMs();
    if (durationMs <= 0) return;
    const current = getNativeCurrentTimeSec();
    $("seekBar").value = Math.round((current / (durationMs / 1000)) * 1000);
    syncSeekBarAnchor();
    if (isTvApp() && nativeMenuOverlayActive()) updatePlayerOptionStates();
    return;
  }
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
  if (hasNativePlayer() && nativePlayerActive) {
    state.captionsOn = !state.captionsOn;
    try {
      window.StreamlineNativePlayer?.setCaptionsEnabled?.(state.captionsOn);
    } catch (_error) {}
    $("ccButton").textContent = state.captionsOn ? "CC On" : "CC Off";
    showPlayerControls(true, { focusId: "ccButton" });
    toast(state.captionsOn ? "Captions on" : "Captions off");
    return;
  }
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

function liveCategoryForChannel(ch) {
  if (!ch) return "All Channels";
  if (ch.category && channelsForCategory(ch.category).some((item) => item.id === ch.id)) return ch.category;
  const smart = smartCategoryRules.find((rule) => matchesSmartCategory(ch, rule));
  if (smart && channelsForCategory(smart.name).some((item) => item.id === ch.id)) return smart.name;
  return "All Channels";
}

function ensureChannelRowRendered(channelId) {
  const list = $("channelList");
  if (!list) return null;
  const channels = list._channels || [];
  const index = channels.findIndex((ch) => ch.id === channelId);
  if (index < 0) return null;
  const token = liveRenderToken;
  let renderedEnd = Number(list.dataset.renderedEnd || 0);
  while (renderedEnd <= index && renderedEnd < channels.length) {
    appendChannelRows(list, channels, renderedEnd, Math.max(liveChunkSize, index - renderedEnd + 1), token);
    renderedEnd = Number(list.dataset.renderedEnd || 0);
  }
  updateActiveRows("channelList", "channelId", channelId);
  return list.querySelector(`[data-channel-id="${cssEscape(channelId)}"]`);
}

async function openLiveChannelFullscreen(ch) {
  if (!ch) return;
  clearTimeout(channelPreviewTimer);
  previewPlaybackKey = "";
  const cat = liveCategoryForChannel(ch);
  state.category = cat;
  state.selectedChannelId = ch.id;
  setView("live");
  $("sectionTitle").textContent = cat;
  renderLive();
  updateActiveRows("liveCategories", "category", cat);
  renderSelectedChannel({ loadGuide: true });
  ensureChannelRowRendered(ch.id);
  await playChannel(ch, false, { preview: false });
  await openPlayerFullscreen(false);
  setTimeout(() => {
    const row = $("channelList")?.querySelector(`[data-channel-id="${cssEscape(ch.id)}"]`);
    row?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, 80);
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
  if (options.play) {
    scheduleChannelPreview(ch);
    clearTimeout(channelInfoTimer);
    channelInfoTimer = setTimeout(() => {
      if (state.selectedChannelId !== ch.id) return;
      renderSelectedChannel({ loadGuide: false });
    }, previewDelayMs);
  } else {
    renderSelectedChannel({ loadGuide: false });
  }
}

function scheduleChannelPreview(ch) {
  clearTimeout(channelPreviewTimer);
  channelPreviewTimer = setTimeout(async () => {
    if (isVodPlaybackActive()) return;
    if (nativeMenuOverlayActive() || nativeMenuPauseRequested) return;
    if (document.body.classList.contains("tv-player-open")) return;
    if (state.view === "movies" || state.view === "series") return;
    if (state.view !== "live" || state.selectedChannelId !== ch.id) return;
    const player = $("videoPlayer");
    const previewKey = `${ch.id}:preview:${playableChannelSource(ch)}`;
    if (previewPlaybackKey === previewKey) {
      if (shouldUseNativeLivePlayer() && nativePlayerActive) return;
      if (
        !shouldUseNativeLivePlayer()
        && !player.paused
        && player.readyState >= 2
        && !player.error
      ) {
        return;
      }
    }
    if (state.view !== "live" || state.selectedChannelId !== ch.id) return;
    playChannel(ch, false, { preview: true });
    loadChannelGuide(ch);
  }, previewDelayMs);
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
  const smart = smartCategoryRules.find((rule) => rule.name === cat);
  if (smart) {
    const channels = data.channels.filter((ch) => matchesSmartCategory(ch, smart));
    libraryIndex.smartCategoryMap.set(cat, channels);
    return channels;
  }
  return libraryIndex.channelCategoryMap.get(cat) || [];
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

function shouldSkipNativeChannelPlayback(ch, preview, options = {}) {
  if (!ch || !preview || !shouldUseNativeLivePlayer(options) || !nativePlayerActive) return false;
  if (state.currentMedia?.id !== ch.id) return false;
  const useTranscoded = !!options.useTranscoded || channelPrefersTranscodedLive(ch);
  const source = playableChannelSource(ch, { useTranscoded });
  if (!source) return false;
  const playbackKey = `${ch.id}:preview:${source}`;
  return previewPlaybackKey === playbackKey;
}

async function playChannel(ch, showToast, options = {}) {
  if (!ch) return;
  const preview = !!options.preview;
  if (nativeMenuOverlayActive() || nativeMenuPauseRequested) return;
  if (preview && (isVodPlaybackActive() || document.body.classList.contains("tv-player-open") || state.view === "movies" || state.view === "series")) return;
  if (shouldSkipNativeChannelPlayback(ch, preview, options)) return;
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
  if (nativeMenuOverlayActive() || nativeMenuPauseRequested) return;
  if (shouldSkipNativeChannelPlayback(ch, preview, options)) return;
  state.currentMedia = { id: ch.id, title: ch.name, type: "Channel" };
  const useNative = shouldUseNativeLivePlayer(options);
  if (!useNative) stopNativePlayer();
  const useTranscoded = !!options.useTranscoded || channelPrefersTranscodedLive(ch);
  const source = playableChannelSource(ch, { useTranscoded });
  if (!source) {
    $("playState").textContent = "Preview";
    return;
  }
  const playbackKey = `${ch.id}:${preview ? "preview" : "full"}:${source}`;
  const player = $("videoPlayer");
  if (preview && previewPlaybackKey === playbackKey) {
    if (shouldUseNativeLivePlayer(options) && nativePlayerActive) return;
    if (
      !shouldUseNativeLivePlayer(options)
      && !player.paused
      && player.readyState >= 2
      && !player.error
    ) {
      return;
    }
  }
  previewPlaybackKey = preview ? playbackKey : "";
  logTvDebug("play-channel-start", {
    id: ch.id,
    streamId: ch.streamId,
    name: ch.name,
    source,
    preview,
    transcodeFallback: useTranscoded,
    native: shouldUseNativeLivePlayer(options)
  });
  if (shouldUseNativeLivePlayer(options)) {
    try {
      player.muted = true;
      player.pause();
    } catch (_error) {}
    player.poster = "";
    clearPreviewFramePoster();
    clearVideoError();
    $("playState").textContent = "Loading";
    document.body.classList.add("native-live-active");
    const fullscreen = document.body.classList.contains("tv-player-open");
    if (startNativePlayer(source, fullscreen)) {
      if (!fullscreen) {
        requestAnimationFrame(() => repositionNativePlayer(false));
      }
      return;
    }
    document.body.classList.remove("native-live-active");
    clearPreviewFramePoster();
    $("playState").textContent = preview ? "Preview" : "Unavailable";
    if (!preview) showVideoError(`${ch.name} could not start native playback.`);
    return;
  }
  resetVideoPlayer(player);
  player.muted = true;
  player.poster = ch.image || "";
  clearVideoError();
  $("playState").textContent = "Loading";
  player.addEventListener("loadeddata", () => {
    if (requestId === playbackRequestId) clearVideoError();
  }, { once: true });
  player.addEventListener("canplay", () => {
    if (requestId === playbackRequestId) clearVideoError();
  }, { once: true });
  player.addEventListener("playing", () => {
    if (requestId !== playbackRequestId) return;
    player.muted = false;
    enableHardwareVolume();
    clearVideoError();
    if (player.videoWidth > 0 && player.videoHeight > 0) player.poster = "";
    $("playState").textContent = preview ? "Preview" : "Playing";
  }, { once: true });
  await loadVideoSource(player, source);
  if (requestId !== playbackRequestId) return;
  if (source.includes("live-hls")) {
    await waitForVideoReady(player, 14000);
  } else if (source.includes("transcode-live")) {
    await waitForVideoReady(player, 12000);
  }
  if (requestId !== playbackRequestId) return;
  const recoverChannelPlayback = (reason) => {
    if (requestId !== playbackRequestId) return;
    logTvDebug(reason, { id: ch.id, name: ch.name, useTranscoded });
    if (!useTranscoded && ch.streamId && isTvApp()) {
      playChannel(ch, showToast, { ...options, preview, useTranscoded: true }).catch(() => {});
      return;
    }
    resetVideoPlayer(player);
    player.poster = ch.image || "";
    $("playState").textContent = preview ? "Preview" : "Unavailable";
    if (!preview) showVideoError(`${ch.name} is not available right now.`);
  };
  player.onerror = () => recoverChannelPlayback("channel-video-error");
  if ($("autoplayToggle")?.checked !== false) {
    $("playState").textContent = preview ? "Preview" : "Loading";
    safePlayVideo(player, preview ? "channel-preview" : "channel", { id: ch.id, name: ch.name }, preview ? 2 : 3).then(() => {
      if (requestId !== playbackRequestId) return;
      $("playState").textContent = preview ? "Preview" : "Playing";
      showPlayerControls(false);
    }).catch(() => {
      recoverChannelPlayback("channel-play-rejected");
    });
  }
}

async function playMedia(item, showToast = true) {
  const title = item.title || item.name || "Selected title";
  const mediaKey = item.id || item.streamUrl || title;
  const now = Date.now();
  if (now < playMediaLockUntil && mediaKey === playMediaLastKey) return;
  playMediaLockUntil = now + 400;
  playMediaLastKey = mediaKey;

  clearTimeout(channelPreviewTimer);
  const requestId = ++playbackRequestId;
  state.currentMedia = { ...item, title };
  const mediaSource = playableMediaSource(item, { forceTranscode: !!item.forceTranscode });
  logTvDebug("play-media-start", { id: item.id, title, type: item.type, container: item.container, source: mediaSource, native: useNativePlayerForVod() });
  $("nowCategory").textContent = item.category || item.type || "Now Playing";
  $("nowTitle").textContent = title;
  $("nowDesc").textContent = item.description || item.program || `${item.type || "Video"} playback`;
  $("favoriteButton").textContent = isFavorite(item.id) ? "Unfavorite" : "Favorite";

  if (useNativePlayerForVod() && mediaSource) {
    clearVideoError();
    clearPreviewFramePoster();
    $("playState").textContent = "Loading";
    document.body.classList.add("native-live-active");
    if (startNativePlayer(mediaSource, true)) {
      if (isTvApp()) {
        if (state.view !== "live") {
          state.returnView = state.view;
          if (state.view === "series") state.returnSeriesScreen = state.seriesScreen;
        }
        setView("live", { keepPlayerOpen: true });
        $("sectionKicker").textContent = item.type || "Video";
        $("sectionTitle").textContent = title;
        $("miniGuide").innerHTML = "";
        openPlayerFullscreen(false);
      } else {
        setView("live");
        $("sectionKicker").textContent = item.type || "Video";
        $("sectionTitle").textContent = title;
        $("miniGuide").innerHTML = "";
        setTimeout(() => {
          if (requestId !== playbackRequestId) return;
          openPlayerFullscreen(false);
        }, 80);
      }
      if (showToast) toast(`Opening ${title}`);
      return;
    }
  }

  logTvDebug("play-media-web", { id: item.id, title, type: item.type, source: mediaSource });
  const player = $("videoPlayer");
  enableHardwareVolume();
  resetVideoPlayer(player);
  player.poster = item.image || "";
  clearVideoError();
  await loadVideoSource(player, mediaSource);
  if (requestId !== playbackRequestId) return;
  if (isTvApp() && mediaSource.includes("transcode-movie")) {
    await waitForVideoReady(player, 8000);
  }
  if (requestId !== playbackRequestId) return;
  enableHardwareVolume();
  player.onerror = () => {
    if (requestId !== playbackRequestId) return;
    logTvDebug("media-video-error", { id: item.id, title, type: item.type });
    showVideoError(`${title} is not available right now.`);
  };
  $("playState").textContent = "Loading";
  const playAttempts = mediaSource.includes("transcode-movie") ? 1 : (isTvApp() ? 2 : 3);
  safePlayVideo(player, "media", { id: item.id, title, type: item.type }, playAttempts).then(() => {
    if (requestId !== playbackRequestId) return;
    $("playState").textContent = "Playing";
    showPlayerControls(false);
  }).catch(() => {
    if (requestId !== playbackRequestId) return;
    logTvDebug("media-play-rejected", { id: item.id, title, type: item.type });
    showVideoError(`Press play to start ${title}.`);
  });
  if (isTvApp()) {
    if (state.view !== "live") {
      state.returnView = state.view;
      if (state.view === "series") state.returnSeriesScreen = state.seriesScreen;
    }
    setView("live", { keepPlayerOpen: true });
    $("sectionKicker").textContent = item.type || "Video";
    $("sectionTitle").textContent = title;
    $("miniGuide").innerHTML = "";
    openPlayerFullscreen(false);
  } else {
    setView("live");
    $("sectionKicker").textContent = item.type || "Video";
    $("sectionTitle").textContent = title;
    $("miniGuide").innerHTML = "";
    setTimeout(() => {
      if (requestId !== playbackRequestId) return;
      openPlayerFullscreen(false);
    }, 80);
  }
  if (showToast) toast(`Opening ${title}`);
}

function isVodMedia(media) {
  const type = media?.type;
  return type === "Movie" || type === "Episode";
}

function isVodPlaybackActive() {
  return isVodMedia(state.currentMedia);
}

function stopVideoPlayback() {
  playbackRequestId += 1;
  clearTimeout(channelPreviewTimer);
  previewPlaybackKey = "";
  if (hasNativePlayer()) stopNativePlayer();
  const player = $("videoPlayer");
  resetVideoPlayer(player);
  player.poster = "";
  $("playState").textContent = "Ready";
  $("videoOverlay").classList.remove("visible");
  showPlayerControls(false);
  const ch = selectedChannel();
  state.currentMedia = ch ? { id: ch.id, title: ch.name, type: "Channel" } : null;
}

function resetVideoPlayer(player = $("videoPlayer")) {
  if (hlsPlayer) {
    try {
      hlsPlayer.destroy();
    } catch (_error) {}
    hlsPlayer = null;
  }
  player.onerror = null;
  try {
    player.pause();
  } catch (_error) {}
  player.removeAttribute("src");
  try {
    player.load();
  } catch (_error) {}
}

function clearPreviewPlayer() {
  if (isVodPlaybackActive() || document.body.classList.contains("tv-player-open")) {
    stopVideoPlayback();
    return;
  }
  const player = $("videoPlayer");
  if (player.poster) player.poster = "";
}

function transcodeMovieUrl(url, options = {}) {
  let source = `/api/transcode-movie?url=${encodeURIComponent(url)}`;
  const startSeconds = Math.max(0, Math.round(Number(options.startSeconds || 0)));
  if (startSeconds > 0) source += `&start=${startSeconds}`;
  return source;
}

function playableMediaSource(item, options = {}) {
  const url = item.streamUrl || videoUrl;
  if (!url) return "";
  const source = `${item.container || ""} ${url}`.toLowerCase();
  const needsTranscode = source.includes(".mkv") || source.includes("mkv");
  if (options.forceTranscode || item.forceTranscode) {
    return transcodeMovieUrl(url, options);
  }
  if (isTvApp()) {
    if (needsTranscode || item.type === "Movie" || item.type === "Episode") {
      return transcodeMovieUrl(url, options);
    }
    return absoluteStreamUrl(url);
  }
  if (needsTranscode) {
    return transcodeMovieUrl(url, options);
  }
  if (useNativePlayerForVod()) return absoluteStreamUrl(url);
  return url;
}

function playableChannelSource(ch, options = {}) {
  if (isTvApp() && ch?.streamId) {
    if (options.useTranscoded || channelNeedsTranscodedPreview(ch)) {
      return `/api/live-hls/${encodeURIComponent(ch.streamId)}/playlist.m3u8`;
    }
    return `/api/stream/live/${encodeURIComponent(ch.streamId)}.m3u8`;
  }
  if (options.transcode && ch?.streamId) {
    return `/api/transcode-live/${encodeURIComponent(ch.streamId)}.mp4`;
  }
  if (ch?.streamUrl) return ch.streamUrl;
  if (ch?.streamId) return `/api/stream/live/${encodeURIComponent(ch.streamId)}.m3u8`;
  return "";
}

function loadVideoSource(player, source) {
  const url = source || "";
  if (url && sameVideoSource(player, url) && player.readyState >= 1 && !hlsPlayer) return Promise.resolve();
  logTvDebug("load-video-source", { source: url });
  resetVideoPlayer(player);
  player.muted = true;
  if (!url) {
    showVideoError("No stream URL for this channel.");
    return Promise.resolve();
  }
  if (isHlsUrl(url) && shouldUseNativeHlsOnThisDevice()) {
    player.src = url;
    player.load();
    return waitForVideoReady(player, 2600);
  }
  if (isHlsUrl(url) && window.Hls?.isSupported()) {
    return attachHlsSource(player, url);
  }
  player.src = url;
  player.load();
  return waitForVideoReady(player, url.includes("transcode-live") || url.includes("live-hls") ? 14000 : 1600);
}

function attachHlsSource(player, url) {
  return new Promise((resolve) => {
    let settled = false;
    let fatalRetries = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    hlsPlayer = new window.Hls({
      enableWorker: !isTvApp(),
      lowLatencyMode: false,
      backBufferLength: 20,
      maxBufferLength: 18,
      maxMaxBufferLength: 36,
      manifestLoadingMaxRetry: 2,
      levelLoadingMaxRetry: 2,
      fragLoadingMaxRetry: 2
    });
    hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, finish);
    hlsPlayer.on(window.Hls.Events.ERROR, (_event, data) => {
      if (!data?.fatal) return;
      logTvDebug("hls-fatal-error", { type: data.type, details: data.details, url, fatalRetries });
      if (fatalRetries < 2 && data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
        fatalRetries += 1;
        try {
          hlsPlayer.startLoad(-1);
          return;
        } catch (_error) {}
      }
      if (fatalRetries < 2 && data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
        fatalRetries += 1;
        try {
          hlsPlayer.recoverMediaError();
          return;
        } catch (_error) {}
      }
      try {
        hlsPlayer.destroy();
      } catch (_error) {}
      hlsPlayer = null;
      try {
        player.pause();
      } catch (_error) {}
      finish();
    });
    hlsPlayer.loadSource(url);
    hlsPlayer.attachMedia(player);
    setTimeout(finish, isTvApp() ? 2200 : 1500);
  });
}

function shouldUseNativeHlsOnThisDevice() {
  return isTvApp() && !window.Hls?.isSupported();
}

function waitForVideoReady(player, timeout = 1800) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      player.removeEventListener("loadedmetadata", finish);
      player.removeEventListener("loadeddata", finish);
      player.removeEventListener("canplay", finish);
      resolve();
    };
    if (player.readyState >= 2) return finish();
    player.addEventListener("loadedmetadata", finish, { once: true });
    player.addEventListener("loadeddata", finish, { once: true });
    player.addEventListener("canplay", finish, { once: true });
    setTimeout(finish, timeout);
  });
}

function safePlayVideo(player, label, detail = {}, attempts = 2) {
  let remaining = Math.max(1, attempts);
  const tryPlay = () => {
    return player.play().catch((error) => {
      remaining -= 1;
      logTvDebug("video-play-attempt-failed", {
        label,
        remaining,
        message: error?.message,
        readyState: player.readyState,
        networkState: player.networkState,
        currentSrc: player.currentSrc || player.src,
        ...detail
      });
      if (remaining <= 0) throw error;
      return waitForVideoReady(player, 1200).then(() => new Promise((resolve) => {
        setTimeout(resolve, isTvApp() ? 350 : 150);
      })).then(tryPlay);
    });
  };
  return tryPlay();
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

function showChannelPlaybackError(message, ch) {
  nativePlayerActive = false;
  nativePlayerPlaying = false;
  previewPlaybackKey = "";
  document.body.classList.remove("native-live-active");
  try {
    window.StreamlineNativePlayer?.stop?.();
  } catch (_error) {}
  const player = $("videoPlayer");
  logTvDebug("show-video-error", { message, channel: ch?.name || "" });
  try {
    player.muted = true;
    player.pause();
  } catch (_error) {}
  player.poster = ch?.image || "";
  if (ch?.image) setPreviewFramePoster(ch);
  $("playState").textContent = ch?.name ? `${ch.name} is not available.` : "Unavailable";
  $("videoOverlay").classList.add("visible");
  document.body.classList.add("channel-unavailable");
  showPlayerControls(false);
  if (!document.body.classList.contains("tv-player-open")) {
    toast(message || "Channel unavailable.");
  }
}

function showVideoError(message) {
  const ch = selectedChannel()
    || (state.currentMedia?.type === "Channel"
      ? data.channels.find((item) => item.id === state.currentMedia.id)
      : null);
  if (isTvApp() && ch) {
    showChannelPlaybackError(message, ch);
    return;
  }
  const player = $("videoPlayer");
  logTvDebug("show-video-error", { message });
  $("playState").textContent = "Unavailable";
  resetVideoPlayer(player);
  if (ch?.image && state.view === "live" && !document.body.classList.contains("tv-player-open")) {
    player.poster = ch.image;
  }
  $("videoOverlay").classList.add("visible");
  showPlayerControls(false);
  toast(message);
}

function clearVideoError() {
  document.body.classList.remove("channel-unavailable");
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

function changeChannel(direction, options = {}) {
  const channels = filteredChannels();
  if (!channels.length) return null;
  const currentIndex = Math.max(0, channels.findIndex((ch) => ch.id === state.selectedChannelId));
  const next = channels[(currentIndex + direction + channels.length) % channels.length];
  state.selectedChannelId = next.id;
  updateActiveRows("channelList", "channelId", next.id);
  const preview = options.preview ?? !document.body.classList.contains("tv-player-open");
  clearTimeout(channelPreviewTimer);
  playChannel(next, false, { preview });
  if (preview) {
    clearTimeout(channelInfoTimer);
    channelInfoTimer = setTimeout(() => {
      if (state.selectedChannelId !== next.id) return;
      renderSelectedChannel({ loadGuide: false });
    }, previewDelayMs);
  } else {
    renderSelectedChannel();
  }
  const row = $("channelList")?.querySelector(`[data-channel-id="${cssEscape(next.id)}"]`);
  row?.focus();
  row?.scrollIntoView({ block: "nearest", inline: "nearest" });
  return next;
}

function surfChannel(direction) {
  changeChannel(direction, { preview: false });
  if (!isTvApp() && !(document.fullscreenElement || document.webkitFullscreenElement)) {
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

function focusMovieCategoryTab() {
  const tab = $("movieTabs")?.querySelector(".chip.active") || $("movieTabs")?.querySelector(".chip");
  tab?.focus();
  tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function renderMovies(options = {}) {
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
      renderMovies({ focusTab: true });
    });
    tabs.appendChild(btn);
  });

  let movies = state.movieCategory === "Featured" ? [...data.movies] : data.movies.filter((m) => m.category === state.movieCategory);
  movies.sort((a, b) => compareMoviesForDisplay(a, b, { titleAsc: state.movieSortAsc }));
  renderPosterGrid($("movieGrid"), movies, openMovieDetail, gridLimit);
  renderMovieDetail();
  if (isTvApp() && options.focusTab) {
    setTimeout(() => focusMovieCategoryTab(), 0);
  }
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
    suppressEnterUntil = Date.now() + 500;
    stopVideoPlayback();
    state.selectedSeriesId = item.id;
    state.seriesScreen = "detail";
    renderSeriesDetail();
    setTimeout(() => focusSeriesDetail(), 0);
    loadSeriesEpisodes(item).catch((error) => {
      logTvDebug("series-episodes-error", { id: item.id, title: item.title, message: error.message });
    }).finally(() => {
      if (state.selectedSeriesId === item.id) setTimeout(() => focusSeriesDetail(), 0);
    });
  }, gridLimit);
  renderSeriesDetail();
}

function focusSeriesGrid() {
  const grid = $("seriesGrid");
  if (!grid) return;
  const card = grid.querySelector(`[data-item-id="${cssEscape(state.selectedSeriesId)}"]`) || grid.querySelector(".poster-card");
  card?.focus();
  card?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function focusSeriesDetail() {
  const detail = $("seriesDetail");
  if (!detail) return;
  state.seriesScreen = "detail";
  detail.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (!isTvApp()) return;
  const heading = detail.querySelector("h3");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

function restoreViewAfterPlayer() {
  if (!state.returnView || state.returnView === "live") return false;
  const returnView = state.returnView;
  const returnSeriesScreen = state.returnSeriesScreen || "detail";
  state.returnView = null;
  state.returnSeriesScreen = null;
  if (returnView === "series") {
    state.seriesScreen = returnSeriesScreen;
    setView("series", { preserveSeriesScreen: true });
    setTimeout(() => {
      if (state.seriesScreen === "detail") focusSeriesDetail();
      else focusSeriesGrid();
    }, 0);
    return true;
  }
  setView(returnView);
  return true;
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
      row.addEventListener("click", async (event) => {
        if (Date.now() < suppressEnterUntil) {
          event.preventDefault();
          return;
        }
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
    if (item.id) card.dataset.itemId = item.id;
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
  ensureSearchIndex();
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
  }) : libraryIndex.searchItems).slice(0, 40);
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
    if (isTvApp()) {
      openLiveChannelFullscreen(result.item);
    } else {
      state.category = liveCategoryForChannel(result.item);
      state.selectedChannelId = result.item.id;
      setView("live");
      renderLive();
      playSelectedChannel(true);
    }
    return;
  }
  if (result.type === "Movie") {
    openMovieDetail(result.item);
    return;
  }
  if (result.type === "Series") {
    state.selectedSeriesId = result.item.id;
    suppressEnterUntil = Date.now() + 500;
    setView("series");
    renderSeriesDetail();
    setTimeout(() => focusSeriesDetail(), 0);
    loadSeriesEpisodes(result.item).catch(() => {});
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
