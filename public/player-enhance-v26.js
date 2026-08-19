(() => {
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let portal = null;
  let host = null;
  let observer = null;
  let safetyTimer = null;
  const liveBound = new WeakSet();

  function cleanupMovieGate() {
    clearTimeout(safetyTimer);
    observer?.disconnect();
    observer = null;
    host = null;
    if (!portal) return;
    const old = portal;
    portal = null;
    old.classList.add('out');
    setTimeout(() => old.remove(), 520);
  }

  function movieGate(player) {
    if (!player || player === host) return;
    cleanupMovieGate();
    host = player;

    const title = player.querySelector('.playerTop b')?.textContent?.trim() || 'VELORA';
    const gate = document.createElement('div');
    gate.id = 'veloraPlaybackPortalV26';
    gate.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13 veloraPlaybackPortalV24';
    gate.innerHTML = `<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA</b><strong>${esc(title)}</strong><span data-vp-status>Finding source</span><div class="vpLine"><i></i></div>`;
    document.documentElement.appendChild(gate);
    portal = gate;

    const fill = gate.querySelector('.vpLine i');
    const label = gate.querySelector('[data-vp-status]');
    let shown = 0, target = 10, raf = 0;
    const render = () => {
      shown += (target - shown) * .18;
      if (Math.abs(target - shown) < .25) shown = target;
      fill?.style.setProperty('--vp-progress', String(shown / 100));
      raf = shown === target ? 0 : requestAnimationFrame(render);
    };
    const set = (n, text) => {
      target = Math.max(target, Math.min(100, Number(n) || 0));
      if (text && label) label.textContent = text;
      if (!raf) raf = requestAnimationFrame(render);
    };
    set(12, 'Finding source');

    const reveal = () => {
      if (host !== player || !portal) return;
      set(100, 'Ready');
      setTimeout(cleanupMovieGate, 120);
    };

    const bindFrame = frame => {
      if (!frame || frame.dataset.veloraGateV26 === '1') return;
      frame.dataset.veloraGateV26 = '1';
      set(58, 'Opening player');
      frame.addEventListener('load', () => {
        set(92, 'Player ready');
        setTimeout(reveal, 260);
      }, { once: true });
      // The iframe may have loaded before the observer saw it. Reveal quickly once
      // the actual provider frame exists; never keep the splash over a usable player.
      setTimeout(() => { if (document.contains(frame)) reveal(); }, 800);
    };

    bindFrame(player.querySelector('iframe.playerEmbed, iframe'));
    observer = new MutationObserver(() => {
      if (!document.contains(player)) return cleanupMovieGate();
      bindFrame(player.querySelector('iframe.playerEmbed, iframe'));
      const note = player.querySelector('.playerNote')?.textContent || '';
      if (/no source|unavailable|resolver is unavailable|could not map/i.test(note)) {
        if (label) label.textContent = note.trim() || 'Source unavailable';
        gate.classList.add('veloraPlaybackError');
        setTimeout(cleanupMovieGate, 1200);
      }
    });
    observer.observe(player, { childList:true, subtree:true, characterData:true });

    // Fail open. Cosmetic splash must never be capable of blocking playback.
    safetyTimer = setTimeout(cleanupMovieGate, 5000);
  }

  function liveGate(w) {
    if (!w || w.dataset.veloraLiveGateV26 === '1') return;
    w.dataset.veloraLiveGateV26 = '1';
    const stage = w.querySelector('.liveStage');
    if (!stage) return;
    const gate = document.createElement('div');
    gate.className = 'veloraPlaybackGateV12 veloraPlaybackGateV13 liveGate';
    gate.innerHTML = '<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA LIVE</b><span data-vp-status>Tuning stream</span><div class="vpLine"><i></i></div>';
    stage.appendChild(gate);
    const fill = gate.querySelector('.vpLine i');
    const label = gate.querySelector('[data-vp-status]');
    let p = 8;
    const set = (n, text='') => { p = Math.max(p, Number(n)||0); fill?.style.setProperty('--vp-progress', String(p/100)); if (text && label) label.textContent=text; };
    const ready = () => { set(100,'Ready'); setTimeout(()=>{ w.classList.add('veloraMediaReady'); gate.classList.add('out'); setTimeout(()=>gate.remove(),520); },90); };
    const bind = media => {
      if (!media || liveBound.has(media)) return;
      liveBound.add(media);
      if (media.tagName === 'VIDEO') {
        media.addEventListener('loadedmetadata',()=>set(82,'Media ready'),{once:true});
        media.addEventListener('canplay',()=>set(96,'Starting playback'),{once:true});
        media.addEventListener('playing',ready,{once:true});
      } else media.addEventListener('load',()=>{set(94,'Player ready');setTimeout(ready,120)},{once:true});
    };
    bind(stage.querySelector('video,iframe'));
    new MutationObserver(()=>bind(stage.querySelector('video,iframe'))).observe(stage,{childList:true,subtree:true});
  }

  function scan() {
    const player = document.querySelector('.player');
    if (player) movieGate(player); else cleanupMovieGate();
    document.querySelectorAll('.livePlayerOverlay').forEach(liveGate);
  }
  new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});
  scan();
})();
