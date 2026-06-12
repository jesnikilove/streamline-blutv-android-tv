const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4188);
const host = process.env.HOST || "127.0.0.1";
const liveLimit = readLimit(process.env.LIVE_LIMIT);
const vodLimit = readLimit(process.env.VOD_LIMIT);
const seriesLimit = readLimit(process.env.SERIES_LIMIT);
let providerSession = invalidSession();
const liveHlsSessions = new Map();
const movieHlsSessions = new Map();
const clientLogs = [];

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
    if (req.method === "POST" && req.url === "/api/load") {
      const body = await readJson(req);
      const result = body.mode === "m3u" ? await loadM3u(body.playlistUrl) : await loadXtream(body);
      return sendJson(res, 200, { ok: true, data: result });
    }
    if (req.method === "POST" && req.url === "/api/session") {
      const body = await readJson(req);
      const result = body.mode === "m3u" ? { ready: true } : await warmXtreamSession(body);
      return sendJson(res, 200, { ok: true, data: result });
    }
    if (req.method === "POST" && req.url === "/api/series-info") {
      const body = await readJson(req);
      const result = await loadSeriesInfo(body.seriesId);
      return sendJson(res, 200, { ok: true, data: result });
    }
    if (req.method === "POST" && req.url === "/api/channel-epg") {
      const body = await readJson(req);
      const result = await loadChannelEpg(body.streamId, body.streamUrl);
      return sendJson(res, 200, { ok: true, data: result });
    }
    if (req.method === "POST" && req.url === "/api/client-log") {
      const body = await readJson(req);
      addClientLog(body);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "GET" && req.url.startsWith("/api/client-logs")) {
      return sendJson(res, 200, { ok: true, logs: clientLogs.slice(-120) });
    }
    if (req.method === "GET" && req.url.startsWith("/api/stream/live/")) {
      return proxyLiveStream(req, res);
    }
    if (req.method === "GET" && req.url.startsWith("/api/stream-proxy")) {
      return proxyStreamAsset(req, res);
    }
    if (req.method === "GET" && req.url.startsWith("/api/transcode-live/")) {
      return transcodeLive(req, res);
    }
    if (req.method === "GET" && req.url.startsWith("/api/live-hls/")) {
      return serveLiveHls(req, res);
    }
    if (req.method === "GET" && req.url.startsWith("/api/movie-hls/")) {
      return serveMovieHls(req, res);
    }
    if (req.method === "GET" && req.url.startsWith("/api/transcode-movie")) {
      return transcodeMovie(req, res);
    }
    return serveFile(req, res);
  } catch (error) {
    return sendJson(res, 400, { ok: false, message: error.message || "Request failed." });
  }
}).listen(port, host, () => {
  console.log(`Streamline BluTV preview running at http://${host}:${port}`);
});

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function addClientLog(entry) {
  clientLogs.push({
    time: new Date().toISOString(),
    ...entry
  });
  if (clientLogs.length > 300) clientLogs.splice(0, clientLogs.length - 300);
  console.log("[client]", JSON.stringify(clientLogs[clientLogs.length - 1]));
}

