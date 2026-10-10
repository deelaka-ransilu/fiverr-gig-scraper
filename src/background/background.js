// ============================================================
// Background service worker
// Only responsible for storing scraped gig/profile data in
// chrome.storage.local, grouped by seller username.
//
// Downloads are handled directly in popup.js (via Blob URLs),
// NOT relayed through here.
// ============================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "store") {
    storeItem(msg)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("storeItem failed:", err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // keep the message channel open for the async sendResponse
  }
});

async function storeItem({ username, kind, title, filename, content, url, category }) {
  const data = await chrome.storage.local.get("sellers");
  const sellers = data.sellers || {};

  if (!sellers[username]) {
    sellers[username] = { username, gigs: [], profile: null };
  }

  const entry = { title, filename, content, url, category: category || null, savedAt: Date.now() };

  if (kind === "gig") {
    // Re-scraping the same gig (same title) overwrites rather than duplicates
    sellers[username].gigs = sellers[username].gigs.filter(g => g.title !== title);
    sellers[username].gigs.push(entry);
  } else if (kind === "profile") {
    sellers[username].profile = entry;
  }

  await chrome.storage.local.set({ sellers });
}