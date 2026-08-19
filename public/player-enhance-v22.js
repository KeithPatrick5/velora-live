(() => {
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = n => Math.max(0, Math.min(100, Number(n) || 0));
  const liveBound = new WeakSet();
  let activePlayer = null;
  let portal = null;
  let playerObserver = null;
  let sourceTimeout = 0;
  let readyTimeout = 0;

  function titleOf(player) {
    return player?.querySelector('.playerTop b')?.textContent?.trim() || 'VELORA';
  }

  function createPortal(player) {
    removePortal();
    activePlayer = player;
    portal = document.createElement('div');
    portal.id = 'veloraPlaybackPortalV22';
    portal.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13 veloraPlaybackPortalV22';
    portal.innerHTML = `<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA</b><strong>${esc(titleOf(player))}</strong><span data-vp-status>Finding source</span><div class="vpLine"><i></i></div>`;
    document.documentElement.appendChild(portal);
    setProgress(8, 'Finding source');

    playerObserver = new MutationObserver(inspectPlayer);
    playerObserver.observe(player, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src'] });
    inspectPlayer();

    sourceTimeout = setTimeout(() => {
      if (!portal || !activePlayer?.isConnected) return;
      const failure = sourceFailureText(activePlayer);
      if (failure) showFailure(failure);
      else if (!activePlayer.querySelector('iframe[src]') && !hasRealVideoSource(activePlayer.querySelector('video'))) {
        showFailure('No playable source was returned for this title.');
      }
    }, 10000);
  }

  function removePortal() {
    clearTimeout(sourceTimeout);
    clearTimeout(readyTimeout);
    playerObserver?.disconnect();
    playerObserver = null;
    portal?.remove();
    portal = null;
    activePlayer = null;
  }

  function setProgress(value, text = '') {
    if (!portal) return;
    const safe = clamp(value);
    portal.style.setProperty('--vp-progress', String(safe / 100));
    const label = portal.querySelector('[data-vp-status]');
    if (text && label) label.textContent = text;
  }

  function markReady(label = 'Ready') {
    if (!portal) return;
    clearTimeout(sourceTimeout);
    clearTimeout(readyTimeout);
    setProgress(100, label);
    const current = portal;
    portal = null;
    activePlayer = null;
    playerObserver?.disconnect();
    playerObserver = null;
    setTimeout(() => {
      current.classList.add('out');
      setTimeout(() => current.remove(), 430);
    }, 40);
  }

  function showFailure(text) {
    if (!portal) return;
    clearTimeout(sourceTimeout);
    clearTimeout(readyTimeout);
    setProgress(100, 'Playback source unavailable');
    const label = portal.querySelector('[data-vp-status]');
    if (label) label.textContent = text || 'Could not start this title. Use Back and try another source.';
    portal.classList.add('veloraPlaybackError');
  }

  function hasRealVideoSource(video) {
    return Boolean(video?.currentSrc || video?.getAttribute?.('src') || video?.querySelector?.('source[src]'));
  }

  function sourceFailureText(player) {
    const text = player?.querySelector('.playerNote')?.textContent?.trim() || '';
    if (!text) return '';
    return /unavailable|no source|no working source|failed|not configured|could not|resolver is unavailable|no playable/i.test(text) ? text : '';
  }

  function bindIframe(iframe) {
    if (!portal || iframe.dataset.veloraGateBoundV22 === '1') return;
    iframe.dataset.veloraGateBoundV22 = '1';
    setProgress(62, 'Opening player');
    const ready = () => markReady('Player ready');
    iframe.addEventListener('load', ready, { once: true });

    // Most cross-origin embeds paint before parent code can introspect them. Never make the
    // cosmetic gate a dependency for playback: once React has produced the real iframe,
    // uncover it quickly even if Safari fired its load event before this listener was attached.
    clearTimeout(readyTimeout);
    readyTimeout = setTimeout(ready, 650);
  }

  function bindVideo(video) {
    if (!portal || video.dataset.veloraGateBoundV22 === '1' || !hasRealVideoSource(video)) return;
    video.dataset.veloraGateBoundV22 = '1';
    setProgress(44, 'Loading media');
    video.addEventListener('loadedmetadata', () => setProgress(78, 'Media ready'), { once: true });
    video.addEventListener('canplay', () => markReady('Media ready'), { once: true });
    video.addEventListener('playing', () => markReady('Playing'), { once: true });
    video.addEventListener('error', () => showFailure('This playback source failed to load.'), { once: true });
    if (video.readyState >= 3) markReady('Media ready');
    else {
      clearTimeout(readyTimeout);
      // The native player can communicate a network error more accurately than our cover can.
      readyTimeout = setTimeout(() => markReady('Player ready'), 1800);
    }
  }

  function inspectPlayer() {
    if (!portal || !activePlayer?.isConnected) return;
    const failure = sourceFailureText(activePlayer);
    if (failure) return showFailure(failure);
    const iframe = activePlayer.querySelector('iframe.playerEmbed[src], iframe[src]');
    if (iframe) return bindIframe(iframe);
    const video = activePlayer.querySelector('video');
    if (hasRealVideoSource(video)) return bindVideo(video);
    setProgress(18, 'Finding source');
  }

  // Preserve the existing live-player loading behavior. Only movie/show playback moved out of
  // React-owned DOM so the cosmetic loader cannot interfere with source reconciliation.
  function addLiveGate(w) {
    if (w.dataset.veloraLiveGateV22 === '1') return;
    w.dataset.veloraLiveGateV22 = '1';
    const stage = w.querySelector('.liveStage');
    if (!stage) return;
    const gate = document.createElement('div');
    gate.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13 liveGate';
    gate.innerHTML = '<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA LIVE</b><span data-vp-status>Tuning stream</span><div class="vpLine"><i></i></div>';
    stage.appendChild(gate);
    let progress = 8;
    const set = (n, text='') => {
      progress = Math.max(progress, clamp(n));
      gate.querySelector('.vpLine i')?.style.setProperty('--vp-progress', String(progress / 100));
      if (text) gate.querySelector('[data-vp-status]').textContent = text;
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
    new MutationObserver(() => bind(stage.querySelector('video,iframe'))).observe(stage, { childList: true });
  }

  function scan() {
    const player = document.querySelector('.player');
    if (player && player !== activePlayer && !portal) createPortal(player);
    if (!player && (activePlayer || portal)) removePortal();
    document.querySelectorAll('.livePlayerOverlay').forEach(addLiveGate);
  }

  new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true });
  scan();
})();
