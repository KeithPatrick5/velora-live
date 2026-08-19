(() => {
  const clamp = n => Math.max(0, Math.min(100, Number(n) || 0));
  const liveBound = new WeakSet();

  // IMPORTANT: Movie/show playback is intentionally untouched here.
  // The recovered React player owns `.player` and must be free to replace
  // its temporary <video> placeholder with the Videasy iframe.
  function addLiveGate(w) {
    if (!w || w.dataset.veloraLiveGateV23 === '1') return;
    w.dataset.veloraLiveGateV23 = '1';
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
        media.addEventListener('load', () => {
          set(94, 'Player ready');
          setTimeout(ready, 120);
        }, { once: true });
      }
    };

    bind(stage.querySelector('video,iframe'));
    new MutationObserver(() => bind(stage.querySelector('video,iframe')))
      .observe(stage, { childList: true, subtree: true });
  }

  function scan() {
    document.querySelectorAll('.livePlayerOverlay').forEach(addLiveGate);
  }

  new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true });
  scan();
})();
