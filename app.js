const videoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

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
  recording: null
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
  const cache = localStorage.getItem("streamlineProviderCache");
  if (cache) {
    try {
      data = JSON.parse(cache);
      state.usingProviderData = true;
      state.category = data.categories[0] || state.category;
      state.selectedChannelId = data.channels[0]?.id || state.selectedChannelId;
      state.movieCategory = data.movieTabs[0] || state.movieCategory;
      state.selectedMovieId = data.movies[0]?.id || state.selectedMovieId;
      state.selectedSeriesId = data.series[0]?.id || state.selectedSeriesId;
    } catch (_error) {
      localStorage.removeItem("streamlineProviderCache");
    }
  }
  bindLogin();
  bindNavigation();
  bindActions();
  renderAll();
  updateClock();
  setInterval(updateClock, 1000 * 30);

  if (localStorage.getItem("streamlineLoggedIn") === "true") {
    showHome();
  } else {
    $("loginButton").focus();
  }
}

function bindLogin() {
  document.querySelectorAll("[data-login-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setLoginMode(btn.dataset.loginMode));
  });
  $("loginButton").addEventListener("click", loginWithProvider);
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

function saveLogin(payload) {
  const provider = payload
    ? payload.server || payload.playlistUrl
    : state.loginMode === "xtream" ? $("serverInput").value.trim() : $("playlistInput").value.trim();
  localStorage.setItem("streamlineProviderName", provider || "Demo Provider");
  localStorage.setItem("streamlineLoginMode", payload?.mode || state.loginMode);
  localStorage.setItem("streamlineLoggedIn", "true");
}

