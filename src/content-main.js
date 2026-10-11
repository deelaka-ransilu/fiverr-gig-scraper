// ============================================================
// Fiverr Gig Scraper - main orchestrator
// All parsing/markdown logic lives in src/parsers and src/markdown.
// This file creates the buttons and wires click -> scrape -> store.
// Data is stored via chrome.storage.local (see background.js) and
// browsed/downloaded from the extension's popup, not downloaded instantly.
//
// - After the background confirms the save, the button plays a
//   "saved" animation (flashButtonSaved in src/ui/widget.js).
// - If the gig/profile is already saved, the button shows an
//   "Already saved" look; clicking it re-scrapes and says "updated".
// - Fiverr is a single-page app, so a light poll (syncButtons) adds or
//   removes the buttons when the route changes without a page reload.
// - If the extension is reloaded, the orphaned script removes its own
//   buttons instead of failing with "Extension context invalidated".
// - After scraping a gig, checkGigCompleteness() (src/parsers/diagnostics.js)
//   lists any empty sections. An incomplete gig is saved with its warnings
//   and a page diagnostic, which the popup can copy.
// ============================================================

const ROW_ID = "fgs-button-row";

function getUsernameFromUrl() {
  const segments = location.pathname.split('/').filter(Boolean);
  return segments[0] || "unknown";
}

// False once the extension has been reloaded/updated and this script is orphaned.
function extensionAlive() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

function isContextError(err) {
  return /Extension context invalidated|EXTENSION_RELOADED/i.test(String((err && err.message) || err));
}

const RELOAD_MSG = "The extension was reloaded. Refresh this tab (Ctrl+Shift+R) and try again.";

function reportFailure(label, err) {
  console.error(label, err);
  alert(isContextError(err) ? RELOAD_MSG : `${label} - check console for details.`);
}

// Sends the scraped item to the background worker and waits for its confirmation.
// Only an explicit { ok: false } counts as a failure.
async function storeScrapedItem(payload) {
  if (!extensionAlive()) throw new Error("EXTENSION_RELOADED");
  const res = await chrome.runtime.sendMessage({ type: "store", ...payload });
  if (res && res.ok === false) {
    throw new Error(res.error || "Background failed to store the item");
  }
}

// ------------------------------------------------------------
// Save handlers
// `busy` stops the saved-state refresh from fighting the flash animation.
// ------------------------------------------------------------
let busy = false;

async function saveGig(gigBtn) {
  if (!extensionAlive()) { alert(RELOAD_MSG); return; }

  busy = true;
  const wasSaved = gigBtn.dataset.saved === "1";
  const restore = setButtonLoading(gigBtn);
  let saved = false;
  let missing = [];

  try {
    await expandAbout(); // "Read More" under the description, so the full text is in the page
    const title = parseTitle();
    const seller = parseSeller();
    const about = parseAboutGig();
    const tiers = parseComparisonTable();
    const faq = parseFAQ();
    const ratingBreakdown = parseRatingBreakdown();
    const breadcrumb = parseBreadcrumb();
    const relatedTags = parseRelatedTags();
    const portfolioCount = parsePortfolioCount();
    const hourlyRate = parseHourlyRate();

    await expandSellerBio();
    const sellerBio = parseSellerBio();

    await loadAllReviews();
    await expandAllReviews();
    await new Promise(r => setTimeout(r, 800)); // let review prices/durations finish rendering
    const reviews = parseReviews();

    // Which sections came back empty? Incomplete gigs get a page diagnostic stored with them.
    missing = checkGigCompleteness({ title, seller, sellerBio, about, tiers, reviews, breadcrumb });
    const diagnostic = missing.length ? buildGigDiagnostic(missing) : "";
    if (missing.length) console.warn("[gig-scraper] incomplete scrape, missing:", missing);

    const markdown = buildMarkdown({ title, seller, sellerBio, about, tiers, reviews, faq, ratingBreakdown, breadcrumb, relatedTags, portfolioCount, hourlyRate });

    const category = breadcrumb.length ? breadcrumb[breadcrumb.length - 1] : null;
    const safeUsername = getUsernameFromUrl().replace(/[^\w-]/g, "-");
    const safeCategory = category ? category.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") : "";
    const safeName = title.slice(0, 50).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "gig";
    const filename = `${[safeUsername, safeCategory, safeName].filter(Boolean).join("_")}.md`;

    await storeScrapedItem({
      kind: "gig",
      username: getUsernameFromUrl(),
      title,
      filename,
      content: markdown,
      url: cleanGigUrl(),
      category,
      warnings: missing,
      diagnostic
    });
    saved = true;
  } catch (err) {
    reportFailure("Scrape failed", err);
  } finally {
    restore();
  }

  const doneText = wasSaved ? "Gig updated" : "Gig saved";
  finishSave(gigBtn, saved, missing.length ? `${doneText} (incomplete)` : doneText);
}

