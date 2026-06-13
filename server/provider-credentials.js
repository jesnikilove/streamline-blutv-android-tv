const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const localPath = path.join(root, ".provider-local.json");

function loadStoredCredentials() {
  if (fs.existsSync(localPath)) {
    const parsed = JSON.parse(fs.readFileSync(localPath, "utf8"));
    const base = String(parsed.server || parsed.url || "").trim().replace(/\/+$/, "");
    const username = parsed.username;
    const password = parsed.password;
    if (base && username && password) return { base, username, password, server: base };
  }
  if (process.env.XTREAM_SERVER && process.env.XTREAM_USER && process.env.XTREAM_PASS) {
    const base = String(process.env.XTREAM_SERVER).trim().replace(/\/+$/, "");
    return {
      base,
      server: base,
      username: process.env.XTREAM_USER,
      password: process.env.XTREAM_PASS
    };
  }
  return null;
}

function persistProviderCredentials({ server, username, password }) {
  const base = String(server || "").trim().replace(/\/+$/, "");
  if (!base || !username || !password) return;
  fs.writeFileSync(localPath, `${JSON.stringify({ server: base, username, password }, null, 2)}\n`, "utf8");
}

module.exports = { loadStoredCredentials, persistProviderCredentials, localPath };
