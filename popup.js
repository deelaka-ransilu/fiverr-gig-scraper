// ============================================================
// Popup logic - reads/writes chrome.storage.local under the
// "sellers" key. Auto-refreshes live if storage changes while
// the popup is open (e.g. you scrape a new gig in another tab).
// ============================================================

let sellers = {};
let activeFilter = "all";

const ICON_EYE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`;
const ICON_DOWNLOAD = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_TRASH = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

async function loadSellers() {
  const data = await chrome.storage.local.get("sellers");
  sellers = data.sellers || {};
  render();
}

// Live refresh: if the content script stores a new item while this popup
// happens to be open, or another popup instance changes something, reflect it immediately.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.sellers) {
    sellers = changes.sellers.newValue || {};
    render();
  }
});

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

function getAllCategories() {
  const set = new Set();
  Object.values(sellers).forEach(s => s.gigs.forEach(g => { if (g.category) set.add(g.category); }));
  return Array.from(set);
}

function renderFilters() {
  const cats = getAllCategories();
  const filters = document.getElementById("filters");
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
  renderFilters();
  const list = document.getElementById("list");
  const usernames = Object.keys(sellers).filter(u => {
    if (activeFilter === "all") return true;
    return sellers[u].gigs.some(g => g.category === activeFilter);
  });

  if (usernames.length === 0) {
    list.innerHTML = `<div class="empty-state">Nothing here yet.<br>Visit a Fiverr gig or profile page and use the buttons in the bottom-right corner to save data here.</div>`;
    document.getElementById("totalCount").textContent = "";
    return;
  }

  let totalItems = 0;
  list.innerHTML = usernames.map(username => {
    const s = sellers[username];
    const visibleGigs = activeFilter === "all" ? s.gigs : s.gigs.filter(g => g.category === activeFilter);
    const gigCount = visibleGigs.length;
    const hasProfile = !!s.profile && activeFilter === "all";
    totalItems += gigCount + (hasProfile ? 1 : 0);

    const displayName = s.profile ? s.profile.title.replace(/\s*—\s*Profile$/i, "") : username;

    const itemsHTML = visibleGigs.map((g) => itemRow(username, "gig", s.gigs.indexOf(g), g)).join("");

    return `
      <div class="seller-group" data-username="${escapeAttr(username)}">
        <div class="seller-header">
          <span class="seller-name">${escapeHtml(displayName)}</span>
          <div class="seller-badges">
            ${gigCount ? `<span class="badge gig-badge">${gigCount} gig${gigCount > 1 ? "s" : ""}</span>` : ""}
            ${hasProfile ? `<span class="badge profile-badge">profile</span>` : ""}
            <span class="chevron">${chevronSVG()}</span>
          </div>
        </div>
        <div class="items">${itemsHTML}</div>
      </div>
    `;
  }).join("");

  document.getElementById("totalCount").textContent = `${totalItems} saved`;

  // Wire up interactions after render (event delegation would also work, this is simple enough)
  list.querySelectorAll(".seller-header").forEach(header => {
    header.addEventListener("click", () => {
      header.parentElement.classList.toggle("expanded");
    });
  });
  list.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const refId = btn.dataset.ref;
      if (action === "view") viewItem(refId);
      if (action === "download") downloadItem(refId);
      if (action === "delete") deleteItem(refId);
    });
  });
}

function chevronSVG() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function itemRow(username, kind, index, entry) {
  const refId = `${username}::gig::${index}`;
  return `
    <div class="item">
      <div class="item-info">
        <div class="item-title">${escapeHtml(entry.title)}</div>
        <div class="item-meta">
          <span class="item-date">${timeAgo(entry.savedAt)}</span>
          ${entry.category ? `<span class="item-category">${escapeHtml(entry.category)}</span>` : ""}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" title="View" data-action="view" data-ref="${refId}">${ICON_EYE}</button>
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

function viewItem(refId) {
  const { entry } = resolveRef(refId);
  document.getElementById("viewerTitle").textContent = entry.title;
  document.getElementById("viewerBody").textContent = entry.content;
  document.getElementById("viewerOverlay").classList.add("open");
}
function closeViewer() {
  document.getElementById("viewerOverlay").classList.remove("open");
}
document.getElementById("viewerOverlay").addEventListener("click", (e) => {
  if (e.target.id === "viewerOverlay") closeViewer();
});
document.getElementById("viewerCloseBtn").addEventListener("click", closeViewer);
document.getElementById("downloadAllBtn").addEventListener("click", downloadAll);
document.getElementById("clearAllBtn").addEventListener("click", clearAll);

function downloadItem(refId) {
  const { entry } = resolveRef(refId);
  chrome.runtime.sendMessage({ type: "download", filename: entry.filename, content: entry.content });
}

async function deleteItem(refId) {
  const { remove, username } = resolveRef(refId);
  remove();
  if (!sellers[username].profile && sellers[username].gigs.length === 0) {
    delete sellers[username];
  }
  await chrome.storage.local.set({ sellers });
  // onChanged listener will re-render, but render immediately too for snappy feedback
  render();
}

async function clearAll() {
  if (!confirm("Delete all saved gigs and profiles? This can't be undone.")) return;
  sellers = {};
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
  // rather than a separate download per item.
  const files = usernames.map(username => {
    const s = sellers[username];
    const safeUsername = username.replace(/[^\w-]/g, "-");
    return {
      filename: `${safeUsername}_combined.md`,
      content: combineSellerMarkdown(username, s)
    };
  });

  chrome.runtime.sendMessage({ type: "downloadMultiple", files });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return (str || "").replace(/"/g, "&quot;");
}

loadSellers();