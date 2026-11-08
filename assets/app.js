(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let site = {}, posts = [], activeTag = null, hero = null;
  const mdCache = new Map();

  // ───────── boot ─────────
  async function boot() {
    try {
      const [s, p] = await Promise.all([
        fetch("site.json", { cache: "no-cache" }).then((r) => r.json()),
        fetch("posts/posts.json", { cache: "no-cache" }).then((r) => r.json()),
      ]);
      site = s;
      posts = p.filter((x) => !x.draft).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    } catch (e) {
      $("postList").innerHTML =
        `<li class="notice">글 목록을 불러오지 못했어요. 파일을 더블클릭해서(file://) 열면 브라우저가 fetch를 막습니다 — ` +
        `폴더에서 <code>python3 -m http.server</code> 실행 후 http://localhost:8000 으로 열어 주세요.</li>`;
      console.error(e);
      return;
    }

    applySite();
    renderTagbar();
    renderList();

    const img = new Image();
    img.src = (site.hero && site.hero.image) || "assets/hero.jpg";
    hero = window.HexHero.mount({
      img, pre: $("dump"), probe: $("probe"),
      font: '"JetBrains Mono", ui-monospace, Menlo, monospace',
      maxWidth: (site.hero && site.hero.maxWidth) || 640,
      heightRatio: (site.hero && site.hero.heightRatio) || 0.68,
    });

    window.addEventListener("hashchange", route);
    route();
  }

  function applySite() {
    document.title = site.title || document.title;
    $("siteTitle").textContent = site.title || "";
    $("siteTagline").textContent = site.tagline || "";
    $("heroCmd").textContent = (site.hero && site.hero.command) || "hexdump -C hero.jpg";
    $("siteLinks").innerHTML = (site.links || [])
      .map((l) => `<a href="${escapeHtml(l.href)}" target="_blank" rel="noopener">[${escapeHtml(l.label)}]</a>`)
      .join("");
    const by = site.author || site.title || "";
    $("footText").textContent = `© ${new Date().getFullYear()} ${by}${site.title && site.title !== by ? ` · ${site.title}` : ""}`;
  }

  // ───────── list ─────────
  function renderTagbar() {
    const counts = {};
    posts.forEach((p) => (p.tags || []).forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
    const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    $("tagbar").innerHTML =
      `<button class="tag${activeTag ? "" : " on"}" data-tag="">all</button>` +
      tags.map((t) => `<button class="tag${t === activeTag ? " on" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)} ${counts[t]}</button>`).join("");
  }

  $("tagbar").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tag]");
    if (!b) return;
    activeTag = b.dataset.tag || null;
    renderTagbar();
    renderList();
  });

  function renderList() {
    const list = activeTag ? posts.filter((p) => (p.tags || []).includes(activeTag)) : posts;
    $("count").textContent = `${list.length} post${list.length === 1 ? "" : "s"}${activeTag ? ` · #${activeTag}` : ""}`;
    $("postList").innerHTML = list.length
      ? list.map((p) => `
        <li><a class="row" href="#p-${escapeHtml(p.slug)}">
          <span class="d">${escapeHtml(p.date)}</span>
          <span class="t">${escapeHtml(p.title)}</span>
          ${p.summary ? `<span class="s">${escapeHtml(p.summary)}</span>` : ""}
          ${(p.tags || []).length ? `<span class="tg">${p.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</span>` : ""}
        </a></li>`).join("")
      : `<li class="empty">아직 글이 없어요.</li>`;
  }

  // ───────── routing ─────────
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    $("aboutBtn").classList.toggle("on", h === "about");
    if (h === "about") return showAbout();
    if (h.startsWith("p-")) {
      const p = posts.find((x) => x.slug === h.slice(2));
      if (p) return showPost(p);
    }
    showHome(h === "posts");
  }

  function showOnly(id) {
    ["home", "post", "about"].forEach((x) => ($(x).hidden = x !== id));
  }

  async function showAbout() {
    showOnly("about");
    window.scrollTo(0, 0);
    document.title = `about — ${site.title || ""}`;
    const body = $("aboutBody");
    if (body.dataset.loaded) return;
    body.innerHTML = `<p class="dim">loading…</p>`;
    try {
      const r = await fetch("about.md", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      body.innerHTML = window.marked.parse(await r.text());
      enhance(body);
      resumeLayout(body);
      body.dataset.loaded = "1";
    } catch (e) {
      body.innerHTML = `<p class="notice">about.md 를 불러오지 못했어요.</p>`;
    }
  }

  // "### Role — Org | 2024.03 – 현재"  →  title on the left, period on the right
  function resumeLayout(root) {
    root.querySelectorAll("h3").forEach((h) => {
      const i = h.innerHTML.lastIndexOf(" | ");
      if (i < 0) return;
      const left = h.innerHTML.slice(0, i), right = h.innerHTML.slice(i + 3);
      h.innerHTML = `<span class="what">${left}</span><span class="when">${right}</span>`;
    });
    // table cells made only of ●◐○ are skill levels → highlighted
    root.querySelectorAll("td").forEach((td) => {
      if (/^[●◐○\s]+$/.test(td.textContent) && td.textContent.trim()) td.classList.add("level");
    });
    // list items ending in " | period" get the same treatment
    root.querySelectorAll("li").forEach((li) => {
      if (li.querySelector("ul,ol")) return;
      const i = li.innerHTML.lastIndexOf(" | ");
      if (i < 0) return;
      li.classList.add("dated");
      li.innerHTML = `<span class="what">${li.innerHTML.slice(0, i)}</span><span class="when">${li.innerHTML.slice(i + 3)}</span>`;
    });
  }

  function showHome(toList) {
    showOnly("home");
    document.title = site.title || "blog";
    if (hero) hero.refresh();
    if (toList) requestAnimationFrame(() => $("posts").scrollIntoView());
  }

  async function showPost(p) {
    showOnly("post");
    window.scrollTo(0, 0);
    document.title = `${p.title} — ${site.title || ""}`;
    $("postPath").textContent = `posts/${p.slug}.md`;
    $("postTitle").textContent = p.title;
    $("postMeta").innerHTML = `${escapeHtml(p.date)}${(p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}`;
    $("postBody").innerHTML = `<p class="dim">loading…</p>`;
    renderPager(p);

    try {
      let md = mdCache.get(p.slug);
      if (md == null) {
        const r = await fetch(`posts/${p.slug}.md`, { cache: "no-cache" });
        if (!r.ok) throw new Error(r.status);
        md = await r.text();
        mdCache.set(p.slug, md);
      }
      $("postBody").innerHTML = window.marked.parse(md);
      enhance($("postBody"));
    } catch (e) {
      $("postBody").innerHTML = `<p class="notice">posts/${escapeHtml(p.slug)}.md 를 불러오지 못했어요.</p>`;
    }
  }

  function renderPager(p) {
    const i = posts.indexOf(p);
    const newer = posts[i - 1], older = posts[i + 1];
    $("pager").innerHTML =
      (older ? `<a href="#p-${escapeHtml(older.slug)}">← older<b>${escapeHtml(older.title)}</b></a>` : "") +
      (newer ? `<a class="next" href="#p-${escapeHtml(newer.slug)}">newer →<b>${escapeHtml(newer.title)}</b></a>` : "");
  }

  // ───────── post body enhancements ─────────
  function enhance(root) {
    // relative image paths are relative to posts/
    root.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!/^([a-z]+:|\/|#)/i.test(src) && !src.startsWith("posts/")) img.setAttribute("src", "posts/" + src);
      img.loading = "lazy";
    });
    // external links open outside
    root.querySelectorAll("a[href]").forEach((a) => {
      if (/^https?:/i.test(a.getAttribute("href"))) { a.target = "_blank"; a.rel = "noopener"; }
    });
    // code blocks: highlight + language label + copy
    root.querySelectorAll("pre > code").forEach((code) => {
      const pre = code.parentElement;
      const m = /language-([\w+-]+)/.exec(code.className);
      if (window.hljs) {
        try { window.hljs.highlightElement(code); } catch (_) {}
      }
      const wrap = document.createElement("div");
      wrap.className = "codewrap";
      pre.replaceWith(wrap);
      wrap.appendChild(pre);
      if (m) {
        const l = document.createElement("span");
        l.className = "lang"; l.textContent = m[1];
        wrap.appendChild(l);
      }
      const b = document.createElement("button");
      b.className = "copy"; b.type = "button"; b.textContent = "copy";
      b.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(code.innerText); b.textContent = "copied"; }
        catch (_) { b.textContent = "blocked"; }
        setTimeout(() => (b.textContent = "copy"), 1200);
      });
      wrap.appendChild(b);
    });
  }

  boot();
})();
