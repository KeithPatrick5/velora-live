(() => {
  const nativeFetch = window.fetch.bind(window);
  const files = {
    home: "/api-snapshot/catalog.json",
    movies: "/api-snapshot/catalog-movies.json",
    shows: "/api-snapshot/catalog-shows.json",
    anime: "/api-snapshot/catalog-anime.json"
  };
  let allItemsPromise;

  const jsonResponse = value => new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });

  async function load(name) {
    const response = await nativeFetch(files[name], { cache: "no-store" });
    if (!response.ok) throw new Error(`Snapshot ${name} returned ${response.status}`);
    return response.json();
  }

  function allItems() {
    allItemsPromise ||= Promise.all([load("home"), load("movies"), load("shows"), load("anime")])
      .then(values => {
        const seen = new Set();
        return values.flatMap(value => value.items || []).filter(item => item?.id && !seen.has(item.id) && seen.add(item.id));
      });
    return allItemsPromise;
  }

  async function catalogFallback(url) {
    const section = url.searchParams.get("section");
    if (section && files[section]) return jsonResponse(await load(section));

    const query = url.searchParams.get("q")?.trim().toLowerCase();
    if (query) {
      const items = (await allItems()).filter(item =>
        String(item.title || "").toLowerCase().includes(query) ||
        String(item.summary || "").toLowerCase().includes(query)
      ).slice(0, 40);
      return jsonResponse({ items, source: "snapshot-fallback" });
    }

    const id = url.searchParams.get("id");
    if (id) {
      const item = (await allItems()).find(candidate => candidate.id === id);
      return item
        ? jsonResponse({ item, seasons: [], episodes: [], source: "snapshot-fallback" })
        : new Response(JSON.stringify({ error: "Title not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    return jsonResponse(await load("home"));
  }

  window.fetch = async function veloraFetch(input, init) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.origin !== location.origin || url.pathname !== "/api/catalog") return nativeFetch(input, init);

    try {
      const response = await nativeFetch(input, init);
      if (response.ok) return response;
    } catch {}

    return catalogFallback(url);
  };
})();
