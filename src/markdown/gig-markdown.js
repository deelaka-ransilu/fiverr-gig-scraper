// ============================================================
// Builds the final .md string from all parsed gig page data
// ============================================================

function buildMarkdown({ title, seller, sellerBio, about, tiers, reviews, faq, ratingBreakdown, breadcrumb, relatedTags, portfolioCount, hourlyRate }) {
  let md = `# ${title}\n\n`;

  md += `**Seller:** ${seller.sellerName}\n`;
  md += `**Fiverr's Choice:** ${seller.hasFiverrsChoice ? "Yes" : "No"}\n`;
  md += `**Level:** ${seller.level}\n`;
  md += `**Rating:** ${seller.rating} (${seller.reviews} reviews)\n`;
  md += `**Category:** ${breadcrumb.join(" > ")}\n`;
  md += `**Hourly Rate:** ${hourlyRate}\n`;
  md += `**Portfolio Size:** ${portfolioCount}+ projects shown\n`;
  md += `**URL:** ${location.href}\n\n`;

  md += `## About the Seller\n\n`;
  md += `**From:** ${sellerBio.from}\n`;
  md += `**Member since:** ${sellerBio.memberSince}\n`;
  md += `**Avg. response time:** ${sellerBio.avgResponseTime}\n`;
  md += `**Last delivery:** ${sellerBio.lastDelivery}\n`;
  md += `**Languages:** ${sellerBio.languages}\n\n`;
  md += `${sellerBio.bio}\n\n`;

  md += `## About This Gig\n\n${about}\n\n`;

  md += `## Packages\n\n`;
  tiers.forEach(tier => {
    md += `### ${tier.type} — ${tier.title}\n`;
    md += `**Price:** ${tier.price}`;
    if (tier.totalPrice && tier.totalPrice !== tier.price) md += ` (Total: ${tier.totalPrice})`;
    md += `\n`;
    md += `**Description:** ${tier.description || ""}\n`;
    md += `**Delivery:** ${tier.delivery || ""}`;
    if (tier.rushOption) md += ` | Rush option: ${tier.rushOption}`;
    md += `\n\n`;
    md += `**Features:**\n`;
    Object.entries(tier.features).forEach(([name, val]) => {
      if (typeof val === "boolean") {
        md += `- ${val ? "✅" : "❌"} ${name}\n`;
      } else {
        md += `- ${name}: ${val}\n`;
      }
    });
    md += `\n`;
  });

  md += `## Reviews\n\n`;
  reviews.forEach(r => {
    md += `### ${r.name} (${r.country}) — ${r.rating}★\n`;
    md += `*${r.timeAgo}*`;
    if (r.price) md += ` | Price: ${r.price}`;
    if (r.duration) md += ` | Duration: ${r.duration}`;
    md += `\n\n`;
    md += `${r.text}\n\n`;
  });

  md += `## Rating Breakdown\n\n`;
  Object.entries(ratingBreakdown.starCounts).forEach(([label, count]) => {
    md += `- ${label}: ${count}\n`;
  });
  md += `\n`;
  Object.entries(ratingBreakdown.categories).forEach(([label, score]) => {
    md += `- ${label}: ${score}★\n`;
  });
  md += `\n`;

  md += `## FAQ\n\n`;
  faq.forEach(item => {
    md += `**Q: ${item.question}**\n${item.answer}\n\n`;
  });

  md += `## Related Tags\n\n`;
  md += relatedTags.map(t => `\`${t}\``).join(", ") + "\n";

  return md;
}