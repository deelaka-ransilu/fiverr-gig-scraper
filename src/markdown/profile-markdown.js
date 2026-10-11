// ============================================================
// Builds the final .md string from parsed seller profile data
// ============================================================

// Page address without Fiverr's tracking query string (source, referrer_gig_slug, ref_ctx_id, imp_id ...).
function cleanPageUrl() {
  return location.origin + location.pathname;
}

function buildProfileMarkdown(profile) {
  let md = `# ${profile.name} — Profile\n\n`;
  md += `**URL:** ${cleanPageUrl()}\n\n`;

  md += `## Skills\n\n`;
  md += profile.skills.map(s => `\`${s}\``).join(", ") + "\n\n";

  md += `## Services\n\n`;
  profile.services.forEach(s => {
    md += `### ${s.category}\n`;
    md += `${s.description}\n`;
    md += `**From:** ${s.price}\n`;
    md += `**Link:** ${String(s.link || "").split("?")[0]}\n\n`;
  });

  md += `## Work Experience\n\n`;
  profile.workExperience.forEach(e => {
    md += `### ${e.jobTitle}\n`;
    md += `*${e.companyType} | ${e.dates}*\n\n`;
    md += `${e.description}\n\n`;
  });

  return md;
}