const fs = require("fs");
const path = require("path");
const { categorySlug, getSmartCategoryRule, matchesSmartCategory, smartCategoryRules } = require("./smart-categories");

const root = path.resolve(__dirname, "..");
const concurrency = Number(process.env.AUDIT_CONCURRENCY || 12);
const timeoutMs = Number(process.env.AUDIT_TIMEOUT_MS || 8000);
const maxChannels = Number(process.env.AUDIT_MAX || 0);
const checkpointEvery = Number(process.env.AUDIT_CHECKPOINT_EVERY || 25);

const ppvCategoryRe = /pay\s*per\s*view|\bppv\b|i\s*ppv|live\s*events?/i;
const ppvNameRe = /pay\s*per\s*view|\bppv\b/i;
const transcodeNameRe = /\b(4k|uhd|uhd4|2160|hevc)\b/i;

async function fetchJson(url, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "StreamlineBluTV-Audit/1.0" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeout = timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "StreamlineBluTV-Audit/1.0" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.length < 8) throw new Error("Empty response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function mapCategories(items) {
  const map = {};
  asArray(items).forEach((item) => {
    if (item?.category_id != null) map[item.category_id] = String(item.category_name || item.name || "Live TV");
  });
  return map;
}

function isPpv(category, name) {
  return ppvCategoryRe.test(category || "") || ppvNameRe.test(name || "");
}

function needsTranscode(name) {
  return transcodeNameRe.test(String(name || ""));
}

async function testDirectStream(base, username, password, streamId) {
  const url = `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.m3u8`;
  const body = await fetchText(url);
  if (!body.includes("#EXTM3U")) throw new Error("Not a valid HLS playlist");
  return "direct-m3u8";
}

async function testUpstreamTs(base, username, password, streamId) {
  const tsUrl = `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${encodeURIComponent(streamId)}.ts`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(tsUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "StreamlineBluTV-Audit/1.0",
        Range: "bytes=0-65535"
      }
    });
    if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 512) throw new Error("Stream too small");
    return "upstream-ts";
  } finally {
    clearTimeout(timer);
  }
}

async function auditChannel(creds, item, category) {
  const streamId = item.stream_id;
  const name = String(item.name || `Channel ${streamId}`);
  const result = {
    id: `live-${streamId}`,
    streamId,
    name,
    category,
    status: "failed",
    method: "",
    error: ""
  };
  if (!streamId) {
    result.error = "Missing stream id";
    return result;
  }
  try {
    if (needsTranscode(name)) {
      await testUpstreamTs(creds.base, creds.username, creds.password, streamId);
      result.status = "ok";
      result.method = "transcode-candidate";
      return result;
    }
    await testDirectStream(creds.base, creds.username, creds.password, streamId);
    result.status = "ok";
    result.method = "direct-m3u8";
    return result;
  } catch (error) {
    try {
      await testUpstreamTs(creds.base, creds.username, creds.password, streamId);
      result.status = "ok";
      result.method = "fallback-ts";
      return result;
    } catch (_fallbackError) {
      result.error = error.message || String(error);
      return result;
    }
  }
}

function auditOutputPaths(category) {
  if (!category) {
    return {
      json: path.join(root, "channel-audit-results.json"),
      txt: path.join(root, "channel-audit-failed.txt")
    };
  }
  const slug = categorySlug(category);
  return {
    json: path.join(root, `channel-audit-${slug}-results.json`),
    txt: path.join(root, `channel-audit-${slug}-failed.txt`)
  };
}

function writeAuditResults(paths, payload) {
  fs.writeFileSync(paths.json, JSON.stringify(payload, null, 2));
  const failed = payload.failedChannels || [];
  fs.writeFileSync(
    paths.txt,
    failed
      .map((ch) => `${ch.category} | ${ch.name} | streamId=${ch.streamId} | ${ch.error}`)
      .join("\n") + (failed.length ? "\n" : "")
  );
}

async function runPool(items, worker, limit, onProgress) {
  const results = new Array(items.length);
  let index = 0;
  async function next() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
      if (onProgress) onProgress(i + 1, items.length, results);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => next()));
  return results;
}

function buildAuditPayload(category, results, skippedPpv, complete) {
  const audited = results.filter(Boolean);
  const failed = audited.filter((r) => r.status !== "ok");
  const ok = audited.filter((r) => r.status === "ok");
  return {
    auditedAt: new Date().toISOString(),
    category: category || null,
    complete,
    totalAudited: audited.length,
    ppvSkipped: skippedPpv.length,
    working: ok.length,
    failed: failed.length,
    failedChannels: failed.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    ppvSkippedSample: skippedPpv.slice(0, 20)
  };
}

async function runChannelAudit(creds, options = {}) {
  if (!creds?.base || !creds?.username || !creds?.password) {
    throw new Error("Provider session is not ready.");
  }

  const category = String(options.category || process.env.AUDIT_CATEGORY || "").trim();
  const outputPaths = auditOutputPaths(category);

  const [liveCats, liveStreams] = await Promise.all([
    fetchJson(`${creds.base}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_categories`, 60000),
    fetchJson(`${creds.base}/player_api.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}&action=get_live_streams`, 120000)
  ]);

  const catMap = mapCategories(liveCats);
  const skippedPpv = [];
  let channels = asArray(liveStreams).map((item) => ({
    item,
    category: catMap[item.category_id] || "Live TV"
  }));

  channels = channels.filter(({ item, category: channelCategory }) => {
    const name = String(item.name || "");
    if (isPpv(channelCategory, name)) {
      skippedPpv.push({ streamId: item.stream_id, name, category: channelCategory });
      return false;
    }
    return true;
  });

  if (category) {
    const rule = getSmartCategoryRule(category);
    if (!rule) {
      const available = smartCategoryRules.map((item) => item.name).join(", ");
      throw new Error(`Unknown smart category "${category}". Available: ${available}`);
    }
    channels = channels.filter(({ item, category: channelCategory }) =>
      matchesSmartCategory({
        name: String(item.name || ""),
        category: channelCategory,
        program: String(item.name || "")
      }, rule)
    );
  }

  if (maxChannels > 0) channels = channels.slice(0, maxChannels);

  const results = await runPool(
    channels,
    ({ item, category: channelCategory }) => auditChannel(creds, item, channelCategory),
    concurrency,
    (progress, total, partialResults) => {
      if (options.onProgress) options.onProgress(progress, total);
      if (progress % checkpointEvery === 0 || progress === total) {
        writeAuditResults(outputPaths, buildAuditPayload(category, partialResults, skippedPpv, progress === total));
      }
    }
  );

  const payload = buildAuditPayload(category, results, skippedPpv, true);
  payload.outputJson = outputPaths.json;
  payload.outputTxt = outputPaths.txt;
  writeAuditResults(outputPaths, payload);
  return payload;
}

module.exports = { runChannelAudit, isPpv, auditOutputPaths };
