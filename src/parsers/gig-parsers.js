// ============================================================
// Gig page parsers
// Each function reads one section of a Fiverr gig page.
// Selectors were checked on a live gig (counts all > 0); the review
// "load more" control is still a best guess, see loadAllReviews().
//
// Fiverr serves more than one layout. Seller info, the description and the
// seller details have an older layout (text right after the h1, .description-wrapper,
// .stats-desc) and a newer one (.seller-card, an "About this Gig" heading).
// Each parser tries the old one first, then the new one.
// ============================================================

function parseTitle() {
  return document.querySelector("h1")?.innerText.trim() || "";
}

// Text lines of the newer seller header card (name, rating, country, languages, orders).
function getSellerCardLines() {
  const card = document.querySelector('.seller-card');
  return (card?.innerText || "").split("\n").map(l => l.trim()).filter(l => l.length > 0);
}

function parseSeller() {
  const h1 = document.querySelector("h1");
  let lines = (h1?.nextElementSibling?.innerText || "")
    .split("\n").map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) lines = getSellerCardLines(); // newer layout
  const text = lines.join(" ");

  const hasFiverrsChoice = lines.some(l => /^fiverr/i.test(l)) && lines.some(l => /^choice$/i.test(l));
  const level = lines.find(l => /^(level \d|top rated|new seller|vetted pro)/i.test(l)) || "";

  // "5.0 (15)" on one line, or "5.0" and "(15)" on separate lines; the word "reviews" is optional
  const combo = text.match(/\b(\d\.\d)\s*\(\s*([\d,]+)\s*(?:reviews?)?\s*\)/i);
  const rating = combo ? combo[1] : (lines.find(l => /^\d\.\d$/.test(l)) || "");
  const reviewsLine = lines.find(l => /^\(\s*[\d,]+\s*(reviews?)?\s*\)$/i.test(l)) || "";
  const reviews = combo ? combo[2] : reviewsLine.replace(/[()]/g, "").replace(/\s*reviews?/i, "").trim();

  const sellerName = lines.find(l =>
    l.length > 1 &&
    l !== level &&
    l !== rating &&
    l !== reviewsLine &&
    !/^\d\.\d/.test(l) &&
    !/fiverr|choice/i.test(l) &&
    !/^(contact me|message)/i.test(l) &&
    !/orders? (completed|in queue)/i.test(l) &&
    !/^i speak /i.test(l)
  ) || "";

  return { sellerName, hasFiverrsChoice, level, rating, reviews };
}

function parseBreadcrumb() {
  const nav = document.querySelector('nav[aria-label="breadcrumbs"]');
  if (!nav) return [];
  const links = nav.querySelectorAll('li a');
  return Array.from(links)
    .map(el => el.innerText.trim())
    .filter(t => t.length > 0 && t !== "/");
}

function parseRelatedTags() {
  const container = document.querySelector('.gig-tags-container');
  if (!container) return [];
  return Array.from(container.querySelectorAll('li a')).map(a => a.innerText.trim());
}

