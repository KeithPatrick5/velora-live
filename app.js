const image = (path) => `https://image.tmdb.org/t/p/w500${path}`;

const catalog = [
  [693134,"Dune: Part Two","movie",2024,"PG-13","2h 46m",98,["Sci-Fi","Adventure","Drama"],"/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg"],
  [872585,"Oppenheimer","movie",2023,"R","3h 1m",97,["Drama","History"],"/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg"],
  [414906,"The Batman","movie",2022,"PG-13","2h 57m",96,["Crime","Mystery","Action"],"/74xTEgt7R36Fpooo50r9T25onhq.jpg"],
  [299534,"Avengers: Endgame","movie",2019,"PG-13","3h 1m",95,["Action","Sci-Fi","Adventure"],"/or06FN3Dka5tukK1e9sl16pB3iy.jpg"],
  [157336,"Interstellar","movie",2014,"PG-13","2h 49m",99,["Sci-Fi","Drama","Adventure"],"/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"],
  [27205,"Inception","movie",2010,"PG-13","2h 28m",98,["Sci-Fi","Thriller","Action"],"/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg"],
  [155,"The Dark Knight","movie",2008,"PG-13","2h 32m",99,["Action","Crime","Drama"],"/qJ2tW6WMUDux911r6m7haRef0WH.jpg"],
  [361743,"Top Gun: Maverick","movie",2022,"PG-13","2h 11m",96,["Action","Drama"],"/62HCnUTziyWcpDaBO2i1DX17ljH.jpg"],
  [634649,"Spider-Man: No Way Home","movie",2021,"PG-13","2h 28m",95,["Action","Adventure","Sci-Fi"],"/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg"],
  [278,"The Shawshank Redemption","movie",1994,"R","2h 22m",99,["Drama"],"/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg"],
  [238,"The Godfather","movie",1972,"R","2h 55m",99,["Crime","Drama"],"/3bhkrj58Vtu7enYsRolD1fZdja1.jpg"],
  [680,"Pulp Fiction","movie",1994,"R","2h 34m",97,["Crime","Drama"],"/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg"],
  [550,"Fight Club","movie",1999,"R","2h 19m",97,["Drama","Thriller"],"/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"],
  [533535,"Deadpool & Wolverine","movie",2024,"R","2h 8m",94,["Action","Comedy","Sci-Fi"],"/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"],
  [945961,"Alien: Romulus","movie",2024,"R","1h 59m",92,["Horror","Sci-Fi"],"/b33nnKl1GSFbao4l3fZDDqsMx0F.jpg"],
  [933260,"The Substance","movie",2024,"R","2h 21m",93,["Horror","Drama","Sci-Fi"],"/lqoMzCcZYEFK729d6qzt349fB4o.jpg"],
  [1022789,"Inside Out 2","movie",2024,"PG","1h 36m",95,["Animation","Family","Comedy"],"/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg"],
  [1184918,"The Wild Robot","movie",2024,"PG","1h 42m",97,["Animation","Family","Sci-Fi"],"/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg"],
  [1396,"Breaking Bad","tv",2008,"TV-MA","5 seasons",99,["Crime","Drama","Thriller"],"/ggFHVNu6YYI5L9pCfOacjizRGt.jpg"],
  [100088,"The Last of Us","tv",2023,"TV-MA","2 seasons",98,["Drama","Sci-Fi","Action"],"/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg"],
  [66732,"Stranger Things","tv",2016,"TV-14","4 seasons",97,["Sci-Fi","Mystery","Drama"],"/49WJfeN0moxb9IPfGn8AIqMGskD.jpg"],
  [76479,"The Boys","tv",2019,"TV-MA","4 seasons",96,["Action","Comedy","Sci-Fi"],"/2zmTngn1tYC1AvfnrFLhxeD82hz.jpg"],
  [1399,"Game of Thrones","tv",2011,"TV-MA","8 seasons",97,["Fantasy","Drama","Action"],"/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg"],
  [94997,"House of the Dragon","tv",2022,"TV-MA","2 seasons",95,["Fantasy","Drama","Action"],"/1X4h40fcB4WWUmIBK0auT4zRBAV.jpg"],
  [95396,"Severance","tv",2022,"TV-MA","2 seasons",99,["Mystery","Sci-Fi","Drama"],"/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg"],
  [126308,"Shōgun","tv",2024,"TV-MA","1 season",98,["Drama","History","War"],"/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg"],
  [106379,"Fallout","tv",2024,"TV-MA","1 season",96,["Sci-Fi","Action","Adventure"],"/AnsSKR9LuK0T9bAOcPVA3PUvyWj.jpg"],
  [60059,"Better Call Saul","tv",2015,"TV-MA","6 seasons",99,["Crime","Drama"],"/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg"],
  [119051,"Wednesday","tv",2022,"TV-14","1 season",94,["Mystery","Comedy","Fantasy"],"/9PFonBhy4cQy7Jz20NpMygczOkv.jpg"],
  [93405,"Squid Game","tv",2021,"TV-MA","2 seasons",96,["Thriller","Drama","Mystery"],"/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg"]
].map(([id,title,type,year,maturity,runtime,match,genres,poster]) => ({id,title,type,year,maturity,runtime,match,genres,poster:image(poster)}));

