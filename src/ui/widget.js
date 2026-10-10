// ============================================================
// Reusable floating pill-button widget
// Creates a circular icon button (bottom-right) that expands
// into a labeled pill on hover, matching Fiverr's seller-widget style.
//
// Palette (Fiverr brand):
//   green  #1DBF73  gig button
//   ink    #222325  profile button / label text
//   saved  #095933  "already saved" state (deep Fiverr green)
// ============================================================

const FGS_COLORS = {
  green: "#1DBF73",
  ink: "#222325",
  saved: "#095933"
};

function labelWidthFor(text) {
  return Math.min(240, text.length * 8 + 40);
}

function createButtonRow() {
  const row = document.createElement("div");
  row.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:999999;display:flex;flex-direction:row-reverse;align-items:center;gap:10px;";
  document.body.appendChild(row);
  return row;
}

function createFloatingButton({ iconSVG, label, color, container }) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div style="width:48px;height:48px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      ${iconSVG}
    </div>
    <div style="display:flex;flex-direction:column;justify-content:center;overflow:hidden;white-space:nowrap;max-width:0;transition:max-width 0.25s ease;">
      <span style="font-size:13px;font-weight:600;color:${FGS_COLORS.ink};padding-right:12px;">${label}</span>
    </div>
  `;
  // Reverse the inner row so the label appears to the LEFT of the icon
  // (since the icon is on the right edge of the screen)
  el.style.cssText = "display:flex;flex-direction:row-reverse;align-items:center;background:#fff;border-radius:28px;box-shadow:0 2px 10px rgba(0,0,0,0.15);cursor:pointer;padding:4px;transition:padding 0.25s ease;";

  // Remember the unsaved look so setButtonSavedLook can switch back to it
  el._fgs = { iconSVG, label, color };

  el.addEventListener("mouseenter", () => {
    el.style.padding = "4px 4px 4px 16px";
    el.querySelector('div:last-child').style.maxWidth = `${labelWidthFor(el.querySelector('span').textContent)}px`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.padding = "4px";
    el.querySelector('div:last-child').style.maxWidth = "0";
  });

  container.appendChild(el);
  return el;
}

// Switches a button between its normal look and the "already saved" look
// (check icon, deep green, label "Already saved"). Clicking still re-scrapes
// and overwrites the saved item.
function setButtonSavedLook(buttonEl, saved) {
  const iconWrapper = buttonEl.querySelector('div:first-child');
  const labelWrap = buttonEl.querySelector('div:last-child');
  const labelSpan = labelWrap.querySelector('span');
  const cfg = buttonEl._fgs;
  if (!cfg) return;

  buttonEl.dataset.saved = saved ? "1" : "";
  iconWrapper.innerHTML = saved ? ICONS.check : cfg.iconSVG;
  iconWrapper.style.background = saved ? FGS_COLORS.saved : cfg.color;
  labelSpan.textContent = saved ? "Already saved" : cfg.label;
  buttonEl.title = saved ? "Already saved. Click to re-scrape and update it." : "";

  if (buttonEl.matches(':hover')) {
    labelWrap.style.maxWidth = `${labelWidthFor(labelSpan.textContent)}px`;
  }
}

function isGigPage() {
  const segments = location.pathname.split('/').filter(Boolean);
  // gig URLs look like /username/gig-slug-here (2+ segments)
  // AND an order box exists, which profile pages never have:
  //  - .gig-page-packages-table : Basic/Standard/Premium comparison table
  //  - .packages-tabs           : single-package (and tabbed) order box
  return segments.length >= 2 && !!document.querySelector('.gig-page-packages-table, .packages-tabs');
}

function isProfilePage() {
  const segments = location.pathname.split('/').filter(Boolean);
  // profile URLs look like /username (exactly 1 segment)
  return segments.length === 1;
}

function setButtonLoading(buttonEl) {
  const iconWrapper = buttonEl.querySelector('div:first-child');
  const original = iconWrapper.innerHTML;
  iconWrapper.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-9-9" stroke="white" stroke-width="2" stroke-linecap="round"/></svg><style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>`;
  buttonEl.style.pointerEvents = "none";

  return function restore() {
    iconWrapper.innerHTML = original;
    buttonEl.style.pointerEvents = "auto";
  };
}

// Success feedback, call AFTER restore() (and after setButtonSavedLook if the
// resting state should be "saved"): the icon swaps to a check that draws
// itself, a ring pulses out from the circle, and the pill opens to show
// `text` (e.g. "Gig saved") for ~2s, then everything goes back to normal.
function flashButtonSaved(buttonEl, text) {
  const iconWrapper = buttonEl.querySelector('div:first-child');
  const labelWrap = buttonEl.querySelector('div:last-child');
  const labelSpan = labelWrap.querySelector('span');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const originalIcon = iconWrapper.innerHTML;
  const originalText = labelSpan.textContent;
  const originalWidth = labelWidthFor(originalText);
  const ringColor = getComputedStyle(iconWrapper).backgroundColor;

  const drawStyle = reduceMotion
    ? "stroke-dasharray:30;stroke-dashoffset:0;"
    : "stroke-dasharray:30;stroke-dashoffset:30;animation:fgs-draw .35s .12s ease-out forwards;";

  iconWrapper.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 13l4 4L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="${drawStyle}"/>
    </svg>
    <style>
      @keyframes fgs-draw { to { stroke-dashoffset: 0; } }
      @keyframes fgs-ring { from { box-shadow: 0 0 0 0 var(--fgs-c); } to { box-shadow: 0 0 0 14px transparent; } }
      @keyframes fgs-pop  { 0% { transform: scale(.85); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
    </style>`;

  if (!reduceMotion) {
    iconWrapper.style.setProperty('--fgs-c', ringColor);
    iconWrapper.style.animation = "fgs-pop .4s ease-out, fgs-ring .7s ease-out";
  }

  labelSpan.textContent = text;
  buttonEl.style.padding = "4px 4px 4px 16px";
  labelWrap.style.maxWidth = `${labelWidthFor(text)}px`;
  buttonEl.style.pointerEvents = "none"; // no double-clicks while the confirmation is showing

  setTimeout(() => {
    iconWrapper.innerHTML = originalIcon;
    iconWrapper.style.animation = "";
    iconWrapper.style.removeProperty('--fgs-c');
    labelSpan.textContent = originalText;
    buttonEl.style.pointerEvents = "auto";

    if (buttonEl.matches(':hover')) {
      labelWrap.style.maxWidth = `${originalWidth}px`;
    } else {
      buttonEl.style.padding = "4px";
      labelWrap.style.maxWidth = "0";
    }
  }, 2000);
}

const ICONS = {
  download: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  person: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="white" stroke-width="2"/></svg>`,
  check: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};