function parsePortfolioCount() {
  const moreLinks = Array.from(document.querySelectorAll('.portfolio-external-wrapper a'))
    .filter(a => /projects/i.test(a.innerText.replace(/\s/g, "")));

  const numbers = moreLinks
    .map(a => {
      const match = a.innerText.match(/\+?\s*(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter(n => n !== null);

  return numbers.length ? Math.max(...numbers) : 0;
}

function parseHourlyRate() {
  const hourlyLink = Array.from(document.querySelectorAll('a, button, p')).find(el => /request hourly offer/i.test(el.innerText));
  const direct = hourlyLink?.previousElementSibling?.innerText.trim();
  if (direct && /^\$\d+\/hour$/.test(direct)) return direct;

  const match = document.body.innerText.match(/\$\d+\/hour/);
  return match ? match[0] : "";
}

async function expandSellerBio() {
  const btn = document.querySelector('.seller-desc button, article.seller-desc button');
  if (btn && /see more/i.test(btn.innerText)) {
    btn.click();
    await new Promise(r => setTimeout(r, 300));
  }
}

function parseSellerBio() {
  const statsDesc = document.querySelector('.stats-desc');
  const raw = statsDesc?.innerText || "";
  const lines = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  const getValueAfter = (label) => {
    const idx = lines.findIndex(l => l === label);
    return idx !== -1 ? lines[idx + 1] || "" : "";
  };

  let from = getValueAfter("From");
  const memberSince = getValueAfter("Member since");
  const avgResponseTime = getValueAfter("Avg. response time");
  const lastDelivery = getValueAfter("Last delivery");
  let languages = getValueAfter("Languages");

  // Newer layout: the seller card lists the country, then "I speak <languages>"
  if (!from || !languages) {
    const cardLines = getSellerCardLines();
    const langIdx = cardLines.findIndex(l => /^i speak /i.test(l));
    if (langIdx !== -1) {
      if (!languages) languages = cardLines[langIdx].replace(/^i speak\s*/i, "");
      if (!from && langIdx > 0) from = cardLines[langIdx - 1];
    }
  }

  const bio = document.querySelector('.seller-desc')?.innerText.trim().replace(/\s*See (More|Less)\s*$/i, "") || "";

  return { from, memberSince, avgResponseTime, lastDelivery, languages, bio };
}

function parseFAQ() {
  const items = document.querySelectorAll('.faq-collapsible');
  return Array.from(items).map(el => {
    const question = el.querySelector('.faq-collapsible-title')?.innerText.trim() || "";
    const answer = el.querySelector('.faq-collapsible-content')?.innerText.trim() || "";
    return { question, answer };
  });
}

function parseRatingBreakdown() {
  const starRows = document.querySelectorAll('.stars-counters tr');
  const starCounts = {};
  starRows.forEach(row => {
    const label = row.querySelector('.stars-filter')?.innerText.trim();
    const countText = row.querySelector('.star-num')?.innerText.trim();
    const count = (countText || "").replace(/[()]/g, "");
    if (label) starCounts[label] = count;
  });

  const categoryEls = document.querySelectorAll('.ranking ul > li');
  const categories = {};
  categoryEls.forEach(li => {
    const label = li.childNodes[0]?.textContent.trim();
    const score = li.querySelector('.rating-score')?.innerText.trim();
    if (label && !(label in categories)) categories[label] = score; // dedupe desktop/mobile
  });

  return { starCounts, categories };
}

// ------------------------------------------------------------
// Gig description
// Older layout: .description-wrapper. Newer layout has no such class, so the
// section is found from its "About this Gig" heading: the smallest ancestor of
// the heading that also holds the description text.
// ------------------------------------------------------------
function findAboutSection() {
  const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,b,strong,div,span,p'))
    .find(el => /^about this gig$/i.test((el.textContent || "").trim()) &&
                !el.querySelector('h1,h2,h3,h4,h5,div,p'));
  if (!heading) return null;

  const headLen = heading.textContent.trim().length;
  let node = heading;
  for (let i = 0; i < 6 && node.parentElement; i++) {
    node = node.parentElement;
    if ((node.innerText || "").trim().length > headLen + 80) return node;
  }
  return null;
}

// Clicks "Read More" in the description area so the full text is in the page.
async function expandAbout() {
  const scope = findAboutSection() || document;
  const btns = Array.from(scope.querySelectorAll('button, [role="button"], a:not([href])'))
    .filter(b => !b.closest('li') && /^read more$/i.test(b.innerText.trim()));
  btns.forEach(b => b.click());
  if (btns.length) await new Promise(r => setTimeout(r, 300));
}

function parseAboutGig() {
  let raw = document.querySelector('.description-wrapper')?.innerText || "";
  if (!raw) {
    const section = findAboutSection();
    raw = (section?.innerText || "")
      .replace(/^\s*about this gig\s*/i, "")
      .replace(/\s*Read (More|Less)\s*$/i, "");
  }
  // Fiverr leaves 3-4 empty lines between sections; keep a single blank line.
  return raw.trim().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

// Gig address without Fiverr's tracking query string (ref_ctx_id, imp_id, ad_key ...).
function cleanGigUrl() {
  return location.origin + location.pathname;
}

// Comparison-table layout. When the page has no table, falls back to the
// package-tab / single-package parser (src/parsers/single-package-parser.js).
function parseComparisonTable() {
  const table = document.querySelector('.gig-page-packages-table table');
  if (!table) return parseSinglePackage();

  const rows = Array.from(table.querySelectorAll('tbody > tr'));
  const headerRow = rows.find(r => r.classList.contains('package-type'));
  if (!headerRow) return parseSinglePackage();

  const ths = headerRow.querySelectorAll('th.package-type-price');

  const tiers = Array.from(ths).map(th => ({
    price: th.querySelector('.price-wrapper p')?.innerText.trim() || "",
    type: th.querySelector('b.type')?.innerText.trim() || "",
    title: th.querySelector('b.title')?.innerText.trim() || "",
    features: {}
  }));

  rows.forEach(row => {
    if (row === headerRow) return;

    const labelCell = row.querySelector('td.package-row-label');
    const label = labelCell?.innerText.trim();
    const cells = Array.from(row.querySelectorAll('td')).filter(td => td !== labelCell);

    if (row.classList.contains('description')) {
      cells.forEach((td, i) => { if (tiers[i]) tiers[i].description = td.innerText.trim(); });
      return;
    }

    if (row.classList.contains('delivery-time')) {
      cells.forEach((td, i) => {
        if (!tiers[i]) return;
        const radios = td.querySelectorAll('label');
        if (radios.length) {
          const checkedLabel = Array.from(radios).find(l => l.querySelector('input')?.checked);
          tiers[i].delivery = checkedLabel?.innerText.trim().replace(/\s+/g, " ") || td.innerText.trim();
          const rush = Array.from(radios).find(l => !l.querySelector('input')?.checked);
          if (rush) tiers[i].rushOption = rush.innerText.trim().replace(/\s+/g, " ");
        } else {
          tiers[i].delivery = td.innerText.trim();
        }
      });
      return;
    }

    if (row.classList.contains('select-package')) {
      cells.forEach((td, i) => {
        if (tiers[i]) tiers[i].totalPrice = td.querySelector('.price-wrapper p')?.innerText.trim() || "";
      });
      return;
    }

    if (!label) return;

    cells.forEach((td, i) => {
      if (!tiers[i]) return;
      const svg = td.querySelector('svg');
      if (svg) {
        const fill = getComputedStyle(svg).fill;
        tiers[i].features[label] = fill === "rgb(34, 35, 37)";
      } else {
        tiers[i].features[label] = td.innerText.trim();
      }
    });
  });

  return tiers;
}

// ------------------------------------------------------------
// Reviews
// The page renders TWO identical `ul.review-list` elements (desktop + mobile),
// each starting with only the first few reviews. We always work on the one with
// the most items, so reviews are never duplicated or read from the short copy.
// ------------------------------------------------------------
function getReviewList() {
  const lists = Array.from(document.querySelectorAll('ul.review-list'));
  if (!lists.length) return null;
  const count = l => l.querySelectorAll('li.review-item-component').length;
  return lists.reduce((best, l) => (count(l) > count(best) ? l : best), lists[0]);
}

function countLoadedReviews() {
  return getReviewList()?.querySelectorAll('li.review-item-component').length || 0;
}

// Clicks the "show/see/load more" control under the reviews until every review
// is loaded (or nothing more appears). The selector is a best guess: any
// button/link outside a review item whose text says "show/see/load/view more"
// or "more reviews". If no such control exists the loop just stops.
async function loadAllReviews(maxClicks = 15) {
  const total = parseInt(String(parseSeller().reviews).replace(/[^\d]/g, ""), 10) || 0;
  const scope = document.querySelector('.reviews-wrap') || document;

  const findMoreBtn = () => Array.from(scope.querySelectorAll('button, a')).find(b =>
    !b.closest('li') &&
    /(show|see|load|view)\s+more|more\s+reviews/i.test(b.innerText.trim())
  );

  const waitFor = async (cond, ms) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (cond()) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return cond();
  };

  for (let i = 0; i < maxClicks; i++) {
    const before = countLoadedReviews();
    if (total && before >= total) break;
    const btn = findMoreBtn();
    if (!btn) break;
    btn.click();
    const grew = await waitFor(() => countLoadedReviews() > before, 3000);
    if (!grew) break;
  }
}

async function expandAllReviews() {
  const list = getReviewList();
  if (!list) return;
  const buttons = list.querySelectorAll('.expand-description');
  buttons.forEach(btn => {
    if (/see more/i.test(btn.innerText)) {
      btn.click();
    }
  });
  await new Promise(r => setTimeout(r, 300));
}

function parseReviews() {
  const list = getReviewList();
  if (!list) return [];

  const items = Array.from(list.querySelectorAll('li.review-item-component'));

  return items.map(li => {
    const name = li.querySelector('p')?.innerText.trim() || "";
    const country = li.querySelector('.country p')?.innerText.trim() || "";
    const text = (li.querySelector('.review-description, [class*="review-item-description"]')?.innerText || "")
      .trim()
      .replace(/\s*See (more|less)\s*$/i, ""); // toggle label left over from expanding

    const raw = li.innerText;
    const lines = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    const rating = lines.find(l => /^\d(\.\d)?$/.test(l)) || "";
    const timeAgo = lines.find(l => /ago$/i.test(l)) || "";
    const priceLine = lines.find(l => /^\$[\d,]+(-\$[\d,]+)?$/.test(l)) || "";
    const durationLine = lines.find(l => /^\d+\s*(day|days|week|weeks|month|months)$/i.test(l)) || "";

    return { name, country, rating, timeAgo, price: priceLine, duration: durationLine, text };
  });
}