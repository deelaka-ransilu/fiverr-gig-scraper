// ============================================================
// Popup logic - reads/writes chrome.storage.local under the
// "sellers" key. Auto-refreshes live if storage changes while
// the popup is open (e.g. you scrape a new gig in another tab).
// ============================================================

let sellers = {};
let activeFilter = "all";
let searchQuery = "";
let viewingEntry = null;
const expandedSellers = new Set(); // survives re-renders (search, filter, delete, live refresh)

const svg = (inner, size = 16, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICON_EYE = svg(`<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>`);
const ICON_COPY = svg(`<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>`);
const ICON_OPEN = svg(`<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`);
const ICON_DOWNLOAD = svg(`<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/>`);
const ICON_TRASH = svg(`<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/>`);
const ICON_CHECK = svg(`<path d="M5 13l4 4L19 7"/>`, 16, 2.4);

async function loadSellers() {
  const data = await chrome.storage.local.get("sellers");
  sellers = data.sellers || {};
  autoExpandIfSingle();
  render();
}

// Live refresh: if the content script stores a new item while this popup
// happens to be open, or another popup instance changes something, reflect it immediately.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.sellers) {
    sellers = changes.sellers.newValue || {};
    autoExpandIfSingle();
    render();
  }
});

// With a single seller there's nothing to compare, so open it right away.
function autoExpandIfSingle() {
  const names = Object.keys(sellers);
  if (names.length === 1) expandedSellers.add(names[0]);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

function lastSaved(s) {
  const times = s.gigs.map(g => g.savedAt);
  if (s.profile) times.push(s.profile.savedAt);
  return times.length ? Math.max(...times) : 0;
}

function displayNameFor(username, s) {
  return s.profile ? s.profile.title.replace(/\s*—\s*Profile$/i, "") : username;
}

function getAllCategories() {
  const set = new Set();
  Object.values(sellers).forEach(s => s.gigs.forEach(g => { if (g.category) set.add(g.category); }));
  return Array.from(set);
}

function renderFilters() {
  const cats = getAllCategories();
  const filters = document.getElementById("filters");

  // If the active category no longer exists (e.g. its last gig was deleted), reset,
  // otherwise the list could be stuck empty with the chips hidden.
  if (activeFilter !== "all" && !cats.includes(activeFilter)) activeFilter = "all";

  if (cats.length <= 1) { filters.style.display = "none"; return; }
  filters.style.display = "flex";
  filters.innerHTML = [`<button class="chip ${activeFilter === 'all' ? 'active' : ''}" data-cat="all">All</button>`]
    .concat(cats.map(c => `<button class="chip ${activeFilter === c ? 'active' : ''}" data-cat="${escapeAttr(c)}">${escapeHtml(c)}</button>`))
    .join("");
  filters.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => setFilter(chip.dataset.cat));
  });
}

function setFilter(cat) {
  activeFilter = cat;
  render();
}

function render() {
  const hasAny = Object.keys(sellers).length > 0;
  document.getElementById("searchWrap").style.display = hasAny ? "" : "none";
  renderFilters();

  const list = document.getElementById("list");
  const q = searchQuery.trim().toLowerCase();

  // Work out what each seller shows under the current category filter + search
  const rows = [];
  Object.keys(sellers).forEach(username => {
    const s = sellers[username];
    const name = displayNameFor(username, s);
    const sellerMatch = !q || username.toLowerCase().includes(q) || name.toLowerCase().includes(q);

    let gigs = activeFilter === "all" ? s.gigs.slice() : s.gigs.filter(g => g.category === activeFilter);
    if (!sellerMatch) {
      gigs = gigs.filter(g => g.title.toLowerCase().includes(q) || (g.category || "").toLowerCase().includes(q));
    }
    const hasProfile = !!s.profile && activeFilter === "all" && sellerMatch;

    if (gigs.length === 0 && !hasProfile) return;
    gigs.sort((a, b) => b.savedAt - a.savedAt); // newest first
    rows.push({ username, s, name, gigs, hasProfile, last: lastSaved(s) });
  });
  rows.sort((a, b) => b.last - a.last); // most recently saved seller on top

  if (rows.length === 0) {
    if (q) {
      list.innerHTML = `<div class="empty-state">No matches for “${escapeHtml(searchQuery.trim())}”.</div>`;
    } else if (hasAny) {
      list.innerHTML = `<div class="empty-state">Nothing in this category.</div>`;
    } else {
      list.innerHTML = `<div class="empty-state">Nothing saved yet.<br>Open a Fiverr gig or seller profile and click the green (gig) or blue (profile) button in the bottom-right corner.</div>`;
    }
    document.getElementById("totalCount").textContent = "";
    return;
  }

  let totalItems = 0;
  list.innerHTML = rows.map(r => {
    const gigCount = r.gigs.length;
    totalItems += gigCount + (r.hasProfile ? 1 : 0);

    const itemsHTML =
      (r.hasProfile ? itemRow(r.username, "profile", 0, r.s.profile) : "") +
      r.gigs.map(g => itemRow(r.username, "gig", r.s.gigs.indexOf(g), g)).join("");

    const open = q || expandedSellers.has(r.username);

    return `
      <div class="seller-group ${open ? "expanded" : ""}" data-username="${escapeAttr(r.username)}">
        <div class="seller-header">
          <span class="seller-name">${escapeHtml(r.name)}</span>
          <div class="seller-badges">
            ${gigCount ? `<span class="badge gig-badge">${gigCount} gig${gigCount > 1 ? "s" : ""}</span>` : ""}
            ${r.hasProfile ? `<span class="badge profile-badge">profile</span>` : ""}
            <span class="chevron">${chevronSVG()}</span>
          </div>
        </div>
        <div class="items">${itemsHTML}</div>
      </div>
    `;
  }).join("");

  document.getElementById("totalCount").textContent =
    `${totalItems} saved` + (rows.length > 1 ? ` from ${rows.length} sellers` : "");

  // Wire up interactions after render
  list.querySelectorAll(".seller-header").forEach(header => {
    header.addEventListener("click", () => {
      const group = header.parentElement;
      const username = group.dataset.username;
      const nowOpen = group.classList.toggle("expanded");
      if (nowOpen) expandedSellers.add(username); else expandedSellers.delete(username);
    });
  });
  list.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const refId = btn.dataset.ref;
      if (action === "view") viewItem(refId);
      if (action === "copy") copyItem(refId, btn);
      if (action === "open") openItem(refId);
      if (action === "download") { downloadItem(refId); flashIcon(btn); }
      if (action === "delete") deleteItem(refId);
    });
  });
}

