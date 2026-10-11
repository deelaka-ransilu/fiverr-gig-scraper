// ============================================================
// Package-tab / single-package order box parser
// Used by parseComparisonTable() when the page has no comparison table.
//
// DOM (seen on a tabbed gig):
//   div.packages-tabs.triple
//     input#package-tab-1..3 (radio)          <- which tab is open is CSS-only
//     div.nav-container > label[role=tab]     <- Basic / Standard / Premium
//     div.b27f71b > div.package-content x N   <- one panel per tab, all in the DOM
//       header: .price-wrapper (price), p > b (title) + description text
//       article: .additional-info (.delivery-wrapper, revisions), ul > li (features)
// A single-package gig is div.packages-tabs.single with one panel.
//
// Reads textContent (not innerText) because hidden tabs aren't rendered, and
// innerText on hidden elements loses line breaks.
// Unverified: how a feature the tier does NOT include is rendered; every
// listed <li> is currently treated as included.
// ============================================================

function parseSinglePackage() {
  const root = document.querySelector('.packages-tabs');
  if (!root) return [];

  const panels = Array.from(root.querySelectorAll('.package-content'));
  if (!panels.length) return parsePackageFromText(root); // layout we haven't seen: best effort

  const labels = Array.from(root.querySelectorAll('.nav-container [role="tab"]'))
    .map(l => l.textContent.trim());

  return panels.map((panel, i) =>
    parsePackagePanel(panel, labels[i] || (panels.length === 1 ? "Single package" : `Package ${i + 1}`))
  );
}

function parsePackagePanel(panel, type) {
  const clean = s => (s || "").replace(/\s+/g, " ").trim();

  const priceText = panel.querySelector('.price-wrapper')?.textContent || "";
  const price = (priceText.match(/[$€£]\s?[\d,]+(?:\.\d+)?/) || [""])[0].replace(/\s/g, "");

  const title = clean(panel.querySelector('header p b')?.textContent);
  const description = clean(panel.querySelector('header p')?.textContent).replace(title, "").trim();

  const info = clean(panel.querySelector('.additional-info')?.textContent);
  const delivery = (info.match(/\d+\s*-?\s*days?\s*delivery/i) ||
    [clean(panel.querySelector('.delivery-wrapper')?.textContent)])[0];
  const revisions = info.match(/(unlimited|\d+)\s*revisions?/i);

  const features = {};
  if (revisions) features["Revisions"] = clean(revisions[0]);
  panel.querySelectorAll('article ul li').forEach(li => {
    const t = clean(li.textContent);
    if (t) features[t] = true;
  });

  return { type, title, price, totalPrice: "", description, delivery, features };
}

// Fallback when there are no .package-content panels: parse the box's text lines.
function parsePackageFromText(root) {
  const lines = root.innerText.split("\n").map(l => l.trim()).filter(Boolean);
  const isPrice = l => /^[$€£]\s?[\d,.]+$/.test(l);

  const price = lines.find(isPrice) || "";
  const title = Array.from(root.querySelectorAll('b.title, .title, h3, h4, b, strong'))
    .map(el => el.innerText.trim())
    .find(t => t.length > 3 && !/subscribe|save up|delivery|revision/i.test(t)) || "";
  const descLine = (title && lines.find(l => l.startsWith(title))) || "";
  const description = descLine ? descLine.slice(title.length).trim() : "";

  const delivery = lines.find(l => /delivery/i.test(l) && /\d/.test(l)) || "";
  const revisions = lines.find(l => /revision/i.test(l)) || "";
  const lastMeta = Math.max(lines.indexOf(delivery), lines.indexOf(revisions));
  const endIdx = lines.findIndex(l => /^(continue|contact me)/i.test(l));
  const featureLines = lines.slice(lastMeta + 1, endIdx === -1 ? undefined : endIdx);

  const features = {};
  if (revisions) features["Revisions"] = revisions;
  featureLines.forEach(l => { if (!isPrice(l)) features[l] = true; });

  return [{ type: "Single package", title, price, totalPrice: "", description, delivery, features }];
}