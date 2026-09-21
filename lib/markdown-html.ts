function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export function markdownToHtml(markdown: string) {
  let inCodeBlock = false;

  return markdown.split("\n").map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      return "";
    }
    if (inCodeBlock) return `<pre>${escapeHtml(line)}</pre>`;
    if (trimmed === "---") return "<hr />";
    if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
    if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (trimmed.startsWith("- ")) return `<p class="bullet">${escapeHtml(trimmed)}</p>`;
    if (!trimmed) return '<div class="space"></div>';

    return `<p>${escapeHtml(line).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_]/g, "")}</p>`;
  }).join("");
}
