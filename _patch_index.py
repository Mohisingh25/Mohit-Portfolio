#!/usr/bin/env python3
"""Patch index.html: two highlighted work cards, nav links, shared music.js."""
import re, io, os, sys, shutil

P = os.path.expanduser("~/mnt/Mohit-Portfolio-main/index.html")
src = io.open(P, encoding="utf-8").read()
orig = src
report = []

# ── 0. backup ────────────────────────────────────────────────────────────
bak = P + ".bak"
if not os.path.exists(bak):
    shutil.copy2(P, bak); report.append("backup -> index.html.bak")

# ── 1. NAV: point UI/UX at the new page and add Graphics ─────────────────
if '<a href="work-section.html">UI / UX</a>' in src:
    src = src.replace(
        '<a href="work-section.html">UI / UX</a>',
        '<a href="uiux-work.html">UI / UX</a>\n    <a href="graphics-work.html">Graphics</a>')
    report.append("nav: UI/UX -> uiux-work.html, added Graphics")
else:
    report.append("!! nav link not found")

# ── 2. CSS for the two highlighted cards ─────────────────────────────────
CARD_CSS = """
/* ---------- highlighted work portals (UI/UX + Graphics) ---------- */
.worklinks{
  display:grid;grid-template-columns:1fr 1fr;gap:clamp(1rem,2.4vw,1.6rem);
  margin:clamp(1.6rem,4vw,2.6rem) 0 clamp(2rem,5vw,3rem);
}
@media(max-width:860px){.worklinks{grid-template-columns:1fr}}
.wlink{
  --wa:var(--orange);
  position:relative;display:flex;flex-direction:column;overflow:hidden;
  background:var(--card);color:var(--ink);border:2px solid var(--ink);
  box-shadow:6px 6px 0 var(--ink);
  transition:transform .3s var(--ease),box-shadow .3s var(--ease);
}
.wlink:hover{transform:translate(-3px,-3px);box-shadow:10px 10px 0 var(--ink)}
.wlink:focus-visible{outline:3px solid var(--wa);outline-offset:4px}
.wlink .wl-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:var(--ink);border-bottom:2px solid var(--ink)}
.wlink .wl-strip img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;filter:var(--film);transition:transform .55s var(--ease),filter .4s}
.wlink:hover .wl-strip img{transform:scale(1.06);filter:none}
.wlink .wl-body{padding:clamp(1.1rem,2.4vw,1.7rem);display:flex;flex-direction:column;gap:.55rem;flex:1}
.wlink .wl-top{display:flex;align-items:center;justify-content:space-between;gap:.6rem}
.wlink .wl-kicker{
  font-family:var(--mono);font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;
  background:var(--wa);color:var(--card);padding:.34rem .6rem;border:2px solid var(--ink);
}
.wlink .wl-no{font-family:var(--mono);font-size:.72rem;letter-spacing:.14em;color:var(--ink-3)}
.wlink h3{font-family:var(--disp);font-size:clamp(1.5rem,3vw,2.1rem);line-height:1.04;letter-spacing:-.02em;margin:.15rem 0 0}
.wlink p{font-size:.93rem;line-height:1.6;color:var(--ink-2);margin:0}
.wlink .wl-facts{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.2rem}
.wlink .wl-facts span{
  font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;
  border:1.5px solid rgba(30,18,12,.28);padding:.3rem .5rem;color:var(--ink-2);
}
.wlink .wl-go{
  margin-top:auto;padding-top:.9rem;display:inline-flex;align-items:center;gap:.5rem;
  font-family:var(--mono);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);
}
.wlink .wl-go i{font-style:normal;transition:transform .3s var(--ease)}
.wlink:hover .wl-go i{transform:translateX(5px)}
.wlink::after{
  content:'';position:absolute;left:0;right:0;bottom:0;height:5px;background:var(--wa);
  transform:scaleX(0);transform-origin:left;transition:transform .45s var(--ease);
}
.wlink:hover::after{transform:scaleX(1)}
.wlink-gd{--wa:var(--ochre)}
"""
if ".worklinks{" not in src:
    # inject just before the closing </style> of the head block
    idx = src.find("</style>")
    src = src[:idx] + CARD_CSS + "\n" + src[idx:]
    report.append("css: .worklinks block injected")

