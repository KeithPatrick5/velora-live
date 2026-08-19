// Vercel's current Node runtime supports a Web-standard `fetch` entrypoint.
// Keep this file intentionally small so function boot errors are caught and
// reported instead of becoming an opaque FUNCTION_INVOCATION_FAILED page.

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function applyHeaders(target, values = {}) {
  for (const [name, value] of Object.entries(values || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) target.append(name, String(item));
    } else {
      target.set(name, String(value));
    }
  }
}

function effectiveUrl(request) {
  const url = new URL(request.url);
  const rewrittenPath = url.searchParams.get("__velora_path");
  if (rewrittenPath) {
    const cleanPath = rewrittenPath.replace(/^\/+|\/+$/g, "");
    url.pathname = `/api/${cleanPath}`;
    url.searchParams.delete("__velora_path");
  }
  return url;
}

function nodeRequest(request, bytes, url) {
  const headers = Object.fromEntries(request.headers.entries());
  if (!headers.host) headers.host = url.host;

  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    async *[Symbol.asyncIterator]() {
      if (bytes.length) yield bytes;
    }
  };
}

async function invokeNodeHandler(request, url) {
  // Import inside the request boundary. If any backend module ever fails to
  // initialize, the outer catch returns a useful JSON response and log entry.
  const { requestHandler } = await import("../server.mjs");
  const bytes = request.method === "GET" || request.method === "HEAD"
    ? Buffer.alloc(0)
    : Buffer.from(await request.arrayBuffer());

  let controller;
  const stream = new ReadableStream({ start(value) { controller = value; } });
  const headers = new Headers();
  let status = 200;
  let started = false;
  let ended = false;
  let resolveResponse;
  let rejectResponse;

  const responsePromise = new Promise((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });

  const start = () => {
    if (started) return;
    started = true;
    for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
    console.log("[velora-api] response", {
      method: request.method,
      path: url.pathname,
      status
    });
    resolveResponse(new Response(request.method === "HEAD" ? null : stream, {
      status,
      headers
    }));
    if (request.method === "HEAD") controller.close();
  };

  const response = {
    statusCode: 200,
    get headersSent() { return started; },
    setHeader(name, value) {
      applyHeaders(headers, { [name]: value });
      return this;
    },
    getHeader(name) { return headers.get(name); },
    writeHead(code, reasonOrHeaders, maybeHeaders) {
      status = Number(code) || 200;
      this.statusCode = status;
      const values = typeof reasonOrHeaders === "string" ? maybeHeaders : reasonOrHeaders;
      applyHeaders(headers, values);
      start();
      return this;
    },
    write(chunk) {
      if (!started) this.writeHead(this.statusCode);
      if (!ended && request.method !== "HEAD") {
        const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        controller.enqueue(value);
      }
      return true;
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null && chunk !== "") this.write(chunk);
      if (!started) this.writeHead(this.statusCode);
      if (!ended) {
        ended = true;
        if (request.method !== "HEAD") controller.close();
      }
      return this;
    }
  };

  Promise.resolve(requestHandler(nodeRequest(request, bytes, url), response))
    .then(() => { if (!ended) response.end(); })
    .catch(error => {
      console.error("[velora-api] handler failed", {
        message: error?.message || String(error),
        stack: error?.stack || ""
      });
      if (!started) rejectResponse(error);
      else if (!ended) controller.error(error);
    });

  return responsePromise;
}

export default {
  async fetch(request) {
    const url = effectiveUrl(request);
    console.log("[velora-api] request", { method: request.method, path: url.pathname });

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        runtime: "node",
        handler: "web-standard",
        tmdbConfigured: Boolean(process.env.TMDB_API_TOKEN || process.env.TMDB_API_KEY)
      }, { headers: { "Cache-Control": "no-store" } });
    }

    try {
      return await invokeNodeHandler(request, url);
    } catch (error) {
      console.error("[velora-api] initialization failed", {
        message: error?.message || String(error),
        stack: error?.stack || "",
        path: url.pathname
      });
      return Response.json({ error: "Velora API failed to initialize." }, {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      });
    }
  }
};
