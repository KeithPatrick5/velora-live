(() => {
  const SESSION_KEY = 'veloraSiteIntroSeenV17';
  const reduceMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let alreadySeen = false;
  try { alreadySeen = sessionStorage.getItem(SESSION_KEY) === '1'; } catch {}
  if (alreadySeen || reduceMotion) return;

  const overlay = document.createElement('div');
  overlay.id = 'veloraSiteIntroV17';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <video id="veloraSiteIntroVideoV17" muted autoplay playsinline preload="auto" disablepictureinpicture>
      <source src="/media/velora-site-intro.mp4" type="video/mp4">
    </video>`;

  // Append only after body exists. If anything below fails, the page itself is never hidden.
  (document.body || document.documentElement).appendChild(overlay);
  const video = overlay.querySelector('video');
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 380);
  };

  video.addEventListener('ended', finish, { once:true });
  video.addEventListener('error', finish, { once:true });
  video.addEventListener('abort', finish, { once:true });
  video.addEventListener('stalled', () => setTimeout(finish, 700), { once:true });

  // Safari occasionally rejects the first autoplay attempt during restoration/navigation.
  const p = video.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {
      // One fast retry after metadata/canplay, then get out of the user's way.
      const retry = () => {
        const p2 = video.play();
        if (p2 && typeof p2.catch === 'function') p2.catch(finish);
      };
      if (video.readyState >= 2) retry();
      else video.addEventListener('canplay', retry, { once:true });
      setTimeout(() => { if (video.paused) finish(); }, 1200);
    });
  }

  // Absolute failsafe. This overlay can never leave the site black indefinitely.
  setTimeout(finish, 4700);
})();
