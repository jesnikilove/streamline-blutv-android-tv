const smartCategoryRules = [
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

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getSmartCategoryRule(name) {
  return smartCategoryRules.find((rule) => rule.name === name) || null;
}

function matchesSmartCategory(channel, rule) {
  const haystack = normalizeSearch(`${channel.name} ${channel.category} ${channel.program || ""}`);
  return rule.terms.some((term) => haystack.includes(normalizeSearch(term)));
}

function filterChannelsForSmartCategory(channels, categoryName) {
  const rule = getSmartCategoryRule(categoryName);
  if (!rule) {
    const available = smartCategoryRules.map((item) => item.name).join(", ");
    throw new Error(`Unknown smart category "${categoryName}". Available: ${available}`);
  }
  return channels.filter((channel) => matchesSmartCategory(channel, rule));
}

function categorySlug(categoryName) {
  return String(categoryName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

module.exports = {
  smartCategoryRules,
  normalizeSearch,
  getSmartCategoryRule,
  matchesSmartCategory,
  filterChannelsForSmartCategory,
  categorySlug
};
