import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("root entry only redirects to the one arcade", () => {
  const html = read("index.html");
  assert.match(html, /http-equiv="refresh"\s+content="0;url=\.\/arcade\/"/i);
  assert.match(html, /location\.replace\(new URL\("\.\/arcade\/",\s*location\.href\)\.href\)/);
  assert.match(html, /href="\.\/arcade\/"/);
});

test("Pages deployment is limited to main and follows verification", () => {
  const workflow = read(".github/workflows/publish-pages.yml");
  assert.match(workflow, /\bon:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(workflow, /\bpublish:\s*\n\s*if:\s*github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /\bpublish:[\s\S]*?\n\s*needs:\s*verify/);
  assert.match(workflow, /\bverify:[\s\S]*?node --test arcade\/tests\/\*\.test\.mjs/);
});

test("one official public arcade address is documented", () => {
  const policy = read("docs/PUBLICATION_POLICY.md");
  const instructions = read("AGENTS.md");
  const link = "https://vesninsergeybk-afk.github.io/survival-open/arcade/";
  for (const text of [policy, instructions]) {
    assert.ok(text.includes(link));
    assert.ok(text.includes("https://vesninmed.ru/lab/"));
    assert.ok(text.includes("/games/survivor/?mission=0"));
  }
});