async function loginWithProvider() {
  setLoginStatus("Loading provider data...");
  $("loginButton").disabled = true;
  try {
    const payload = state.loginMode === "xtream"
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

async function loadProviderCatalog(payload) {
  const response = await fetch("/api/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
  });
  const parsed = await response.json();
  if (!response.ok || !parsed.ok) throw new Error(parsed.message || "Provider login failed.");

  data = parsed.data;
  state.usingProviderData = true;
  state.category = data.categories[0] || "All Channels";
  state.selectedChannelId = data.channels[0]?.id || "";
  state.movieCategory = data.movieTabs[0] || "Featured";
  state.selectedMovieId = data.movies[0]?.id || "";
  state.selectedSeriesId = data.series[0]?.id || "";
  saveLogin(payload);
  persistProviderCache(parsed.data);
  updateCacheInfo();
  return parsed.data;
}

function persistProviderCache(library) {
  try {
    localStorage.setItem("streamlineProviderCache", JSON.stringify(library));
  } catch (_error) {
    localStorage.removeItem("streamlineProviderCache");
    toast("Full catalog loaded for this session. Cache was too large to save.");
  }
}

function setLoginStatus(message) {
  const status = $("loginStatus");
  if (status) status.textContent = message;
}

function showHome() {
  $("loginScreen").classList.add("hidden");
  $("homeScreen").classList.remove("hidden");
  $("providerText").textContent = localStorage.getItem("streamlineProviderName") || "Demo Provider";
  $("settingsProvider").textContent = $("providerText").textContent;
  updateCacheInfo();
  renderLive();
  playSelectedChannel(false);
  document.querySelector(".nav-item.active").focus();
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  document.addEventListener("keydown", (event) => {
    if ($("homeScreen").classList.contains("hidden")) return;
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

function setView(view) {
  state.view = view;
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
  $("playerPlayPause").addEventListener("click", togglePlayerPlayback);
  $("ccButton").addEventListener("click", toggleCaptions);
  $("wideButton").addEventListener("click", toggleWideMode);
  $("recordButton").addEventListener("click", toggleRecording);
  $("exitFullscreenButton").addEventListener("click", exitPlayerFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
  $("sortMovies").addEventListener("click", () => {
    state.movieSortAsc = !state.movieSortAsc;
    $("sortMovies").textContent = state.movieSortAsc ? "A-Z" : "Z-A";
    renderMovies();
  });
  $("searchInput").addEventListener("input", renderSearch);
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
    state.favorites = new Set();
    renderAll();
    toast("Demo cache cleared");
  });
  updateCacheInfo();
}

async function toggleFullscreen() {
  if (state.view !== "live") setView("live");
  await openPlayerFullscreen(true);
}

async function openPlayerFullscreen(showControls = false) {
  try {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fullscreenElement) {
      const target = $("videoFrame");
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      } else {
        throw new Error("Fullscreen unsupported");
      }
      if (showControls) {
        $("videoPlayer").pause();
        showPlayerControls(true);
      }
    } else {
      await exitPlayerFullscreen();
    }
    syncFullscreenButton();
  } catch (_error) {
    $("videoPlayer").pause();
    showPlayerControls(true);
    toast("Fullscreen is blocked by this browser. Player controls are open.");
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
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  $("fullscreenButton").textContent = fullscreenElement ? "Exit Player" : "Player Fullscreen";
  if (!fullscreenElement) showPlayerControls(false);
}

function showPlayerControls(show) {
  $("playerControls").classList.toggle("hidden", !show);
  $("videoFrame").classList.toggle("controls-open", show);
  $("controlMediaTitle").textContent = state.currentMedia?.title || $("nowTitle").textContent || "Paused";
  $("playerPlayPause").textContent = $("videoPlayer").paused ? "Play" : "Pause";
  if (show) $("playerPlayPause").focus();
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

function toggleCaptions() {
  state.captionsOn = !state.captionsOn;
  $("ccButton").textContent = state.captionsOn ? "CC On" : "CC Off";
  toast(state.captionsOn ? "Captions requested" : "Captions off");
}

function toggleWideMode() {
  state.wideMode = !state.wideMode;
  $("videoFrame").classList.toggle("wide-mode", state.wideMode);
  $("wideButton").textContent = state.wideMode ? "Fit" : "Wide";
}

function toggleRecording() {
  const player = $("videoPlayer");
  if (state.recording) {
    state.recording.stop();
    state.recording = null;
    $("recordButton").textContent = "Record";
    toast("Recording stopped");
    return;
  }
  if (!player.captureStream || typeof MediaRecorder === "undefined") {
    toast("Recording is not available in this browser.");
    return;
  }
  try {
    const chunks = [];
    const recorder = new MediaRecorder(player.captureStream());
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "streamline-recording.webm";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    recorder.start();
    state.recording = recorder;
    $("recordButton").textContent = "Stop";
    toast("Recording started");
  } catch (_error) {
    toast("Recording is blocked for this stream.");
  }
}

function renderAll() {
  renderLive();
  renderMovies();
  renderSeries();
  renderFavorites();
  renderSearch();
}

function renderLive() {
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
  channels.forEach((ch) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "list-row focusable" + (ch.id === state.selectedChannelId ? " active" : "");
    row.innerHTML = `<span class="row-title">${isFavorite(ch.id) ? "Star " : ""}${ch.name}</span><span class="row-sub">${ch.program}</span>`;
    row.addEventListener("click", () => {
      const alreadySelected = state.selectedChannelId === ch.id;
      state.selectedChannelId = ch.id;
      renderLive();
      playSelectedChannel(true);
      if (alreadySelected) openPlayerFullscreen();
    });
    list.appendChild(row);
  });

  renderSelectedChannel();
}

function filteredChannels() {
  if (state.category === "All Channels") return data.channels;
  return data.channels.filter((ch) => ch.category === state.category);
}

function countChannels(cat) {
  return cat === "All Channels" ? data.channels.length : data.channels.filter((ch) => ch.category === cat).length;
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
    const row = document.createElement("div");
    row.className = "guide-item";
    row.innerHTML = `<span>${item.time}</span><span>${item.title}</span>`;
    guide.appendChild(row);
  });
}

