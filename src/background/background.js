// ============================================================
// Background service worker
// Only responsible for storing scraped gig/profile data in
// chrome.storage.local, grouped by seller username.
//
// Downloads are handled directly in popup.js (via Blob URLs),
// NOT relayed through here.
// ============================================================

// ------------------------------------------------------------
// Filename enforcement
// The popup creates a Blob URL for each download. Chrome/Brave was
// saving those under the blob's random ID (e5d4cf83-....md) instead of
// the name we pass to chrome.downloads.download(). So the popup tells us
// the wanted name first ("expectDownload"), and when the browser decides
// the final filename we suggest ours explicitly.
// ------------------------------------------------------------
const pendingNames = new Map(); // blob URL -> wanted filename

function cleanFilename(name) {
  let base = String(name || "gig").replace(/\.md$/i, "");
  base = base
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  return (base.slice(0, 150) || "gig") + ".md";
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (item.byExtensionId !== chrome.runtime.id) return; // not ours, leave it alone

  let key = [item.url, item.finalUrl].find(u => pendingNames.has(u));
  if (key === undefined && pendingNames.size) key = pendingNames.keys().next().value; // fallback: oldest pending

  console.log("[gig-scraper] naming download", {
    browserProposed: item.filename,
    url: item.url,
    matched: key !== undefined,
    wanted: key !== undefined ? pendingNames.get(key) : null
  });

  if (key === undefined) return;
  const wanted = cleanFilename(pendingNames.get(key));
  pendingNames.delete(key);
  suggest({ filename: wanted, conflictAction: "uniquify" });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "expectDownload") {
    pendingNames.set(msg.url, msg.filename);
    sendResponse({ ok: true });
    return; // answered synchronously
  }

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

async function storeItem({ username, kind, title, filename, content, url, category, warnings, diagnostic }) {
  const data = await chrome.storage.local.get("sellers");
  const sellers = data.sellers || {};

  if (!sellers[username]) {
    sellers[username] = { username, gigs: [], profile: null };
  }

  const entry = {
    title,
    filename,
    content,
    url,
    category: category || null,
    warnings: warnings || [],      // names of sections that came back empty
    diagnostic: diagnostic || "",  // page report for fixing the parser (only set when incomplete)
    savedAt: Date.now()
  };

  if (kind === "gig") {
    // Re-scraping the same gig (same title) overwrites rather than duplicates
    sellers[username].gigs = sellers[username].gigs.filter(g => g.title !== title);
    sellers[username].gigs.push(entry);
  } else if (kind === "profile") {
    sellers[username].profile = entry;
  }

  await chrome.storage.local.set({ sellers });
}