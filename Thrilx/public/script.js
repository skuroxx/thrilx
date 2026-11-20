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

  // Watch together: query param the embed uses to start at a given second.
  // If resumed rooms restart from 0:00, change this to the name your player expects (e.g. "startAt" or "t").
  const START_PARAM = "progress";

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
    users: svg(line('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>')),
    pause: svg('<path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/>'),
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
    if (view === "discover" && playerModal.hidden) refreshContinueRowDom();
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
    const label = item.currentTime ? "Saved at " + fmtTime(item.currentTime) : "";
    progressPill.textContent = label;
    progressPill.hidden = !label;
  }

  // Listen for iframe progress messages from vidstuck.cc
  window.addEventListener("message", function (event) {
    if (typeof event.data !== "string") return;
    try {
      const data = JSON.parse(event.data);
      if (!selectedId || playerModal.hidden || /youtube/.test(event.origin)) return;

      const payload = data.data || data;
      const currentTime = Number(payload.currentTime ?? payload.time ?? payload.progress ?? payload.watched ?? 0);
      const duration = Number(payload.duration ?? payload.total ?? 0);
      const season = Number(payload.season ?? activeSeasonNum ?? 1);
      const episode = Number(payload.episode ?? activeEpisodeNum ?? 1);

      // Watch together: remember the real playback position (only from our own player frame)
      if (party.active && !party.hold && event.source === player.contentWindow && payload.event !== "ended") {
        const pos = Number(payload.currentTime ?? payload.time);
        if (Number.isFinite(pos) && pos >= 0) party.time = pos;
      }

      if ((currentTime > 0 || duration > 0 || payload.event === "timeupdate" || payload.type === "MEDIA_DATA") && Date.now() - lastSave > 4000) {
        lastSave = Date.now();
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
        ? (it.duration > 0 ? Math.max(1, Math.round((it.duration - it.currentTime) / 60)) + "m left" : fmtTime(it.currentTime))
        : "Resume";

      return (
        '<div class="cw-card">' +
        '<button class="cw-remove" type="button" data-cw-remove data-type="' + esc(it.type) + '" data-id="' + it.id + '" aria-label="Remove from Continue Watching">' + ICONS.x + "</button>" +
        '<button class="cw-main" type="button" data-watch data-type="' + esc(it.type) + '" data-id="' + it.id + '" data-season="' + (it.season || 1) + '" data-episode="' + (it.episode || 1) + '">' +
        '<div class="cw-thumb">' +
        (imgPath ? '<img loading="lazy" src="' + imgPath + '" alt="">' : "") +
        '<div class="cw-shade"></div>' +
        '<div class="cw-play-badge" style="--p:' + pct + '">' + ICONS.play + "</div>" +
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
      '<div class="card-info"><div class="card-title" title="' + esc(m.title) + '">' + esc(m.title) + '</div><div class="card-sub">' + year(m.date) + " · " + typeLabel(m.type) + "</div></div></button>";
  }
  const rowHtml = (title, list) => {
    const ranked = /^(Trending|Popular)/.test(title);
    const items = ranked
      ? list.slice(0, 10).map((m, i) => '<div class="rank-item"><span class="rank-num" aria-hidden="true">' + (i + 1) + "</span>" + cardHtml(m, i) + "</div>").join("")
      : list.map(cardHtml).join("");
    return '<div class="row"><h3 class="row-title">' + esc(title) + (ranked ? ' <small class="row-note">Top 10</small>' : "") + '</h3><div class="row-scroll">' + items + "</div></div>";
  };
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

  let view = "discover", token = 0, lastSave = 0;

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
    window.scrollTo({ top: 0, behavior: "instant" });

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
      window.scrollTo({ top: 0, behavior: "instant" });
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
      const d = await api("/" + type + "/" + id + "/videos", { include_video_language: "en,hi,ja,ko,es,null" });
      const yt = (d.results || []).filter((v) => v.site === "YouTube" && v.key);
      const rank = (v) => (v.type === "Trailer" ? (v.official ? 0 : 1) : v.type === "Teaser" ? 2 : 3);
      const keys = [...new Set(yt.sort((a, b) => rank(a) - rank(b)).map((v) => v.key))].slice(0, 4);
      return (trailerCache[cacheKey] = keys.length ? keys : null);
    } catch {
      return (trailerCache[cacheKey] = null);
    }
  }

  let ytPlayer = null, ytReady = false, ytKeys = [], ytTry = 0, ytTimer = null, ytSig = "";
  function loadYT() {
    if (window.YT && YT.Player) return Promise.resolve();
    return new Promise((res) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
      if (!$("script[data-yt]")) {
        const t = document.createElement("script");
        t.src = "https://www.youtube.com/iframe_api"; t.dataset.yt = "1"; document.head.appendChild(t);
      }
    });
  }
  function playKey() {
    const k = ytKeys[ytTry];
    clearTimeout(ytTimer);
    if (!k) { $("#hero-video").classList.remove("on"); return; }
    ytPlayer.mute(); ytPlayer.loadVideoById(k);
    ytTimer = setTimeout(nextKey, 9000);
  }
  function nextKey() { ytTry++; playKey(); }
  function onYtState(e) {
    if (e.data === 1) { clearTimeout(ytTimer); $("#hero-video").classList.add("on"); updateMuteButton(); }
    else if (e.data === 0) { ytPlayer.seekTo(0); ytPlayer.playVideo(); }
  }

  function setVideo(keys) {
    const box = $("#hero-video");
    if (!box) return;
    const ok = keys && keys.length && !isOverlayOpen() && heroVisible && !hero.hidden;
    if (!ok) {
      box.classList.remove("on");
      if (ytReady) { try { ytPlayer.pauseVideo(); } catch { /* ignore */ } }
      if (!keys) ytSig = "";
      updateMuteButton();
      return;
    }
    const sig = keys.join();
    if (ytSig === sig && ytReady) { try { ytPlayer.playVideo(); } catch { /* ignore */ } return; }
    ytSig = sig; ytKeys = keys; ytTry = 0; heroMuted = true;
    box.classList.remove("on"); updateMuteButton();
    loadYT().then(() => {
      if (ytSig !== sig) return;
      if (!ytPlayer) {
        box.insertAdjacentHTML("afterbegin", '<div id="yt-hero"></div>');
        ytPlayer = new YT.Player("yt-hero", {
          playerVars: { autoplay: 1, mute: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3, origin: location.origin },
          events: { onReady: () => { ytReady = true; playKey(); }, onStateChange: onYtState, onError: nextKey },
        });
      } else if (ytReady) playKey();
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
    if (!ytReady) return;
    heroMuted = !heroMuted;
    if (heroMuted) ytPlayer.mute(); else { ytPlayer.unMute(); ytPlayer.setVolume(100); }
    ytPlayer.playVideo();
    updateMuteButton();
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
      '<button class="pill-btn" data-hero-trailer type="button" hidden>' + ICONS.play + "Trailer</button>" +
      '<button class="pill-btn" data-detail data-type="' + m.type + '" data-id="' + m.id + '" type="button">Details</button>' +
      '<button class="btn-round" data-fav data-type="' + m.type + '" data-id="' + m.id + '" type="button" aria-label="Toggle my list">' + ICONS.heart + "</button>" +
      '<button class="btn-round" data-mute type="button" aria-label="Unmute trailer">' + ICONS.mute + "</button></div>";
    const next = [1, 2, 3, 4].map((n) => (idx + n) % slides.length).filter((n) => n !== idx);
    $("#hero-list").innerHTML = next.map((n) => {
      const s = slides[n];
      return '<button class="hl-item" data-slide="' + n + '" type="button">' + (s.poster ? '<img src="' + IMG + "w92" + s.poster + '" alt="">' : "") +
        '<span><b title="' + esc(s.title) + '">' + esc(s.title) + "</b><small>" + year(s.date) + " · " + typeLabel(s.type) + "</small></span></button>";
    }).join("");
    $$(".dot").forEach((d, n) => d.classList.toggle("active", n === idx));
    syncFav();

    currentKey = null;
    setVideo(null);
    const key = await getTrailer(m.type, m.id);
    if (idx !== activeIdx) return;
    currentKey = key;
    const htb = $("[data-hero-trailer]"); if (htb) htb.hidden = !key;
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
  let activeSeasonNum = 1, activeEpisodeNum = 1, browseSeason = 1, browseTok = 0;
  const seasonCache = {};

  const trailerKeys = (yt) => {
    const rank = (v) => (v.type === "Trailer" ? (v.official ? 0 : 1) : v.type === "Teaser" ? 2 : 3);
    return [...new Set([...yt].sort((a, b) => rank(a) - rank(b)).map((v) => v.key))].slice(0, 4);
  };
  function buildEmbedUrl(type, id, season = 1, episode = 1, start = 0) {
    const cleanId = parseInt(id, 10);
    let url = type === "tv"
      ? EMBED_BASE + "/tv/" + cleanId + "/" + parseInt(season, 10) + "/" + parseInt(episode, 10) + "?" + TV_EMBED_PARAMS
      : EMBED_BASE + "/movie/" + cleanId + "?" + MOVIE_EMBED_PARAMS;
    if (start >= 3) url += "&" + START_PARAM + "=" + Math.floor(start) + "&autoPlay=true";
    return url;
  }

  function loadEmbedSrc(type, id, season = 1, episode = 1, start = 0) {
    activeSeasonNum = Number(season) || 1;
    activeEpisodeNum = Number(episode) || 1;
    party.time = start > 0 ? Number(start) : 0;

    const src = buildEmbedUrl(type, id, activeSeasonNum, activeEpisodeNum, start);
    playerLoading.classList.remove("hidden");
    player.onload = () => playerLoading.classList.add("hidden");
    player.src = src;

    if (playerBar) {
      const pt = current && Number(current.id) === Number(id) && current.type === type ? esc(current.title) : "";
      playerBar.innerHTML = '<span class="pb-title">' + pt + "</span>" +
        '<span class="pb-sub">' + (type === "tv" ? "Season " + activeSeasonNum + " \u00b7 Episode " + activeEpisodeNum : "Feature film") + "</span>";
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

    if (current && Number(current.id) === Number(id) && current.type === type) {
      const prevSaved = getSavedProgress(type, id);
      const existing = type === "tv" ? prevSaved?.episodes?.["s" + activeSeasonNum + "e" + activeEpisodeNum] : prevSaved;
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
    browseSeason = Number(seasonNum); const bt = ++browseTok;
    if (seasonPills) {
      $$(".season-pill", seasonPills).forEach((b) => b.classList.toggle("active", Number(b.dataset.seasonPill) === browseSeason));
    }
    epGrid.innerHTML = '<div class="state"><div class="spinner"></div>Loading Season ' + browseSeason + " episodes…</div>";

    const cacheKey = tvId + ":" + browseSeason;
    let seasonData = seasonCache[cacheKey];
    if (!seasonData) {
      try {
        seasonData = await api("/tv/" + tvId + "/season/" + browseSeason);
        seasonCache[cacheKey] = seasonData;
      } catch {
        seasonData = null;
      }
    }

    if (bt !== browseTok) return;
    const episodes = seasonData?.episodes || [];
    const saved = getSavedProgress("tv", tvId);

    if (!episodes.length) {
      const fallbackInfo = playerSeasons.find((s) => s.season_number === browseSeason);
      const count = Math.max(1, fallbackInfo?.episode_count || 1);
      epGrid.innerHTML = Array.from({ length: count }, (_, i) => i + 1).map((epNum) => {
        const isPlaying = browseSeason === activeSeasonNum && activeEpisodeNum === epNum;
        return (
          '<button type="button" class="ep-card' + (isPlaying ? " active" : "") + '" data-ep-select data-id="' + tvId + '" data-season="' + browseSeason + '" data-episode="' + epNum + '">' +
          '<div class="ep-body"><div class="ep-title">Episode ' + epNum + '</div><div class="ep-desc">Click to play Season ' + browseSeason + ", Episode " + epNum + "</div></div></button>"
        );
      }).join("");
      return;
    }

    if (seriesEpSummary) {
      seriesEpSummary.textContent = "Season " + browseSeason + " · " + episodes.length + (episodes.length === 1 ? " Episode" : " Episodes");
    }

    epGrid.innerHTML = episodes.map((ep) => {
      const epNum = ep.episode_number;
      const isPlaying = browseSeason === activeSeasonNum && activeEpisodeNum === epNum;
      const thumb = ep.still_path
        ? '<img loading="lazy" src="' + IMG + "w300" + ep.still_path + '" alt="">'
        : (current?.backdrop ? '<img loading="lazy" src="' + IMG + "w300" + current.backdrop + '" alt="">' : "");
      const epSaved = saved?.episodes?.["s" + browseSeason + "e" + epNum];
      const pct = epSaved && epSaved.duration > 0 ? Math.min(98, Math.max(8, Math.round((epSaved.currentTime / epSaved.duration) * 100))) : 0;

      return (
        '<button type="button" class="ep-card' + (isPlaying ? " active" : "") + '" data-ep-select data-id="' + tvId + '" data-season="' + browseSeason + '" data-episode="' + epNum + '">' +
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

  async function openPlayerScene(type, id, initSeason = null, initEpisode = null, startAt = 0) {
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
    loadEmbedSrc(type, id, startSeason, startEpisode, startAt);
    detailsBox.innerHTML = '<div></div><div class="meta">Loading details…</div>';

    try {
      const m = await api("/" + type + "/" + id, { append_to_response: "videos,credits,watch/providers", include_video_language: "en,hi,ja,ko,es,null" });
      if (selectedId !== Number(id) || selectedType !== type) return;

      current = norm({ ...m, media_type: type }, type);
      const title = current.title;
      const pbt = $(".pb-title"); if (pbt) pbt.textContent = title;
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
      const pick = trailerKeys(yt);

      detailsBox.innerHTML =
        "<div>" + (m.poster_path ? '<img src="' + IMG + "w342" + m.poster_path + '" alt="Poster for ' + esc(title) + '">' : "") + "</div>" +
        '<div class="dt-info"><h2>' + esc(title) + "</h2>" +
        '<div class="meta">' + [year(relDate), run, m.vote_average ? "<b>" + ICONS.star + m.vote_average.toFixed(1) + "</b>" : "", "TMDB ID " + m.id, typeLabel(type)].filter(Boolean).join(" · ") + "</div>" +
        '<div class="actions wrap">' +
        (pick.length ? '<button class="pill-btn" data-trailer-player="' + pick.join() + '" type="button">' + ICONS.play + "Official Trailer</button>" : "") +
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
    if (party.active) partyLeave();
    player.src = "about:blank";
    if (playerBar) playerBar.innerHTML = "";
    detailsBox.innerHTML = "";
    if (epGrid) epGrid.innerHTML = "";
    if (seriesBrowser) seriesBrowser.hidden = true;
    selectedId = null;
    if (view === "discover") refreshContinueRowDom();
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
      const m = await api("/" + type + "/" + id, { append_to_response: "videos,credits,watch/providers", include_video_language: "en,hi,ja,ko,es,null" });
      current = norm({ ...m, media_type: type }, type);
      const saved = getSavedProgress(type, id);
      const watchBtnText = saved
        ? (type === "tv" ? "Continue S" + (saved.season || 1) + ":E" + (saved.episode || 1) : "Continue (" + fmtTime(saved.currentTime) + ")")
        : "Watch Now";

      const yt = (m.videos?.results || []).filter((v) => v.site === "YouTube");
      const pick = trailerKeys(yt);
      const run = type === "tv"
        ? (m.number_of_seasons ? m.number_of_seasons + (m.number_of_seasons > 1 ? " seasons" : " season") : "")
        : (m.runtime ? m.runtime + " min" : "");

      body.innerHTML =
        '<div class="dt-grid"><div class="dt-poster">' + (m.poster_path ? '<img src="' + IMG + "w500" + m.poster_path + '" alt="Poster for ' + esc(current.title) + '">' : "") + "</div>" +
        '<div class="dt-info"><h2>' + esc(current.title) + "</h2>" +
        '<div class="meta">' + [year(current.date), run, current.rating ? "<b>" + ICONS.star + current.rating.toFixed(1) + "</b>" : "", "TMDB ID " + m.id, typeLabel(type)].filter(Boolean).join(" · ") + "</div>" +
        '<div class="actions wrap">' +
        '<button class="pill-btn strong" data-watch data-type="' + type + '" data-id="' + id + '" type="button">' + ICONS.play + esc(watchBtnText) + "</button>" +
        (pick.length ? '<button class="pill-btn" data-trailer="' + pick.join() + '" type="button">' + ICONS.play + "Trailer</button>" : "") +
        '<button class="pill-btn" data-fav data-full="1" data-type="' + type + '" data-id="' + id + '" type="button"></button>' +
        '<button class="pill-btn" data-party-host data-type="' + type + '" data-id="' + id + '" type="button">' + ICONS.users + "Watch together</button>" +
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

  // ---------------- Trailer lightbox ----------------
  let trPlayer = null, trKeys = [], trI = 0;
  function trPlay() {
    const msg = $("#tr-msg");
    if (trI >= trKeys.length) {
      msg.innerHTML = 'This trailer can\u2019t be embedded. <a href="https://www.youtube.com/watch?v=' + encodeURIComponent(trKeys[0]) + '" target="_blank" rel="noopener">Watch it on YouTube</a>';
      return;
    }
    msg.textContent = "";
    trPlayer.loadVideoById(trKeys[trI]);
  }
  function openTrailer(keys) {
    if (!keys || !keys.length) return;
    if (!$("#trailer-ov")) {
      document.body.insertAdjacentHTML("beforeend", '<div class="overlay" id="trailer-ov" hidden><div class="panel trailer-panel" role="dialog" aria-modal="true" aria-label="Trailer"><button class="close" type="button" data-close aria-label="Close">' + ICONS.x + '</button><div class="trailer"><div id="tr-yt"></div></div><p class="meta" id="tr-msg" role="status"></p></div></div>');
      const o = $("#trailer-ov");
      o.addEventListener("click", (e) => { if (e.target === o) closeOverlay(o); });
    }
    trKeys = keys; trI = 0;
    openOverlay("trailer-ov");
    loadYT().then(() => {
      if (trPlayer) return trPlay();
      trPlayer = new YT.Player("tr-yt", {
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, origin: location.origin },
        events: { onReady: trPlay, onError: () => { trI++; trPlay(); } },
      });
    });
  }

  // ---------------- Overlays ----------------
  function openOverlay(id) {
    $$(".overlay").forEach((o) => { if (o.id !== id && !((id === "share" || id === "trailer-ov") && o.id === "detail")) o.hidden = true; });
    $("#" + id).hidden = false; document.body.classList.add("no-scroll");
    setVideo(null);
    const c = $("#" + id + " .close"); if (c) c.focus();
  }
  function closeOverlay(o) {
    o.hidden = true;
    if (o.id === "trailer-ov" && trPlayer) { try { trPlayer.stopVideo(); } catch { /* ignore */ } }
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
  const introBg = $("#intro-bg");
  if (introBg) {
    const word = "Thril<b>x</b> ";
    introBg.innerHTML = Array.from({ length: 7 }, (_, i) =>
      '<div class="ib-row' + (i % 2 ? " rev" : "") + '" style="--s:' + (46 + i * 7) + 's"><span>' + word.repeat(7) + '</span><span aria-hidden="true">' + word.repeat(7) + "</span></div>").join("");
    intro.addEventListener("pointermove", (e) => {
      introBg.style.setProperty("--px", ((e.clientX / innerWidth - .5) * 40).toFixed(1) + "px");
      introBg.style.setProperty("--py", ((e.clientY / innerHeight - .5) * 24).toFixed(1) + "px");
    });
  }
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
  if (seen || roomFromUrl()) {
    intro.hidden = true;
    document.body.classList.add("ready");
  } else {
    document.body.classList.add("no-scroll");
  }
  $("#enter").addEventListener("click", hideIntro);
  $("#skip-intro").addEventListener("click", hideIntro);

  // ---------------------------------------------------------------
  // WATCH TOGETHER
  // Peer-to-peer over WebRTC (PeerJS). The host's browser is the hub, so no server
  // code or database is needed and it works on Vercel's static hosting.
  //
  // Rules of the room:
  //  - Anyone with the link can join and starts at the host's current position.
  //  - If anyone leaves (or drops), everyone is paused. When they rejoin, everyone
  //    resumes from the same second. The host can also "continue without them".
  //  - Picking an episode switches it for the whole room.
  // The embedded player is cross-origin and can't be remote-controlled, so "pause"
  // stops the player and covers it, and "resume" reloads it at the saved second.
  // ---------------------------------------------------------------
  const PEER_LIB = "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js";
  const PEER_PREFIX = "thrilx-room-";
  const PING_MS = 4000, TIMEOUT_MS = 15000, MAX_GUESTS = 11;
  const NAME_KEY = "thrilx-name";

  const party = {
    active: false, role: null, room: null, me: "",
    peer: null, conn: null,     // conn is the guest's link to the host
    book: new Map(),            // host only: name key -> { name, host, status, conn, lastSeen }
    members: [],                // what the UI shows: [{ name, host, status }]
    hold: null,                 // { names, time } while paused for someone who left
    time: 0,                    // last known playback position in seconds
    lastPong: 0, timers: [], busy: false, error: "", joinRoom: null,
  };

  const partyKey = (n) => String(n).trim().toLowerCase();
  const cleanName = (n) => String(n || "").replace(/\s+/g, " ").trim().slice(0, 24) || "Guest";
  const clampInt = (v) => { const n = Math.floor(Number(v)); return n >= 1 && n <= 999 ? n : 0; };
  const send = (conn, msg) => { try { if (conn && conn.open) conn.send(msg); } catch { /* ignore */ } };
  const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };
  const rememberName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
  const roomLink = () => location.origin + location.pathname + "?room=" + party.room;
  const listNames = (n) => (n.length > 2 ? n.slice(0, 2).join(", ") + " and " + (n.length - 2) + " more" : n.join(" and "));

  function roomFromUrl() {
    const r = new URLSearchParams(location.search).get("room");
    return r && /^[A-Za-z0-9]{4,12}$/.test(r) ? r.toUpperCase() : null;
  }
  function genRoomId() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    return [...buf].map((b) => chars[b % chars.length]).join("");
  }

  let toastTimer = 0;
  function toast(text) {
    if (!text) return;
    let el = $("#toast");
    if (!el) { document.body.insertAdjacentHTML("beforeend", '<div id="toast" class="toast" role="status" aria-live="polite"></div>'); el = $("#toast"); }
    el.textContent = text; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
  }

  function loadPeerLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PEER_LIB; s.onload = resolve;
      s.onerror = () => { const e = new Error("lib"); e.friendly = "Couldn't load the room service. Check your connection and try again."; reject(e); };
      document.head.appendChild(s);
    });
  }

  function confirmLeaveRoom() {
    if (!party.active) return true;
    return confirm(party.role === "host"
      ? "Closing the player ends the room for everyone. Continue?"
      : "Leave the room? Everyone else will be paused until you rejoin.");
  }

  // ----- Pause for everyone / resume -----
  function renderHold() {
    const box = $("#party-hold"); if (!box) return;
    box.hidden = !party.hold;
    if (!party.hold) return;
    $("#hold-sub").textContent = "Waiting for " + listNames(party.hold.names) + " to rejoin.";
    $("#hold-time").textContent = party.hold.time >= 3 ? "Picks up from " + fmtTime(party.hold.time) : "Starts from the beginning";
    $("#hold-skip").hidden = party.role !== "host";
  }
  function holdOn(names, time) {
    const first = !party.hold;
    party.hold = { names, time };
    party.time = time;
    if (first) player.src = "about:blank"; // stops the video and its sound
    renderHold(); updatePartyUI();
  }
  function holdOff(time) {
    party.hold = null;
    renderHold();
    if (selectedId && !playerModal.hidden) loadEmbedSrc(selectedType, selectedId, activeSeasonNum, activeEpisodeNum, time);
    updatePartyUI();
  }

  // ----- Episode changes are shared -----
  function applyNav(s, e) {
    if (!selectedId || selectedType !== "tv") return;
    loadEmbedSrc("tv", selectedId, s, e);
    if (party.hold) { player.src = "about:blank"; party.hold.time = 0; renderHold(); }
    if (browseSeason !== s) renderSeasonEpisodes(selectedId, s);
  }
  function partyNavLocal(s, e) {
    if (!party.active) return;
    if (party.role === "host") hostBroadcast({ t: "nav", season: s, episode: e });
    else send(party.conn, { t: "nav", season: s, episode: e });
  }

  // ----- Host -----
  const hostMembers = () => [...party.book.values()].map((m) => ({ name: m.name, host: !!m.host, status: m.status }));
  function hostBroadcast(msg, except) { party.book.forEach((m) => { if (m.conn && m.conn !== except) send(m.conn, msg); }); }
  function hostSync() { party.members = hostMembers(); hostBroadcast({ t: "members", members: party.members }); updatePartyUI(); }

  // Pause while anyone is away; resume once everyone is back.
  function hostRecompute() {
    const away = [...party.book.values()].filter((m) => !m.host && m.status === "away").map((m) => m.name);
    if (away.length) {
      const time = party.hold ? party.hold.time : party.time;
      hostBroadcast({ t: "hold", names: away, time });
      holdOn(away, time);
    } else if (party.hold) {
      const time = party.hold.time;
      hostBroadcast({ t: "resume", time });
      holdOff(time);
    }
  }

  function hostMarkAway(m) {
    if (m.status !== "online") return;
    const c = m.conn; m.status = "away"; m.conn = null;
    try { if (c) c.close(); } catch { /* ignore */ }
    const text = m.name + " left";
    toast(text); hostBroadcast({ t: "toast", text });
    hostRecompute(); hostSync();
  }

  function hostSkipAway() {
    [...party.book].forEach(([k, m]) => { if (!m.host && m.status === "away") party.book.delete(k); });
    hostRecompute(); hostSync();
  }

  function hostOnHello(conn, msg) {
    if (conn.memberKey) return;
    let name = cleanName(msg.name), key = partyKey(name);
    const prev = party.book.get(key);
    const comeBack = !!prev && !prev.host && prev.status === "away";
    if (!comeBack) {
      const online = [...party.book.values()].filter((m) => !m.host && m.status === "online").length;
      if (online >= MAX_GUESTS) { send(conn, { t: "full" }); setTimeout(() => { try { conn.close(); } catch { /* ignore */ } }, 300); return; }
      if (prev) { let n = 2; while (party.book.has(partyKey(name + " (" + n + ")"))) n++; name += " (" + n + ")"; key = partyKey(name); }
    }
    const m = comeBack ? prev : { name, host: false };
    m.status = "online"; m.conn = conn; m.lastSeen = Date.now();
    conn.memberKey = key;
    party.book.set(key, m);

    send(conn, {
      t: "welcome", you: m.name, members: hostMembers(), hold: party.hold,
      state: { type: selectedType, id: selectedId, season: activeSeasonNum, episode: activeEpisodeNum, time: party.hold ? party.hold.time : party.time },
    });
    const text = m.name + (comeBack ? " is back" : " joined");
    toast(text); hostBroadcast({ t: "toast", text }, conn);
    hostRecompute(); hostSync();
  }

  function hostOnMessage(conn, msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "hello") return hostOnHello(conn, msg);
    const m = party.book.get(conn.memberKey);
    if (!m || m.conn !== conn) return;
    m.lastSeen = Date.now();
    if (msg.t === "ping") send(conn, { t: "pong" });
    else if (msg.t === "bye") hostMarkAway(m);
    else if (msg.t === "nav" && selectedType === "tv") {
      const s = clampInt(msg.season), e = clampInt(msg.episode);
      if (s && e) { hostBroadcast({ t: "nav", season: s, episode: e }, conn); applyNav(s, e); }
    }
  }

  function hostOnClose(conn) {
    const m = party.book.get(conn.memberKey);
    if (m && m.conn === conn) hostMarkAway(m);
  }

  function hostWatchdog() {
    const now = Date.now();
    party.book.forEach((m) => { if (!m.host && m.status === "online" && now - m.lastSeen > TIMEOUT_MS) hostMarkAway(m); });
  }

  function openHostPeer(room, name) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(PEER_PREFIX + room, { debug: 0 });
      let opened = false;
      peer.on("open", () => {
        opened = true;
        party.peer = peer; party.room = room; party.role = "host"; party.active = true; party.me = name; party.hold = null;
        party.book.clear();
        party.book.set(partyKey(name), { name, host: true, status: "online", conn: null, lastSeen: Date.now() });
        party.members = hostMembers();
        party.timers.push(setInterval(hostWatchdog, 3000));
        peer.on("connection", (conn) => {
          conn.on("data", (msg) => hostOnMessage(conn, msg));
          conn.on("close", () => hostOnClose(conn));
          conn.on("error", () => hostOnClose(conn));
        });
        resolve();
      });
      peer.on("error", (e) => { if (!opened) { try { peer.destroy(); } catch { /* ignore */ } reject(e); } });
      peer.on("disconnected", () => { if (opened) { try { peer.reconnect(); } catch { /* ignore */ } } });
    });
  }

  async function partyCreate(name) {
    if (party.busy || party.active) return;
    if (!selectedId) { party.error = "Open a movie or episode first."; return updatePartyUI(true); }
    party.busy = true; party.error = ""; updatePartyUI(true);
    try {
      await loadPeerLib();
      let ok = false;
      for (let i = 0; i < 4 && !ok; i++) {
        try { await openHostPeer(genRoomId(), name); ok = true; }
        catch (e) { if (!e || e.type !== "unavailable-id") throw e; }
      }
      if (!ok) throw new Error("retry");
      rememberName(name);
      toast("Room created. Share the link!");
    } catch (e) {
      party.error = e && e.friendly ? e.friendly : "Couldn't reach the room service. Check your connection and try again.";
    } finally { party.busy = false; updatePartyUI(true); }
  }

  // ----- Guest -----
  function guestOnWelcome(msg) {
    const s = msg.state || {};
    if ((s.type !== "movie" && s.type !== "tv") || !Number.isInteger(Number(s.id))) return guestFail("This room isn't ready yet. Try again in a moment.");
    party.active = true; party.role = "guest"; party.me = String(msg.you || ""); party.hold = null;
    party.members = Array.isArray(msg.members) ? msg.members : [];
    party.lastPong = Date.now();
    party.timers.push(setInterval(() => {
      send(party.conn, { t: "ping" });
      if (Date.now() - party.lastPong > TIMEOUT_MS) guestConnLost();
    }, PING_MS));
    openPlayerScene(s.type, Number(s.id), s.season, s.episode, Number(s.time) || 0);
    if (msg.hold && Array.isArray(msg.hold.names)) holdOn(msg.hold.names.map(String), Number(msg.hold.time) || 0);
    updatePartyUI();
    toast("You're in the room");
  }

  function guestOnMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    party.lastPong = Date.now();
    switch (msg.t) {
      case "members": party.members = Array.isArray(msg.members) ? msg.members : []; updatePartyUI(); break;
      case "hold": holdOn((Array.isArray(msg.names) ? msg.names : []).map(String), Number(msg.time) || 0); break;
      case "resume": holdOff(Number(msg.time) || 0); break;
      case "nav": { const s = clampInt(msg.season), e = clampInt(msg.episode); if (s && e) applyNav(s, e); break; }
      case "toast": toast(String(msg.text || "").slice(0, 80)); break;
      case "closed": toast("The host ended the room"); partyReset({ reload: true }); break;
      default: break;
    }
  }

  function guestConnLost() {
    if (!party.active || party.role !== "guest") return;
    const room = party.room;
    partyReset({ reload: true });
    toast("Disconnected from the room");
    openJoin(room, "Connection lost. Rejoin to keep watching together.");
  }

  function guestFail(text) { party.error = text; partyTeardown(); const s = $("#join-status"); if (s) s.textContent = text; }

  function partyJoin(room, name) {
    return loadPeerLib().then(() => new Promise((resolve, reject) => {
      partyTeardown();
      let settled = false, wait = 0;
      const fail = (text) => { if (settled) return; settled = true; clearTimeout(wait); partyTeardown(); const e = new Error(text); e.friendly = text; reject(e); };
      const peer = new Peer({ debug: 0 });
      party.peer = peer;
      wait = setTimeout(() => fail("Couldn't reach the room. Check the link, and ask the host to keep Thrilx open."), 15000);
      peer.on("error", (e) => fail(e && e.type === "peer-unavailable" ? "Room not found. It may have ended." : "Connection problem. Please try again."));
      peer.on("disconnected", () => { if (!settled) return; try { peer.reconnect(); } catch { /* ignore */ } });
      peer.on("open", () => {
        const conn = peer.connect(PEER_PREFIX + room, { reliable: true, serialization: "json" });
        party.conn = conn;
        conn.on("open", () => send(conn, { t: "hello", name }));
        conn.on("data", (msg) => {
          if (settled) return guestOnMessage(msg);
          if (msg && msg.t === "full") return fail("This room is full.");
          if (msg && msg.t === "welcome") {
            settled = true; clearTimeout(wait);
            party.room = room;
            guestOnWelcome(msg);
            resolve();
          }
        });
        conn.on("close", () => { if (settled) guestConnLost(); else fail("Couldn't join the room."); });
      });
    }));
  }

  // ----- Leaving / cleanup -----
  function partyTeardown(delay = 0) {
    party.timers.forEach(clearInterval); party.timers = [];
    const { peer, conn } = party;
    party.peer = null; party.conn = null; party.book = new Map();
    const close = () => { try { if (conn) conn.close(); } catch { /* ignore */ } try { if (peer) peer.destroy(); } catch { /* ignore */ } };
    if (delay) setTimeout(close, delay); else close();
  }

  function partyReset({ delay = 0, reload = false } = {}) {
    const hold = party.hold;
    partyTeardown(delay);
    Object.assign(party, { active: false, role: null, room: null, me: "", members: [], hold: null, error: "" });
    renderHold();
    if (reload && hold && selectedId && !playerModal.hidden) loadEmbedSrc(selectedType, selectedId, activeSeasonNum, activeEpisodeNum, hold.time);
    updatePartyUI(true);
  }

  function partyLeave() {
    if (!party.active) return;
    if (party.role === "host") hostBroadcast({ t: "closed" });
    else {
      send(party.conn, { t: "bye" });
      try { history.replaceState(null, "", location.pathname); } catch { /* ignore */ }
    }
    partyReset({ delay: 300, reload: !playerModal.hidden });
  }

  window.addEventListener("pagehide", () => {
    if (!party.active) return;
    if (party.role === "host") hostBroadcast({ t: "closed" }); else send(party.conn, { t: "bye" });
  });

  // ----- UI -----
  function renderPartyPanel(force) {
    const body = $("#party-body"); if (!body) return;
    const mode = party.active ? party.role : "idle";

    if (mode === "idle") {
      if (body.dataset.mode !== "idle" || force) {
        const typed = $("#party-name") ? $("#party-name").value : "";
        body.dataset.mode = "idle";
        body.innerHTML =
          "<h2>Watch together</h2>" +
          "<p>Create a room and share the link. Everyone watches the same title, and if someone leaves it pauses for all until they are back.</p>" +
          '<form class="party-form" data-pa-form="create">' +
          '<label class="sr" for="party-name">Your name</label>' +
          '<input id="party-name" type="text" maxlength="24" placeholder="Your name" autocomplete="nickname" required value="' + esc(typed || savedName()) + '"' + (party.busy ? " disabled" : "") + ">" +
          '<button class="btn-watch wide" type="submit"' + (party.busy ? " disabled" : "") + ">" + (party.busy ? "Creating room…" : "Create room") + "</button></form>" +
          '<p class="party-err" role="alert">' + esc(party.error) + "</p>";
      }
      return;
    }

    body.dataset.mode = mode;
    const rows = party.members.map((m) =>
      '<li class="' + (m.status === "away" ? "away" : "") + '"><span class="st"></span><span class="nm">' + esc(m.name) + "</span><small>" +
      (m.host ? "Host" : m.status === "away" ? "Away" : (m.name === party.me ? "You" : "")) + "</small></li>").join("");
    const hold = party.hold ? '<p class="party-note">Paused: waiting for ' + esc(listNames(party.hold.names)) + " to rejoin." + "</p>" : "";

    if (mode === "host") {
      body.innerHTML =
        "<h2>Your room</h2><p>Share this link. Anyone who opens it joins you.</p>" +
        '<div class="party-link"><input id="party-link" type="text" readonly aria-label="Room link" value="' + esc(roomLink()) + '"><button class="pill-btn" type="button" data-pa="copy">Copy</button></div>' +
        (navigator.share ? '<div class="party-actions"><button class="pill-btn" type="button" data-pa="share">' + ICONS.share + "Share link</button></div>" : "") +
        '<ul class="party-members">' + rows + "</ul>" + hold +
        '<div class="party-actions">' + (party.hold ? '<button class="pill-btn" type="button" data-pa="skip">Continue without them</button>' : "") +
        '<button class="pill-btn danger" type="button" data-pa="leave">End room</button></div>';
    } else {
      body.innerHTML =
        "<h2>In the room</h2><p>Room <b>" + esc(party.room) + "</b></p>" +
        '<ul class="party-members">' + rows + "</ul>" + hold +
        '<div class="party-actions"><button class="pill-btn danger" type="button" data-pa="leave">Leave room</button></div>';
    }
  }

  function updatePartyUI(force) {
    const btn = $("#party-btn");
    if (btn) {
      const n = party.members.filter((m) => m.status === "online").length;
      btn.classList.toggle("on", party.active);
      btn.innerHTML = ICONS.users + '<span class="lbl">' + (party.active ? "Room · " + n : "Watch together") + "</span>";
    }
    renderPartyPanel(force);
    renderHold();
  }

  function openJoin(room, note) {
    party.joinRoom = room;
    $("#join-room").textContent = room;
    $("#join-status").textContent = note || "";
    $("#join-name").value = savedName();
    openOverlay("join");
  }

  async function copyRoomLink() {
    try { await navigator.clipboard.writeText(roomLink()); toast("Link copied"); }
    catch {
      const i = $("#party-link");
      if (i) { i.select(); try { document.execCommand("copy"); toast("Link copied"); } catch { toast("Press Ctrl+C to copy the link"); } }
    }
  }

  $("#party").addEventListener("click", (e) => {
    const a = e.target.closest("[data-pa]"); if (!a) return;
    const act = a.dataset.pa;
    if (act === "copy") copyRoomLink();
    else if (act === "share") navigator.share({ title: "Watch with me on Thrilx", text: "Join my room on Thrilx" + (current ? " to watch " + current.title : ""), url: roomLink() }).catch(() => {});
    else if (act === "skip") hostSkipAway();
    else if (act === "leave") partyLeave();
  });
  $("#party").addEventListener("submit", (e) => {
    if (!e.target.closest("[data-pa-form]")) return;
    e.preventDefault();
    partyCreate(cleanName($("#party-name").value));
  });
  $("#hold-skip").addEventListener("click", hostSkipAway);

  $("#join-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (party.busy || !party.joinRoom) return;
    const name = cleanName($("#join-name").value), status = $("#join-status"), go = $("#join-go");
    party.busy = true; go.disabled = true; status.textContent = "Joining…";
    partyJoin(party.joinRoom, name)
      .then(() => { rememberName(name); try { history.replaceState(null, "", "?room=" + party.joinRoom); } catch { /* ignore */ } })
      .catch((err) => { status.textContent = err && err.friendly ? err.friendly : "Couldn't join the room. Please try again."; })
      .finally(() => { party.busy = false; go.disabled = false; });
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#party-btn")) { updatePartyUI(true); return openOverlay("party"); }
    const ph = e.target.closest("[data-party-host]");
    if (ph) { openPlayerScene(ph.dataset.type, Number(ph.dataset.id)); updatePartyUI(true); openOverlay("party"); }
  });

  // ---------------- Events ----------------
  $("#contact-mail").textContent = CONTACT; $("#contact-mail").href = "mailto:" + CONTACT;
  $("#search-form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#query").value.trim(); if (q) search(q); });
  $("#open-list").addEventListener("click", () => showView("list"));
  $("#open-menu").addEventListener("click", () => openOverlay("menu"));
  $("#home-link").addEventListener("click", (e) => { e.preventDefault(); showView("discover"); });
  $("#to-top").addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "instant" }); });
  $("#hero-prev").addEventListener("click", () => { showSlide(idx - 1); startTimer(); });
  $("#hero-next").addEventListener("click", () => { showSlide(idx + 1); startTimer(); });
  $("#close-player").addEventListener("click", () => { if (confirmLeaveRoom()) closePlayerScene(); });

  // Optional Topbar Scene Switcher inside #player-modal
  $("#player-home-logo")?.addEventListener("click", (e) => { e.preventDefault(); if (!confirmLeaveRoom()) return; closePlayerScene(); showView("discover"); });
  $("#scene-home")?.addEventListener("click", () => { if (confirmLeaveRoom()) closePlayerScene(); });
  $("#scene-details")?.addEventListener("click", () => {
    if (!selectedId || !confirmLeaveRoom()) return;
    const t = selectedType, i = selectedId;
    closePlayerScene();
    openDetail(t, i);
  });
  $("#scene-player")?.addEventListener("click", () => {
    playerModal.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (party.active && !playerModal.hidden) { $$(".overlay").forEach(closeOverlay); return; } // stay in the room
    closeOverlays();
  });
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
      applyNav(sNum, eNum);
      partyNavLocal(sNum, eNum);
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
    const tr = t.closest("[data-trailer],[data-trailer-player]");
    if (tr) return openTrailer((tr.dataset.trailer || tr.dataset.trailerPlayer).split(","));
    if (t.closest("[data-hero-trailer]")) return openTrailer(currentKey);
    const sl = t.closest("[data-slide]"); if (sl) { showSlide(Number(sl.dataset.slide)); return startTimer(); }
    const d = t.closest("[data-detail]"); if (d) return openDetail(d.dataset.type, Number(d.dataset.id));
  });

  syncFav();
  showView("discover");
  updatePartyUI();
  if (roomFromUrl()) openJoin(roomFromUrl());
})();
