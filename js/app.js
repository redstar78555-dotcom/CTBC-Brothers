(function initializeCheerLibrary(global, document) {
  "use strict";

  const elements = {
    grid: document.querySelector("#catalog-grid"),
    template: document.querySelector("#card-template"),
    search: document.querySelector("#search-input"),
    clearSearch: document.querySelector("#clear-search"),
    filters: [...document.querySelectorAll(".filter-button")],
    visibleCount: document.querySelector("#visible-count"),
    emptyState: document.querySelector("#empty-state"),
    resetFilters: document.querySelector("#reset-filters"),
    playerPanel: document.querySelector("#player-panel"),
    player: document.querySelector("#youtube-player"),
    nowPlayingTitle: document.querySelector("#now-playing-title"),
    nowPlayingMeta: document.querySelector("#now-playing-meta"),
    youtubeFallback: document.querySelector("#youtube-fallback"),
    stopPlayer: document.querySelector("#stop-player"),
    liveStatus: document.querySelector("#live-status")
  };

  const state = {
    filter: "all",
    query: "",
    activeId: null
  };

  const categoryLabels = {
    player: "球員應援",
    team: "團隊應援",
    classic: "經典應援"
  };

  const validYouTubeId = /^[A-Za-z0-9_-]{11}$/;

  function isHttpsUrl(value) {
    if (!value) return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  function validateItem(item) {
    return {
      ...item,
      playable:
        Boolean(item.youtubeId) &&
        validYouTubeId.test(item.youtubeId) &&
        isHttpsUrl(item.sourceUrl),
      danceAvailable: isHttpsUrl(item.danceUrl),
      sourceAvailable: isHttpsUrl(item.sourceUrl)
    };
  }

  const items = (global.CTBC_CHEERS || []).map(validateItem);
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) {
      throw new Error(`曲目資料的 id 缺漏或重複：${item.id || "(空白)"}`);
    }
    ids.add(item.id);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("zh-Hant")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matches(item) {
    const inCategory = state.filter === "all" || item.category === state.filter;
    if (!inCategory) return false;
    if (!state.query) return true;

    const searchable = normalize(
      [item.number, item.name, item.title, item.subtitle, item.description, categoryLabels[item.category]].join(" ")
    );
    return searchable.includes(state.query);
  }

  function setLink(link, url, disabledText) {
    if (isHttpsUrl(url)) {
      link.href = url;
      link.classList.remove("is-disabled");
      link.removeAttribute("aria-disabled");
      link.tabIndex = 0;
      return;
    }

    link.removeAttribute("href");
    link.classList.add("is-disabled");
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
    link.textContent = disabledText;
  }

  function makeCard(item) {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".cheer-card");
    const category = fragment.querySelector(".category-badge");
    const verify = fragment.querySelector(".verify-badge");
    const number = fragment.querySelector(".player-number");
    const subtitle = fragment.querySelector(".card-subtitle");
    const title = fragment.querySelector(".card-title");
    const description = fragment.querySelector(".card-description");
    const chant = fragment.querySelector(".chant-content");
    const play = fragment.querySelector(".play-button");
    const dance = fragment.querySelector(".dance-link");
    const source = fragment.querySelector(".source-link");

    card.dataset.id = item.id;
    card.dataset.category = item.category;
    category.textContent = categoryLabels[item.category] || "應援曲";
    category.classList.add(item.category);
    verify.textContent = item.playable ? "● 已核對直連" : "● 影片待確認";
    verify.classList.toggle("pending", !item.playable);
    number.textContent = item.number || "B";
    subtitle.textContent = item.subtitle;
    title.textContent = item.title;
    description.textContent = item.description;

    const chantText = document.createElement("p");
    chantText.textContent = item.chant;
    const rightsNote = document.createElement("small");
    rightsNote.textContent = "本站僅提供簡短提示；完整歌詞與動作以來源影片及球場版本為準。";
    chant.append(chantText, rightsNote);

    play.dataset.itemId = item.id;
    if (item.playable) {
      play.dataset.youtubeId = item.youtubeId;
      play.setAttribute("aria-label", `聽歌曲：${item.title}`);
      play.addEventListener("click", () => playSong(item));
    } else {
      play.disabled = true;
      play.removeAttribute("data-youtube-id");
      play.innerHTML = "<span aria-hidden=\"true\">◷</span> 影片待確認";
      play.setAttribute("aria-label", `${item.title}的官方影片尚待確認`);
    }

    setLink(dance, item.danceUrl, "應援舞待補");
    if (item.danceAvailable) {
      dance.setAttribute("aria-label", `觀看${item.title}的應援舞（另開新分頁）`);
    }

    setLink(source, item.sourceUrl, "來源待補");
    if (item.sourceAvailable) {
      source.setAttribute("aria-label", `${item.title}的資料來源（另開新分頁）`);
    }

    return fragment;
  }

  function render() {
    const visibleItems = items.filter(matches);
    const fragment = document.createDocumentFragment();
    for (const item of visibleItems) {
      fragment.append(makeCard(item));
    }

    elements.grid.replaceChildren(fragment);
    elements.visibleCount.textContent = String(visibleItems.length);
    elements.grid.hidden = visibleItems.length === 0;
    elements.emptyState.hidden = visibleItems.length !== 0;
  }

  function playSong(item) {
    if (!item.playable) return;

    const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.youtubeId)}?autoplay=1&rel=0&playsinline=1`;
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(item.youtubeId)}`;
    elements.player.src = embedUrl;
    elements.player.title = `YouTube 播放器：${item.title}`;
    elements.nowPlayingTitle.textContent = item.title;
    elements.nowPlayingMeta.textContent = `${item.name} · ${item.subtitle}`;
    elements.youtubeFallback.href = watchUrl;
    elements.playerPanel.hidden = false;
    state.activeId = item.id;
    elements.liveStatus.textContent = `已載入${item.title}，播放器位於曲目列表上方。`;

    const reduceMotion = global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    elements.playerPanel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    global.setTimeout(() => elements.nowPlayingTitle.focus({ preventScroll: true }), reduceMotion ? 0 : 350);
  }

  function stopPlayer({ announce = true } = {}) {
    elements.player.src = "about:blank";
    elements.player.title = "YouTube 應援曲播放器";
    elements.playerPanel.hidden = true;
    state.activeId = null;
    if (announce) elements.liveStatus.textContent = "已停止播放。";
  }

  function selectFilter(filter) {
    state.filter = filter;
    for (const button of elements.filters) {
      const active = button.dataset.filter === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    render();
  }

  function resetAll() {
    elements.search.value = "";
    elements.clearSearch.hidden = true;
    state.query = "";
    selectFilter("all");
    elements.search.focus();
  }

  elements.search.addEventListener("input", (event) => {
    state.query = normalize(event.target.value);
    elements.clearSearch.hidden = state.query.length === 0;
    render();
  });

  elements.clearSearch.addEventListener("click", () => {
    elements.search.value = "";
    state.query = "";
    elements.clearSearch.hidden = true;
    render();
    elements.search.focus();
  });

  for (const button of elements.filters) {
    button.addEventListener("click", () => selectFilter(button.dataset.filter));
  }

  elements.resetFilters.addEventListener("click", resetAll);
  elements.stopPlayer.addEventListener("click", () => stopPlayer());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.playerPanel.hidden) {
      stopPlayer();
    }
  });

  render();

  global.__CTBC_APP__ = Object.freeze({
    itemCount: items.length,
    playableCount: items.filter((item) => item.playable).length,
    stopPlayer
  });
})(window, document);
