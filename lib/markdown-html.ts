import { Marked } from "marked";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

function isAsciiDiagram(text: string) {
  return text.split("\n").length >= 3 &&
    /(?:\+[-=]{3}|[┌┐└┘├┤┬┴┼╔╗╚╝║│]|\|[^\n]*\|)/.test(text);
}

function diagramHtml(text: string) {
  return `<figure class="diagram ascii-diagram"><pre>${escapeHtml(text)}</pre></figure>\n`;
}

// A private instance avoids changing Markdown behavior elsewhere in the app.
const markdown = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }) {
      // Support table line breaks without allowing manuscript HTML to execute.
      return /^<br\s*\/?\s*>$/i.test(text.trim()) ? "<br>" : escapeHtml(text);
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      return /^(?:https?:\/\/|mailto:|#)/i.test(href)
        ? `<a href="${escapeHtml(href)}">${label}</a>`
        : label;
    },
    image({ text }) {
      // PDF rendering must not fetch arbitrary URLs from generated content.
      return `<span class="image-description">${escapeHtml(text)}</span>`;
    },
    code({ text, lang }) {
      const language = lang?.trim().split(/\s+/)[0].toLowerCase() ?? "";
      if (language === "mermaid") {
        return `<figure class="diagram mermaid-diagram"><pre class="mermaid-source">${escapeHtml(text)}</pre></figure>\n`;
      }
      if (["ascii", "diagram"].includes(language) ||
        (["", "text", "plaintext"].includes(language) && isAsciiDiagram(text))) {
        return diagramHtml(text);
      }
      return `<pre class="code-block"><code>${escapeHtml(text)}</code></pre>\n`;
    },
  },
});

// Older generated books sometimes omit fences around ASCII boxes. Recover
// those blocks too, while leaving valid GFM tables to the table parser.
markdown.use({ extensions: [{
  name: "legacyDiagram",
  level: "block",
  start(source) { return source.search(/^[ \t]*(?:\+[-=]{3}|[|┌┏╔│║])/m); },
  tokenizer(source) {
    const lines = source.split("\n");
    const structural = (line: string) => /^[ \t]*(?:\+[-=]|[|┌┏╔│║└┘┐├┤┬┴┼╚╝╠╣═─]|[\\/vV↑↓↔→←][ \t]*$)/.test(line);
    if (!structural(lines[0])) return;
    if (/^\s*\|?\s*:?-{3,}/.test(lines[1] ?? "")) return;
    let end = 0;
    while (end < lines.length) {
      if (structural(lines[end])) { end += 1; continue; }
      // Keep labels and blank spacing between connector lines in one figure.
      const next = lines.slice(end + 1).findIndex((line) => line.trim() !== "");
      const nextIndex = end + 1 + next;
      if (next >= 0 && nextIndex - end <= 3 && structural(lines[nextIndex]) &&
        !/^\s*(?:#{1,6}\s|[-*+]\s|```|~~~)/.test(lines[end])) {
        end = nextIndex;
        continue;
      }
      break;
    }
    const text = lines.slice(0, end).join("\n").trimEnd();
    if (!isAsciiDiagram(text)) return;
    return { type: "legacyDiagram", raw: lines.slice(0, end).join("\n") + (end < lines.length ? "\n" : ""), text };
  },
  renderer(token) { return diagramHtml(token.text); },
}] });

export function markdownToHtml(source: string): string {
  return markdown.parse(source.replace(/\r\n?/g, "\n"), { async: false });
}
