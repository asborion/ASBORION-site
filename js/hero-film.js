/* ==========================================================
   Accueil : film d'introduction ASBORION
   - Le nom « ASBORION » est une couche HTML synchronisée sur
     le temps réel de la vidéo (pas de seconde étoile).
   - Au premier affichage, l'étoile (1re image de la vidéo)
     apparaît, tourne légèrement et respire, puis le nom arrive
     avant que la lecture démarre.
   - Lecture automatique, muette, en boucle, sans commandes ;
     mise en pause hors écran ; respecte « réduire les animations ».
   ========================================================== */
(() => {
  const root = document.querySelector('[data-hero-film]');
  if (!root) return;

  const video = root.querySelector('video');
  const canvas = root.querySelector('canvas');
  const wm = root.querySelector('.hero-film__name');
  if (!video || !canvas || !wm || !canvas.getContext) return;

  /* ── Réglages ─────────────────────────────────────────── */
  const INTRO_HOLD = 0.7;                 // s sur la 1re image avant la lecture (0 = désactivé)
  const VW = 1920, VH = 1080;             // repère de mesure (vidéo 1080p)
  const STAR_X = 941.5, STAR_Y = 540;     // centre de l'étoile
  const CROP = { x: 200, y: 0, w: 1483, h: 1080 };
  const LOOP_IN = [11.20, 11.80];         // le nom revient quand l'étoile se reforme
  const FADE_OUT = [0.50, 1.00];          // le nom s'efface avant l'ouverture de l'étoile

  const ctx = canvas.getContext('2d');
  const mctx = document.createElement('canvas').getContext('2d');
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const easeOut = (v) => 1 - Math.pow(1 - clamp(v), 3);

  /* Version 720p sur petits écrans, 1080p sinon */
  const pickSource = () => {
    const w = root.clientWidth * (window.devicePixelRatio || 1);
    const src = w <= 1400 ? root.dataset.srcSm : root.dataset.src;
    if (src && video.getAttribute('src') !== src) video.setAttribute('src', src);
    video.preload = 'auto';
    video.load();
  };
  pickSource();

  /* ── Alignement : le rayon inférieur passe entre « O » et « R » ── */
  function align() {
    const node = wm.firstChild;
    if (!node || node.length < 5) return;
    const r = document.createRange(); r.setStart(node, 4); r.setEnd(node, 5);
    const fr = root.getBoundingClientRect();
    const rr = r.getBoundingClientRect();
    const cs = getComputedStyle(wm);
    const fs = parseFloat(cs.fontSize);
    const ls = parseFloat(cs.letterSpacing) || 0.5 * fs;
    mctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    const mO = mctx.measureText('O'), mR = mctx.measureText('R');
    const rsbO = mO.width - (mO.actualBoundingBoxRight || mO.width);
    const lsbR = -(mR.actualBoundingBoxLeft || 0);
    const gapCenter = (rr.left - fr.left) - ls / 2 + (lsbR - rsbO) / 2;
    const target = fr.width * (STAR_X / VW);
    const cur = parseFloat(wm.style.left) || 0;
    wm.style.left = (cur + target - gapCenter) + 'px';
  }
  if ('ResizeObserver' in window) new ResizeObserver(align).observe(root);
  else window.addEventListener('resize', align);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);

  function setName(o, y, blur) {
    wm.style.opacity = o.toFixed(3);
    wm.style.transform = `translateY(calc(-50% + ${y.toFixed(3)}em))`;
    wm.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
  }

  function nameAt(t) {
    if (t >= LOOP_IN[0]) {
      const p = smooth((t - LOOP_IN[0]) / (LOOP_IN[1] - LOOP_IN[0]));
      return setName(p, (1 - p) * 0.35, (1 - p) * 5);
    }
    if (t <= FADE_OUT[0]) return setName(1, 0, 0);
    const p = smooth((t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0]));
    setName(1 - p, -p * 0.2, p * 4);
  }

  /* ── 1re image, gardée pour l'intro ── */
  const snap = document.createElement('canvas'); snap.width = VW; snap.height = VH;
  const sctx = snap.getContext('2d');
  /* L'affiche (= 1re image) sert pour l'intro : pas besoin d'attendre la vidéo */
  function snapshotFromPoster() {
    return new Promise((res, rej) => {
      const url = video.getAttribute('poster');
      if (!url) return rej();
      const img = new Image();
      img.onload = () => { sctx.drawImage(img, 0, 0, VW, VH); res(); };
      img.onerror = rej;
      img.src = url;
    });
  }
  function takeSnapshot() {
    return new Promise((res) => {
      let tries = 0;
      const go = () => {
        sctx.drawImage(video, 0, 0, VW, VH);
        let ok = true;
        try { ok = sctx.getImageData(STAR_X, STAR_Y, 1, 1).data[0] > 40; } catch (e) { /* ignore */ }
        if (ok || tries++ > 30) res(); else requestAnimationFrame(go);
      };
      go();
    });
  }

  function drawStar(alpha, rot, scale) {
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = alpha;
    const rx = CROP.x + CROP.w;
    ctx.drawImage(snap, 0, 0, CROP.x, VH, 0, 0, CROP.x, VH);
    ctx.drawImage(snap, rx, 0, VW - rx, VH, rx, 0, VW - rx, VH);
    ctx.save();
    ctx.translate(STAR_X, STAR_Y); ctx.rotate(rot); ctx.scale(scale, scale); ctx.translate(-STAR_X, -STAR_Y);
    ctx.drawImage(snap, CROP.x, CROP.y, CROP.w, CROP.h, CROP.x, CROP.y, CROP.w, CROP.h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ── États ── */
  let mode = 'idle';          // idle | intro | handoff | video | paused | static
  let introStart = 0, raf = 0, ready = false, visible = false, introDone = false;
  let playToken = 0;          // ignore les réponses de play() périmées

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (mode === 'intro') {
      const t = (now - introStart) / 1000;
      const hold = INTRO_HOLD;
      const p = clamp(t / hold);
      drawStar(
        easeOut(t / (hold * 0.5)),
        (-4 * Math.PI / 180) * (1 - easeOut(p)),
        (0.965 + 0.035 * easeOut(p)) * (1 + 0.012 * Math.sin(Math.PI * p))
      );
      const q = smooth((t - hold * 0.3) / (hold * 0.55));
      setName(q, (1 - q) * 0.35, (1 - q) * 5);
      // l'étoile reste affichée jusqu'à ce que la 1re image vidéo soit réellement à l'écran
      if (t >= hold) { drawStar(1, 0, 1); setName(1, 0, 0); introDone = true; startPlayback(); }
    } else if (mode === 'video') {
      nameAt(video.currentTime);
    }
  }

  function startPlayback() {
    if (mode === 'handoff' || mode === 'video') return;
    mode = 'handoff';
    video.loop = true;
    const token = ++playToken;
    const reveal = () => {
      if (token !== playToken || mode !== 'handoff') return;
      root.classList.add('is-playing'); mode = 'video';
    };
    let p;
    try { p = video.play(); } catch (e) { p = Promise.reject(e); }
    if (!p || !p.then) return reveal();
    p.then(() => {
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(reveal);
      else requestAnimationFrame(reveal);
    }).catch((err) => {
      if (token !== playToken) return;           // une autre tentative a pris le relais
      if (err && err.name === 'NotAllowedError') {
        // lecture automatique vraiment refusée (mode économie d'énergie…) :
        // image fixe + nom, relance au premier geste de l'utilisateur
        showStatic();
        armGestureRetry();
      } else {
        // simple interruption (pause hors écran, chargement…) : on réessaiera
        mode = 'paused';
        setTimeout(maybeStart, 250);
      }
    });
  }

  let gestureArmed = false;
  function armGestureRetry() {
    if (gestureArmed) return;
    gestureArmed = true;
    const evts = ['pointerup', 'touchend', 'click', 'keydown']; // gestes reconnus par Safari (pas le scroll)
    const retry = () => {
      evts.forEach((e) => window.removeEventListener(e, retry, true));
      gestureArmed = false;
      if (mode === 'static' && !mq.matches) { mode = 'paused'; startPlayback(); }
    };
    evts.forEach((e) => window.addEventListener(e, retry, { capture: true, passive: true }));
  }

  function showStatic() {
    playToken++;
    video.pause();
    drawStar(1, 0, 1);
    root.classList.remove('is-playing');
    setName(1, 0, 0);
    mode = 'static';
  }

  function start() {
    align();
    if (mq.matches) { video.pause(); video.currentTime = 0; return showStatic(); }
    if (introDone || INTRO_HOLD <= 0) {
      drawStar(1, 0, 1); setName(1, 0, 0); introDone = true; return startPlayback();
    }
    drawStar(0, 0, 1); setName(0, 0.35, 5);
    introStart = performance.now(); mode = 'intro';
  }

  /* Démarre quand c'est prêt ET visible ; pause seulement une fois la vidéo lancée */
  function maybeStart() {
    if (!ready) return;
    if (!visible || document.hidden) {
      if (mode === 'video') { playToken++; video.pause(); mode = 'paused'; }
      return;
    }
    if (mode === 'idle') start();
    else if (mode === 'paused') startPlayback();
  }

  if ('IntersectionObserver' in window) {
    // dès qu'un petit bout de la carte est à l'écran
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      maybeStart();
    }, { threshold: 0.01 }).observe(root);
  } else {
    visible = true;
  }

  document.addEventListener('visibilitychange', maybeStart);
  window.addEventListener('pageshow', maybeStart);

  mq.addEventListener && mq.addEventListener('change', () => {
    if (!ready) return;
    if (mq.matches) showStatic(); else { playToken++; mode = 'idle'; video.currentTime = 0; introDone = false; root.classList.remove('is-playing'); maybeStart(); }
  });

  /* ── Boucle garantie ── */
  video.loop = true;
  // filet de sécurité si un navigateur ignore « loop »
  video.addEventListener('ended', () => {
    video.currentTime = 0;
    if (mode === 'video') video.play().catch(() => {});
  });
  // un navigateur (iOS, économie d'énergie…) peut mettre la vidéo en pause tout seul : on relance
  video.addEventListener('pause', () => {
    if (mode !== 'video' || !visible || document.hidden || mq.matches) return;
    setTimeout(() => {
      if (mode === 'video' && video.paused && visible && !document.hidden) video.play().catch(() => {});
    }, 300);
  });

  root.classList.add('is-enhanced');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  let started = false;
  const onReady = (fromVideo) => {
    if (started) return;
    started = true;
    (fromVideo ? takeSnapshot() : Promise.resolve()).then(() => {
      ready = true;
      if (!raf) raf = requestAnimationFrame(tick);
      maybeStart();
    });
  };
  // l'intro démarre dès que l'affiche est chargée, pendant que la vidéo se télécharge
  snapshotFromPoster().then(() => onReady(false)).catch(() => {
    if (video.readyState >= 2) onReady(true);
    else video.addEventListener('loadeddata', () => onReady(true), { once: true });
  });
  // si la vidéo devient prête pendant l'intro, rien à faire : tick() lance la lecture
})();
