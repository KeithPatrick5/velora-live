(() => {
  const reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const startAt = performance.now();
  let videoEnded = reduceMotion;
  let appReady = false;
  let finished = false;

  const overlay = document.createElement('div');
  overlay.id = 'veloraSiteIntroV18';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <video id="veloraSiteIntroVideoV18" muted autoplay playsinline preload="auto" disablepictureinpicture>
      <source src="/media/velora-site-intro.mp4" type="video/mp4">
    </video>
    <div class="veloraIntroProgress"></div>`;
  (document.body || document.documentElement).appendChild(overlay);
  const video = overlay.querySelector('video');

  const setProgress = (value) => {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    overlay.style.setProperty('--catalog-progress', `${pct}%`);
  };

  const catalogState = () => document.querySelector('main.catalogState,.catalogState');
  const stateIsBooting = (el) => {
    if (!el) return false;
    const text = (el.textContent || '').trim();
    if (!text) return true;
    return /Loading the live catalog|Starting Velora|Syncing the live catalog/i.test(text);
  };

  const syncRecoveredLoader = () => {
    const state = catalogState();
    if (!state) {
      appReady = true;
      setProgress(100);
      return;
    }
    const booting = stateIsBooting(state);
    state.classList.toggle('veloraCatalogBootState', booting);
    if (!booting) {
      // A real error/empty state should remain visible rather than being hidden by the intro.
      appReady = true;
      setProgress(100);
    }
  };

  const resourceMilestones = () => {
    const entries = performance.getEntriesByType?.('resource') || [];
    if (entries.some(e => /\/assets\/index-.*\.js(?:$|\?)/.test(e.name))) setProgress(42);
    if (entries.some(e => /\/api\/catalog(?:$|[?\/])/.test(e.name))) setProgress(78);
  };

  const finishIfReady = () => {
    syncRecoveredLoader();
    resourceMilestones();
    if (!videoEnded || !appReady || finished) return;
    finished = true;
    setProgress(100);
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 360);
  };

  setProgress(10); // DOM + intro shell exist.
  document.addEventListener('DOMContentLoaded', () => setProgress(18), { once:true });

  if (!reduceMotion) {
    video.addEventListener('loadedmetadata', () => setProgress(24), { once:true });
    video.addEventListener('canplay', () => setProgress(32), { once:true });
    video.addEventListener('ended', () => {
      videoEnded = true;
      overlay.classList.add('holding');
      setProgress(Math.max(58, parseFloat(getComputedStyle(overlay).getPropertyValue('--catalog-progress')) || 0));
      finishIfReady();
    }, { once:true });
    video.addEventListener('error', () => { videoEnded = true; finishIfReady(); }, { once:true });
    video.addEventListener('abort', () => { videoEnded = true; finishIfReady(); }, { once:true });

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {
        const retry = () => {
          const second = video.play();
          if (second && typeof second.catch === 'function') second.catch(() => {
            videoEnded = true;
            finishIfReady();
          });
        };
        if (video.readyState >= 2) retry();
        else video.addEventListener('canplay', retry, { once:true });
      });
    }
  }

  const observer = new MutationObserver(() => finishIfReady());
  observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });

  const resourceObserver = typeof PerformanceObserver !== 'undefined'
    ? new PerformanceObserver(() => { resourceMilestones(); finishIfReady(); })
    : null;
  try { resourceObserver?.observe({ type:'resource', buffered:true }); } catch {}

  const poll = setInterval(() => {
    resourceMilestones();
    finishIfReady();
    if (finished) {
      clearInterval(poll);
      observer.disconnect();
      try { resourceObserver?.disconnect(); } catch {}
    }
  }, 100);

  // Safety: never trap the user. If boot is genuinely still running, reveal the clean V fallback,
  // not the recovered "Loading the live catalog..." copy.
  setTimeout(() => {
    if (finished) return;
    syncRecoveredLoader();
    if (videoEnded) {
      finished = true;
      overlay.classList.add('out');
      setTimeout(() => overlay.remove(), 360);
    }
  }, 9000);

  // Mark the recovered loader immediately, before React fills its text.
  syncRecoveredLoader();
})();
