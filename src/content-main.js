// ============================================================
// Fiverr Gig Scraper - main orchestrator
// All parsing/markdown logic lives in src/parsers and src/markdown.
// This file creates the buttons and wires click -> scrape -> store.
// Data is stored via chrome.storage.local (see background.js) and
// browsed/downloaded from the extension's popup, not downloaded instantly.
// ============================================================

function getUsernameFromUrl() {
  const segments = location.pathname.split('/').filter(Boolean);
  return segments[0] || "unknown";
}

const row = createButtonRow();

const onGig = isGigPage();
const onProfile = isProfilePage();

let gigBtn = null;
let profileBtn = null;

if (onGig) {
  gigBtn = createFloatingButton({
    iconSVG: ICONS.download,
    label: "Save Gig",
    color: "#22C55E",
    container: row
  });
}

if (onProfile) {
  profileBtn = createFloatingButton({
    iconSVG: ICONS.person,
    label: "Save Profile",
    color: "#3B82F6",
    container: row
  });
}

if (gigBtn) {
  gigBtn.addEventListener("click", async () => {
    const restore = setButtonLoading(gigBtn);

    try {
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

      await expandAllReviews();
      const reviews = parseReviews();

      const markdown = buildMarkdown({ title, seller, sellerBio, about, tiers, reviews, faq, ratingBreakdown, breadcrumb, relatedTags, portfolioCount, hourlyRate });

      const category = breadcrumb.length ? breadcrumb[breadcrumb.length - 1] : null;
      const safeUsername = getUsernameFromUrl().replace(/[^\w-]/g, "-");
      const safeCategory = category ? category.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") : "";
      const safeName = title.slice(0, 50).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "gig";
      const filenameParts = [safeUsername, safeCategory, safeName].filter(Boolean);
      const filename = `${filenameParts.join("_")}.md`;

      chrome.runtime.sendMessage({
        type: "store",
        kind: "gig",
        username: getUsernameFromUrl(),
        title,
        filename,
        content: markdown,
        url: location.href,
        category
      });
    } catch (err) {
      console.error("Scrape failed:", err);
      alert("Scrape failed - check console for details.");
    } finally {
      restore();
    }
  });
}

if (profileBtn) {
  profileBtn.addEventListener("click", async () => {
    const restore = setButtonLoading(profileBtn);

    try {
      await expandSkillsAndServices();
      const profile = parseProfile();
      const markdown = buildProfileMarkdown(profile);
      const safeUsername = getUsernameFromUrl().replace(/[^\w-]/g, "-");
      const filename = `${safeUsername}_profile.md`;

      chrome.runtime.sendMessage({
        type: "store",
        kind: "profile",
        username: getUsernameFromUrl(),
        title: `${profile.name} — Profile`,
        filename,
        content: markdown,
        url: location.href,
        category: null
      });
    } catch (err) {
      console.error("Profile scrape failed:", err);
      alert("Profile scrape failed - check console.");
    } finally {
      restore();
    }
  });
}