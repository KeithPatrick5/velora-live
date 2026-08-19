(() => {
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  function titleOf(player){return player.querySelector('.playerTop b')?.textContent?.trim() || 'VELORA';}
  function bindProgress(gate,host){
    const fill=gate.querySelector('.vpLine i'),label=gate.querySelector('[data-vp-status]');
    let shown=0,raf=0,target=clamp(host?.dataset?.veloraProgress||8);
    const render=()=>{shown += (target-shown)*.22;if(Math.abs(target-shown)<.25)shown=target;fill?.style.setProperty('--vp-progress',String(shown/100));if(shown!==target)raf=requestAnimationFrame(render);else raf=0};
    const set=(n,text='')=>{target=Math.max(target,clamp(n));if(text&&label)label.textContent=text;if(!raf)raf=requestAnimationFrame(render)};
    set(target,host?.dataset?.veloraProgressLabel||'Preparing stream');
    host?.addEventListener('velora:stream-progress',e=>set(e.detail?.value,e.detail?.label));
    return set;
  }
  function addGate(player){
    if(!player || player.dataset.veloraPlayerV13==='1') return;
    player.dataset.veloraPlayerV13='1'; player.classList.add('veloraPlayerV13');
    const gate=document.createElement('div'); gate.className='veloraPlaybackGateV12 veloraPlaybackGateV13';
    gate.innerHTML=`<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA</b><strong>${esc(titleOf(player))}</strong><span data-vp-status>Preparing your stream</span><div class="vpLine"><i></i></div>`;
    player.appendChild(gate); const setProgress=bindProgress(gate,player);
    const note=player.querySelector('.playerNote'); if(note) note.style.display='none';
    const markReady=()=>{setProgress(100,'Ready');setTimeout(()=>{player.classList.add('veloraPlayerReady');gate.classList.add('out');setTimeout(()=>gate.remove(),520)},90)};
    const bindMedia=media=>{if(!media)return;if(media.tagName==='VIDEO'){setProgress(38,'Loading media');media.addEventListener('loadedmetadata',()=>setProgress(78,'Media ready'),{once:true});media.addEventListener('canplay',()=>setProgress(94,'Starting playback'),{once:true});media.addEventListener('playing',markReady,{once:true})}else{setProgress(48,'Opening player');media.addEventListener('load',()=>{setProgress(92,'Player ready');setTimeout(markReady,120)},{once:true})}};
    bindMedia(player.querySelector('video,iframe'));
    const mo=new MutationObserver(()=>bindMedia(player.querySelector('video,iframe')));mo.observe(player,{childList:true,subtree:true});
    setTimeout(()=>{mo.disconnect();if(document.contains(gate))markReady()},9000);
  }
  function addLiveGate(w){
    if(w.dataset.veloraLiveGateV13==='1')return;w.dataset.veloraLiveGateV13='1';
    const stage=w.querySelector('.liveStage');if(!stage)return;
    const gate=document.createElement('div');gate.className='veloraPlaybackGateV12 veloraPlaybackGateV13 liveGate';gate.innerHTML='<div class="vpGlow"></div><div class="vpMark"><i></i><i></i></div><b>VELORA LIVE</b><span data-vp-status>Tuning stream</span><div class="vpLine"><i></i></div>';stage.appendChild(gate);
    const setProgress=bindProgress(gate,w);
    const ready=()=>{setProgress(100,'Ready');setTimeout(()=>{w.classList.add('veloraMediaReady');gate.classList.add('out');setTimeout(()=>gate.remove(),520)},90)};
    const bind=m=>{if(!m)return;if(m.tagName==='VIDEO'){m.addEventListener('loadedmetadata',()=>setProgress(82,'Media ready'),{once:true});m.addEventListener('canplay',()=>setProgress(96,'Starting playback'),{once:true});m.addEventListener('playing',ready,{once:true})}else m.addEventListener('load',()=>{setProgress(94,'Player ready');setTimeout(ready,120)},{once:true})};
    bind(stage.querySelector('video,iframe'));new MutationObserver(()=>bind(stage.querySelector('video,iframe'))).observe(stage,{childList:true});
  }
  function scan(){document.querySelectorAll('.player').forEach(addGate);document.querySelectorAll('.livePlayerOverlay').forEach(addLiveGate)}
  new MutationObserver(scan).observe(document.documentElement,{subtree:true,childList:true});scan();
})();