function chevronSVG() {
  return svg(`<path d="M9 6l6 6-6 6"/>`, 12, 2.5);
}

function itemRow(username, kind, index, entry) {
  const refId = `${username}::${kind}::${index}`;
  const tag = kind === "profile"
    ? `<span class="item-kind">Profile</span>`
    : (entry.category ? `<span class="item-category">${escapeHtml(entry.category)}</span>` : "");
  return `
    <div class="item">
      <div class="item-info">
        <div class="item-title" title="${escapeAttr(entry.title)}">${escapeHtml(entry.title)}</div>
        <div class="item-meta">
          <span class="item-date">${timeAgo(entry.savedAt)}</span>
          ${tag}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" title="View" data-action="view" data-ref="${refId}">${ICON_EYE}</button>
        <button class="icon-btn" title="Copy Markdown" data-action="copy" data-ref="${refId}">${ICON_COPY}</button>
        <button class="icon-btn" title="Open on Fiverr" data-action="open" data-ref="${refId}">${ICON_OPEN}</button>
        <button class="icon-btn" title="Download" data-action="download" data-ref="${refId}">${ICON_DOWNLOAD}</button>
        <button class="icon-btn delete-btn" title="Delete" data-action="delete" data-ref="${refId}">${ICON_TRASH}</button>
      </div>
    </div>
  `;
}

function resolveRef(refId) {
  const [username, kind, index] = refId.split("::");
  const s = sellers[username];
  if (kind === "profile") return { entry: s.profile, username, remove: () => { s.profile = null; } };
  const idx = parseInt(index, 10);
  return { entry: s.gigs[idx], username, remove: () => { s.gigs.splice(idx, 1); } };
}

// Swap a button's icon to a green check for a moment
function flashIcon(btn) {
  const original = btn.innerHTML;
  btn.innerHTML = ICON_CHECK;
  btn.classList.add("done");
  setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove("done");
  }, 1200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (err2) {
      return false;
    }
  }
}

async function copyItem(refId, btn) {
  const { entry } = resolveRef(refId);
  const ok = await copyText(entry.content);
  if (ok) flashIcon(btn);
  else alert("Couldn't copy to the clipboard.");
}

function openItem(refId) {
  const { entry } = resolveRef(refId);
  if (entry.url) chrome.tabs.create({ url: entry.url });
}

function viewItem(refId) {
  const { entry } = resolveRef(refId);
  viewingEntry = entry;
  document.getElementById("viewerTitle").textContent = entry.title;
  document.getElementById("viewerBody").textContent = entry.content;
  document.getElementById("viewerOverlay").classList.add("open");
}
function closeViewer() {
  viewingEntry = null;
  document.getElementById("viewerOverlay").classList.remove("open");
}
document.getElementById("viewerOverlay").addEventListener("click", (e) => {
  if (e.target.id === "viewerOverlay") closeViewer();
});
document.getElementById("viewerCloseBtn").addEventListener("click", closeViewer);
document.getElementById("viewerCopyBtn").addEventListener("click", async (e) => {
  if (!viewingEntry) return;
  const btn = e.currentTarget;
  if (await copyText(viewingEntry.content)) {
    btn.textContent = "Copied";
    setTimeout(() => { btn.textContent = "Copy"; }, 1200);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeViewer();
});
document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  render();
});
document.getElementById("downloadAllBtn").addEventListener("click", downloadAll);
document.getElementById("clearAllBtn").addEventListener("click", clearAll);

