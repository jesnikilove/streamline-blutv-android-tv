const videoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const state = {
  loginMode: "xtream",
  view: "live",
  category: "All Channels",
  selectedChannelId: "ch-1",
  movieCategory: "Featured",
  selectedSeriesId: "ser-1",
  favorites: new Set(JSON.parse(localStorage.getItem("streamlineFavorites") || "[]")),
  movieSortAsc: true,
  usingProviderData: false
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
  return { id, title, category, year, image, type: "Movie" };
}

function series(id, title, category, seasons, image) {
  const seasonList = [];
  for (let s = 1; s <= Math.min(seasons, 6); s += 1) {
    const episodes = [];
    for (let e = 1; e <= 5; e += 1) {
      episodes.push({ season: s, episode: e, title: `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")} - Episode ${e}` });
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

function saveLogin() {
  const provider = state.loginMode === "xtream" ? $("serverInput").value.trim() : $("playlistInput").value.trim();
  localStorage.setItem("streamlineProviderName", provider || "Demo Provider");
  localStorage.setItem("streamlineLoginMode", state.loginMode);
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
    state.selectedSeriesId = data.series[0]?.id || "";
    saveLogin();
    localStorage.setItem("streamlineProviderCache", JSON.stringify(parsed.data));
    setLoginStatus("Provider loaded.");
    showHome();
  } catch (error) {
    setLoginStatus(error.message || "Could not load provider.");
  } finally {
    $("loginButton").disabled = false;
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
  $("clearCache").addEventListener("click", () => {
    localStorage.removeItem("streamlineFavorites");
    localStorage.removeItem("streamlineProviderCache");
    state.favorites = new Set();
    renderAll();
    toast("Demo cache cleared");
  });
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      $("fullscreenButton").textContent = "Exit Fullscreen";
    } else {
      await document.exitFullscreen();
      $("fullscreenButton").textContent = "Fullscreen";
    }
  } catch (_error) {
    toast("Fullscreen is blocked by this browser.");
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
      state.selectedChannelId = ch.id;
      renderLive();
      playSelectedChannel(true);
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
  const player = $("videoPlayer");
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
  renderPosterGrid($("movieGrid"), movies);
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
      row.addEventListener("click", () => toast(`Opening ${show.title} ${ep.title}`));
      episodes.appendChild(row);
    });
  });
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
      else toast(`Opening ${item.title}`);
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
  const q = $("searchInput")?.value?.trim().toLowerCase() || "";
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
    ...data.channels.map((item) => ({ title: item.name, subtitle: item.program, type: "Channel", image: item.image })),
    ...data.movies.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.year}`, type: "Movie", image: item.image })),
    ...data.series.map((item) => ({ title: item.title, subtitle: `${item.category} ${item.seasons} seasons`, type: "Series", image: item.image }))
  ];
  const results = (q ? everything.filter((item) => `${item.title} ${item.subtitle} ${item.type}`.toLowerCase().includes(q)) : everything).slice(0, 16);
  const box = $("searchResults");
  box.innerHTML = "";
  results.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "search-row focusable";
    row.innerHTML = `<span class="search-type">${item.type}</span><span><strong>${item.title}</strong><br><small>${item.subtitle}</small></span><span>Open</span>`;
    row.addEventListener("click", () => toast(`Opening ${item.title}`));
    box.appendChild(row);
  });
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