function playSelectedChannel(showToast) {
  const ch = selectedChannel();
  if (!ch) return;
  state.currentMedia = { id: ch.id, title: ch.name, type: "Channel" };
  const player = $("videoPlayer");
  player.muted = false;
  player.volume = 1;
  player.poster = ch.image;
  player.src = ch.streamUrl || videoUrl;
  player.onerror = () => {
    $("playState").textContent = "Preview";
    player.src = videoUrl;
    player.play().catch(() => {});
  };
  if ($("autoplayToggle")?.checked !== false) {
    player.play().then(() => {
      $("playState").textContent = "Playing";
    }).catch(() => {
      $("playState").textContent = "Preview";
    });
  }
  if (showToast) toast(`Opening ${ch.name}`);
}

function playMedia(item, showToast = true) {
  const title = item.title || item.name || "Selected title";
  state.currentMedia = { ...item, title };
  $("nowCategory").textContent = item.category || item.type || "Now Playing";
  $("nowTitle").textContent = title;
  $("nowDesc").textContent = item.description || item.program || `${item.type || "Video"} playback`;
  $("favoriteButton").textContent = isFavorite(item.id) ? "Unfavorite" : "Favorite";

  const player = $("videoPlayer");
  player.muted = false;
  player.volume = 1;
  player.poster = item.image || "";
  player.src = item.streamUrl || videoUrl;
  player.onerror = () => {
    $("playState").textContent = "Preview";
    player.src = videoUrl;
    player.play().catch(() => {});
  };
  player.play().then(() => {
    $("playState").textContent = "Playing";
  }).catch(() => {
    $("playState").textContent = "Preview";
  });
  setView("live");
  if (showToast) toast(`Opening ${title}`);
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
  $("guideTimes").innerHTML = ["7:00 PM", "7:30 PM", "8:00 PM", "9:00 PM"].map((t) => `<div>${t}</div>`).join("");
  const rows = $("guideRows");
  rows.innerHTML = "";
  data.channels.forEach((ch) => {
    const row = document.createElement("div");
    row.className = "guide-row";
    row.innerHTML = `<div class="guide-channel">${ch.name}</div>` + ch.guide.map((g, i) => `<div class="program-block ${i === 0 ? "now" : ""}"><strong>${g.title}</strong><span>${g.time}</span></div>`).join("");
    rows.appendChild(row);
  });
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
  movies.sort((a, b) => state.movieSortAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));
  renderPosterGrid($("movieGrid"), movies, openMovieDetail);
  renderMovieDetail();
}

function openMovieDetail(movie) {
  state.selectedMovieId = movie.id;
  setView("movies");
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
  });
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

function renderPosterGrid(container, items, handler) {
  container.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "poster-card focusable";
    card.innerHTML = `
      <div class="poster-art" style="background-image:url('${item.image}')"></div>
      <div class="poster-info"><strong>${item.title}</strong><span>${item.category} ${item.year || ""}</span></div>
    `;
    card.addEventListener("click", () => {
      if (handler) handler(item);
      else playMedia(item);
    });
    container.appendChild(card);
  });
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

  const everything = [
    ...data.channels.map((item) => ({ title: item.name, subtitle: item.program, type: "Channel", image: item.image, item })),
    ...data.movies.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.year || ""}`, type: "Movie", image: item.image, item })),
    ...data.series.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.seasons} seasons`, type: "Series", image: item.image, item }))
  ];
  const terms = q.split(" ").filter(Boolean);
  const results = (q ? everything.filter((item) => {
    const haystack = normalizeSearch(`${item.title} ${item.subtitle} ${item.type}`);
    return terms.every((term) => haystack.includes(term));
  }) : everything).slice(0, 80);
  const box = $("searchResults");
  box.innerHTML = "";
  if (results.length === 0) {
    box.innerHTML = `<div class="empty-state">No results found.</div>`;
    return;
  }
  results.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "search-row focusable";
    row.innerHTML = `<span class="search-type">${item.type}</span><span><strong>${item.title}</strong><br><small>${item.subtitle}</small></span><span>Open</span>`;
    row.addEventListener("click", () => openSearchResult(item));
    box.appendChild(row);
  });
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
  const payloadText = sessionStorage.getItem("streamlineLastProviderPayload");
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

function updateCacheInfo() {
  const info = $("cacheInfo");
  if (!info) return;
  info.textContent = `${data.channels.length} channels, ${data.movies.length} movies, ${data.series.length} series loaded.`;
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
