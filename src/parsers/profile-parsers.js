// ============================================================
// Seller profile page parsers
// Runs on fiverr.com/<username> pages, not gig pages.
// ============================================================

async function expandSkillsAndServices() {
  const skillsBtn = document.querySelector('ul[aria-label="Skills List"] button');
  if (skillsBtn) skillsBtn.click();

  const showAllBtn = Array.from(document.querySelectorAll('button')).find(el => /^show all \(\d+\)$/i.test(el.innerText.trim()));
  if (showAllBtn) showAllBtn.click();

  await new Promise(r => setTimeout(r, 500));
}

function parseSkills() {
  const list = document.querySelector('ul[aria-label="Skills List"]');
  if (!list) return [];
  return Array.from(list.querySelectorAll('a')).map(a => a.innerText.trim());
}

function parseProfileServices() {
  const cards = document.querySelectorAll('.gig-service-card-listings .gig-service-card');
  return Array.from(cards).map(card => {
    const category = card.querySelector('.category-title')?.innerText.trim() || "";
    const description = card.querySelector('.description')?.innerText.trim() || "";
    const price = card.querySelector('.price')?.innerText.trim() || "";
    const link = card.querySelector('a')?.href || "";
    return { category, description, price, link };
  });
}

// ------------------------------------------------------------
// Work experience
// Each entry's <p> lines are sorted by what they look like, not by position:
//   company        the first line
//   employment     "Full-time • 6 yrs 2 mos"
//   dates          "Aug 2018 - Mar 2023 • 4 yrs 7 mos"
//   role title     a short leftover line ("Lead Software Engineer")
//   description    a long leftover line (first line only; tag-spam follows it)
// An entry can hold several roles at one company; each date line closes a role.
// ------------------------------------------------------------
const WORK_DATE_RE = /\b(19|20)\d{2}\b.*([-–—]|\bpresent\b)|\bpresent\b/i;
const WORK_TYPE_RE = /^(full[- ]time|part[- ]time|contract|freelance|internship|self[- ]employed|temporary|apprenticeship)\b|•\s*\d+\s*(yrs?|mos?)\b/i;

function parseWorkEntry(entry) {
  const lines = Array.from(entry.querySelectorAll('p'))
    .map(p => p.innerText.trim())
    .filter(Boolean);

  const company = lines[0] || "";
  let employment = "";
  const roles = [];
  let cur = null;

  lines.slice(1).forEach(line => {
    if (WORK_DATE_RE.test(line)) {
      if (!cur || cur.dates) { cur = { title: "", dates: "", description: "" }; roles.push(cur); }
      cur.dates = line;
    } else if (WORK_TYPE_RE.test(line)) {
      employment = employment || line;
    } else if (line.length > 70 && cur) {
      // Skip a bare "Responsibilities:" header; keep the first few lines after it
      const body = line.split("\n").map(s => s.trim()).filter(Boolean)
        .filter(s => !/^responsibilities:?$/i.test(s));
      cur.description = cur.description || body.slice(0, 3).join(" ").slice(0, 400);
    } else {
      if (!cur || cur.dates) { cur = { title: line, dates: "", description: "" }; roles.push(cur); }
      else if (!cur.title) cur.title = line;
    }
  });

  return { company, employment, roles };
}

function parseWorkExperience() {
  const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4')).find(h => /work experience/i.test(h.innerText));
  const container = heading?.nextElementSibling;
  if (!container) return [];

  const entries = container.querySelectorAll(':scope > div');
  return Array.from(entries).map(parseWorkEntry).filter(e => e.company);
}

function parseProfile() {
  const nameEl = document.querySelector('h1, h2');
  return {
    name: nameEl?.innerText.trim() || "",
    skills: parseSkills(),
    services: parseProfileServices(),
    workExperience: parseWorkExperience()
  };
}