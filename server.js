import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHome, getSection, search, details } from "./src/catalog/index.js";
import { resolvePlayback } from "./src/playback/resolver.js";
import { getLiveChannels, reportLiveHealth, getUpcomingSports, getStreamedSportsStreams } from "./src/live/index.js";
import { signup, signin, logout, userBySession, updateUser, publicUser } from "./src/auth/store.js";

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");

// Load a local .env automatically so the app can be started with just `npm start`.
const envPath = path.join(ROOT, ".env");
if (fsSync.existsSync(envPath)) {
  const text = fsSync.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript; charset=utf-8"],[".css","text/css; charset=utf-8"],[".json","application/json; charset=utf-8"],[".woff2","font/woff2"],[".svg","image/svg+xml"],[".png","image/png"],[".jpg","image/jpeg"],[".jpeg","image/jpeg"],[".mp4","video/mp4"]]);

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(x => { const i=x.indexOf("="); return [x.slice(0,i).trim(), decodeURIComponent(x.slice(i+1))]; }));
}
function json(res, status, data, headers={}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(data));
}
async function body(req) {
  const chunks=[]; for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return {}; }
}
function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function api(req, res, url) {
  if (url.pathname === "/api/live/upcoming" && req.method === "GET") {
    try { return json(res, 200, await getUpcomingSports({ force: url.searchParams.get('refresh') === '1' })); }
    catch (error) { return json(res, 200, { events: [], focus: { mode: "channels", label: "Live TV", sport: null, events: [] }, error: error.message }); }
  }

  if (url.pathname === "/api/live/sports-stream" && req.method === "GET") {
    try {
      const streams = await getStreamedSportsStreams(url.searchParams.get("source"), url.searchParams.get("id"));
      return json(res, streams.length ? 200 : 404, { streams });
    } catch (error) { return json(res, 502, { error: error.message, streams: [] }); }
  }

  if (url.pathname === "/api/live" && req.method === "GET") {
    try { return json(res, 200, { channels: await getLiveChannels({ country: url.searchParams.get("country") || undefined, category: url.searchParams.get("category") || undefined, q: url.searchParams.get("q") || undefined, limit: url.searchParams.get("limit") || undefined, force: url.searchParams.get('refresh') === '1' }) }); }
    catch (error) { return json(res, 502, { error: error.message, channels: [] }); }
  }

  if (url.pathname === "/api/live/report" && req.method === "POST") {
    try {
      const ok = await reportLiveHealth(await body(req));
      return json(res, ok ? 200 : 400, ok ? { ok: true } : { error: "Invalid health report" });
    } catch (error) { return json(res, 400, { error: error.message || "Invalid report" }); }
  }

  if (url.pathname === "/api/catalog" && req.method === "GET") {
    try {
      if (url.searchParams.get("q")) return json(res, 200, await search(url.searchParams.get("q")));
      if (url.searchParams.get("id")) {
        const result = await details(url.searchParams.get("id"), Number(url.searchParams.get("season") || 1));
        return result ? json(res, 200, result) : json(res, 404, { error: "Title not found" });
      }
      if (url.searchParams.get("section")) return json(res, 200, await getSection(url.searchParams.get("section")));
      return json(res, 200, await getHome());
    } catch (error) { return json(res, 502, { error: error.message }); }
  }

  if (url.pathname === "/api/resolve" && req.method === "POST") {
    res.writeHead(200, { "Content-Type":"text/event-stream; charset=utf-8", "Cache-Control":"no-cache, no-transform", Connection:"keep-alive" });
    sse(res, "progress", { message: "Resolving playback provider…" });
    try {
      const sources = await resolvePlayback(await body(req));
      sse(res, "sources", { sources });
      sse(res, "complete", { sourceCount: sources.length });
    } catch (error) {
      sse(res, "progress", { message: error.message });
      sse(res, "complete", { sourceCount: 0 });
    }
    return res.end();
  }

  if (url.pathname === "/api/auth" && req.method === "POST") {
    const input = await body(req);
    const sid = cookies(req).velora_session;
    try {
      if (input.action === "logout") {
        if (sid) await logout(sid);
        return json(res, 200, { ok: true }, { "Set-Cookie": "velora_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
      }
      const result = input.action === "signup" ? await signup(input) : await signin(input);
      return json(res, 200, { user: result.user }, { "Set-Cookie": `velora_session=${result.sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }

  if (url.pathname === "/api/me") {
    const sid = cookies(req).velora_session;
    if (req.method === "GET") {
      const record = await userBySession(sid);
      if (!record) return json(res, 401, { error: "Not signed in" });
      return json(res, 200, { user: publicUser(record.user), library: record.user.library || [], items: record.user.items || [], progress: record.user.progress || [] });
    }
    if (req.method === "POST") {
      const input = await body(req);
      const updated = await updateUser(sid, user => {
        user.library ||= []; user.items ||= []; user.progress ||= [];
        if (input.action === "library") {
          user.library = input.saved ? [...new Set([...user.library, input.mediaId])] : user.library.filter(x => x !== input.mediaId);
          if (input.item?.id) user.items = [input.item, ...user.items.filter(x => x.id !== input.item.id)].slice(0, 200);
        }
        if (input.action === "progress") {
          const record = { mediaId: input.mediaId, seconds: Number(input.seconds)||0, duration: Number(input.duration)||0, season:Number(input.season)||0, episode:Number(input.episode)||0, item:input.item, updatedAt:new Date().toISOString() };
          user.progress = [record, ...user.progress.filter(x => x.mediaId !== input.mediaId)].slice(0, 200);
        }
      });
      return updated ? json(res, 200, { ok:true }) : json(res, 401, { error:"Not signed in" });
    }
  }
  return false;
}

async function staticFile(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  // The first-visit intro is a standalone document. React never owns or hydrates it,
  // which removes the race that caused 20+ fragile overlay iterations.
  if (pathname === "/" && url.searchParams.get("app") !== "1") {
    const data = await fs.readFile(path.join(PUBLIC, "intro.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Length": String(data.length) });
    return res.end(data);
  }
  if (pathname === "/favicon.svg") {
    res.writeHead(200,{"Content-Type":"image/svg+xml"});
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111"/><path d="M13 15h11l8 25 8-25h11L38 50H26z" fill="white"/></svg>');
  }
  let target = path.join(PUBLIC, pathname === "/" ? "index.html" : pathname);
  if (!target.startsWith(PUBLIC)) { res.writeHead(403); return res.end("Forbidden"); }
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) target = path.join(target, "index.html");
    const ext = path.extname(target);
    const type = mime.get(ext) || "application/octet-stream";
    const range = req.headers.range;

    // Browsers, especially media elements, may request MP4 byte ranges. Returning proper
    // 206 responses avoids forcing the whole intro file through a single 200 response.
    if (ext === ".mp4" && range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}`, "Accept-Ranges": "bytes" });
        return res.end();
      }
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : stat.size - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}`, "Accept-Ranges": "bytes" });
        return res.end();
      }
      end = Math.min(end, stat.size - 1);
      const handle = await fs.open(target, "r");
      try {
        const length = end - start + 1;
        const data = Buffer.allocUnsafe(length);
        await handle.read(data, 0, length, start);
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Length": String(length),
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store"
        });
        return res.end(data);
      } finally {
        await handle.close();
      }
    }

    const data = await fs.readFile(target);
    const headers = { "Content-Type": type, "Cache-Control": "no-store", "Content-Length": String(data.length) };
    if (ext === ".mp4") headers["Accept-Ranges"] = "bytes";
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    // SPA fallback keeps the recovered single-page navigation behavior.
    const data = await fs.readFile(path.join(PUBLIC,"index.html"));
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache"});
    res.end(data);
  }
}

export async function requestHandler(req,res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await api(req,res,url);
      if (handled !== false) return;
      return json(res,404,{error:"Not found"});
    }
    return staticFile(req,res,url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) return json(res,500,{error:"Internal server error"});
    res.end();
  }
}

// Only open a TCP listener when `node server.js` runs this file directly.
// Importing it from Vercel must never depend on a platform environment flag.
const invokedDirectly = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (invokedDirectly) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => console.log(`Velora running at http://localhost:${PORT}`));
}
