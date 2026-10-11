// ============================================================
// Scrape quality checks
//
// checkGigCompleteness(): names the sections that came back empty, so a
//   broken parser shows up as a warning instead of a silently thin file.
//   (FAQ, tags and package features are NOT checked: some gigs legitimately
//   have none.)
// buildGigDiagnostic(): a text report of what the page actually looks like
//   (selector counts, class-name inventories, HTML snippets). It is stored
//   with an incomplete gig; the popup's "Copy diagnostic" button copies it so
//   the parser can be fixed from one paste, with no manual console work.
// ============================================================

function checkGigCompleteness({ title, seller, sellerBio, about, tiers, reviews, breadcrumb }) {
  const missing = [];
  if (!title) missing.push("title");
  if (!seller.sellerName) missing.push("seller name");
  if (!sellerBio.from && !sellerBio.memberSince) missing.push("seller details");
  if (!about) missing.push("gig description");

  if (!tiers.length) {
    missing.push("packages");
  } else if (tiers.some(t => !t.price)) {
    missing.push("package prices");
  }

  const expected = parseInt(String(seller.reviews).replace(/\D/g, ""), 10) || 0;
  if (expected > 0 && reviews.length === 0) missing.push("reviews");
  else if (expected > 0 && reviews.length < expected) missing.push(`reviews (${reviews.length} of ${expected})`);
  if (!breadcrumb.length) missing.push("category");

  return missing;
}

function buildGigDiagnostic(missing) {
  const q = s => document.querySelectorAll(s).length;
  const h1 = document.querySelector("h1");
  const snip = (el, n) => (el ? el.outerHTML.slice(0, n) : "(not found)");

  // Class-name inventory for the areas that most often change between layouts
  const inventory = (needle, limit = 20) =>
    Array.from(document.querySelectorAll(`[class*="${needle}"], [id*="${needle}"]`))
      .slice(0, limit)
      .map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 70)}#${e.id} (${(e.innerText || "").length} chars)`)
      .join("\n") || "(none)";

  // Every button/link that looks like "more / show / see / load" (review loading, read more)
  const moreControls = Array.from(document.querySelectorAll("button, a, [role='button']"))
    .filter(b => /more|show|see|load/i.test((b.innerText || "").trim()))
    .slice(0, 15)
    .map(b => `${b.tagName.toLowerCase()}.${String(b.className).slice(0, 50)} "${(b.innerText || "").trim().slice(0, 40)}" inLi=${!!b.closest("li")}`)
    .join("\n") || "(none)";

  const counts = {
    h1: q("h1"),
    breadcrumbs: q('nav[aria-label="breadcrumbs"] li a'),
    tags: q(".gig-tags-container li a"),
    sellerCard: q(".seller-card"),
    sellerDesc: q(".seller-desc"),
    statsDesc: q(".stats-desc"),
    description: q(".description-wrapper"),
    aboutSectionFound: findAboutSection() ? 1 : 0,
    faq: q(".faq-collapsible"),
    table: q(".gig-page-packages-table table"),
    packageTabs: q(".packages-tabs"),
    packagePanels: q(".package-content"),
    panelListItems: q(".package-content li"),
    starsCounters: q(".stars-counters tr"),
    reviewLists: q("ul.review-list"),
    reviewItems: q("li.review-item-component"),
    loadedReviews: countLoadedReviews()
  };

  const card = document.querySelector(".seller-card");
  const about = findAboutSection();

  return [
    "FIVERR SCRAPER DIAGNOSTIC",
    `url: ${cleanGigUrl()}`,
    `missing: ${missing.join(", ")}`,
    `selector counts: ${JSON.stringify(counts)}`,
    "",
    "--- text right after the h1 ---",
    h1?.nextElementSibling?.innerText || "(none)",
    "",
    "--- h1 parent text (first 700 chars) ---",
    (h1?.parentElement?.innerText || "(none)").slice(0, 700),
    "",
    "--- .seller-card text (first 900 chars) ---",
    (card?.innerText || "(none)").slice(0, 900),
    "",
    "--- .seller-card html (1800) ---",
    snip(card, 1800),
    "",
    "--- 'About this Gig' section text (first 600 chars) ---",
    (about?.innerText || "(not found)").slice(0, 600),
    "",
    "--- 'About this Gig' section html (1800) ---",
    snip(about, 1800),
    "",
    "--- more/show/see/load buttons and links ---",
    moreControls,
    "",
    "--- elements with 'description' in class/id ---",
    inventory("description"),
    "",
    "--- elements with 'seller' in class/id ---",
    inventory("seller"),
    "",
    "--- elements with 'faq' in class/id ---",
    inventory("faq"),
    "",
    "--- first .package-content html (2500) ---",
    snip(document.querySelector(".package-content"), 2500),
    "",
    "--- order box html (2500) ---",
    snip(document.querySelector(".packages-tabs, .gig-page-packages-table"), 2500)
  ].join("\n");
}