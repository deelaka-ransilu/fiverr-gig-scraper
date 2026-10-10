// ============================================================
// Reusable floating pill-button widget
// Creates a circular icon button (bottom-right) that expands
// into a labeled pill on hover, matching Fiverr's seller-widget style.
// ============================================================

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
      <span style="font-size:13px;font-weight:600;color:#222325;padding-right:12px;">${label}</span>
    </div>
  `;
  // Reverse the inner row so the label appears to the LEFT of the icon
  // (since the icon is on the right edge of the screen)
  el.style.cssText = "display:flex;flex-direction:row-reverse;align-items:center;background:#fff;border-radius:28px;box-shadow:0 2px 10px rgba(0,0,0,0.15);cursor:pointer;padding:4px;transition:padding 0.25s ease;";

  const labelWidth = Math.min(200, label.length * 8 + 40);
  el.addEventListener("mouseenter", () => {
    el.style.padding = "4px 4px 4px 16px";
    el.querySelector('div:last-child').style.maxWidth = `${labelWidth}px`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.padding = "4px";
    el.querySelector('div:last-child').style.maxWidth = "0";
  });

  container.appendChild(el);
  return el;
}

function isGigPage() {
  const segments = location.pathname.split('/').filter(Boolean);
  // gig URLs look like /username/gig-slug-here (2+ segments)
  // AND a packages table exists, which profile pages never have
  return segments.length >= 2 && !!document.querySelector('.gig-page-packages-table');
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

// Success feedback, call AFTER restore(): the icon swaps to a check that
// draws itself, a ring pulses out from the circle, and the pill opens to
// show `text` (e.g. "Gig saved") for ~2s, then everything goes back to normal.
function flashButtonSaved(buttonEl, text) {
  const iconWrapper = buttonEl.querySelector('div:first-child');
  const labelWrap = buttonEl.querySelector('div:last-child');
  const labelSpan = labelWrap.querySelector('span');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const originalIcon = iconWrapper.innerHTML;
  const originalText = labelSpan.textContent;
  const originalWidth = Math.min(200, originalText.length * 8 + 40);
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
  labelWrap.style.maxWidth = `${Math.min(200, text.length * 8 + 40)}px`;
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
  person: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="white" stroke-width="2"/></svg>`
};