(() => {
  const overlay = document.getElementById('veloraSiteIntroV20');
  const video = document.getElementById('veloraSiteIntroVideoV20');
  if (!overlay || !video) return;

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let finished = false;
  let fallbackTimer = 0;

  const setProgress = (value) => {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    overlay.style.setProperty('--intro-progress', `${safe}%`);
  };

  const reveal = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
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

  // The application loads normally underneath this overlay. The intro never waits on React,
  // the catalog, network probes, or any application-specific selector.
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

  const play = video.play();
  play?.catch?.(() => {
    // Retry once when Safari reports enough media, then immediately fail open if autoplay
    // still cannot begin. Never hold a black overlay waiting for user interaction.
    const retry = () => {
      const second = video.play();
      second?.catch?.(failOpen);
    };
    if (video.readyState >= 3) retry();
    else {
      video.addEventListener('canplay', retry, { once: true });
      setTimeout(() => {
        if (!finished && video.paused && video.currentTime < 0.05) failOpen();
      }, 900);
    }
  });

  // Source is ~4.04 seconds. This is only a crash-safe escape hatch, not normal timing.
  fallbackTimer = setTimeout(reveal, 4700);
})();
