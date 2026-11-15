(() => {
  "use strict";

  // ---------------------------------------------------------------
  // CONFIG (no secrets here: the TMDB key lives in the serverless function (api/tmdb) as the TMDB_KEY env var)
  // ---------------------------------------------------------------
  const REGION = "IN";                 // ISO 3166-1 country code for "Where to watch"
  const CONTACT = "you@example.com";   // shown in the contact section
  const IMG = "https://image.tmdb.org/t/p/";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const year = (d) => (d ? d.slice(0, 4) : "TBA");
  const typeLabel = (t) => (t === "tv" ? "Series" : "Movie");

  // ---------------- Vector icons (inline SVG, inherit text color) ----------------
  const svg = (inner, cls = "") => '<svg class="ic ' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + "</svg>";
  const line = (inner) => '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</g>";
  const HEART = "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";
  const ICONS = {
    star: svg('<path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>'),
    play: svg('<path fill="currentColor" d="M7 4.5v15l13-7.5z"/>'),
    heart: svg(line('<path d="' + HEART + '"/>')),
    heartFill: svg('<path fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="' + HEART + '"/>'),
    chevL: svg(line('<polyline points="15 18 9 12 15 6"/>')),
    chevR: svg(line('<polyline points="9 18 15 12 9 6"/>')),
    x: svg(line('<path d="M6 6l12 12M18 6L6 18"/>')),
    search: svg(line('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>')),
    share: svg(line('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>')),
    menu: svg(line('<path class="l1" d="M4 7h16"/><path class="l2" d="M4 12h16"/><path class="l3" d="M4 17h16"/>'), "menu-ic"),
  };
  $$("[data-icon]").forEach((el) => el.insertAdjacentHTML("afterbegin", ICONS[el.dataset.icon] || ""));

  // ---------------- Scroll reveal (skipped when the user prefers reduced motion) ----------------
  const io = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.06, rootMargin: "0px 0px -30px 0px" })
    : null;
  function reveal(els) {
    if (!io) return;
    els.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--d", Math.min(i, 4) * 70 + "ms"); io.observe(el); });
  }
  reveal($$(".band"));

  const hero = $("#hero"), main = $("#main"), home = $("#home"), results = $("#results"), viewTitle = $("#view-title");
  const spinner = '<div class="state"><div class="spinner"></div>Loading…</div>';

  // ---------------- API (through the Worker proxy) ----------------
  async function api(path, params = {}) {
    const url = new URL("/api/tmdb" + path, location.origin);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let res;
    try { res = await fetch(url); } catch { throw new Error("Can't reach the server. Check your connection."); }
    if (res.status === 500) throw new Error("The server has no TMDB key yet. Add TMDB_KEY in your Vercel project settings, then redeploy.");
    if (!res.ok) throw new Error("TMDB request failed (" + res.status + "). Try again.");
    return res.json();
  }

  const norm = (m, fallbackType) => ({
    id: m.id, type: m.media_type || fallbackType, title: m.title || m.name || "Untitled",
    date: m.release_date || m.first_air_date || "", poster: m.poster_path, backdrop: m.backdrop_path,
    rating: m.vote_average, overview: m.overview,
  });
  const clean = (list, t) => list.filter((m) => m.media_type !== "person").map((m) => norm(m, t));

  // ---------------- My list (localStorage) ----------------
  const KEY = "thrilx-list";
  const getList = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const saveList = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };
  const inList = (it) => getList().some((x) => x.id === it.id && x.type === it.type);
  function toggleFav(it) {
    const list = getList();
    const i = list.findIndex((x) => x.id === it.id && x.type === it.type);
    if (i >= 0) list.splice(i, 1); else list.unshift(it);
    saveList(list);
    syncFav(it);
    if (view === "list") showView("list");
  }
  function syncFav(toggled) {
    $("#list-count").textContent = getList().length;
    $$("[data-fav]").forEach((b) => {
      const id = Number(b.dataset.id), type = b.dataset.type;
      const on = inList({ id, type });
      b.classList.toggle("on", on);
      b.innerHTML = (on ? ICONS.heartFill : ICONS.heart) + (b.dataset.full ? (on ? "In my list" : "Add to my list") : "");
      b.setAttribute("aria-pressed", on);
      if (toggled && toggled.id === id && toggled.type === type) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    });
  }

  // ---------------- Markup ----------------
  function cardHtml(m, i = 0) {
    const poster = m.poster ? '<img loading="lazy" src="' + IMG + "w342" + m.poster + '" alt="">' : "<span>No poster</span>";
    const rating = m.rating ? '<span class="badge">' + ICONS.star + m.rating.toFixed(1) + "</span>" : "";
    return '<button class="card" style="--i:' + Math.min(i, 12) + '" data-detail data-type="' + m.type + '" data-id="' + m.id + '" type="button"><div class="poster">' + poster + rating + "</div>" +
      '<div class="card-info"><div class="card-title">' + esc(m.title) + '</div><div class="card-sub">' + year(m.date) + " · " + typeLabel(m.type) + "</div></div></button>";
  }
  const rowHtml = (title, list) =>
    '<div class="row"><h3 class="row-title">' + esc(title) + '</h3><div class="row-scroll">' + list.map(cardHtml).join("") + "</div></div>";
  const gridHtml = (list) => '<div class="grid">' + list.map(cardHtml).join("") + "</div>";
  const stateHtml = (msg, cls = "") => '<div class="state ' + cls + '">' + msg + "</div>";

  // ---------------- Views ----------------
  const anime = { with_genres: 16, with_original_language: "ja", sort_by: "popularity.desc" };
  const drama = { with_genres: 18, sort_by: "popularity.desc", "vote_count.gte": 100 };
  const VIEWS = {
    discover: { hero: true, rows: [
      ["Trending this week", "/trending/all/week", "movie"],
      ["Popular movies", "/movie/popular", "movie"],
      ["Popular series", "/tv/popular", "tv"],
      ["Top rated movies", "/movie/top_rated", "movie"],
      ["Top rated series", "/tv/top_rated", "tv"],
    ] },
    movies: { title: "Movies", rows: [
      ["Now playing", "/movie/now_playing", "movie"], ["Popular", "/movie/popular", "movie"], ["Top rated", "/movie/top_rated", "movie"],
    ] },
    series: { title: "Series", rows: [
      ["On the air", "/tv/on_the_air", "tv"], ["Popular", "/tv/popular", "tv"], ["Top rated", "/tv/top_rated", "tv"],
    ] },
    anime: { title: "Anime", rows: [
      ["Popular anime series", "/discover/tv", "tv", anime],
      ["Top rated anime", "/discover/tv", "tv", { ...anime, sort_by: "vote_average.desc", "vote_count.gte": 300 }],
      ["Anime movies", "/discover/movie", "movie", anime],
    ] },
    drama: { title: "Drama", rows: [
      ["Popular drama series", "/discover/tv", "tv", drama],
      ["Drama movies", "/discover/movie", "movie", { ...drama, "vote_count.gte": 500 }],
      ["Korean dramas", "/discover/tv", "tv", { ...drama, with_original_language: "ko" }],
    ] },
  };

  let view = "discover", token = 0;

  function setNav(name) {
    $$("#nav button, #menu-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  }
  function showHero(on) { hero.hidden = !on; main.classList.toggle("nohero", !on); }

  async function showView(name) {
    view = name; const t = ++token;
    closeOverlays(); setNav(name); $("#query").value = ""; results.innerHTML = "";
    window.scrollTo({ top: 0 });

    if (name === "list") {
      showHero(false); viewTitle.textContent = "My list"; viewTitle.hidden = false;
      const list = getList();
      home.innerHTML = list.length ? gridHtml(list) : stateHtml("Your list is empty. Tap the heart on any title to save it here.");
      reveal($$(".grid", home));
      return;
    }
    const v = VIEWS[name];
    showHero(false); viewTitle.hidden = !v.title; viewTitle.textContent = v.title || "";
    home.innerHTML = spinner;
    try {
      const lists = await Promise.all(v.rows.map((r) => api(r[1], r[3] || {})));
      if (t !== token) return;
      home.innerHTML = v.rows.map((r, i) => rowHtml(r[0], clean(lists[i].results, r[2]))).join("");
      reveal($$(".row", home));
      if (v.hero) setupHero(clean(lists[0].results, "movie"));
    } catch (err) { if (t === token) home.innerHTML = stateHtml(esc(err.message), "error"); }
  }

  async function search(q) {
    view = "search"; const t = ++token;
    closeOverlays(); setNav(""); showHero(false); home.innerHTML = "";
    viewTitle.hidden = false; viewTitle.textContent = "Results for “" + q + "”";
    results.innerHTML = spinner;
    try {
      const d = await api("/search/multi", { query: q, include_adult: "false" });
      if (t !== token) return;
      const list = clean(d.results, "movie").filter((m) => m.type === "movie" || m.type === "tv");
      results.innerHTML = list.length ? gridHtml(list) : stateHtml("No movies or series found for “" + esc(q) + "”. Check the spelling or try a shorter title.", "error");
      reveal($$(".grid", results));
      window.scrollTo({ top: 0 });
    } catch (err) { if (t === token) results.innerHTML = stateHtml(esc(err.message), "error"); }
  }

  // ---------------- Hero ----------------
  let slides = [], idx = 0, timer = null;
  function setupHero(list) {
    slides = list.filter((m) => m.backdrop).slice(0, 6);
    if (!slides.length) return;
    $("#hero-dots").innerHTML = slides.map((_, i) => '<button class="dot" data-slide="' + i + '" type="button" aria-label="Slide ' + (i + 1) + '"></button>').join("");
    showHero(true); showSlide(0); startTimer();
  }
  function showSlide(i) {
    idx = (i + slides.length) % slides.length;
    hero.classList.remove("swap"); void hero.offsetWidth; hero.classList.add("swap");
    const m = slides[idx];
    $("#hero-bg").style.backgroundImage = "url(" + IMG + "w1280" + m.backdrop + ")";
    $("#hero-content").innerHTML =
      '<div class="eyebrow">Trending #' + (idx + 1) + "</div><h1>" + esc(m.title) + "</h1>" +
      '<div class="chips">' + (m.rating ? "<span>" + ICONS.star + m.rating.toFixed(1) + "</span>" : "") + "<span>" + year(m.date) + "</span><span>" + typeLabel(m.type) + "</span></div>" +
      "<p>" + esc(m.overview) + "</p>" +
      '<div class="actions"><button class="btn-watch" data-detail data-type="' + m.type + '" data-id="' + m.id + '" type="button">' + ICONS.play + 'Where to watch</button>' +
      '<button class="btn-round" data-fav data-type="' + m.type + '" data-id="' + m.id + '" type="button" aria-label="Toggle my list">' + ICONS.heart + "</button></div>";
    const next = [1, 2, 3, 4].map((n) => (idx + n) % slides.length).filter((n) => n !== idx);
    $("#hero-list").innerHTML = next.map((n) => {
      const s = slides[n];
      return '<button class="hl-item" data-slide="' + n + '" type="button">' + (s.poster ? '<img src="' + IMG + "w92" + s.poster + '" alt="">' : "") +
        "<span><b>" + esc(s.title) + "</b><small>" + year(s.date) + " · " + typeLabel(s.type) + "</small></span></button>";
    }).join("");
    $$(".dot").forEach((d, n) => d.classList.toggle("active", n === idx));
    syncFav();
  }
  function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => { if (!hero.hidden && !document.hidden && $("#detail").hidden) showSlide(idx + 1); }, 9000);
  }

  // ---------------- Detail ----------------
  let current = null;
  async function openDetail(type, id) {
    const body = $("#dt-body");
    body.innerHTML = spinner; openOverlay("detail");
    try {
      const m = await api("/" + type + "/" + id, { append_to_response: "videos,credits,watch/providers" });
      current = norm({ ...m, media_type: type }, type);
      const yt = (m.videos?.results || []).filter((v) => v.site === "YouTube");
      const pick = yt.find((v) => v.type === "Trailer" && v.official) || yt.find((v) => v.type === "Trailer") || yt.find((v) => v.type === "Teaser");
      const run = type === "tv"
        ? (m.number_of_seasons ? m.number_of_seasons + (m.number_of_seasons > 1 ? " seasons" : " season") : "")
        : (m.runtime ? m.runtime + " min" : "");
      const cast = (m.credits?.cast || []).slice(0, 10).map((c) =>
        '<div class="cast-item">' + (c.profile_path ? '<img loading="lazy" src="' + IMG + "w185" + c.profile_path + '" alt="">' : '<div class="cast-ph">' + esc(c.name[0]) + "</div>") +
        "<b>" + esc(c.name) + "</b><small>" + esc(c.character || "") + "</small></div>").join("");
      const prov = m["watch/providers"]?.results?.[REGION];
      const groups = [["flatrate", "Stream"], ["free", "Free"], ["ads", "Free with ads"], ["rent", "Rent"], ["buy", "Buy"]]
        .filter(([k]) => prov && prov[k]?.length)
        .map(([k, label]) => '<div class="prov-group"><span>' + label + "</span>" +
          prov[k].map((p) => '<img src="' + IMG + "w92" + p.logo_path + '" alt="' + esc(p.provider_name) + '" title="' + esc(p.provider_name) + '">').join("") + "</div>").join("");
      const provHtml = groups
        ? groups + '<a class="prov-link" href="' + esc(prov.link) + '" target="_blank" rel="noopener">See every option and open links</a>'
        : '<p class="meta">No listings for ' + REGION + " yet. Availability changes often, so check back later.</p>";

      body.innerHTML =
        '<div class="dt-grid"><div class="dt-poster">' + (m.poster_path ? '<img src="' + IMG + "w500" + m.poster_path + '" alt="Poster for ' + esc(current.title) + '">' : "") + "</div>" +
        '<div class="dt-info"><h2>' + esc(current.title) + "</h2>" +
        '<div class="meta">' + [year(current.date), run, current.rating ? "<b>" + ICONS.star + current.rating.toFixed(1) + "</b>" : "", typeLabel(type)].filter(Boolean).join(" · ") + "</div>" +
        '<div class="actions wrap">' +
        (pick ? '<button class="pill-btn strong" data-trailer="' + pick.key + '" type="button">' + ICONS.play + 'Trailer</button>' : "") +
        '<button class="pill-btn" data-fav data-full="1" data-type="' + type + '" data-id="' + id + '" type="button"></button>' +
        '<button class="pill-btn" data-open="share" type="button">' + ICONS.share + 'Share</button></div>' +
        '<div id="dt-trailer"></div>' +
        (m.tagline ? '<p class="tagline">' + esc(m.tagline) + "</p>" : "") +
        '<p class="overview">' + esc(m.overview || "No description available.") + "</p>" +
        '<div class="genres">' + (m.genres || []).map((g) => "<span>" + esc(g.name) + "</span>").join("") + "</div>" +
        '<h3 class="sub">Where to watch in ' + REGION + "</h3>" + provHtml +
        (cast ? '<h3 class="sub">Cast</h3><div class="cast">' + cast + "</div>" : "") + "</div></div>";
      syncFav();
    } catch (err) { body.innerHTML = stateHtml(esc(err.message), "error"); }
  }

  // ---------------- Overlays ----------------
  function openOverlay(id) {
    $$(".overlay").forEach((o) => { if (o.id !== id && !(id === "share" && o.id === "detail")) o.hidden = true; });
    $("#" + id).hidden = false; document.body.classList.add("no-scroll");
    const c = $("#" + id + " .close"); if (c) c.focus();
  }
  function closeOverlay(o) {
    o.hidden = true;
    if (o.id === "detail") $("#dt-body").innerHTML = "";
    if (!$$(".overlay").some((x) => !x.hidden) && intro.hidden) document.body.classList.remove("no-scroll");
  }
  const closeOverlays = () => $$(".overlay").forEach(closeOverlay);

  // ---------------- Share ----------------
  const shareData = { title: "Thrilx", text: "Find what to watch, and where to watch it.", url: location.origin };
  if (!navigator.share) $("#share-native").hidden = true;
  $("#share-native").addEventListener("click", () => { navigator.share(shareData).catch(() => {}); });
  $("#share-copy").addEventListener("click", async () => {
    const s = $("#share-status");
    try { await navigator.clipboard.writeText(shareData.url); s.textContent = "Link copied."; }
    catch { s.textContent = "Couldn't copy. Copy this link instead: " + shareData.url; }
  });

  // ---------------- Intro ----------------
  const intro = $("#intro");
  function hideIntro() {
    document.body.classList.add("ready"); intro.classList.add("leaving");
    setTimeout(() => { intro.hidden = true; if (!$$(".overlay").some((x) => !x.hidden)) document.body.classList.remove("no-scroll"); }, 800);
    try { sessionStorage.setItem("thrilx-intro", "1"); } catch { /* ignore */ }
  }
  let seen = false;
  try { seen = sessionStorage.getItem("thrilx-intro") === "1"; } catch { /* ignore */ }
  if (seen) { intro.hidden = true; document.body.classList.add("ready"); } else document.body.classList.add("no-scroll");
  $("#enter").addEventListener("click", hideIntro);
  $("#skip-intro").addEventListener("click", hideIntro);

  // ---------------- Events ----------------
  $("#contact-mail").textContent = CONTACT; $("#contact-mail").href = "mailto:" + CONTACT;
  $("#search-form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#query").value.trim(); if (q) search(q); });
  $("#open-list").addEventListener("click", () => showView("list"));
  $("#open-menu").addEventListener("click", () => openOverlay("menu"));
  $("#home-link").addEventListener("click", (e) => { e.preventDefault(); showView("discover"); });
  $("#to-top").addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0 }); });
  $("#hero-prev").addEventListener("click", () => { showSlide(idx - 1); startTimer(); });
  $("#hero-next").addEventListener("click", () => { showSlide(idx + 1); startTimer(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlays(); });
  window.addEventListener("scroll", () => $("#topbar").classList.toggle("scrolled", window.scrollY > 40), { passive: true });
  $$(".overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) closeOverlay(o); }));

  document.addEventListener("click", (e) => {
    const t = e.target;
    const v = t.closest("[data-view]"); if (v) return showView(v.dataset.view);
    if (t.closest("[data-close]")) return closeOverlay(t.closest(".overlay"));
    const op = t.closest("[data-open]"); if (op) return openOverlay(op.dataset.open);
    const fav = t.closest("[data-fav]");
    if (fav) {
      const id = Number(fav.dataset.id), type = fav.dataset.type;
      const it = current && current.id === id && current.type === type ? current : slides.find((s) => s.id === id && s.type === type) || getList().find((x) => x.id === id && x.type === type);
      return it && toggleFav(it);
    }
    const tr = t.closest("[data-trailer]");
    if (tr) {
      $("#dt-trailer").innerHTML = '<div class="trailer"><iframe title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowfullscreen src="https://www.youtube-nocookie.com/embed/' +
        encodeURIComponent(tr.dataset.trailer) + '?autoplay=1&rel=0"></iframe></div>';
      return;
    }
    const sl = t.closest("[data-slide]"); if (sl) { showSlide(Number(sl.dataset.slide)); return startTimer(); }
    const d = t.closest("[data-detail]"); if (d) return openDetail(d.dataset.type, Number(d.dataset.id));
  });

  syncFav();
  showView("discover");
})();