function serveFile(req, res) {
  const requestPath = req.url.split("?")[0];
  const rawPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(root, "." + decodeURIComponent(rawPath));
  if (!filePath.startsWith(root)) return sendJson(res, 403, { ok: false, message: "Forbidden" });
  fs.readFile(filePath, (error, data) => {
    if (error) return sendJson(res, 404, { ok: false, message: "Not found" });
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error("Request too large."));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (_error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

async function loadXtream({ server, username, password }) {
  const base = normalizeBase(server);
  if (!base || !username || !password) throw new Error("Enter server, username, and password.");

  await warmXtreamSession({ server, username, password });

  const [liveCats, liveStreams, vodCats, vodStreams, seriesStreams] = await Promise.all([
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_categories`).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`).catch(() => []),
    fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`).catch(() => [])
  ]);

  const liveMap = mapCategories(liveCats);
  const vodMap = mapCategories(vodCats);
  const channels = applyLimit(asArray(liveStreams), liveLimit).map((item, index) => ({
    id: `live-${item.stream_id || index}`,
    streamId: item.stream_id,
    name: text(item.name, `Channel ${index + 1}`),
    category: liveMap[item.category_id] || "Live TV",
    program: text(item.name, "Live channel"),
    description: text(item.name, "Live channel"),
    image: text(item.stream_icon, ""),
    streamUrl: `/api/stream/live/${encodeURIComponent(item.stream_id)}.m3u8`,
    guide: demoGuide(text(item.name, "Live channel"), liveMap[item.category_id] || "Live TV")
  }));

  const movies = applyLimit(asArray(vodStreams), vodLimit).map((item, index) => ({
    id: `movie-${item.stream_id || index}`,
    title: text(item.name, `Movie ${index + 1}`),
    category: vodMap[item.category_id] || "VOD",
    year: text(item.year, ""),
    image: text(item.stream_icon, ""),
    description: text(item.plot || item.description || item.short_description, ""),
    type: "Movie",
    container: text(item.container_extension, "mp4").toLowerCase(),
    streamUrl: `${base}/movie/${username}/${password}/${item.stream_id}.${item.container_extension || "mp4"}`
  }));

  const series = applyLimit(asArray(seriesStreams), seriesLimit).map((item, index) => ({
    id: `series-${item.series_id || index}`,
    seriesId: item.series_id,
    title: text(item.name, `Series ${index + 1}`),
    category: vodMap[item.category_id] || "Series",
    seasons: 1,
    image: text(item.cover, ""),
    type: "Series",
    seasonList: demoSeasons()
  }));

  return normalizeLibrary(channels, movies, series);
}

async function warmXtreamSession({ server, username, password }) {
  const base = normalizeBase(server);
  if (!base || !username || !password) throw new Error("Enter server, username, and password.");
  const auth = await fetchJson(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
  if (auth.user_info && Number(auth.user_info.auth) === 0) throw new Error("Provider rejected this login.");
  providerSession = { base, username, password };
  return { ready: true };
}

async function loadChannelEpg(streamId, streamUrl) {
  const session = providerSession.base ? providerSession : sessionFromStreamUrl(streamUrl);
  if (!session.base) throw new Error("Load an Xtream provider before loading guide data.");
  if (!streamId) return { guide: [] };
  const { base, username, password } = session;
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_short_epg&stream_id=${encodeURIComponent(streamId)}&limit=6`;
  const info = await fetchJson(url);
  const listings = asArray(info.epg_listings || info.listings || info);
  const guide = listings.map((item, index) => ({
    time: formatGuideTime(item.start_timestamp || item.start || item.start_time),
    title: decodeMaybeBase64(item.title) || `Program ${index + 1}`,
    description: decodeMaybeBase64(item.description || item.desc || "")
  })).filter(item => item.title);
  return { guide };
}

function sessionFromStreamUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const parts = url.pathname.split("/").filter(Boolean);
    const liveIndex = parts.indexOf("live");
    if (liveIndex < 0 || parts.length < liveIndex + 4) return invalidSession();
    return {
      base: `${url.protocol}//${url.host}`,
      username: decodeURIComponent(parts[liveIndex + 1]),
      password: decodeURIComponent(parts[liveIndex + 2])
    };
  } catch (_error) {
    return invalidSession();
  }
}

async function loadSeriesInfo(seriesId) {
  if (!providerSession.base) throw new Error("Load an Xtream provider before playing series.");
  if (!seriesId) throw new Error("Missing series id.");
  const { base, username, password } = providerSession;
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${encodeURIComponent(seriesId)}`;
  const info = await fetchJson(url);
  const seasons = [];
  const episodesBySeason = info.episodes || {};
  Object.keys(episodesBySeason).sort((a, b) => Number(a) - Number(b)).forEach((seasonKey) => {
    const episodes = asArray(episodesBySeason[seasonKey]).map((ep, index) => ({
      season: Number(seasonKey) || 1,
      episode: Number(ep.episode_num || index + 1),
      title: text(ep.title, `Episode ${index + 1}`),
      container: text(ep.container_extension, "mp4").toLowerCase(),
      streamUrl: `${base}/series/${username}/${password}/${ep.id}.${ep.container_extension || "mp4"}`
    }));
    if (episodes.length) seasons.push({ season: Number(seasonKey) || 1, episodes });
  });
  return { seasonList: seasons.length ? seasons : demoSeasons() };
}

async function loadM3u(playlistUrl) {
  if (!playlistUrl) throw new Error("Enter a playlist URL.");
  const body = await fetchText(playlistUrl);
  const channels = parseM3u(body);
  return normalizeLibrary(channels, [], []);
}

function normalizeLibrary(channels, movies, series) {
  const liveCategories = ["All Channels", ...unique(channels.map(item => item.category || "Live TV"))];
  const movieTabs = ["Featured", ...unique(movies.map(item => item.category || "VOD"))];
  return {
    categories: liveCategories,
    channels: channels.map((item, index) => ({
      ...item,
      image: item.image || fallbackImage(index),
      guide: item.guide && item.guide.length ? item.guide : demoGuide(item.program || item.name || "Live channel", item.category || "Live TV")
    })),
    movieTabs,
    movies: movies.map((item, index) => ({ ...item, image: item.image || fallbackPoster(index) })),
    series: series.map((item, index) => ({ ...item, image: item.image || fallbackPoster(index + 4), seasonList: item.seasonList || demoSeasons() }))
  };
}

function parseM3u(body) {
  const lines = body.split(/\r?\n/);
  const channels = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      current = {
        name: afterComma(line) || "Channel",
        category: attr(line, "group-title") || "Live TV",
        image: attr(line, "tvg-logo") || ""
      };
    } else if (current && line.trim() && !line.startsWith("#")) {
      channels.push({
        id: `m3u-${channels.length + 1}`,
        name: current.name,
        category: current.category,
        program: current.name,
        description: current.name,
        image: current.image,
        streamUrl: line.trim(),
        guide: demoGuide(current.name, current.category)
      });
      current = null;
    }
  }
  if (!channels.length) throw new Error("No channels found in this M3U playlist.");
  return channels;
}

function readLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function applyLimit(items, limit) {
  return limit > 0 ? items.slice(0, limit) : items;
}

async function proxyLiveStream(req, res) {
  if (!providerSession.base) throw new Error("Load your provider before playing live TV.");
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const match = requestUrl.pathname.match(/^\/api\/stream\/live\/([^/]+)\.m3u8$/);
  if (!match) throw new Error("Missing stream id.");
  const streamId = decodeURIComponent(match[1]);
  const { base, username, password } = providerSession;
  const upstreamUrl = `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.m3u8`;
  const playlist = await fetchText(upstreamUrl);
  res.writeHead(200, {
    "Content-Type": "application/vnd.apple.mpegurl",
    "Cache-Control": "no-store"
  });
  res.end(rewritePlaylist(playlist, upstreamUrl));
}

async function proxyStreamAsset(req, res) {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const assetUrl = requestUrl.searchParams.get("url");
  if (!assetUrl) throw new Error("Missing stream asset.");
  const upstream = await fetch(assetUrl, { headers: { "User-Agent": "StreamlineBluTV/1.0" } });
  if (!upstream.ok) throw new Error(`Provider returned ${upstream.status}`);
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  res.writeHead(upstream.status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  if (upstream.body) return Readable.fromWeb(upstream.body).pipe(res);
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.end(buffer);
}

async function transcodeMovie(req, res) {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const movieUrl = requestUrl.searchParams.get("url");
  if (!movieUrl) throw new Error("Missing movie URL.");
  const audioMap = await preferredAudioMap(movieUrl);

  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-i", movieUrl,
    "-map", "0:v:0",
  ];
  if (audioMap) args.push("-map", audioMap);
  else args.push("-an");
  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-profile:v", "baseline",
    "-level", "3.1",
    "-c:a", "aac",
    "-b:a", "160k",
    "-metadata:s:a:0", "language=eng",
    "-movflags", "frag_keyframe+empty_moov+faststart",
    "-f", "mp4",
    "pipe:1"
  );

  const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Cache-Control": "no-store"
  });
  ffmpeg.stdout.pipe(res);
  req.on("close", () => {
    if (!ffmpeg.killed) ffmpeg.kill("SIGKILL");
  });
  ffmpeg.on("error", () => {
    if (!res.headersSent) sendJson(res, 500, { ok: false, message: "Movie audio conversion failed." });
    else res.end();
  });
}

async function transcodeLive(req, res) {
  if (!providerSession.base) throw new Error("Load your provider before playing live TV.");
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const match = requestUrl.pathname.match(/^\/api\/transcode-live\/([^/]+)\.mp4$/);
  if (!match) throw new Error("Missing stream id.");
  const streamId = decodeURIComponent(match[1]);
  const { base, username, password } = providerSession;
  const liveUrl = `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.ts`;

  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-fflags", "+genpts",
    "-i", liveUrl,
    "-map", "0:v:0?",
    "-map", "0:a:0?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-profile:v", "baseline",
    "-level", "3.1",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4",
    "pipe:1"
  ];

  const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Cache-Control": "no-store"
  });
  ffmpeg.stdout.pipe(res);
  req.on("close", () => {
    if (!ffmpeg.killed) ffmpeg.kill("SIGKILL");
  });
  ffmpeg.on("error", () => {
    if (!res.headersSent) sendJson(res, 500, { ok: false, message: "Live video conversion failed." });
    else res.end();
  });
}

async function serveLiveHls(req, res) {
  if (!providerSession.base) throw new Error("Load your provider before playing live TV.");
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const match = requestUrl.pathname.match(/^\/api\/live-hls\/([^/]+)\/([^/]+)$/);
  if (!match) throw new Error("Missing live HLS stream.");
  const streamId = decodeURIComponent(match[1]);
  const fileName = decodeURIComponent(match[2]);
  const session = ensureLiveHlsSession(streamId);
  if (fileName === "playlist.m3u8") {
    await waitForFile(session.playlistPath, 6500);
  }
  const filePath = path.resolve(session.dir, fileName);
  if (!filePath.startsWith(session.dir)) throw new Error("Invalid HLS segment.");
  fs.readFile(filePath, (error, data) => {
    if (error) return sendJson(res, 404, { ok: false, message: "Stream is starting. Try again." });
    const contentType = fileName.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function ensureLiveHlsSession(streamId) {
  const existing = liveHlsSessions.get(streamId);
  if (existing && !existing.ffmpeg.killed) {
    existing.lastUsed = Date.now();
    return existing;
  }
  const { base, username, password } = providerSession;
  const safeId = String(streamId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join("/private/tmp", "streamline-blutv-hls", safeId);
  fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(dir).forEach((file) => {
    try { fs.unlinkSync(path.join(dir, file)); } catch (_error) {}
  });
  const liveUrl = `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.ts`;
  const playlistPath = path.join(dir, "playlist.m3u8");
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-fflags", "+genpts",
    "-i", liveUrl,
    "-map", "0:v:0?",
    "-map", "0:a:0?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-profile:v", "baseline",
    "-level", "3.1",
    "-c:a", "aac",
    "-b:a", "128k",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "5",
    "-hls_flags", "delete_segments+append_list+omit_endlist",
    "-hls_segment_filename", path.join(dir, "seg_%05d.ts"),
    playlistPath
  ];
  const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "ignore"] });
  const session = { dir, playlistPath, ffmpeg, lastUsed: Date.now() };
  liveHlsSessions.set(streamId, session);
  ffmpeg.on("close", () => {
    if (liveHlsSessions.get(streamId) === session) liveHlsSessions.delete(streamId);
  });
  return session;
}

function waitForFile(filePath, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      fs.stat(filePath, (error, stats) => {
        if (!error && stats.size > 0) return resolve(true);
        if (Date.now() - startedAt > timeoutMs) return resolve(false);
        setTimeout(check, 180);
      });
    };
    check();
  });
}

async function serveMovieHls(req, res) {
  const requestUrl = new URL(req.url, `http://${host}:${port}`);
  const match = requestUrl.pathname.match(/^\/api\/movie-hls\/([^/]+)\/([^/]+)$/);
  if (!match) throw new Error("Missing movie HLS stream.");
  const mediaId = decodeURIComponent(match[1]);
  const fileName = decodeURIComponent(match[2]);
  const movieUrl = requestUrl.searchParams.get("url");
  const session = await ensureMovieHlsSession(mediaId, movieUrl);
  if (fileName === "playlist.m3u8") {
    await waitForFile(session.playlistPath, 9000);
  }
  const filePath = path.resolve(session.dir, fileName);
  if (!filePath.startsWith(session.dir)) throw new Error("Invalid movie segment.");
  fs.readFile(filePath, (error, data) => {
    if (error) return sendJson(res, 404, { ok: false, message: "Movie is starting. Try again." });
    const contentType = fileName.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

async function ensureMovieHlsSession(mediaId, movieUrl) {
  if (!movieUrl) throw new Error("Missing movie URL.");
  const safeId = safePathId(mediaId || crypto.createHash("sha1").update(movieUrl).digest("hex"));
  const existing = movieHlsSessions.get(safeId);
  if (existing && existing.source === movieUrl && !existing.ffmpeg.killed) {
    existing.lastUsed = Date.now();
    return existing;
  }
  if (existing && !existing.ffmpeg.killed) existing.ffmpeg.kill("SIGKILL");
  const dir = path.join("/private/tmp", "streamline-blutv-movie-hls", safeId);
  fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(dir).forEach((file) => {
    try { fs.unlinkSync(path.join(dir, file)); } catch (_error) {}
  });
  const audioMap = await preferredAudioMap(movieUrl);
  const playlistPath = path.join(dir, "playlist.m3u8");
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-i", movieUrl,
    "-map", "0:v:0",
  ];
  if (audioMap) args.push("-map", audioMap);
  else args.push("-an");
  args.push(
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-profile:v", "baseline",
    "-level", "3.1",
    "-c:a", "aac",
    "-b:a", "160k",
    "-metadata:s:a:0", "language=eng",
    "-f", "hls",
    "-hls_time", "4",
    "-hls_list_size", "8",
    "-hls_flags", "delete_segments+append_list+omit_endlist",
    "-hls_segment_filename", path.join(dir, "seg_%05d.ts"),
    playlistPath
  );
  const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "ignore"] });
  const session = { dir, playlistPath, ffmpeg, source: movieUrl, lastUsed: Date.now() };
  movieHlsSessions.set(safeId, session);
  ffmpeg.on("close", () => {
    if (movieHlsSessions.get(safeId) === session) movieHlsSessions.delete(safeId);
  });
  return session;
}

function safePathId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96) || "media";
}

