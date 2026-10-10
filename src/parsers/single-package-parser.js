// ============================================================
// Single-package gig layout parser
// Some gigs have no Basic/Standard/Premium comparison table, just one
// order box (div.packages-tabs.single). This reads it into the same
// tier shape that parseComparisonTable() returns.
// Built from the box's text lines (inner HTML not yet inspected), so
// verify the saved Markdown after the first save.
// ============================================================

function parseSinglePackage() {
  const root = document.querySelector('.packages-tabs');
  if (!root) return [];

  const lines = root.innerText.split("\n").map(l => l.trim()).filter(Boolean);
  const isPrice = l => /^[$€£]\s?[\d,.]+$/.test(l);

  const price = lines.find(isPrice) || "";

  // Title: first bold/heading element that isn't the "Subscribe to Save" / delivery text
  const title = Array.from(root.querySelectorAll('b.title, .title, h3, h4, b, strong'))
    .map(el => el.innerText.trim())
    .find(t => t.length > 3 && !/subscribe|save up|delivery|revision/i.test(t)) || "";

  // Description: the line that starts with the title, minus the title itself
  const descLine = (title && lines.find(l => l.startsWith(title))) || "";
  const description = descLine ? descLine.slice(title.length).trim() : "";

  const delivery = lines.find(l => /delivery/i.test(l) && /\d/.test(l)) || "";
  const revisions = lines.find(l => /revision/i.test(l)) || "";

  // Feature lines sit between the revisions/delivery line and the buttons
  const lastMeta = Math.max(lines.indexOf(delivery), lines.indexOf(revisions));
  const endIdx = lines.findIndex(l => /^(continue|contact me)/i.test(l));
  const featureLines = lines.slice(lastMeta + 1, endIdx === -1 ? undefined : endIdx);

  const features = {};
  if (revisions) features["Revisions"] = revisions;
  featureLines.forEach(l => { if (!isPrice(l)) features[l] = true; });

  return [{
    type: "Single package",
    title,
    price,
    totalPrice: "",
    description,
    delivery,
    features
  }];
}