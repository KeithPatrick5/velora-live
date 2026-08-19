(() => {
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function titleOf(player){return player.querySelector('.playerTop b')?.textContent?.trim() || 'VELORA';}
  function addGate(player){
    if(!player || player.dataset.veloraPlayerV12==='1') return;
    player.dataset.veloraPlayerV12='1';
    player.classList.add('veloraPlayerV12');
    const gate=document.createElement('div'); gate.className='veloraPlaybackGateV12';
    gate.innerHTML=`<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA</b><strong>${esc(titleOf(player))}</strong><span>Preparing your stream</span><div class="vpLine"><i></i></div>`;
    player.appendChild(gate);
    const note=player.querySelector('.playerNote'); if(note) note.style.display='none';
    const markReady=()=>{player.classList.add('veloraPlayerReady');gate.classList.add('out');setTimeout(()=>gate.remove(),520)};
    const media=player.querySelector('video,iframe');
    if(media){
      if(media.tagName==='VIDEO'){
        if(media.readyState>=2) markReady();
        else ['loadeddata','canplay','playing'].forEach(e=>media.addEventListener(e,markReady,{once:true}));
      } else media.addEventListener('load',()=>setTimeout(markReady,180),{once:true});
    }
    const mo=new MutationObserver(()=>{
      const m=player.querySelector('video,iframe'); if(!m)return;
      if(m.tagName==='VIDEO') ['loadeddata','canplay','playing'].forEach(e=>m.addEventListener(e,markReady,{once:true}));
      else m.addEventListener('load',()=>setTimeout(markReady,180),{once:true});
    });
    mo.observe(player,{childList:true,subtree:true});
    setTimeout(()=>{mo.disconnect(); if(document.contains(gate)) markReady()},9000);
  }
  function scan(){document.querySelectorAll('.player').forEach(addGate);document.querySelectorAll('.livePlayerOverlay').forEach(w=>{
    if(w.dataset.veloraLiveGate==='1')return; w.dataset.veloraLiveGate='1';
    const stage=w.querySelector('.liveStage'); if(!stage)return;
    const gate=document.createElement('div');gate.className='veloraPlaybackGateV12 liveGate';gate.innerHTML='<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA LIVE</b><span>Tuning stream</span><div class="vpLine"><i></i></div>';stage.appendChild(gate);
    const ready=()=>{w.classList.add('veloraMediaReady');gate.classList.add('out');setTimeout(()=>gate.remove(),520)};
    const media=stage.querySelector('video,iframe'); if(media){if(media.tagName==='VIDEO'){['loadeddata','canplay','playing'].forEach(e=>media.addEventListener(e,ready,{once:true}))}else media.addEventListener('load',()=>setTimeout(ready,180),{once:true})}
    new MutationObserver(()=>{const m=stage.querySelector('video,iframe');if(!m)return;if(m.tagName==='VIDEO'){['loadeddata','canplay','playing'].forEach(e=>m.addEventListener(e,ready,{once:true}))}else m.addEventListener('load',()=>setTimeout(ready,180),{once:true})}).observe(stage,{childList:true});
  })}
  new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true}); scan();
})();
