import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasTmdb, homeCatalog, sectionCatalog, searchCatalog, titleDetails } from "./tmdb.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const snapshots = path.resolve(here, "../../public/api-snapshot");

async function readSnapshot(name) {
  return JSON.parse(await fs.readFile(path.join(snapshots, name), "utf8"));
}

async function liveOrFallback(label, liveFn, fallbackFn) {
  if (!hasTmdb()) return fallbackFn();
  try {
    return await liveFn();
  } catch (error) {
    console.error(`[catalog] ${label} TMDB failed; using recovered snapshot:`, error?.message || error);
    return fallbackFn();
  }
}

export async function getHome() {
  return liveOrFallback("home", homeCatalog, async () => {
    const snapshot = await readSnapshot("catalog.json");
    return { ...snapshot, source: "snapshot-fallback" };
  });
}

export async function getSection(section) {
  const name = section === "movies" ? "catalog-movies.json" : section === "anime" ? "catalog-anime.json" : "catalog-shows.json";
  return liveOrFallback(`section:${section}`, () => sectionCatalog(section), async () => {
    const snapshot = await readSnapshot(name);
    return { ...snapshot, source: "snapshot-fallback" };
  });
}

export async function search(query) {
  return liveOrFallback("search", () => searchCatalog(query), async () => {
    const home = await readSnapshot("catalog.json");
    const q = String(query || "").toLowerCase();
    return { items: (home.items || []).filter(x => x.title?.toLowerCase().includes(q)).slice(0, 30), source: "snapshot-fallback" };
  });
}

export async function details(id, season) {
  if (hasTmdb() && String(id || "").startsWith("tmdb-")) {
    try {
      return await titleDetails(id, season);
    } catch (error) {
      console.error(`[catalog] details TMDB failed for ${id}:`, error?.message || error);
    }
  }

  const home = await readSnapshot("catalog.json");
  const item = (home.items || []).find(x => x.id === id);
  return item ? { item, seasons: [], episodes: [] } : null;
}