function preferredAudioMap(movieUrl) {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=index,codec_type:stream_tags=language,title",
      "-of", "json",
      movieUrl
    ], { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    ffprobe.stdout.on("data", chunk => {
      output += chunk;
      if (output.length > 1024 * 1024) ffprobe.kill("SIGKILL");
    });
    ffprobe.on("close", () => {
      try {
        const streams = JSON.parse(output || "{}").streams || [];
        const audio = streams.filter(stream => stream.codec_type === "audio");
        const english = audio.find((stream) => {
          const language = String(stream.tags?.language || "").toLowerCase();
          const title = String(stream.tags?.title || "").toLowerCase();
          return language === "eng" || language === "en" || title.includes("english");
        });
        const selected = english || audio[0];
        resolve(selected ? `0:${selected.index}` : "");
      } catch (_error) {
        resolve("0:a:0?");
      }
    });
    ffprobe.on("error", () => resolve("0:a:0?"));
  });
}

function rewritePlaylist(body, playlistUrl) {
  return String(body || "").split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_match, url) => `URI="/api/stream-proxy?url=${encodeURIComponent(new URL(url, playlistUrl).toString())}"`);
    }
    const absolute = new URL(trimmed, playlistUrl).toString();
    return `/api/stream-proxy?url=${encodeURIComponent(absolute)}`;
  }).join("\n");
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "StreamlineBluTV/1.0" } });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "StreamlineBluTV/1.0" } });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.text();
}