# ── 3. replace the single UI/UX feature card with two portals ────────────
CARDS = """    <div class="worklinks rv">

      <a class="wlink wlink-ui" href="uiux-work.html">
        <span class="wl-strip">
          <img src="img_ui/ui-daadis-desktop.jpg" alt="Daadis storefront" loading="lazy">
          <img src="img_ui/ui-sweety-desktop.jpg" alt="Sweety Intimates storefront" loading="lazy">
          <img src="img_ui/ui-yudu-desktop.jpg" alt="Yudu Robotics website" loading="lazy">
        </span>
        <span class="wl-body">
          <span class="wl-top"><span class="wl-kicker">UI / UX &middot; Case studies</span><span class="wl-no">01</span></span>
          <h3>UI / UX Work</h3>
          <p>Six shipped products, start to finish &mdash; research, information architecture, design systems and the front-end that went live. Rosier Foods, Daadis, Arohance, Sweety Intimates, Bibox and Yudu Robotics.</p>
          <span class="wl-facts"><span>06 case studies</span><span>05 industries</span><span>Design systems</span><span>Shipped</span></span>
          <span class="wl-go">Open UI / UX work <i>&#8594;</i></span>
        </span>
      </a>

      <a class="wlink wlink-gd" href="graphics-work.html">
        <span class="wl-strip">
          <img src="img_graphics/gfx-camp-02.jpg" alt="Janmashtami sale creative" loading="lazy">
          <img src="img_graphics/gfx-camp-04.jpg" alt="Ganesh Chaturthi sale creative" loading="lazy">
          <img src="img_graphics/gfx-ban-01.jpg" alt="Monsoon sale homepage banner" loading="lazy">
        </span>
        <span class="wl-body">
          <span class="wl-top"><span class="wl-kicker">Graphics &middot; Campaigns</span><span class="wl-no">02</span></span>
          <h3>Graphic Design Work</h3>
          <p>Sale campaigns, website banners, packaging and process films &mdash; the tools, the build process and the six brand rules that keep 550+ creatives looking like one brand.</p>
          <span class="wl-facts"><span>550+ creatives</span><span>12 campaigns</span><span>Packaging</span><span>Motion</span></span>
          <span class="wl-go">Open graphics work <i>&#8594;</i></span>
        </span>
      </a>

    </div>
"""

pat = re.compile(r'\n\s*<a class="feature rv" href="work-section\.html">.*?</a>\n', re.S)
if pat.search(src):
    src = pat.sub("\n" + CARDS, src, count=1)
    report.append("work section: feature card -> two highlighted portals")
else:
    # fall back: insert the portals right before the workbar
    m = re.search(r'\n(\s*)<div class="workbar rv">', src)
    if m:
        src = src[:m.start()] + "\n" + CARDS + src[m.start():]
        report.append("work section: portals inserted before .workbar (fallback)")
    else:
        report.append("!! could not place work portals")

# ── 4. swap the inline player for the shared music.js ────────────────────
start = src.find("/* ---------- 15. MUSIC PLAYER (YouTube-backed) ---------- */")
if start != -1:
    anchor = src.find("boot();", start)
    end = src.find("})();", anchor)
    if anchor != -1 and end != -1:
        end += len("})();")
        src = src[:start] + "/* music player now lives in music.js (shared with the work pages) */" + src[end:]
        report.append("index: inline player removed")
        if 'src="music.js"' not in src:
            src = src.replace("</body>", '<script src="music.js" defer></script>\n</body>', 1)
            report.append("index: <script src=music.js> added")
    else:
        report.append("!! player end marker not found")
else:
    report.append("-- inline player already removed")

if src != orig:
    io.open(P, "w", encoding="utf-8").write(src)
    report.append("index.html written (%d -> %d bytes)" % (len(orig), len(src)))
else:
    report.append("no changes")

print("\n".join(report))
