import assert from "node:assert/strict";
import test from "node:test";
import { markdownToHtml } from "../lib/markdown-html.ts";

test("renders Burmese GFM tables with header cells and inline formatting", () => {
  const html = markdownToHtml("| အချက် | ဖော်ပြချက် |\n| --- | --- |\n| **Tools** | `tools/list` |\n| Pipe | a\\|b |");
  assert.match(html, /<table>[\s\S]*<thead>[\s\S]*<th>အချက်<\/th>/);
  assert.match(html, /<strong>Tools<\/strong>/);
  assert.match(html, /<code>tools\/list<\/code>/);
  assert.match(html, /a\|b/);
  assert.doesNotMatch(html, /ascii-diagram/);
});

test("keeps a fenced ASCII diagram in one preformatted figure", () => {
  const source = "+----------------+\n| MCP Client     |\n+----------------+\n        |\n        v\n+----------------+\n| MCP Server     |\n+----------------+";
  const html = markdownToHtml("```text\n" + source + "\n```");
  assert.equal((html.match(/<pre/g) ?? []).length, 1);
  assert.match(html, /class="diagram ascii-diagram"/);
  assert.ok(html.includes(source));
});

test("recovers unfenced legacy boxes without absorbing the next heading", () => {
  const html = markdownToHtml("+-----------+\n| MCP Host  |\n+-----------+\n     |\n HTTPS + OAuth\n     v\n+-----------+\n| Server    |\n+-----------+\n\n#### Key takeaways\n\nမြန်မာစာ ရှင်းလင်းချက်။");
  assert.equal((html.match(/ascii-diagram/g) ?? []).length, 1);
  assert.match(html, /<\/figure>\s*<h4>Key takeaways<\/h4>/);
  assert.match(html, /<p>မြန်မာစာ/);
});

test("keeps code punctuation and spacing and escapes HTML inside code", () => {
  const html = markdownToHtml('```ts\nconst user_name = "<script>";\n  console.log(user_name);\n```');
  assert.match(html, /user_name/);
  assert.match(html, /\n  console\.log/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal((html.match(/<pre/g) ?? []).length, 1);
});

test("marks Mermaid for local rendering instead of printing paragraphs", () => {
  const html = markdownToHtml('```mermaid\nflowchart TD\n  A["အသုံးပြုသူ"] --> B["Server"]\n```');
  assert.match(html, /class="mermaid-source"/);
  assert.match(html, /A\[&quot;အသုံးပြုသူ&quot;\]/);
});

test("supports headings, nested lists, emphasis, and blockquotes", () => {
  const html = markdownToHtml("#### အသုံးပြုပုံ\n\n> **မှတ်ချက်**\n\n1. First\n   - Nested\n\n`user_name` and **bold**");
  for (const tag of ["h4", "blockquote", "ol", "ul", "strong", "code"]) {
    assert.ok(html.includes(`<${tag}>`));
  }
  assert.match(html, /<code>user_name<\/code>/);
});

test("does not execute manuscript HTML or load external images", () => {
  const html = markdownToHtml('<script>alert(1)</script>\n\n<img src="http://127.0.0.1/private">\n\n[unsafe](javascript:alert%281%29)\n\n![image](https://example.com/private)');
  assert.doesNotMatch(html, /<script|<img|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /image-description/);
});

test("allows safe links and table line breaks without allowing arbitrary HTML", () => {
  const html = markdownToHtml('| Link | Notes |\n| --- | --- |\n| [Docs](https://example.com?a=1&b=2) | one<br>two |');
  assert.match(html, /href="https:\/\/example.com\?a=1&amp;b=2"/);
  assert.match(html, /one<br>two/);
});
