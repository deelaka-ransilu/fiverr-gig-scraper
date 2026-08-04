// ============================================================
// Fiverr Gig Scraper - main orchestrator
// All parsing/markdown logic lives in src/parsers and src/markdown.
// This file just creates the buttons and wires click -> scrape -> save.
// ============================================================

createLabelInput();

const gigBtn = createFloatingButton({
  iconSVG: ICONS.download,
  label: "Save Gig to MD",
  color: "#22C55E",
  bottomOffset: 16
});

const profileBtn = createFloatingButton({
  iconSVG: ICONS.person,
  label: "Save Profile to MD",
  color: "#3B82F6",
  bottomOffset: 76
});

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

    const safeName = title.slice(0, 60).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "gig";
    const label = getScraperLabel();
    const filename = label ? `${label}-${safeName}.md` : `${safeName}.md`;
    chrome.runtime.sendMessage({ type: "save", content: markdown, filename });
  } catch (err) {
    console.error("Scrape failed:", err);
    alert("Scrape failed - check console for details.");
  } finally {
    restore();
  }
});

profileBtn.addEventListener("click", async () => {
  const restore = setButtonLoading(profileBtn);

  try {
    await expandSkillsAndServices();
    const profile = parseProfile();
    const markdown = buildProfileMarkdown(profile);
    const safeName = profile.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "profile";
    const label = getScraperLabel();
    const filename = label ? `${label}-${safeName}-profile.md` : `${safeName}-profile.md`;
    chrome.runtime.sendMessage({ type: "save", content: markdown, filename });
  } catch (err) {
    console.error("Profile scrape failed:", err);
    alert("Profile scrape failed - check console. Note: this button only works on a Fiverr seller profile page, not a gig page.");
  } finally {
    restore();
  }
});