function mapCategories(items) {
  const out = {};
  asArray(items).forEach(item => {
    out[item.category_id] = text(item.category_name, "Live TV");
  });
  return out;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeBase(value) {
  let base = String(value || "").trim().replace(/\/+$/, "");
  if (base && !/^https?:\/\//i.test(base)) base = `http://${base}`;
  return base;
}

function text(value, fallback) {
  const out = String(value || "").trim();
  return out || fallback;
}

function decodeMaybeBase64(value) {
  const raw = text(value, "");
  if (!raw) return "";
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length % 4 === 0) {
      const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
      if (decoded && /[a-z0-9]/i.test(decoded)) return decoded;
    }
  } catch (_error) {
    return raw;
  }
  return raw;
}

function formatGuideTime(value) {
  if (!value) return "";
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric * (numeric > 100000000000 ? 1 : 1000))
    : new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function afterComma(line) {
  const index = line.lastIndexOf(",");
  return index >= 0 ? line.slice(index + 1).trim() : "";
}

function attr(line, key) {
  const match = line.match(new RegExp(`${key}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function demoGuide(title, category = "Live TV") {
  const label = title || category || "Live channel";
  return [
    { time: "Now", title: label },
    { time: "Next", title: `${label} continues` },
    { time: "Later", title: `${category} programming` },
    { time: "Tonight", title: label }
  ];
}

function demoSeasons() {
  return [1, 2, 3].map(season => ({
    season,
    episodes: [1, 2, 3, 4, 5].map(episode => ({
      season,
      episode,
      title: `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")} - Episode ${episode}`
    }))
  }));
}

function fallbackImage(index) {
  const images = [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80"
  ];
  return images[index % images.length];
}

function fallbackPoster(index) {
  const images = [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80"
  ];
  return images[index % images.length];
}

function invalidSession() {
  return { base: "", username: "", password: "" };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
