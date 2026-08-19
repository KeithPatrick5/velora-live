(() => {
  const root = document.documentElement;
  if (!root) return;

  const SESSION_KEY = 'veloraSiteIntroSeenV16';
  const reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let alreadySeen = false;
  try { alreadySeen = sessionStorage.getItem(SESSION_KEY) === '1'; } catch {}

  // This is ONLY the first-visit site intro. Player/video loading is handled elsewhere.
  if (alreadySeen || reduceMotion) {
    root.classList.add('veloraBootDone');
    return;
  }

  root.classList.add('veloraSiteIntroActive');

  const overlay = document.createElement('div');
  overlay.id = 'veloraSiteIntroV16';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <video id="veloraSiteIntroVideoV16" muted playsinline preload="auto" disablepictureinpicture>
      <source src="/media/velora-site-intro.mp4" type="video/mp4">
    </video>
  `;
  root.appendChild(overlay);

  const video = overlay.querySelector('video');
  const startedAt = performance.now();
  let finished = false;

  const appReady = () => !!document.body?.querySelector(
    '.navShell,.cinemaHero,.browseLanding,.livePage,.duloLiveShell'
  );

  const finish = (force = false) => {
    if (finished) return;
    if (!force && !appReady()) return;
    finished = true;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    overlay.classList.add('out');
    root.classList.remove('veloraSiteIntroActive');
    root.classList.add('veloraBootDone');
    setTimeout(() => overlay.remove(), 430);
  };

  // The clip is ~4s after acceleration. If the app is ready when it ends, reveal immediately.
  video.addEventListener('ended', () => finish(false), { once: true });

  // If the app is a hair late, hold the final black frame briefly instead of flashing old loader UI.
  const readyPoll = setInterval(() => {
    if (finished) return clearInterval(readyPoll);
    if (video.ended && appReady()) finish(true);
  }, 60);

  // Never allow intro failure to trap the user on black.
  const hardStop = setTimeout(() => finish(true), 5200);
  const cleanup = () => {
    clearInterval(readyPoll);
    clearTimeout(hardStop);
  };
  overlay.addEventListener('transitionend', cleanup, { once: true });

  const play = () => {
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => finish(true));
    }
  };

  if (video.readyState >= 2) play();
  else video.addEventListener('canplay', play, { once: true });

  // Fallback if canplay never fires.
  setTimeout(() => {
    if (!finished && performance.now() - startedAt > 900 && video.paused) play();
  }, 950);
})();
