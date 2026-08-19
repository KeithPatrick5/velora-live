(() => {
  const overlay = document.getElementById('veloraSiteIntroV21');
  const video = document.getElementById('veloraSiteIntroVideoV21');
  if (!overlay || !video) return;

  // The recovered React application hydrates/replaces BODY children. Keep the first-visit
  // intro outside BODY so hydration cannot delete it a fraction of a second after playback starts.
  // DOM appendChild after parsing preserves it as a fixed HTML child in Safari/Chromium.
  try { document.documentElement.appendChild(overlay); } catch {}

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let finished = false;
  let fallbackTimer = 0;
  let keepAlive = null;

  const setProgress = (value) => {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    overlay.style.setProperty('--intro-progress', `${safe}%`);
  };

  const reveal = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    keepAlive?.disconnect();
    try { sessionStorage.setItem('velora-site-intro-seen', '1'); } catch {}
    setProgress(100);
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 280);
  };

  try {
    if (sessionStorage.getItem('velora-site-intro-seen') === '1') {
      overlay.remove();
      return;
    }
  } catch {}

  // If a framework reconciliation ever removes our HTML-level overlay while the intro is running,
  // restore the same element (and same video state) rather than creating/restarting a new video.
  keepAlive = new MutationObserver(() => {
    if (!finished && !overlay.isConnected) {
      try { document.documentElement.appendChild(overlay); } catch {}
    }
  });
  keepAlive.observe(document.documentElement, { childList: true });

  setProgress(2);
  if (reduced) {
    setProgress(100);
    setTimeout(reveal, 220);
    return;
  }

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.addEventListener('loadedmetadata', () => setProgress(5), { once: true });
  video.addEventListener('playing', () => setProgress(8), { once: true });
  video.addEventListener('timeupdate', () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    setProgress(8 + (video.currentTime / video.duration) * 90);
  });
  video.addEventListener('ended', reveal, { once: true });

  const failOpen = () => setTimeout(reveal, 120);
  video.addEventListener('error', failOpen, { once: true });
  video.addEventListener('abort', failOpen, { once: true });

  const attempt = () => {
    const play = video.play();
    play?.catch?.(() => {
      const retry = () => video.play()?.catch?.(failOpen);
      if (video.readyState >= 3) retry();
      else {
        video.addEventListener('canplay', retry, { once: true });
        setTimeout(() => {
          if (!finished && video.paused && video.currentTime < 0.05) failOpen();
        }, 900);
      }
    });
  };
  attempt();

  // The source is ~4.04 s. This remains crash protection only.
  fallbackTimer = setTimeout(reveal, 4700);
})();
