/*
 * hexdump.js — renders an image as `hexdump -C` output.
 * Every hex byte is the real luminance (0x00–0xff) of the pixel under it,
 * and every glyph is painted in that pixel's colour.
 */
(function () {
  "use strict";

  const hex2 = (x) => x.toString(16).padStart(2, "0");
  const asc = (x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : ".");
  const esc = (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c);
  const lumOf = (r, g, b) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

  // One hexdump -C line as cells: kind = lit | h0 | h1 | asc
  function template(bpr) {
    const cells = [];
    const lit = (s) => { for (const ch of s) cells.push({ kind: "lit", ch, bi: -1 }); };
    lit("00000000  ");                                   // placeholder offset, rewritten per row
    for (let i = 0; i < bpr; i++) {
      cells.push({ kind: "h0", bi: i }, { kind: "h1", bi: i });
      lit(" ");
      if (i % 8 === 7 && i !== bpr - 1) lit(" ");
    }
    lit(" |");
    for (let i = 0; i < bpr; i++) cells.push({ kind: "asc", bi: i });
    lit("|");
    return cells;
  }

  function charWidthPerPx(font) {
    const s = document.createElement("span");
    s.style.cssText = `font:700 100px ${font};position:absolute;visibility:hidden;white-space:pre;left:-9999px`;
    s.textContent = "0".repeat(50);
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width / 50 / 100;
    s.remove();
    return w || 0.6;
  }

  function paint(r, g, b) {
    // gentle contrast + lift the deepest shadows so black fur still reads on a dark page
    const c = (v) => Math.max(0, Math.min(255, (v - 128) * 1.18 + 128));
    const lift = 34, k = 1 - lift / 255;
    return `rgb(${Math.round(lift + c(r) * k)},${Math.round(lift + c(g) * k)},${Math.round(lift + c(b) * k)})`;
  }

  function mount({ img, pre, probe, font, targetPx = 5, maxWidth = 640, heightRatio = 0.68, reserve = 150 }) {
    let state = null, lastW = 0, timer = 0, anim = 0;

    function sample(cols, rows) {
      const mid = document.createElement("canvas");
      mid.width = cols * 2; mid.height = rows * 2;
      const m = mid.getContext("2d");
      m.imageSmoothingQuality = "high";
      m.drawImage(img, 0, 0, mid.width, mid.height);
      const c = document.createElement("canvas");
      c.width = cols; c.height = rows;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.imageSmoothingQuality = "high";
      x.drawImage(mid, 0, 0, cols, rows);
      return x.getImageData(0, 0, cols, rows).data;
    }

    function render(animate) {
      if (!img.naturalWidth || !pre.isConnected || pre.offsetParent === null) return;
      cancelAnimationFrame(anim);

      const aspect = img.naturalHeight / img.naturalWidth;
      const avail = Math.min(document.documentElement.clientWidth - 32, maxWidth);
      const byHeight = ((window.innerHeight - reserve) * heightRatio) / aspect;
      const blockW = Math.max(Math.min(avail, byHeight), Math.min(avail, 260));

      const w1 = charWidthPerPx(font);
      const t = blockW < 480 ? Math.min(targetPx, 4.2) : targetPx;   // denser grid on phones
      const colsWanted = blockW / (w1 * t);
      let bpr = Math.floor((colsWanted - 13) / 4.125 / 8) * 8;
      bpr = Math.max(8, Math.min(128, bpr));

      const tpl = template(bpr);
      const cols = tpl.length;
      const fontPx = blockW / (cols * w1);
      const cw = fontPx * w1, lineH = fontPx;
      const rows = Math.max(8, Math.round(((cols * cw) / lineH) * aspect));
      const px = sample(cols, rows);

      const lines = new Array(rows), bytesByRow = new Array(rows);
      for (let y = 0; y < rows; y++) {
        const bytes = new Uint8Array(bpr);
        tpl.forEach((cell, x) => {
          if (cell.kind === "h0") { const i = (y * cols + x) * 4; bytes[cell.bi] = lumOf(px[i], px[i + 1], px[i + 2]); }
        });
        const off = (y * bpr).toString(16).padStart(8, "0");
        let html = "", offIdx = 0;
        tpl.forEach((cell, x) => {
          let ch;
          if (cell.kind === "lit") ch = offIdx < 8 && x < 8 ? off[offIdx++] : cell.ch;
          else if (cell.kind === "h0") ch = hex2(bytes[cell.bi])[0];
          else if (cell.kind === "h1") ch = hex2(bytes[cell.bi])[1];
          else ch = asc(bytes[cell.bi]);
          if (ch === " ") { html += " "; return; }
          const i = (y * cols + x) * 4;
          html += `<span style="color:${paint(px[i], px[i + 1], px[i + 2])}">${esc(ch)}</span>`;
        });
        lines[y] = html;
        bytesByRow[y] = bytes;
      }

      pre.style.fontSize = fontPx + "px";
      pre.style.lineHeight = lineH + "px";
      pre.style.width = cols * cw + "px";
      pre.style.height = rows * lineH + "px";
      state = { tpl, cols, rows, bpr, cw, lineH, px, bytesByRow };

      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduce) { pre.innerHTML = lines.join("\n"); return; }

      // stream the rows in, like the command is still printing
      pre.innerHTML = "";
      const perFrame = Math.max(1, Math.ceil(rows / 45));
      let y = 0;
      const step = () => {
        const end = Math.min(rows, y + perFrame);
        pre.insertAdjacentHTML("beforeend", lines.slice(y, end).join("\n") + (end < rows ? "\n" : ""));
        y = end;
        if (y < rows) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    function onMove(e) {
      if (!state || !probe) return;
      const r = pre.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / state.cw);
      const y = Math.floor((e.clientY - r.top) / state.lineH);
      if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return;
      const cell = state.tpl[x];
      if (cell.bi < 0) { probe.innerHTML = "&nbsp;"; return; }
      const v = state.bytesByRow[y][cell.bi];
      const off = y * state.bpr + cell.bi;
      const i = (y * state.cols + x) * 4;
      probe.innerHTML =
        `offset <b>0x${off.toString(16).padStart(8, "0")}</b> · byte <b>0x${hex2(v)}</b> '${esc(asc(v))}' · ` +
        `rgb(${state.px[i]},${state.px[i + 1]},${state.px[i + 2]})`;
    }

    pre.addEventListener("mousemove", onMove);
    pre.addEventListener("mouseleave", () => { if (probe) probe.innerHTML = "&nbsp;"; });
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const w = document.documentElement.clientWidth;
        if (w !== lastW) { lastW = w; render(false); }
      }, 160);
    });

    const start = () => {
      lastW = document.documentElement.clientWidth;
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => render(true));
    };
    if (img.complete && img.naturalWidth) start();
    else img.addEventListener("load", start, { once: true });

    return {
      refresh() {
        const w = document.documentElement.clientWidth;
        if (!state || w !== lastW) { lastW = w; render(false); }
      },
    };
  }

  window.HexHero = { mount };
})();
