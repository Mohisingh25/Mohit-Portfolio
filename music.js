/* ============================================================
   SHARED MUSIC PLAYER — YouTube-backed
   Used by index.html, uiux-work.html and graphics-work.html.
   Playback state (track + position + paused) is stored in
   localStorage, so the song carries on across pages instead of
   restarting. Each page styles #mp itself, so the player takes
   on that page's theme.
   Requires: window.MUSIC = [{url:'...', title:'...'}, ...]
   ============================================================ */
(function () {
  if (!Array.isArray(window.MUSIC) || !window.MUSIC.length) return;
  if (window.__MP_BOOTED) return;
  window.__MP_BOOTED = true;

  var RM = false;
  try { RM = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- tiny storage helpers (never throw) ---------- */
  var S = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function extractYouTubeId(value) {
    if (!value) return '';
    var s = String(value).trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    try {
      var u = new URL(s);
      if (u.hostname.indexOf('youtu.be') >= 0) return u.pathname.split('/').filter(Boolean)[0] || '';
      if (u.hostname.indexOf('youtube.com') >= 0) {
        var v = u.searchParams.get('v');
        if (v) return v;
        var parts = u.pathname.split('/').filter(Boolean);
        var si = parts.indexOf('shorts'); if (si >= 0 && parts[si + 1]) return parts[si + 1];
        var ei = parts.indexOf('embed');  if (ei >= 0 && parts[ei + 1]) return parts[ei + 1];
      }
    } catch (e) {}
    return '';
  }

  var TRACKS = window.MUSIC
    .map(function (t) { return Object.assign({}, t, { id: extractYouTubeId(t.url || t.link || t.id) }); })
    .filter(function (t) { return t.id; });
  if (!TRACKS.length) return;

  var ICON = {
    play : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    prev : '<svg viewBox="0 0 24 24"><path d="M7 6h2v12H7zm3 6l8-6v12z"/></svg>',
    next : '<svg viewBox="0 0 24 24"><path d="M15 6h2v12h-2zM6 6l8 6-8 6z"/></svg>',
    shuf : '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8.5h-2.2l-2 2.6-1.3-1.6L13.6 7H17zM3 7h4.6l2.2 2.8-1.3 1.6L6.9 9H3zM17 13l4 4-4 4v-2.5h-3.4L3 18.5v-2h9.9l1.9-2.4V13z"/></svg>'
  };
  var fmt = function (s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function build() {
    var mp = document.createElement('div');
    mp.id = 'mp';
    mp.innerHTML =
      '<button class="unmute" type="button">&#9834; Tap for sound</button>' +
      '<span class="art"><img alt=""></span>' +
      '<span class="meta"><b></b><small></small></span>' +
      '<span class="eq"><b></b><b></b><b></b></span>' +
      '<span class="ctrl">' +
        '<button class="prev" aria-label="Previous track">' + ICON.prev + '</button>' +
        '<button class="play" aria-label="Play">' + ICON.play + '</button>' +
        '<button class="next" aria-label="Next track">' + ICON.next + '</button>' +
        '<button class="shuf" aria-label="Shuffle">' + ICON.shuf + '</button>' +
      '</span>' +
      '<span class="seek" role="slider" aria-label="Seek"><i></i></span>';
    document.body.appendChild(mp);

    var host = document.createElement('div'); host.id = 'yt'; document.body.appendChild(host);
    setTimeout(function () { mp.classList.add('up'); }, RM ? 0 : 1200);

    var el = {
      art  : mp.querySelector('.art img'), title: mp.querySelector('.meta b'), sub: mp.querySelector('.meta small'),
      play : mp.querySelector('.play'),    prev : mp.querySelector('.prev'),   next: mp.querySelector('.next'),
      shuf : mp.querySelector('.shuf'),    seek : mp.querySelector('.seek'),   bar : mp.querySelector('.seek i')
    };

    /* ---------- restore where the last page left off ---------- */
    var savedVid  = S.get('mp-vid', '');
    var savedTime = parseFloat(S.get('mp-t', '0')) || 0;
    var savedAt   = parseInt(S.get('mp-ts', '0'), 10) || 0;
    var fresh     = savedAt && (Date.now() - savedAt) < 6 * 3600 * 1000;
    var startIdx  = -1;
    if (fresh && savedVid) {
      for (var k = 0; k < TRACKS.length; k++) if (TRACKS[k].id === savedVid) { startIdx = k; break; }
    }
    // Nudge past the gap spent loading the new page so it feels continuous.
    var resumeAt = (startIdx >= 0) ? Math.max(0, savedTime + Math.min(6, (Date.now() - savedAt) / 1000)) : 0;

    var i = startIdx >= 0 ? startIdx : Math.floor(Math.random() * TRACKS.length);
    var yt = null, ready = false, timer = null, booting = false;
    var shuffle = S.get('mp-shuffle', '1') === '1';
    var userPaused = S.get('mp-paused', '0') === '1';
    el.shuf.classList.toggle('on', shuffle);

    var paintMeta = function () {
      var t = TRACKS[i];
      el.art.src = 'https://i.ytimg.com/vi/' + t.id + '/default.jpg';
      el.title.textContent = t.title || 'Track ' + (i + 1);
      el.sub.textContent = 'YouTube · 0:00 / 0:00';
    };
    paintMeta();
    mp.classList.add('idle');

    var setIcon = function (p) {
      el.play.innerHTML = p ? ICON.pause : ICON.play;
      el.play.setAttribute('aria-label', p ? 'Pause' : 'Play');
      mp.classList.toggle('playing', p);
      if (p) mp.classList.remove('idle');
    };

    var save = function () {
      if (!yt || !yt.getCurrentTime) return;
      try {
        S.set('mp-vid', TRACKS[i].id);
        S.set('mp-t', String(yt.getCurrentTime() || 0));
        S.set('mp-ts', String(Date.now()));
      } catch (e) {}
    };

    var tick = function () {
      if (!yt || !yt.getDuration) return;
      var d = yt.getDuration() || 0, c = yt.getCurrentTime() || 0;
      el.bar.style.width = (d ? (c / d * 100) : 0) + '%';
      el.sub.textContent = 'YouTube · ' + fmt(c) + ' / ' + fmt(d);
      save();
    };

    var load = function (n, autoplay) {
      i = (n + TRACKS.length) % TRACKS.length;
      paintMeta();
      if (!yt) return;
      S.set('mp-t', '0'); S.set('mp-vid', TRACKS[i].id); S.set('mp-ts', String(Date.now()));
      autoplay ? yt.loadVideoById(TRACKS[i].id) : yt.cueVideoById(TRACKS[i].id);
    };
    var step = function (d) {
      if (shuffle && TRACKS.length > 1) {
        var n = i, guard = 0;
        while (n === i && guard++ < 20) n = Math.floor(Math.random() * TRACKS.length);
        if (n === i) n = (i + 1) % TRACKS.length;
        load(n, true);
      } else load(i + d, true);
    };

    el.play.onclick = function () {
      if (!ready || !yt) { boot(); return; }
      var st = yt.getPlayerState();
      if (st === 1) { yt.pauseVideo(); userPaused = true; }
      else { yt.unMute(); yt.setVolume(55); yt.playVideo(); userPaused = false; mp.classList.remove('muted'); }
      S.set('mp-paused', userPaused ? '1' : '0');
    };
    el.prev.onclick = function () { if (yt && yt.getCurrentTime && yt.getCurrentTime() > 4) { yt.seekTo(0); } else step(-1); };
    el.next.onclick = function () { step(1); };
    el.shuf.onclick = function () { shuffle = !shuffle; el.shuf.classList.toggle('on', shuffle); S.set('mp-shuffle', shuffle ? '1' : '0'); };

    var nudge = mp.querySelector('.unmute');
    if (nudge) nudge.onclick = function (e) {
      e.stopPropagation();
      if (!yt) return;
      try { yt.unMute(); yt.setVolume(70); yt.playVideo(); } catch (err) {}
      userPaused = false; S.set('mp-paused', '0');
      setTimeout(function () { try { if (!yt.isMuted()) mp.classList.remove('muted'); } catch (err) {} }, 200);
    };
    el.seek.onclick = function (e) {
      if (!yt || !yt.getDuration) return;
      var r = el.seek.getBoundingClientRect();
      yt.seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (yt.getDuration() || 0), true);
    };

    /* save on the way out so the next page picks up here */
    addEventListener('pagehide', save);
    addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

    window.onYouTubeIframeAPIReady = function () {
      yt = new YT.Player('yt', {
        videoId: TRACKS[i].id,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0,
          modestbranding: 1, iv_load_policy: 3,
          start: resumeAt > 2 ? Math.floor(resumeAt) : 0
        },
        events: {
          onReady: function () {
            ready = true; mp.classList.remove('dead');
            timer = setInterval(tick, 500);
            if (resumeAt > 2) { try { yt.seekTo(resumeAt, true); } catch (e) {} }
            if (userPaused) { setIcon(false); return; }

            /* Browsers only allow sound after a real gesture — listen until we
               confirm the track is actually audible, then stop listening. */
            var GESTURES = ['pointerdown', 'click', 'keydown', 'touchend', 'touchstart'];
            var withSound = function () { try { return yt.getPlayerState() === 1 && yt.isMuted() === false; } catch (e) { return false; } };
            var start = function () { try { yt.unMute(); yt.setVolume(70); yt.playVideo(); } catch (e) {} };
            var stopListening = function () { GESTURES.forEach(function (ev) { removeEventListener(ev, wake); }); };
            function wake() {
              if (userPaused) { stopListening(); return; }
              start();
              setTimeout(function () {
                if (withSound()) { mp.classList.remove('muted'); stopListening(); }
                else { mp.classList.add('muted'); }
              }, 220);
            }
            GESTURES.forEach(function (ev) { addEventListener(ev, wake, { passive: true }); });
            start();
            setTimeout(function () {
              if (userPaused) return;
              if (!withSound()) { try { yt.mute(); yt.playVideo(); } catch (e) {} mp.classList.add('muted'); }
            }, 900);
          },
          onStateChange: function (e) {
            setIcon(e.data === YT.PlayerState.PLAYING);
            if (e.data === YT.PlayerState.ENDED) step(1);
            if (e.data === YT.PlayerState.PLAYING) {
              var d = yt.getVideoData && yt.getVideoData();
              if (d && d.title) el.title.textContent = d.title;
              save();
            }
          },
          onError: function () { step(1); }
        }
      });
    };

    var dead = function (msg) { mp.classList.add('dead'); el.sub.textContent = 'YouTube · ' + (msg || 'unavailable right now'); };
    function boot() {
      if (ready || booting) return;
      booting = true; mp.classList.remove('dead'); el.sub.textContent = 'YouTube · loading…';
      if (window.YT && window.YT.Player) { window.onYouTubeIframeAPIReady(); }
      else {
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = function () { booting = false; dead(); };
        document.head.appendChild(tag);
      }
      setTimeout(function () {
        booting = false;
        if (!ready) dead(location.protocol === 'file:' ? 'run the site on a server to play' : undefined);
      }, 7000);
    }
    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
