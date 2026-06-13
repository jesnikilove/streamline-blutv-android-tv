#!/usr/bin/env node
const path = require("path");
const { runChannelAudit } = require("./audit-channels-lib");
const { loadStoredCredentials } = require("./provider-credentials");

const root = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = argv.slice(2);
  let category = String(process.env.AUDIT_CATEGORY || "").trim();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--category" && args[i + 1]) {
      category = args[i + 1];
      i += 1;
    } else if (args[i].startsWith("--category=")) {
      category = args[i].slice("--category=".length);
    }
  }
  return { category: String(category || "").trim() };
}

function loadCredentials() {
  const creds = loadStoredCredentials();
  if (creds) return creds;
  throw new Error(
    "Missing credentials. Log in via the app once, create .provider-local.json, or set XTREAM_SERVER, XTREAM_USER, XTREAM_PASS."
  );
}

const { category } = parseArgs(process.argv);

runChannelAudit(loadCredentials(), {
  category,
  onProgress(progress, total) {
    const label = category ? `${category} ` : "";
    process.stderr.write(`\rChecked ${label}${progress}/${total}...`);
  }
}).then((result) => {
  process.stderr.write("\n");
  if (result.category) console.log(`Category: ${result.category}`);
  console.log(`Working: ${result.working}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`PPV skipped: ${result.ppvSkipped}`);
  console.log(`Wrote ${result.outputTxt || path.join(root, "channel-audit-failed.txt")}`);
  console.log(`Wrote ${result.outputJson || path.join(root, "channel-audit-results.json")}`);
}).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
