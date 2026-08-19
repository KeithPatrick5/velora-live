import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const intro = fs.readFileSync(new URL("../public/intro.html", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");

test("site intro is a standalone document outside React", () => {
  assert(!index.includes("site-intro-v22.js"));
  assert.match(intro, /<video id="introVideo"/);
  assert.match(server, /url\.searchParams\.get\("app"\) !== "1"/);
});

test("standalone intro has autoplay-safe video and hard fail-open", () => {
  assert.match(intro, /muted autoplay playsinline/);
  assert.match(intro, /setTimeout\(go, 4700\)/);
  assert(intro.includes("location.replace('/?app=1')"));
});
