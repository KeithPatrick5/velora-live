import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("movie/video load screen remains frozen at v13", () => {
  const index = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const js = fs.readFileSync(new URL("../public/player-enhance-v13.js", import.meta.url), "utf8");
  assert.match(index, /player-enhance-v13\.js/);
  assert(js.length > 1000);
});
