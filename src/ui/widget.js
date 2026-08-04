// ============================================================
// Reusable floating pill-button widget
// Creates a circular icon button (bottom-left) that expands
// into a labeled pill on hover, matching Fiverr's seller-widget style.
// ============================================================

function createFloatingButton({ iconSVG, label, color, bottomOffset }) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div style="width:48px;height:48px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      ${iconSVG}
    </div>
    <div style="display:flex;flex-direction:column;justify-content:center;overflow:hidden;white-space:nowrap;max-width:0;transition:max-width 0.25s ease;">
      <span style="font-size:13px;font-weight:600;color:#222325;padding-left:12px;">${label}</span>
    </div>
  `;
  el.style.cssText = `position:fixed;bottom:${bottomOffset}px;left:16px;z-index:999999;display:flex;align-items:center;background:#fff;border-radius:28px;box-shadow:0 2px 10px rgba(0,0,0,0.15);cursor:pointer;padding:4px;transition:padding 0.25s ease;`;

  const labelWidth = Math.min(200, label.length * 8 + 40);
  el.addEventListener("mouseenter", () => {
    el.style.padding = "4px 16px 4px 4px";
    el.querySelector('div:last-child').style.maxWidth = `${labelWidth}px`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.padding = "4px";
    el.querySelector('div:last-child').style.maxWidth = "0";
  });

  document.body.appendChild(el);
  return el;
}

function createLabelInput() {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;bottom:132px;left:16px;z-index:999999;background:#fff;border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,0.15);padding:6px 12px;display:flex;align-items:center;gap:6px;";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "niche label (optional)";
  input.value = localStorage.getItem("fiverrScraperLabel") || "";
  input.style.cssText = "border:none;outline:none;font-size:12px;width:140px;color:#222325;";
  input.addEventListener("input", () => {
    localStorage.setItem("fiverrScraperLabel", input.value.trim());
  });

  wrapper.appendChild(input);
  document.body.appendChild(wrapper);
  return input;
}

function getScraperLabel() {
  const raw = localStorage.getItem("fiverrScraperLabel") || "";
  const clean = raw.trim().toLowerCase().replace(/[^\w-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean;
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

const ICONS = {
  download: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  person: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="7" r="4" stroke="white" stroke-width="2"/></svg>`
};