const featured = catalog[0];
const movies = catalog.filter((item) => item.type === "movie");
const shows = catalog.filter((item) => item.type === "tv");
const rows = [
  ["Trending Now", catalog.slice(0,10)],
  ["Binge-Worthy Series", shows],
  ["Critically Acclaimed", catalog.filter((item) => item.match >= 97)],
  ["Movie Night", movies.slice(7)]
];

let activeTab = "home";
let myList = JSON.parse(localStorage.getItem("noctra-my-list") || "[]");
const homeView = document.querySelector(".home-view");
const browseView = document.querySelector(".browse-view");
const grid = document.querySelector("#catalog-grid");
const search = document.querySelector("#search-input");
const clearSearch = document.querySelector("#clear-search");
const modal = document.querySelector("#player-modal");
const frame = document.querySelector("#player-frame");
const playerTitle = document.querySelector("#player-title");

document.querySelector("#hero").style.backgroundImage = "url(https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg)";

function playerUrl(item) {
  return item.type === "movie"
    ? `https://player.videasy.to/movie/${item.id}?overlay=true`
    : `https://player.videasy.to/tv/${item.id}/1/1?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true`;
}

function play(item) {
  playerTitle.textContent = item.title;
  frame.src = playerUrl(item);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closePlayer() {
  modal.hidden = true;
  frame.src = "about:blank";
  document.body.style.overflow = "";
}

function toggleList(item) {
  myList = myList.includes(item.id) ? myList.filter((id) => id !== item.id) : [...myList,item.id];
  localStorage.setItem("noctra-my-list", JSON.stringify(myList));
  updateHeroList();
  if (!browseView.hidden) renderGrid();
  renderRows();
}

function card(item) {
  const article = document.createElement("article");
  article.className = "media-card";
  article.innerHTML = `<button type="button" class="poster-button" aria-label="Play ${item.title}"><span class="poster-fallback">${item.title}</span><img src="${item.poster}" alt="${item.title} poster" loading="lazy"><span class="poster-shade"></span><span class="card-play"><span class="play-triangle"></span></span><span class="card-copy"><strong>${item.title}</strong><small>${item.type === "tv" ? "Series" : item.year}</small></span></button><button type="button" class="list-toggle ${myList.includes(item.id) ? "is-added" : ""}" aria-label="${myList.includes(item.id) ? "Remove" : "Add"} ${item.title} ${myList.includes(item.id) ? "from" : "to"} My List">${myList.includes(item.id) ? "✓" : "+"}</button>`;
  article.querySelector(".poster-button").addEventListener("click", () => play(item));
  article.querySelector(".list-toggle").addEventListener("click", () => toggleList(item));
  return article;
}

function renderRows() {
  const target = document.querySelector("#content-rows");
  target.replaceChildren();
  rows.forEach(([title,items],index) => {
    const section = document.createElement("div");
    section.className = "media-row";
    section.innerHTML = `<div class="row-heading"><h2>${title}</h2>${index === 0 ? "<span>Updated today</span>" : ""}</div><div class="card-track"></div>`;
    const track = section.querySelector(".card-track");
    items.forEach((item) => track.append(card(item)));
    target.append(section);
  });
}

function visibleCatalog() {
  if (activeTab === "movies") return movies;
  if (activeTab === "tv") return shows;
  if (activeTab === "list") return catalog.filter((item) => myList.includes(item.id));
  return catalog;
}

function renderGrid() {
  const term = search.value.trim().toLowerCase();
  const results = visibleCatalog().filter((item) => `${item.title} ${item.year} ${item.genres.join(" ")}`.toLowerCase().includes(term));
  grid.replaceChildren(...results.map(card));
  grid.hidden = results.length === 0;
  const empty = document.querySelector("#empty-state");
  empty.hidden = results.length !== 0;
  if (!results.length) {
    const isEmptyList = activeTab === "list" && !term;
    document.querySelector("#empty-title").textContent = isEmptyList ? "Your list is empty." : `Nothing found for “${search.value}”.`;
    document.querySelector("#empty-copy").textContent = isEmptyList ? "Tap + on any title to save it here." : "Try another title or genre.";
  }
  clearSearch.hidden = !search.value;
}

function updateHeroList() {
  document.querySelector("#hero-list").textContent = myList.includes(featured.id) ? "✓ In My List" : "+ My List";
}

function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "home") {
    homeView.hidden = false;
    browseView.hidden = true;
  } else {
    homeView.hidden = true;
    browseView.hidden = false;
    search.value = "";
    document.querySelector("#browse-title").textContent = tab === "tv" ? "Series" : tab === "list" ? "My List" : "Movies";
    renderGrid();
    setTimeout(() => search.focus(), 0);
  }
  scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
document.querySelector(".search-button").addEventListener("click", () => {
  activeTab = "home";
  homeView.hidden = true;
  browseView.hidden = false;
  document.querySelector("#browse-title").textContent = "Search";
  search.value = "";
  renderGrid();
  setTimeout(() => search.focus(),0);
});
search.addEventListener("input", renderGrid);
clearSearch.addEventListener("click", () => { search.value = ""; search.focus(); renderGrid(); });
document.querySelector("#hero-play").addEventListener("click", () => play(featured));
document.querySelector("#hero-list").addEventListener("click", () => toggleList(featured));
document.querySelector("#close-player").addEventListener("click", closePlayer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) closePlayer(); });

updateHeroList();
renderRows();
