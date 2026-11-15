(() => {
  "use strict";

  // Prevent double-execution if script is included or pasted twice
  if (window.__THRILX_INIT__) return;
  window.__THRILX_INIT__ = true;

  // ---------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------
  const REGION = "IN";                 // ISO 3166-1 country code for "Where to watch"
  const CONTACT = "you@example.com";   // shown in the contact section
  const IMG = "https://image.tmdb.org/t/p/";
  const API_BASE = "/api/tmdb";
  const EMBED_BASE = "https://vidstuck.cc/embed";

  // Series & Movie Embed Query Params
  const TV_EMBED_PARAMS = "nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=8B5CF6&branding=vidstuck&subtitle=english&server=valstrax";
  const MOVIE_EMBED_PARAMS = "overlay=true&color=8B5CF6&branding=vidstuck&subtitle=english&server=valstrax";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const year = (d) => (d ? d.slice(0, 4) : "TBA");
  const typeLabel = (t) => (t === "tv" ? "Series" : "Movie");

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
    return m + ":" + String(r).padStart(2, "0");
  }

  // ---------------- Vector icons (Deduplicated) ----------------
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
    mute: svg(line('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>')),
    unmute: svg(line('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>')),
  };
  $$("[data-icon]").forEach((el) => {
    $$("svg.ic", el).forEach((old) => old.remove());
    el.insertAdjacentHTML("afterbegin", ICONS[el.dataset.icon] || "");
  });

  // ---------------- Scroll reveal ----------------
  const io = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.06, rootMargin: "0px 0px -30px 0px" })
    : null;
  function reveal(els) {
    if (!io) return;
    els.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--d", Math.min(i, 4) * 70 + "ms"); io.observe(el); });
  }
  reveal($$(".band"));

  const hero = $("#hero"), main = $("#main"), home = $("#home"), results = $("#results"), viewTitle = $("#view-title");
  const intro = $("#intro");
  const playerModal = $("#player-modal"), player = $("#player"), playerLoading = $("#player-loading"), playerBar = $("#player-bar"), detailsBox = $("#details");
  const seriesBrowser = $("#series-browser"), seasonPills = $("#season-pills"), epGrid = $("#ep-grid"), seriesEpSummary = $("#series-ep-summary");
  const progressPill = $("#player-progress-pill");
  const spinner = '<div class="state"><div class="spinner"></div>Loading…</div>';

  function isOverlayOpen() {
    const anyOverlay = $$(".overlay").some((o) => !o.hidden);
    const playerOpen = playerModal && !playerModal.hidden;
    const introOpen = intro && !intro.hidden;
    return anyOverlay || playerOpen || introOpen;
  }

  // ---------------- API ----------------
  async function api(path, params = {}) {
    const url = new URL(API_BASE, location.origin);
    url.searchParams.set("path", path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let res;
    try { res = await fetch(url); } catch { throw new Error("Can't reach the server. Check your connection."); }
    if (res.status === 500) throw new Error("The server has no TMDB key yet. Add TMDB_KEY in your Vercel project settings, then redeploy.");
    if (!res.ok) throw new Error("TMDB request failed (" + res.status + "). Try again.");
    return res.json();
  }

  const norm = (m, fallbackType) => ({
    id: m.id,
    type: m.media_type === "tv" || m.media_type === "movie" ? m.media_type : (m.first_air_date && !m.release_date ? "tv" : fallbackType || "movie"),
    title: m.title || m.name || "Untitled",
    date: m.release_date || m.first_air_date || "",
    poster: m.poster_path,
    backdrop: m.backdrop_path,
    rating: m.vote_average,
    overview: m.overview,
  });
  const clean = (list, t) => (list || []).filter((m) => m.media_type !== "person").map((m) => norm(m, t));

  // ---------------- Continue Watching & Progress Storage ----------------
  const CW_KEY = "thrilx-continue";

  function getContinueList() {
    try { return JSON.parse(localStorage.getItem(CW_KEY) || "[]"); }
    catch { return []; }
  }
  function saveContinueList(list) {
    try { localStorage.setItem(CW_KEY, JSON.stringify(list.slice(0, 24))); }
    catch { /* ignore */ }
  }
  function getSavedProgress(type, id) {
    return getContinueList().find((x) => x.type === type && Number(x.id) === Number(id)) || null;
  }
  function upsertContinueItem(entry) {
    const list = getContinueList();
    const idx = list.findIndex((x) => x.type === entry.type && Number(x.id) === Number(entry.id));
    const prev = idx >= 0 ? list[idx] : {};
    const merged = {
      ...prev,
      ...entry,
      episodes: { ...(prev.episodes || {}), ...(entry.episodes || {}) },
      updatedAt: Date.now(),
    };
    if (idx >= 0) list.splice(idx, 1);
    list.unshift(merged);
    saveContinueList(list);
    updateProgressBadgeUI(merged);
    if (view === "discover") refreshContinueRowDom();
  }
  function removeContinueItem(type, id) {
    const list = getContinueList().filter((x) => !(x.type === type && Number(x.id) === Number(id)));
    saveContinueList(list);
    if (view === "discover") refreshContinueRowDom();
  }

  function updateProgressBadgeUI(item) {
    if (!progressPill) return;
    if (!item || !selectedId || Number(item.id) !== Number(selectedId) || item.type !== selectedType) {
      progressPill.hidden = true;
      return;
    }
    const label = item.type === "tv"
      ? "S" + (item.season || 1) + ":E" + (item.episode || 1) + (item.currentTime ? " · " + fmtTime(item.currentTime) : "")
      : (item.currentTime ? "Saved " + fmtTime(item.currentTime) : "Watching");
    progressPill.textContent = label;
    progressPill.hidden = false;
  }

  // Listen for iframe progress messages from vidstuck.cc
  window.addEventListener("message", function (event) {
    if (typeof event.data !== "string") return;
    try {
      const data = JSON.parse(event.data);
      console.log("Progress:", data);

      if (!selectedId) return;

      const payload = data.data || data;
      const currentTime = Number(payload.currentTime ?? payload.time ?? payload.progress ?? payload.watched ?? 0);
      const duration = Number(payload.duration ?? payload.total ?? 0);
      const season = Number(payload.season ?? activeSeasonNum ?? 1);
      const episode = Number(payload.episode ?? activeEpisodeNum ?? 1);

      if (currentTime > 0 || duration > 0 || payload.event === "timeupdate" || payload.type === "MEDIA_DATA") {
        const epKey = "s" + season + "e" + episode;
        const episodesUpdate = selectedType === "tv"
          ? { [epKey]: { currentTime, duration, updatedAt: Date.now() } }
          : {};

        upsertContinueItem({
          id: selectedId,
          type: selectedType,
          title: current?.title || "TMDB #" + selectedId,
          poster: current?.poster || "",
          backdrop: current?.backdrop || "",
          date: current?.date || "",
          rating: current?.rating || 0,
          season: selectedType === "tv" ? season : 1,
          episode: selectedType === "tv" ? episode : 1,
          currentTime: currentTime > 0 ? currentTime : (getSavedProgress(selectedType, selectedId)?.currentTime || 0),
          duration: duration > 0 ? duration : (getSavedProgress(selectedType, selectedId)?.duration || 0),
          episodes: episodesUpdate,
        });
      }
    } catch {
      // Ignore invalid messages
    }
  });

  function continueRowHtml() {
    const list = getContinueList();
    if (!list.length) return "";
    const cards = list.map((it) => {
      const imgPath = it.backdrop ? IMG + "w780" + it.backdrop : (it.poster ? IMG + "w342" + it.poster : "");
      const pct = it.duration > 0 ? Math.min(98, Math.max(6, Math.round((it.currentTime / it.duration) * 100))) : 25;
      const tag = it.type === "tv" ? "S" + (it.season || 1) + " · E" + (it.episode || 1) : "Movie";
      const timeStr = it.currentTime > 0
        ? fmtTime(it.currentTime) + (it.duration > 0 ? " / " + fmtTime(it.duration) : "")
        : "Resume";

      return (
        '<div class="cw-card">' +
        '<button class="cw-remove" type="button" data-cw-remove data-type="' + esc(it.type) + '" data-id="' + it.id + '" aria-label="Remove from Continue Watching">' + ICONS.x + "</button>" +
        '<button class="cw-main" type="button" data-watch data-type="' + esc(it.type) + '" data-id="' + it.id + '" data-season="' + (it.season || 1) + '" data-episode="' + (it.episode || 1) + '">' +
        '<div class="cw-thumb">' +
        (imgPath ? '<img loading="lazy" src="' + imgPath + '" alt="">' : "") +
        '<div class="cw-shade"></div>' +
        '<div class="cw-play-badge">' + ICONS.play + "</div>" +
        '<span class="cw-tag">' + esc(tag) + "</span>" +
        '<span class="cw-time">' + esc(timeStr) + "</span>" +
        '<div class="cw-bar"><div class="cw-bar-fill" style="width:' + pct + '%"></div></div>' +
        "</div>" +
        '<div class="cw-info"><div><div class="cw-title">' + esc(it.title) + '</div><div class="cw-sub">' + year(it.date) + " · " + typeLabel(it.type) + "</div></div></div>" +
        "</button></div>"
      );
    }).join("");

    return (
      '<div class="row" id="cw-row">' +
      '<div class="row-head"><h3 class="row-title">Continue watching</h3>' +
      '<button type="button" class="row-clear" id="cw-clear-all">Clear all</button></div>' +
      '<div class="row-scroll">' + cards + "</div></div>"
    );
  }

  function refreshContinueRowDom() {
    const existing = $("#cw-row");
    const html = continueRowHtml();
    if (existing) {
      if (html) existing.outerHTML = html;
      else existing.remove();
    } else if (html && home.firstChild) {
      home.insertAdjacentHTML("afterbegin", html);
    }
  }

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

  function buildExtraDetailsHtml(m) {
    const prov = m["watch/providers"]?.results?.[REGION];
    const groups = [["flatrate", "Stream"], ["free", "Free"], ["ads", "Free with ads"], ["rent", "Rent"], ["buy", "Buy"]]
      .filter(([k]) => prov && prov[k]?.length)
      .map(([k, label]) => '<div class="prov-group"><span>' + label + "</span>" +
        prov[k].map((p) => '<img src="' + IMG + "w92" + p.logo_path + '" alt="' + esc(p.provider_name) + '" title="' + esc(p.provider_name) + '">').join("") + "</div>").join("");
    const provHtml = groups
      ? groups + '<a class="prov-link" href="' + esc(prov.link) + '" target="_blank" rel="noopener">See every option and open links</a>'
      : '<p class="meta">No listings for ' + REGION + " yet. Availability changes often, so check back later.</p>";

    const cast = (m.credits?.cast || []).slice(0, 10).map((c) =>
      '<div class="cast-item">' + (c.profile_path ? '<img loading="lazy" src="' + IMG + "w185" + c.profile_path + '" alt="">' : '<div class="cast-ph">' + esc(c.name[0]) + "</div>") +
      "<b>" + esc(c.name) + "</b><small>" + esc(c.character || "") + "</small></div>").join("");

    return '<h3 class="sub">Where to watch in ' + REGION + "</h3>" + provHtml +
      (cast ? '<h3 class="sub">Cast</h3><div class="cast">' + cast + "</div>" : "");
  }

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
  function showHero(on) {
    hero.hidden = !on;
    main.classList.toggle("nohero", !on);
    if (on) heroVisible = true;
    else setVideo(null);
  }

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
      const cwHtml = name === "discover" ? continueRowHtml() : "";
      home.innerHTML = cwHtml + v.rows.map((r, i) => rowHtml(r[0], clean(lists[i].results, r[2]))).join("");
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

  // ---------------- Hero with Background Trailer ----------------
  let slides = [], idx = 0, timer = null;
  let heroVisible = true, currentKey = null, heroMuted = true;
  const trailerCache = {};

  async function getTrailer(type, id) {
    const cacheKey = type + ":" + id;
    if (cacheKey in trailerCache) return trailerCache[cacheKey];
    try {
      const d = await api("/" + type + "/" + id + "/videos");
      const yt = (d.results || []).filter((v) => v.site === "YouTube" && v.key);
      const pick =
        yt.find((v) => v.type === "Trailer" && v.official) ||
        yt.find((v) => v.type === "Trailer") ||
        yt.find((v) => v.type === "Teaser") ||
        yt[0];
      return (trailerCache[cacheKey] = pick ? pick.key : null);
    } catch {
      return (trailerCache[cacheKey] = null);
    }
  }

  function buildHeroYoutubeSrc(key, muted) {
    return (
      "https://www.youtube.com/embed/" +
      encodeURIComponent(key) +
      "?autoplay=1&mute=" +
      (muted ? "1" : "0") +
      "&controls=0&loop=1&playlist=" +
      encodeURIComponent(key) +
      "&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&disablekb=1&iv_load_policy=3"
    );
  }

  function setVideo(key) {
    const box = $("#hero-video");
    if (!box) return;
    if (!key || isOverlayOpen() || !heroVisible || hero.hidden) {
      box.classList.remove("on");
      box.innerHTML = "";
      box.dataset.key = "";
      updateMuteButton();
      return;
    }
    if (box.dataset.key === key && box.firstChild) return;
    box.classList.remove("on");
    box.dataset.key = key;
    heroMuted = true;
    updateMuteButton();

    box.innerHTML =
      '<iframe title="Trailer" allow="autoplay; encrypted-media" src="' +
      buildHeroYoutubeSrc(key, true) +
      '"></iframe>';
    box.firstChild.addEventListener("load", () => {
      box.classList.add("on");
      updateMuteButton();
    });
  }

  function updateMuteButton() {
    const b = $("[data-mute]");
    if (!b) return;
    b.innerHTML = heroMuted ? ICONS.mute : ICONS.unmute;
    b.setAttribute("aria-label", heroMuted ? "Unmute trailer" : "Mute trailer");
    b.classList.toggle("on", !heroMuted);
  }

  function toggleMute() {
    if (!currentKey) return;
    const box = $("#hero-video");
    let frame = $("#hero-video iframe");
    if (!frame && box) {
      setVideo(currentKey);
      frame = $("#hero-video iframe");
    }
    if (!frame) return;

    heroMuted = !heroMuted;
    updateMuteButton();

    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: heroMuted ? "mute" : "unMute", args: [] }),
        "*"
      );
      if (!heroMuted) {
        frame.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
          "*"
        );
        frame.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [] }),
          "*"
        );
      }
    } catch {
      frame.src = buildHeroYoutubeSrc(currentKey, heroMuted);
    }
  }

  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver(
      (entries) => {
        if (hero.hidden) return;
        heroVisible = entries[0].isIntersecting;
        setVideo(currentKey);
      },
      { threshold: 0.2 }
    ).observe(hero);
  }

  function setupHero(list) {
    slides = list.filter((m) => m.backdrop).slice(0, 6);
    if (!slides.length) return;
    $("#hero-dots").innerHTML = slides.map((_, i) => '<button class="dot" data-slide="' + i + '" type="button" aria-label="Slide ' + (i + 1) + '"></button>').join("");
    showHero(true);
    showSlide(0);
    startTimer();
  }

  async function showSlide(i) {
    idx = (i + slides.length) % slides.length;
    const activeIdx = idx;
    hero.classList.remove("swap"); void hero.offsetWidth; hero.classList.add("swap");
    const m = slides[idx];
    const saved = getSavedProgress(m.type, m.id);
    const watchLabel = saved
      ? (m.type === "tv" ? "Continue S" + (saved.season || 1) + ":E" + (saved.episode || 1) : "Continue Watching")
      : "Watch Now";

    $("#hero-bg").style.backgroundImage = "url(" + IMG + "w1280" + m.backdrop + ")";
    $("#hero-content").innerHTML =
      '<div class="eyebrow">Trending #' + (idx + 1) + " · " + typeLabel(m.type) + "</div><h1>" + esc(m.title) + "</h1>" +
      '<div class="chips">' + (m.rating ? "<span>" + ICONS.star + m.rating.toFixed(1) + "</span>" : "") + "<span>" + year(m.date) + "</span><span>" + typeLabel(m.type) + "</span></div>" +
      "<p>" + esc(m.overview) + "</p>" +
      '<div class="actions">' +
      '<button class="btn-watch" data-watch data-type="' + m.type + '" data-id="' + m.id + '" type="button">' + ICONS.play + esc(watchLabel) + "</button>" +
      '<button class="pill-btn" data-detail data-type="' + m.type + '" data-id="' + m.id + '" type="button">Details</button>' +
      '<button class="btn-round" data-fav data-type="' + m.type + '" data-id="' + m.id + '" type="button" aria-label="Toggle my list">' + ICONS.heart + "</button>" +
      '<button class="btn-round" data-mute type="button" aria-label="Unmute trailer">' + ICONS.mute + "</button></div>";
    const next = [1, 2, 3, 4].map((n) => (idx + n) % slides.length).filter((n) => n !== idx);
    $("#hero-list").innerHTML = next.map((n) => {
      const s = slides[n];
      return '<button class="hl-item" data-slide="' + n + '" type="button">' + (s.poster ? '<img src="' + IMG + "w92" + s.poster + '" alt="">' : "") +
        "<span><b>" + esc(s.title) + "</b><small>" + year(s.date) + " · " + typeLabel(s.type) + "</small></span></button>";
    }).join("");
    $$(".dot").forEach((d, n) => d.classList.toggle("active", n === idx));
    syncFav();

    currentKey = null;
    setVideo(null);
    const key = await getTrailer(m.type, m.id);
    if (idx !== activeIdx) return;
    currentKey = key;
    setVideo(key);
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!isOverlayOpen() && heroVisible && !hero.hidden && !document.hidden && slides.length > 1) {
        showSlide(idx + 1);
      }
    }, 30000);
  }

  // ---------------- Dedicated Watch Scene (#player-modal) ----------------
  let selectedId = null, selectedType = "movie", playerSeasons = [];
  let activeSeasonNum = 1, activeEpisodeNum = 1;
  const seasonCache = {};

  function buildEmbedUrl(type, id, season = 1, episode = 1) {
    const cleanId = parseInt(id, 10);
    if (type === "tv") {
      return EMBED_BASE + "/tv/" + cleanId + "/" + parseInt(season, 10) + "/" + parseInt(episode, 10) + "?" + TV_EMBED_PARAMS;
    }
    return EMBED_BASE + "/movie/" + cleanId + "?" + MOVIE_EMBED_PARAMS;
  }

  function loadEmbedSrc(type, id, season = 1, episode = 1) {
    activeSeasonNum = Number(season) || 1;
    activeEpisodeNum = Number(episode) || 1;

    const src = buildEmbedUrl(type, id, activeSeasonNum, activeEpisodeNum);
    playerLoading.classList.remove("hidden");
    player.onload = () => playerLoading.classList.add("hidden");
    player.src = src;

    if (playerBar) {
      if (type === "tv") {
        playerBar.innerHTML =
          '<span class="chips"><span>Playing Season ' + activeSeasonNum + " · Episode " + activeEpisodeNum + "</span></span>";
      } else {
        playerBar.innerHTML = '<span class="chips"><span>Feature Film</span></span>';
      }
    }

    if (epGrid) {
      $$(".ep-card", epGrid).forEach((card) => {
        const isMatch = Number(card.dataset.season) === activeSeasonNum && Number(card.dataset.episode) === activeEpisodeNum;
        card.classList.toggle("active", isMatch);
        const badge = $(".ep-playing-badge", card);
        if (isMatch && !badge) {
          $(".ep-thumb", card)?.insertAdjacentHTML("beforeend", '<span class="ep-playing-badge">Playing</span>');
        } else if (!isMatch && badge) {
          badge.remove();
        }
      });
    }

    if (current && Number(current.id) === Number(id)) {
      const existing = getSavedProgress(type, id);
      upsertContinueItem({
        id,
        type,
        title: current.title,
        poster: current.poster,
        backdrop: current.backdrop,
        date: current.date,
        rating: current.rating,
        season: activeSeasonNum,
        episode: activeEpisodeNum,
        currentTime: existing?.currentTime || 0,
        duration: existing?.duration || 0,
      });
    }
  }

  async function renderSeasonEpisodes(tvId, seasonNum) {
    if (!epGrid) return;
    activeSeasonNum = Number(seasonNum);
    if (seasonPills) {
      $$(".season-pill", seasonPills).forEach((b) => b.classList.toggle("active", Number(b.dataset.seasonPill) === activeSeasonNum));
    }
    epGrid.innerHTML = '<div class="state"><div class="spinner"></div>Loading Season ' + activeSeasonNum + " episodes…</div>";

    const cacheKey = tvId + ":" + activeSeasonNum;
    let seasonData = seasonCache[cacheKey];
    if (!seasonData) {
      try {
        seasonData = await api("/tv/" + tvId + "/season/" + activeSeasonNum);
        seasonCache[cacheKey] = seasonData;
      } catch {
        seasonData = null;
      }
    }

    const episodes = seasonData?.episodes || [];
    const saved = getSavedProgress("tv", tvId);

    if (!episodes.length) {
      const fallbackInfo = playerSeasons.find((s) => s.season_number === activeSeasonNum);
      const count = Math.max(1, fallbackInfo?.episode_count || 1);
      epGrid.innerHTML = Array.from({ length: count }, (_, i) => i + 1).map((epNum) => {
        const isPlaying = activeSeasonNum === Number(seasonNum) && activeEpisodeNum === epNum;
        return (
          '<button type="button" class="ep-card' + (isPlaying ? " active" : "") + '" data-ep-select data-id="' + tvId + '" data-season="' + activeSeasonNum + '" data-episode="' + epNum + '">' +
          '<div class="ep-body"><div class="ep-title">Episode ' + epNum + '</div><div class="ep-desc">Click to play Season ' + activeSeasonNum + ", Episode " + epNum + "</div></div></button>"
        );
      }).join("");
      return;
    }

    if (seriesEpSummary) {
      seriesEpSummary.textContent = "Season " + activeSeasonNum + " · " + episodes.length + (episodes.length === 1 ? " Episode" : " Episodes");
    }

    epGrid.innerHTML = episodes.map((ep) => {
      const epNum = ep.episode_number;
      const isPlaying = activeSeasonNum === Number(seasonNum) && activeEpisodeNum === epNum;
      const thumb = ep.still_path
        ? '<img loading="lazy" src="' + IMG + "w300" + ep.still_path + '" alt="">'
        : (current?.backdrop ? '<img loading="lazy" src="' + IMG + "w300" + current.backdrop + '" alt="">' : "");
      const epSaved = saved?.episodes?.["s" + activeSeasonNum + "e" + epNum];
      const pct = epSaved && epSaved.duration > 0 ? Math.min(98, Math.max(8, Math.round((epSaved.currentTime / epSaved.duration) * 100))) : 0;

      return (
        '<button type="button" class="ep-card' + (isPlaying ? " active" : "") + '" data-ep-select data-id="' + tvId + '" data-season="' + activeSeasonNum + '" data-episode="' + epNum + '">' +
        '<div class="ep-thumb">' +
        thumb +
        '<span class="ep-num-badge">E' + epNum + "</span>" +
        (isPlaying ? '<span class="ep-playing-badge">Playing</span>' : "") +
        (ep.runtime ? '<span class="ep-runtime">' + ep.runtime + "m</span>" : "") +
        (pct > 0 ? '<div class="cw-bar"><div class="cw-bar-fill" style="width:' + pct + '%"></div></div>' : "") +
        "</div>" +
        '<div class="ep-body">' +
        '<div class="ep-title">' + esc(ep.name || "Episode " + epNum) + "</div>" +
        '<div class="ep-desc">' + esc(ep.overview || "No overview available for this episode.") + "</div>" +
        "</div></button>"
      );
    }).join("");
  }

  async function openPlayerScene(type, id, initSeason = null, initEpisode = null) {
    selectedType = type;
    selectedId = Number(id);
    playerSeasons = [];

    const saved = getSavedProgress(type, id);
    const startSeason = initSeason ? Number(initSeason) : (saved?.season || 1);
    const startEpisode = initEpisode ? Number(initEpisode) : (saved?.episode || 1);

    $$(".overlay").forEach((o) => { o.hidden = true; });
    $("#dt-body").innerHTML = "";

    playerModal.hidden = false;
    document.body.classList.add("no-scroll");
    playerModal.scrollTop = 0;
    setVideo(null);

    if (seriesBrowser) seriesBrowser.hidden = type !== "tv";
    updateProgressBadgeUI(saved);
    loadEmbedSrc(type, id, startSeason, startEpisode);
    detailsBox.innerHTML = '<div></div><div class="meta">Loading details…</div>';

    try {
      const m = await api("/" + type + "/" + id, { append_to_response: "videos,credits,watch/providers" });
      if (selectedId !== Number(id) || selectedType !== type) return;

      current = norm({ ...m, media_type: type }, type);
      const title = current.title;
      const relDate = current.date;
      const run = type === "tv"
        ? (m.number_of_seasons ? m.number_of_seasons + (m.number_of_seasons > 1 ? " seasons" : " season") : "")
        : (m.runtime ? Math.floor(m.runtime / 60) + "h " + (m.runtime % 60) + "m" : "");

      upsertContinueItem({
        id: selectedId,
        type: selectedType,
        title: current.title,
        poster: current.poster,
        backdrop: current.backdrop,
        date: current.date,
        rating: current.rating,
        season: activeSeasonNum,
        episode: activeEpisodeNum,
      });

      if (type === "tv" && seasonPills) {
        playerSeasons = (m.seasons || []).filter((s) => s.season_number > 0);
        seasonPills.innerHTML = playerSeasons.map((s) =>
          '<button type="button" class="season-pill' + (s.season_number === activeSeasonNum ? " active" : "") + '" data-season-pill="' + s.season_number + '" data-id="' + id + '">Season ' + s.season_number + "</button>"
        ).join("");
        renderSeasonEpisodes(id, activeSeasonNum);
      }

      const yt = (m.videos?.results || []).filter((v) => v.site === "YouTube");
      const pick = yt.find((v) => v.type === "Trailer" && v.official) || yt.find((v) => v.type === "Trailer") || yt.find((v) => v.type === "Teaser");

      detailsBox.innerHTML =
        "<div>" + (m.poster_path ? '<img src="' + IMG + "w342" + m.poster_path + '" alt="Poster for ' + esc(title) + '">' : "") + "</div>" +
        '<div class="dt-info"><h2>' + esc(title) + "</h2>" +
        '<div class="meta">' + [year(relDate), run, m.vote_average ? "<b>" + ICONS.star + m.vote_average.toFixed(1) + "</b>" : "", "TMDB ID " + m.id, typeLabel(type)].filter(Boolean).join(" · ") + "</div>" +
        '<div class="actions wrap">' +
        (pick ? '<button class="pill-btn" data-trailer-player="' + pick.key + '" type="button">' + ICONS.play + "Official Trailer</button>" : "") +
        '<button class="pill-btn" data-fav data-full="1" data-type="' + type + '" data-id="' + id + '" type="button"></button>' +
        '<button class="pill-btn" data-open="share" type="button">' + ICONS.share + "Share</button></div>" +
        '<div id="player-trailer-box"></div>' +
        (m.tagline ? '<p class="tagline">' + esc(m.tagline) + "</p>" : "") +
        '<p class="overview">' + esc(m.overview || "No description available.") + "</p>" +
        '<div class="genres">' + (m.genres || []).map((g) => "<span>" + esc(g.name) + "</span>").join("") + "</div>" +
        buildExtraDetailsHtml(m) +
        "</div>";
      syncFav();
    } catch (err) {
      if (selectedId !== Number(id) || selectedType !== type) return;
      detailsBox.innerHTML = "<div></div><div><h2>TMDB ID " + id + '</h2><div class="meta">Details unavailable (' + esc(err.message) + ") but the player is loaded.</div></div>";
    }
  }

  function closePlayerScene() {
    if (playerModal.hidden) return;
    playerModal.hidden = true;
    player.src = "about:blank";
    if (playerBar) playerBar.innerHTML = "";
    detailsBox.innerHTML = "";
    if (epGrid) epGrid.innerHTML = "";
    if (seriesBrowser) seriesBrowser.hidden = true;
    selectedId = null;
    if (!isOverlayOpen()) {
      document.body.classList.remove("no-scroll");
      setVideo(currentKey);
    }
  }

  // ---------------- Detail Modal ----------------
  let current = null;
  async function openDetail(type, id) {
    const body = $("#dt-body");
    body.innerHTML = spinner; openOverlay("detail");
    try {
      const m = await api("/" + type + "/" + id, { append_to_response: "videos,credits,watch/providers" });
      current = norm({ ...m, media_type: type }, type);
      const saved = getSavedProgress(type, id);
      const watchBtnText = saved
        ? (type === "tv" ? "Continue S" + (saved.season || 1) + ":E" + (saved.episode || 1) : "Continue (" + fmtTime(saved.currentTime) + ")")
        : "Watch Now";

      const yt = (m.videos?.results || []).filter((v) => v.site === "YouTube");
      const pick = yt.find((v) => v.type === "Trailer" && v.official) || yt.find((v) => v.type === "Trailer") || yt.find((v) => v.type === "Teaser");
      const run = type === "tv"
        ? (m.number_of_seasons ? m.number_of_seasons + (m.number_of_seasons > 1 ? " seasons" : " season") : "")
        : (m.runtime ? m.runtime + " min" : "");

      body.innerHTML =
        '<div class="dt-grid"><div class="dt-poster">' + (m.poster_path ? '<img src="' + IMG + "w500" + m.poster_path + '" alt="Poster for ' + esc(current.title) + '">' : "") + "</div>" +
        '<div class="dt-info"><h2>' + esc(current.title) + "</h2>" +
        '<div class="meta">' + [year(current.date), run, current.rating ? "<b>" + ICONS.star + current.rating.toFixed(1) + "</b>" : "", "TMDB ID " + m.id, typeLabel(type)].filter(Boolean).join(" · ") + "</div>" +
        '<div class="actions wrap">' +
        '<button class="pill-btn strong" data-watch data-type="' + type + '" data-id="' + id + '" type="button">' + ICONS.play + esc(watchBtnText) + "</button>" +
        (pick ? '<button class="pill-btn" data-trailer="' + pick.key + '" type="button">' + ICONS.play + "Trailer</button>" : "") +
        '<button class="pill-btn" data-fav data-full="1" data-type="' + type + '" data-id="' + id + '" type="button"></button>' +
        '<button class="pill-btn" data-open="share" type="button">' + ICONS.share + "Share</button></div>" +
        '<div id="dt-trailer"></div>' +
        (m.tagline ? '<p class="tagline">' + esc(m.tagline) + "</p>" : "") +
        '<p class="overview">' + esc(m.overview || "No description available.") + "</p>" +
        '<div class="genres">' + (m.genres || []).map((g) => "<span>" + esc(g.name) + "</span>").join("") + "</div>" +
        buildExtraDetailsHtml(m) +
        "</div></div>";
      syncFav();
    } catch (err) { body.innerHTML = stateHtml(esc(err.message), "error"); }
  }

  // ---------------- Overlays ----------------
  function openOverlay(id) {
    $$(".overlay").forEach((o) => { if (o.id !== id && !(id === "share" && o.id === "detail")) o.hidden = true; });
    $("#" + id).hidden = false; document.body.classList.add("no-scroll");
    setVideo(null);
    const c = $("#" + id + " .close"); if (c) c.focus();
  }
  function closeOverlay(o) {
    o.hidden = true;
    if (o.id === "detail") $("#dt-body").innerHTML = "";
    if (!isOverlayOpen()) {
      document.body.classList.remove("no-scroll");
      setVideo(currentKey);
    }
  }
  const closeOverlays = () => {
    $$(".overlay").forEach(closeOverlay);
    closePlayerScene();
  };

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
  function hideIntro() {
    document.body.classList.add("ready"); intro.classList.add("leaving");
    setTimeout(() => {
      intro.hidden = true;
      if (!isOverlayOpen()) {
        document.body.classList.remove("no-scroll");
        setVideo(currentKey);
      }
    }, 800);
    try { sessionStorage.setItem("thrilx-intro", "1"); } catch { /* ignore */ }
  }
  let seen = false;
  try { seen = sessionStorage.getItem("thrilx-intro") === "1"; } catch { /* ignore */ }
  if (seen) {
    intro.hidden = true;
    document.body.classList.add("ready");
  } else {
    document.body.classList.add("no-scroll");
  }
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
  $("#close-player").addEventListener("click", closePlayerScene);

  // Optional Topbar Scene Switcher inside #player-modal
  $("#player-home-logo")?.addEventListener("click", (e) => { e.preventDefault(); closePlayerScene(); showView("discover"); });
  $("#scene-home")?.addEventListener("click", () => { closePlayerScene(); });
  $("#scene-details")?.addEventListener("click", () => {
    if (!selectedId) return;
    const t = selectedType, i = selectedId;
    closePlayerScene();
    openDetail(t, i);
  });
  $("#scene-player")?.addEventListener("click", () => {
    playerModal.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlays(); });
  window.addEventListener("scroll", () => $("#topbar").classList.toggle("scrolled", window.scrollY > 40), { passive: true });
  $$(".overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) closeOverlay(o); }));

  document.addEventListener("click", (e) => {
    const t = e.target;
    const v = t.closest("[data-view]"); if (v) return showView(v.dataset.view);
    if (t.closest("[data-close]")) return closeOverlay(t.closest(".overlay"));
    const op = t.closest("[data-open]"); if (op) return openOverlay(op.dataset.open);
    if (t.closest("[data-mute]")) return toggleMute();

    if (t.id === "cw-clear-all") {
      saveContinueList([]);
      refreshContinueRowDom();
      return;
    }
    const cwRem = t.closest("[data-cw-remove]");
    if (cwRem) {
      e.stopPropagation();
      removeContinueItem(cwRem.dataset.type, Number(cwRem.dataset.id));
      return;
    }

    const sPill = t.closest("[data-season-pill]");
    if (sPill) {
      renderSeasonEpisodes(Number(sPill.dataset.id), Number(sPill.dataset.seasonPill));
      return;
    }

    const epCard = t.closest("[data-ep-select]");
    if (epCard) {
      const tvId = Number(epCard.dataset.id);
      const sNum = Number(epCard.dataset.season);
      const eNum = Number(epCard.dataset.episode);
      loadEmbedSrc("tv", tvId, sNum, eNum);
      playerModal.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const fav = t.closest("[data-fav]");
    if (fav) {
      const id = Number(fav.dataset.id), type = fav.dataset.type;
      const it = current && current.id === id && current.type === type ? current : slides.find((s) => s.id === id && s.type === type) || getList().find((x) => x.id === id && x.type === type);
      return it && toggleFav(it);
    }
    const watch = t.closest("[data-watch]");
    if (watch) {
      const s = watch.dataset.season ? Number(watch.dataset.season) : null;
      const ep = watch.dataset.episode ? Number(watch.dataset.episode) : null;
      openPlayerScene(watch.dataset.type, Number(watch.dataset.id), s, ep);
      return;
    }
    const tr = t.closest("[data-trailer]");
    if (tr) {
      $("#dt-trailer").innerHTML = '<div class="trailer"><iframe title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowfullscreen src="https://www.youtube-nocookie.com/embed/' +
        encodeURIComponent(tr.dataset.trailer) + '?autoplay=1&rel=0"></iframe></div>';
      return;
    }
    const trPlayer = t.closest("[data-trailer-player]");
    if (trPlayer) {
      const box = $("#player-trailer-box");
      if (box) {
        box.innerHTML = '<div class="trailer"><iframe title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowfullscreen src="https://www.youtube-nocookie.com/embed/' +
          encodeURIComponent(trPlayer.dataset.trailerPlayer) + '?autoplay=1&rel=0"></iframe></div>';
      }
      return;
    }
    const sl = t.closest("[data-slide]"); if (sl) { showSlide(Number(sl.dataset.slide)); return startTimer(); }
    const d = t.closest("[data-detail]"); if (d) return openDetail(d.dataset.type, Number(d.dataset.id));
  });

  syncFav();
  showView("discover");
})();
