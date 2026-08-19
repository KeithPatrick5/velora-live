(() => {
  const overlay = document.getElementById('veloraSiteIntroV19');
  const video = document.getElementById('veloraSiteIntroVideoV19');
  if (!overlay || !video) return;

  const started = performance.now();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let videoDone = reduced;
  let appReady = false;
  let finished = false;
  let maxSeen = 4;

  const setProgress = (value) => {
    maxSeen = Math.max(maxSeen, Math.min(100, Number(value) || 0));
    overlay.style.setProperty('--intro-progress', `${maxSeen}%`);
  };

  const detectAppReady = () => {
    // These only exist once the recovered React app has moved past its boot state.
    appReady = !!document.querySelector('.navShell, .cinemaHero, .browseLanding, .livePage, .libraryPage');
    if (appReady) setProgress(100);
    return appReady;
  };

  const reveal = () => {
    if (finished) return;
    finished = true;
    setProgress(100);
    try { sessionStorage.setItem('velora-site-intro-seen', '1'); } catch {}
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 360);
  };

  const hold = () => {
    if (videoDone) return;
    videoDone = true;
    overlay.classList.add('holding');
    video.pause();
    setProgress(Math.max(90, maxSeen));
  };

  const maybeFinish = () => {
    detectAppReady();
    if (videoDone && appReady) reveal();
  };

  // First visit per tab/session only. Do not let a stale flag hide a broken page forever.
  try {
    if (sessionStorage.getItem('velora-site-intro-seen') === '1') {
      overlay.remove();
      return;
    }
  } catch {}

  setProgress(6);
  document.addEventListener('DOMContentLoaded', () => setProgress(12), { once: true });

  if (reduced) {
    overlay.classList.add('holding');
    setProgress(90);
  } else {
    // Safari requires muted + playsinline for autoplay. Set both attributes and properties.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    video.addEventListener('loadedmetadata', () => setProgress(18), { once: true });
    video.addEventListener('loadeddata', () => setProgress(24), { once: true });
    video.addEventListener('canplay', () => setProgress(30), { once: true });
    video.addEventListener('playing', () => setProgress(34), { once: true });
    video.addEventListener('timeupdate', () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      // Video progress is real. Reserve the last 10% for the app becoming ready.
      setProgress(34 + (video.currentTime / video.duration) * 56);
    });
    video.addEventListener('ended', () => { hold(); maybeFinish(); }, { once: true });
    video.addEventListener('error', () => { hold(); maybeFinish(); }, { once: true });
    video.addEventListener('abort', () => { hold(); maybeFinish(); }, { once: true });
    video.addEventListener('stalled', () => {
      // Do not turn a transient Safari stall into a black screen. The poster/hold remains visible.
      if (performance.now() - started > 1800 && video.currentTime < 0.1) hold();
    });

    const p = video.play();
    if (p?.catch) {
      p.catch(() => {
        // Safari may defer autoplay until enough media is available. Retry once on canplay.
        const retry = () => {
          const second = video.play();
          second?.catch?.(() => { hold(); maybeFinish(); });
        };
        if (video.readyState >= 3) retry();
        else video.addEventListener('canplay', retry, { once: true });
      });
    }
  }

  const observer = new MutationObserver(maybeFinish);
  observer.observe(document.body, { childList: true, subtree: true });

  const poll = setInterval(() => {
    maybeFinish();
    if (finished) {
      clearInterval(poll);
      observer.disconnect();
    }
  }, 100);

  // The intro itself must never be able to trap the site.
  setTimeout(() => {
    if (!finished) reveal();
  }, 8000);
})();