async function saveProfile(profileBtn) {
  if (!extensionAlive()) { alert(RELOAD_MSG); return; }

  busy = true;
  const wasSaved = profileBtn.dataset.saved === "1";
  const restore = setButtonLoading(profileBtn);
  let saved = false;

  try {
    await expandSkillsAndServices();
    const profile = parseProfile();
    const markdown = buildProfileMarkdown(profile);
    const safeUsername = getUsernameFromUrl().replace(/[^\w-]/g, "-");

    await storeScrapedItem({
      kind: "profile",
      username: getUsernameFromUrl(),
      title: `${profile.name} — Profile`,
      filename: `${safeUsername}_profile.md`,
      content: markdown,
      url: cleanPageUrl(),
      category: null
    });
    saved = true;
  } catch (err) {
    reportFailure("Profile scrape failed", err);
  } finally {
    restore();
  }

  finishSave(profileBtn, saved, wasSaved ? "Profile updated" : "Profile saved");
}

// After a save: rest in the "Already saved" look, play the flash, then
// re-check storage once the animation is over.
function finishSave(btn, saved, flashText) {
  if (!saved) {
    busy = false;
    return;
  }
  setButtonSavedLook(btn, true);
  flashButtonSaved(btn, flashText);
  setTimeout(() => {
    busy = false;
    refreshSavedState();
  }, 2100);
}

// ------------------------------------------------------------
// "Already saved" detection (reads chrome.storage.local directly)
// A gig counts as saved when a gig with the same title exists for this
// seller, the same rule the background uses to overwrite on re-save.
// ------------------------------------------------------------
async function isAlreadySaved(state) {
  if (!extensionAlive()) return false;
  try {
    const { sellers } = await chrome.storage.local.get("sellers");
    const seller = sellers && sellers[getUsernameFromUrl()];
    if (!seller) return false;
    if (state === "profile") return !!seller.profile;
    const title = parseTitle();
    return !!title && (seller.gigs || []).some(g => g.title === title);
  } catch (e) {
    return false;
  }
}

let currentBtn = null;

async function refreshSavedState() {
  if (!currentBtn || busy) return;
  const btn = currentBtn;
  const saved = await isAlreadySaved(mountedState);
  if (btn === currentBtn && !busy) setButtonSavedLook(btn, saved);
}

// Keep the button in sync when items are saved/deleted from the popup.
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.sellers) refreshSavedState();
  });
} catch (e) { /* context already gone */ }

// ------------------------------------------------------------
// Button mounting (SPA-aware)
// ------------------------------------------------------------
let mountedState = null; // "gig" | "profile" | "none"
let mountedKey = null;   // state + pathname, so gig-to-gig navigation remounts

function removeRow() {
  document.getElementById(ROW_ID)?.remove();
}

function mountButtons(state, key) {
  removeRow(); // also clears leftovers from an orphaned older copy of this script
  mountedState = state;
  mountedKey = key;
  currentBtn = null;
  if (state === "none") return;

  const row = createButtonRow();
  row.id = ROW_ID;

  if (state === "gig") {
    const gigBtn = createFloatingButton({ iconSVG: ICONS.download, label: "Save Gig", color: FGS_COLORS.green, container: row });
    gigBtn.addEventListener("click", () => saveGig(gigBtn));
    currentBtn = gigBtn;
  } else if (state === "profile") {
    const profileBtn = createFloatingButton({ iconSVG: ICONS.person, label: "Save Profile", color: FGS_COLORS.ink, container: row });
    profileBtn.addEventListener("click", () => saveProfile(profileBtn));
    currentBtn = profileBtn;
  }

  refreshSavedState();
}

function syncButtons() {
  if (!extensionAlive()) {
    // Orphaned after an extension reload: remove stale buttons and stop polling.
    clearInterval(syncTimer);
    removeRow();
    return;
  }

  const state = isGigPage() ? "gig" : isProfilePage() ? "profile" : "none";
  const key = `${state}|${location.pathname}`;
  const rowPresent = !!document.getElementById(ROW_ID);

  if (key !== mountedKey || (state !== "none" && !rowPresent)) {
    mountButtons(state, key);
  }
}

const syncTimer = setInterval(syncButtons, 1000);
syncButtons();