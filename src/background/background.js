// ============================================================
// Background service worker
// Stores scraped gig/profile data in chrome.storage.local,
// grouped by seller username. Handles downloads triggered
// from the popup (single item, per-seller, or all).
// ============================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "store") {
    storeItem(msg).then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async sendResponse
  }

  if (msg.type === "download") {
    downloadFile(msg.filename, msg.content);
  }

  if (msg.type === "downloadMultiple") {
    // msg.files: [{ filename, content }, ...]
    msg.files.forEach((f, i) => {
      // stagger slightly so Chrome doesn't collapse rapid-fire downloads
      setTimeout(() => downloadFile(f.filename, f.content), i * 150);
    });
  }
});

function downloadFile(filename, content) {
  const dataUrl = "data:text/markdown;charset=utf-8," + encodeURIComponent(content);
  chrome.downloads.download({
    url: dataUrl,
    filename: filename || "gig.md",
    saveAs: false
  });
}

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