// Direct Blob-based download — avoids Chrome's known filename bug with large data: URIs
// relayed through the background service worker. popup.js has full DOM access,
// so we create the Blob and call chrome.downloads.download() right here.
async function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  // Tell the background which name to enforce (see onDeterminingFilename in background.js)
  try {
    await chrome.runtime.sendMessage({ type: "expectDownload", url: blobUrl, filename });
  } catch (err) {
    console.warn("expectDownload failed, falling back to the browser's naming:", err);
  }

  chrome.downloads.download({
    url: blobUrl,
    filename: filename,
    saveAs: false
  }, () => {
    // Revoke after a short delay so the download has time to actually start
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  });
}

// ---- file naming -------------------------------------------------
// Gig:     <seller>_<category>_<short-title>.md
//          madilyani_Figma-to-Web-App_convert-figma-to-reactjs-or-nextjs-website-with-ai-integration.md
// Profile: <seller>_profile.md
// Built at download time from the saved entry, so gigs saved earlier get the new names too.
function slugify(s) {
  return String(s || "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function shortTitleSlug(title, max = 70) {
  // drop the "I will ..." boilerplate every gig title starts with
  const t = String(title || "").replace(/^(i\s*will|i[’']ll|i\s*can|we\s*will)\s+/i, "");
  const words = slugify(t).split("-").filter(Boolean);
  let out = "";
  for (const w of words) {
    if ((out ? out.length + 1 : 0) + w.length > max) break; // cut at a word boundary
    out += (out ? "-" : "") + w;
  }
  return out || (words[0] || "gig").slice(0, max);
}

function categoryPathFor(entry) {
  // The full breadcrumb is already inside the saved Markdown:
  // "**Category:** Programming & Tech > Software Development > Figma to Web & App"
  const m = /^\*\*Category:\*\*[ \t]*(.+)$/m.exec(entry.content || "");
  let parts = m ? m[1].split(">").map(slugify).filter(Boolean) : [];
  if (!parts.length && entry.category) parts = [slugify(entry.category)];
  return parts.join("_");
}

function fileNameFor(username, kind, entry) {
  const seller = username.replace(/[^\w-]/g, "-");
  if (kind === "profile") return `${seller}_profile.md`;
  return [categoryPathFor(entry), seller, shortTitleSlug(entry.title)].filter(Boolean).join("_") + ".md";
}

function downloadItem(refId) {
  const { entry, username } = resolveRef(refId);
  const kind = refId.split("::")[1];
  triggerDownload(fileNameFor(username, kind, entry), entry.content);
}

async function deleteItem(refId) {
  const { remove, username } = resolveRef(refId);
  remove();
  if (!sellers[username].profile && sellers[username].gigs.length === 0) {
    delete sellers[username];
    expandedSellers.delete(username);
  }
  await chrome.storage.local.set({ sellers });
  // onChanged listener will re-render, but render immediately too for snappy feedback
  render();
}

async function clearAll() {
  if (!confirm("Delete all saved gigs and profiles? This can't be undone.")) return;
  sellers = {};
  expandedSellers.clear();
  await chrome.storage.local.set({ sellers });
  render();
}

function combineSellerMarkdown(username, s) {
  let md = `# ${username} — Combined Export\n\n`;
  md += `_Generated ${new Date().toLocaleString()}_\n\n`;
  md += `---\n\n`;

  if (s.profile) {
    md += s.profile.content;
    md += `\n\n---\n\n`;
  }

  s.gigs.forEach((g, i) => {
    md += g.content;
    if (i < s.gigs.length - 1) md += `\n\n---\n\n`;
  });

  return md;
}

function downloadAll() {
  const usernames = Object.keys(sellers);
  if (usernames.length === 0) { alert("Nothing saved yet."); return; }

  // One combined file per seller (profile + all their gigs merged),
  // rather than a separate download per item. Stagger slightly so
  // Chrome doesn't collapse multiple rapid downloads together.
  usernames.forEach((username, i) => {
    const s = sellers[username];
    const safeUsername = username.replace(/[^\w-]/g, "-");
    const filename = `${safeUsername}_combined.md`;
    const content = combineSellerMarkdown(username, s);
    setTimeout(() => triggerDownload(filename, content), i * 200);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

loadSellers();