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

function parseWorkExperience() {
  const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4')).find(h => /work experience/i.test(h.innerText));
  const container = heading?.nextElementSibling;
  if (!container) return [];

  const entries = container.querySelectorAll(':scope > div');
  return Array.from(entries).map(entry => {
    const paragraphs = Array.from(entry.querySelectorAll('p')).map(p => p.innerText.trim());
    return {
      jobTitle: paragraphs[0] || "",
      companyType: paragraphs[1] || "",
      dates: paragraphs[2] || "",
      description: (paragraphs[3] || "").split("\n")[0] // first line only, avoid the tag-spam that follows
    };
  });
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