(() => {
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = n => Math.max(0, Math.min(100, Number(n) || 0));
  const bound = new WeakSet();

  function titleOf(player) {
    return player.querySelector('.playerTop b')?.textContent?.trim() || 'VELORA';
  }

  function bindProgress(gate, host) {
    const fill = gate.querySelector('.vpLine i');
    const label = gate.querySelector('[data-vp-status]');
    let shown = 0, raf = 0, target = clamp(host?.dataset?.veloraProgress || 8);
    const render = () => {
      shown += (target - shown) * .22;
      if (Math.abs(target - shown) < .25) shown = target;
      fill?.style.setProperty('--vp-progress', String(shown / 100));
      if (shown !== target) raf = requestAnimationFrame(render); else raf = 0;
    };
    const set = (n, text = '') => {
      target = Math.max(target, clamp(n));
      if (text && label) label.textContent = text;
      if (!raf) raf = requestAnimationFrame(render);
    };
    set(target, host?.dataset?.veloraProgressLabel || 'Finding source');
    host?.addEventListener('velora:stream-progress', e => set(e.detail?.value, e.detail?.label));
    return set;
  }

  function hasRealVideoSource(video) {
    return Boolean(video?.currentSrc || video?.src || video?.querySelector?.('source[src]'));
  }

  function sourceFailureText(player) {
    const text = player.querySelector('.playerNote')?.textContent?.trim() || '';
    if (!text) return '';
    return /unavailable|no source|no working source|failed|not configured|could not/i.test(text) ? text : '';
  }

  function addGate(player) {
    if (!player || player.dataset.veloraPlayerV21 === '1') return;
    player.dataset.veloraPlayerV21 = '1';
    player.classList.add('veloraPlayerV13');

    const gate = document.createElement('div');
    gate.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13';
    gate.innerHTML = `<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA</b><strong>${esc(titleOf(player))}</strong><span data-vp-status>Finding source</span><div class="vpLine"><i></i></div>`;
    player.appendChild(gate);
    const setProgress = bindProgress(gate, player);
    let done = false;
    let embedFallback = 0;

    const markReady = () => {
      if (done || !gate.isConnected) return;
      done = true;
      clearTimeout(embedFallback);
      setProgress(100, 'Ready');
      setTimeout(() => {
        player.classList.add('veloraPlayerReady');
        gate.classList.add('out');
        setTimeout(() => gate.remove(), 520);
      }, 70);
    };

    const showFailure = text => {
      if (done || !gate.isConnected) return;
      clearTimeout(embedFallback);
      setProgress(100, 'Playback source unavailable');
      const strong = gate.querySelector('strong');
      const label = gate.querySelector('[data-vp-status]');
      if (strong) strong.textContent = titleOf(player);
      if (label) label.textContent = text || 'Could not start this title. Use Back and try another source.';
      gate.classList.add('veloraPlaybackError');
    };

    const bindMedia = media => {
      if (!media || bound.has(media) || done) return;

      if (media.tagName === 'VIDEO') {
        // React creates an empty VIDEO while /api/resolve is still running. Do not mistake that
        // placeholder for a real source and leave the user stuck forever on "Loading media".
        if (!hasRealVideoSource(media)) {
          setProgress(18, 'Finding source');
          return;
        }
        bound.add(media);
        setProgress(40, 'Loading media');
        media.addEventListener('loadedmetadata', () => setProgress(78, 'Media ready'), { once: true });
        media.addEventListener('canplay', () => setProgress(94, 'Starting playback'), { once: true });
        media.addEventListener('playing', markReady, { once: true });
        media.addEventListener('error', () => showFailure('This playback source failed to load.'), { once: true });
        if (media.readyState >= 1) setProgress(78, 'Media ready');
        if (media.readyState >= 3) setProgress(94, 'Starting playback');
        if (!media.paused && media.currentTime > 0) markReady();
        return;
      }

      if (media.tagName === 'IFRAME') {
        if (!media.src) return;
        bound.add(media);
        setProgress(50, 'Opening player');
        media.addEventListener('load', () => {
          setProgress(94, 'Player ready');
          setTimeout(markReady, 80);
        }, { once: true });
        // Cross-origin embeds can complete before a MutationObserver attaches the load handler.
        // Once a real embed URL exists, reveal it quickly instead of permanently covering a valid player.
        embedFallback = setTimeout(() => markReady(), 1400);
      }
    };

    const inspect = () => {
      if (done || !gate.isConnected) return;
      const failure = sourceFailureText(player);
      if (failure) {
        showFailure(failure);
        return;
      }
      const iframe = player.querySelector('iframe.playerEmbed[src], iframe[src]');
      const video = player.querySelector('video');
      if (iframe) bindMedia(iframe);
      else if (video) bindMedia(video);
    };

    inspect();
    const mo = new MutationObserver(inspect);
    mo.observe(player, { childList: true, subtree: true, characterData: true });

    // Do not fake success after a timer. A source must actually materialize.
    setTimeout(() => {
      if (done || !gate.isConnected) return;
      const failure = sourceFailureText(player);
      if (failure) showFailure(failure);
      else if (!player.querySelector('iframe[src]') && !hasRealVideoSource(player.querySelector('video'))) {
        showFailure('No playable source was returned for this title.');
      }
      mo.disconnect();
    }, 10000);
  }

  function addLiveGate(w) {
    if (w.dataset.veloraLiveGateV13 === '1') return;
    w.dataset.veloraLiveGateV13 = '1';
    const stage = w.querySelector('.liveStage');
    if (!stage) return;
    const gate = document.createElement('div');
    gate.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13 liveGate';
    gate.innerHTML = '<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA LIVE</b><span data-vp-status>Tuning stream</span><div class="vpLine"><i></i></div>';
    stage.appendChild(gate);
    const setProgress = bindProgress(gate, w);
    let readyDone = false;
    const ready = () => {
      if (readyDone) return;
      readyDone = true;
      setProgress(100, 'Ready');
      setTimeout(() => {
        w.classList.add('veloraMediaReady');
        gate.classList.add('out');
        setTimeout(() => gate.remove(), 520);
      }, 90);
    };
    const bind = m => {
      if (!m || bound.has(m)) return;
      bound.add(m);
      if (m.tagName === 'VIDEO') {
        m.addEventListener('loadedmetadata', () => setProgress(82, 'Media ready'), { once: true });
        m.addEventListener('canplay', () => setProgress(96, 'Starting playback'), { once: true });
        m.addEventListener('playing', ready, { once: true });
      } else {
        m.addEventListener('load', () => { setProgress(94, 'Player ready'); setTimeout(ready, 120); }, { once: true });
      }
    };
    bind(stage.querySelector('video,iframe'));
    new MutationObserver(() => bind(stage.querySelector('video,iframe'))).observe(stage, { childList: true });
  }

  function scan() {
    document.querySelectorAll('.player').forEach(addGate);
    document.querySelectorAll('.livePlayerOverlay').forEach(addLiveGate);
  }
  new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true });
  scan();
})();
