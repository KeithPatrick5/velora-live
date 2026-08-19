(() => {
  const ID = 'veloraSiteIntroV22';
  if (document.getElementById(ID)) return;

  const overlay = document.createElement('div');
  overlay.id = ID;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <video id="veloraSiteIntroVideoV22" muted autoplay playsinline preload="auto" poster="/media/velora-site-intro-poster.jpg" disablepictureinpicture>
      <source src="/media/velora-site-intro.mp4" type="video/mp4">
    </video>
    <div class="veloraIntroProgress"><i></i></div>`;

  // Keep the intro out of React's body-owned subtree. The recovered app may replace BODY
  // during hydration, but this HTML-level sibling survives that reconciliation.
  document.documentElement.appendChild(overlay);

  const video = overlay.querySelector('video');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let finished = false;
  let fallbackTimer = 0;
  let keepAlive = null;

  const setProgress = value => {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    overlay.style.setProperty('--intro-progress', `${safe}%`);
  };

  const reveal = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallbackTimer);
    keepAlive?.disconnect();
    setProgress(100);
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 280);
  };

  // If the framework reconciles <html> once during boot and removes unknown children,
  // restore this exact element. This preserves the same <video> and currentTime.
  keepAlive = new MutationObserver(() => {
    if (!finished && !overlay.isConnected) {
      try { document.documentElement.appendChild(overlay); } catch {}
    }
  });
  keepAlive.observe(document.documentElement, { childList: true });

  setProgress(2);
  if (reduced) {
    setProgress(100);
    setTimeout(reveal, 180);
    return;
  }

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.addEventListener('loadedmetadata', () => setProgress(6), { once: true });
  video.addEventListener('playing', () => setProgress(10), { once: true });
  video.addEventListener('timeupdate', () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    setProgress(10 + (video.currentTime / video.duration) * 88);
  });
  video.addEventListener('ended', reveal, { once: true });

  const failOpen = () => setTimeout(reveal, 80);
  video.addEventListener('error', failOpen, { once: true });
  video.addEventListener('abort', failOpen, { once: true });

  const play = video.play();
  play?.catch?.(() => {
    const retry = () => video.play()?.catch?.(failOpen);
    if (video.readyState >= 3) retry();
    else video.addEventListener('canplay', retry, { once: true });
    setTimeout(() => {
      if (!finished && video.paused && video.currentTime < 0.05) failOpen();
    }, 900);
  });

  // The encoded intro is ~4.04s. This is crash protection, not pacing.
  fallbackTimer = setTimeout(reveal, 4700);
})();
