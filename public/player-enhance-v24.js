(() => {
  const clamp = n => Math.max(0, Math.min(100, Number(n) || 0));
  const liveBound = new WeakSet();
  let moviePortal = null;
  let movieHost = null;
  let movieObserver = null;
  let portalTimer = null;

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function removeMoviePortal() {
    clearTimeout(portalTimer);
    movieObserver?.disconnect();
    movieObserver = null;
    movieHost = null;
    if (moviePortal) {
      moviePortal.classList.add('out');
      const old = moviePortal;
      moviePortal = null;
      setTimeout(() => old.remove(), 420);
    }
  }

  function makeMoviePortal(player) {
    if (!player || player === movieHost) return;
    removeMoviePortal();
    movieHost = player;

    const title = player.querySelector('.playerTop b')?.textContent?.trim() || 'VELORA';
    const portal = document.createElement('div');
    portal.id = 'veloraPlaybackPortalV24';
    portal.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13 veloraPlaybackPortalV24';
    portal.innerHTML = `<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA</b><strong>${esc(title)}</strong><span data-vp-status>Finding source</span><div class="vpLine"><i></i></div>`;
    document.documentElement.appendChild(portal);
    moviePortal = portal;

    const fill = portal.querySelector('.vpLine i');
    const label = portal.querySelector('[data-vp-status]');
    let shown = 0;
    let target = 10;
    let raf = 0;
    const render = () => {
      shown += (target - shown) * .2;
      if (Math.abs(target - shown) < .3) shown = target;
      fill?.style.setProperty('--vp-progress', String(shown / 100));
      raf = shown === target ? 0 : requestAnimationFrame(render);
    };
    const set = (n, text) => {
      target = Math.max(target, clamp(n));
      if (text && label) label.textContent = text;
      if (!raf) raf = requestAnimationFrame(render);
    };
    set(12, 'Finding source');

    const ready = () => {
      if (!moviePortal || movieHost !== player) return;
      set(100, 'Ready');
      setTimeout(removeMoviePortal, 120);
    };

    const bindFrame = frame => {
      if (!frame || frame.dataset.veloraBoundV24 === '1') return;
      frame.dataset.veloraBoundV24 = '1';
      set(72, 'Opening player');
      // The provider iframe itself owns the remaining playback loading state.
      // Do not cover it for several seconds just because its internal player is busy.
      setTimeout(() => { if (document.contains(frame)) ready(); }, 420);
      frame.addEventListener('load', () => {
        set(92, 'Player ready');
        setTimeout(ready, 280);
      }, { once: true });
      // If the iframe was already loaded before we attached, don't strand the gate.
      setTimeout(() => {
        if (document.contains(frame)) {
          set(92, 'Player ready');
          ready();
        }
      }, 900);
    };

    bindFrame(player.querySelector('iframe.playerEmbed, iframe'));
    movieObserver = new MutationObserver(() => {
      if (!document.contains(player)) return removeMoviePortal();
      bindFrame(player.querySelector('iframe.playerEmbed, iframe'));
      const note = player.querySelector('.playerNote')?.textContent || '';
      if (/unavailable|could not map|no source|resolver is unavailable/i.test(note)) {
        label.textContent = note.trim() || 'Source unavailable';
        portal.classList.add('veloraPlaybackError');
        setTimeout(removeMoviePortal, 1800);
      }
    });
    movieObserver.observe(player, { childList: true, subtree: true, characterData: true });

    // Never block navigation forever if an upstream provider stalls.
    portalTimer = setTimeout(removeMoviePortal, 2800);
  }

  function addLiveGate(w) {
    if (!w || w.dataset.veloraLiveGateV24 === '1') return;
    w.dataset.veloraLiveGateV24 = '1';
    const stage = w.querySelector('.liveStage');
    if (!stage) return;

    const gate = document.createElement('div');
    gate.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13 liveGate';
    gate.innerHTML = '<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA LIVE</b><span data-vp-status>Tuning stream</span><div class="vpLine"><i></i></div>';
    stage.appendChild(gate);

    let progress = 8;
    const set = (n, text = '') => {
      progress = Math.max(progress, clamp(n));
      gate.querySelector('.vpLine i')?.style.setProperty('--vp-progress', String(progress / 100));
      const label = gate.querySelector('[data-vp-status]');
      if (text && label) label.textContent = text;
    };
    const ready = () => {
      set(100, 'Ready');
      setTimeout(() => {
        w.classList.add('veloraMediaReady');
        gate.classList.add('out');
        setTimeout(() => gate.remove(), 520);
      }, 90);
    };
    const bind = media => {
      if (!media || liveBound.has(media)) return;
      liveBound.add(media);
      if (media.tagName === 'VIDEO') {
        media.addEventListener('loadedmetadata', () => set(82, 'Media ready'), { once: true });
        media.addEventListener('canplay', () => set(96, 'Starting playback'), { once: true });
        media.addEventListener('playing', ready, { once: true });
      } else {
        media.addEventListener('load', () => { set(94, 'Player ready'); setTimeout(ready, 120); }, { once: true });
      }
    };
    bind(stage.querySelector('video,iframe'));
    new MutationObserver(() => bind(stage.querySelector('video,iframe'))).observe(stage, { childList: true, subtree: true });
  }

  function scan() {
    const player = document.querySelector('.player');
    if (player && !player.querySelector('iframe.playerEmbed, iframe')) makeMoviePortal(player);
    else if (player && player !== movieHost) makeMoviePortal(player);
    else if (!player) removeMoviePortal();
    document.querySelectorAll('.livePlayerOverlay').forEach(addLiveGate);
  }

  window.addEventListener('message', e => {
    if (!moviePortal) return;
    if (e.origin === 'https://vidlink.pro' && e.data?.type === 'PLAYER_EVENT' && e.data?.data?.event === 'play') {
      removeMoviePortal();
    }
  });

  new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true });
  scan();
})();
