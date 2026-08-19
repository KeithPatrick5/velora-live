(() => {
  console.info('[Velora] live UI v14 loaded');
  let channelsPromise=null, sportsPromise=null, activePlayer=null, lastLivePage=null, hlsPromise=null;
  let currentCountry='us', refreshScheduled=false, heroTimer=null;
  const eventAvailability=new Map(), failedUntil=new Map();
  const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sections=['Sports','Entertainment','News','Movies & Series','Documentary','Kids & Family','Local & General'];
  const countries=[['us','United States'],['ca','Canada'],['mx','Mexico'],['gb','United Kingdom']];

  function report(ch,status,latencyMs){fetch('/api/live/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:ch.id,url:ch.player?.url,status,latencyMs})}).catch(()=>{});}
  function loadHls(){if(window.Hls)return Promise.resolve(window.Hls);if(!hlsPromise)hlsPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';s.onload=()=>resolve(window.Hls);s.onerror=()=>reject(new Error('Could not load HLS player'));document.head.appendChild(s)});return hlsPromise;}
  async function loadChannels(force=false){if(!channelsPromise||force)channelsPromise=fetch(`/api/live?country=${encodeURIComponent(currentCountry)}&limit=500`,{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Live API ${r.status}`);return Array.isArray(d.channels)?d.channels:[]});return channelsPromise;}
  async function loadSports(force=false){if(!sportsPromise||force)sportsPromise=fetch('/api/live/upcoming',{cache:'no-store'}).then(r=>r.json()).then(x=>({events:Array.isArray(x.events)?x.events:[],focus:x.focus||{mode:'channels',label:'Best live channels',sport:null,events:[]}})).catch(()=>({events:[],focus:{mode:'channels',label:'Best live channels',sport:null,events:[]}}));return sportsPromise;}

  function closePlayer(){if(activePlayer?._hls)activePlayer._hls.destroy();activePlayer?.remove();activePlayer=null;document.body.style.overflow='';}
  async function attachStream(video,ch,onProgress=()=>{}){const url=ch.player?.url||'',started=performance.now();let sent=false;const progress=(n,label)=>{onProgress(Math.max(0,Math.min(100,n)),label||'')};const ok=()=>{progress(100,'Ready');if(!sent){sent=true;report(ch,'working',Math.round(performance.now()-started))}},bad=()=>{if(!sent){sent=true;report(ch,'down',Math.round(performance.now()-started))}};progress(12,'Opening source');video.addEventListener('loadedmetadata',()=>progress(82,'Media ready'),{once:true});video.addEventListener('canplay',()=>{progress(96,'Starting playback');ok()},{once:true});video.addEventListener('playing',ok,{once:true});video.addEventListener('error',bad,{once:true});if(video.canPlayType('application/vnd.apple.mpegurl')){progress(34,'Loading manifest');video.src=url;await video.play().catch(()=>{});return}if(/\.m3u8($|\?)/i.test(url)){progress(24,'Loading player');const Hls=await loadHls();progress(38,'Connecting stream');if(Hls?.isSupported()){const hls=new Hls({enableWorker:true,lowLatencyMode:true,manifestLoadingTimeOut:7000,levelLoadingTimeOut:7000});hls.loadSource(url);hls.attachMedia(video);activePlayer._hls=hls;hls.on(Hls.Events.MANIFEST_PARSED,()=>{progress(72,'Manifest ready');video.play().catch(()=>{})});hls.on(Hls.Events.ERROR,(_e,d)=>{if(d?.fatal)bad()});return}}progress(42,'Loading media');video.src=url;await video.play().catch(()=>{});}
  function openPlayer(ch,context=''){closePlayer();const wrap=document.createElement('div');wrap.className='livePlayerOverlay';wrap.dataset.veloraProgress='6';wrap.dataset.veloraProgressLabel='Preparing';wrap.innerHTML=`<div class="livePlayerTop"><button class="liveBack" aria-label="Back">←</button><div><b>${esc(context||ch.name)}</b><span>LIVE · ${esc(ch.name)} · ${esc(ch.category||'Channel')}</span></div></div><div class="liveStage"></div>`;const setProgress=(value,label='')=>{wrap.dataset.veloraProgress=String(value);if(label)wrap.dataset.veloraProgressLabel=label;wrap.dispatchEvent(new CustomEvent('velora:stream-progress',{detail:{value,label}}))};wrap.querySelector('.liveBack')?.addEventListener('click',closePlayer);document.body.appendChild(wrap);document.body.style.overflow='hidden';activePlayer=wrap;const stage=wrap.querySelector('.liveStage');setProgress(10,'Resolving stream');if(ch.player?.type==='embed'){setProgress(35,'Opening player');stage.innerHTML=`<iframe src="${esc(ch.player.url)}" title="${esc(ch.name)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;const frame=stage.querySelector('iframe');frame?.addEventListener('load',()=>{setProgress(100,'Ready')},{once:true});return}const video=document.createElement('video');video.controls=true;video.autoplay=true;video.playsInline=true;stage.appendChild(video);attachStream(video,ch,setProgress).catch(err=>{report(ch,'down');setProgress(0,'Stream unavailable');stage.innerHTML=`<div class="livePlaybackError"><b>Stream could not start</b><span>${esc(err.message||'This channel may be offline or geo-restricted.')}</span></div>`})}
  async function openStreamedEvent(ev){
    const sources=Array.isArray(ev?.streamedSources)?ev.streamedSources:[];
    if(!sources.length)return false;
    for(const src of sources){
      try{
        const r=await fetch(`/api/live/sports-stream?source=${encodeURIComponent(src.source)}&id=${encodeURIComponent(src.id)}`,{cache:'no-store'});
        const data=await r.json().catch(()=>({}));
        const streams=Array.isArray(data.streams)?data.streams:[];
        if(!streams.length)continue;
        const chosen=[...streams].sort((a,b)=>{
          const ae=/english/i.test(a.language||'')?1:0,be=/english/i.test(b.language||'')?1:0;
          return (be-ae)||((b.hd?1:0)-(a.hd?1:0))||(Number(a.streamNo||0)-Number(b.streamNo||0));
        })[0];
        if(chosen?.embedUrl){
          openPlayer({name:'Live Sports',category:'Sports',provider:'Streamed',player:{type:'embed',url:chosen.embedUrl}},ev.shortName||ev.name||'Live event');
          return true;
        }
      }catch{}
    }
    return false;
  }

  function eventPlayback(ev,channels){
    if(Array.isArray(ev?.streamedSources)&&ev.streamedSources.length)return {type:'streamed'};
    const channel=matchEventChannel(ev,channels);
    return channel?{type:'channel',channel}:null;
  }
  function eventTiming(ev,now=Date.now()){
    const t=Date.parse(ev?.date||'');
    const delta=Number.isFinite(t)?t-now:NaN;
    const mins=Number.isFinite(delta)?Math.round(delta/60000):null;
    const trulyLive=ev?.state==='in';
    if(trulyLive)return {phase:'live',label:'LIVE',detail:ev.detail||'Live now',delta,mins};
    if(Number.isFinite(delta)&&delta<=10*60000&&delta>=-5*60000)return {phase:'soon',label:'STARTING SOON',detail:delta>0?`Starts in ${Math.max(1,Math.ceil(delta/60000))} min`:'Scheduled start time',delta,mins};
    if(Number.isFinite(delta)&&delta>10*60000){
      const sameDay=new Date(t).toDateString()===new Date(now).toDateString();
      const detail=sameDay?new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):new Date(t).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'});
      return {phase:'upcoming',label:'UPCOMING',detail:`Starts ${detail}`,delta,mins};
    }
    return {phase:'upcoming',label:'UPCOMING',detail:ev.detail||'Upcoming',delta,mins};
  }
  async function resolveStreamedAvailability(ev,force=false){
    const key=ev?.id||ev?.externalId||ev?.shortName||'';
    const cached=eventAvailability.get(key);
    if(!force&&cached&&Date.now()-cached.at<45000)return cached;
    const sources=Array.isArray(ev?.streamedSources)?ev.streamedSources:[];
    let available=false;
    for(const src of sources.slice(0,3)){
      try{
        const r=await fetch(`/api/live/sports-stream?source=${encodeURIComponent(src.source)}&id=${encodeURIComponent(src.id)}`,{cache:'no-store'});
        const data=await r.json().catch(()=>({}));
        if(r.ok&&Array.isArray(data.streams)&&data.streams.some(x=>x?.embedUrl)){available=true;break}
      }catch{}
    }
    const result={available,at:Date.now()};eventAvailability.set(key,result);return result;
  }
  function quarantineEvent(ev,ms=45000){failedUntil.set(ev?.id||ev?.externalId||ev?.shortName||'',Date.now()+ms);}
  function isQuarantined(ev){return (failedUntil.get(ev?.id||ev?.externalId||ev?.shortName||'')||0)>Date.now();}

  function findLivePage(){return document.querySelector('.livePage')||[...document.querySelectorAll('section')].find(el=>/Live TV/i.test(el.textContent||'')&&/LIVE SOURCE/i.test(el.textContent||''))||null;}
  const norm=s=>String(s||'').toLowerCase().replace(/\b(hd|channel|network|tv|live)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const terrestrial=new Set(['abc','nbc','cbs','fox','univision']);
  const canonicalAlias=new Map([
    ['espn','espn'],['espn2','espn2'],['espnu','espnu'],['espn deportes','espn deportes'],
    ['fs1','fs1'],['fox sports 1','fs1'],['fs2','fs2'],['fox sports 2','fs2'],
    ['tnt','tnt'],['tbs','tbs'],['mlb network','mlb network'],['nfl network','nfl network'],
    ['fox deportes','fox deportes'],['tudn','tudn'],['usa','usa'],['usa network','usa'],
    ['abc','abc'],['nbc','nbc'],['cbs','cbs'],['fox','fox'],['univision','univision'],
    ['cbs sports network','cbs sports network'],['cbs sports hq','cbs sports hq'],['cbs sports golazo network','cbs sports golazo network'],['golazo network','cbs sports golazo network'],['golf channel','golf channel'],['tennis channel','tennis channel'],['bein sports xtra','bein sports xtra'],['fubo sports network','fubo sports network'],['nfl channel','nfl channel'],
    ['sec network','sec network'],['acc network','acc network'],['big ten network','big ten network']
  ]);
  const nonLinear=/\b(espn\+|mlb\.?(tv)?|apple tv\+?|peacock|paramount\+?|prime video|amazon prime|max)\b/i;
  function canon(raw){const n=norm(raw);return canonicalAlias.get(n)||n;}
  function broadcastTerms(ev){
    return [...new Set((ev.broadcasts||[]).filter(x=>x&&!nonLinear.test(String(x))).map(x=>({raw:String(x),norm:norm(x),canon:canon(x)})).filter(x=>x.norm))];
  }
  function networkMatchScore(term,ch){
    const cn=norm(ch.name),cc=canon(ch.name);
    if(!cn)return 0;
    if(cc===term.canon)return 100;
    if(cn===term.norm)return 98;
    if(terrestrial.has(term.canon) && (cn===term.canon || cn.startsWith(term.canon+' ') || cn.endsWith(' '+term.canon))) return 86;
    const a=term.norm.split(' ').filter(Boolean),b=cn.split(' ').filter(Boolean);
    if(a.length>=2){
      const inter=a.filter(x=>b.includes(x));
      const ratio=inter.length/Math.max(a.length,b.length);
      if(inter.length===a.length && a.length>=2)return 82;
      if(ratio>=.72)return 76;
    }
    return 0;
  }
  const networkAliases={
    'apple tv':['apple tv','apple tv+','mls season pass'],
    'mlb.tv':['mlb.tv','mlb tv'],
    'espn':['espn'], 'espn2':['espn2'], 'espnu':['espnu'], 'espnews':['espnews'],
    'fox':['fox'], 'fs1':['fs1','fox sports 1'], 'fs2':['fs2','fox sports 2'],
    'tbs':['tbs'], 'tnt':['tnt'], 'tru tv':['tru tv','trutv'],
    'cbs':['cbs'], 'nbc':['nbc'], 'abc':['abc'], 'usa network':['usa network','usa'],
    'nfl network':['nfl network'], 'nfl channel':['nfl channel'], 'nba tv':['nba tv'], 'nhl network':['nhl network'], 'mlb network':['mlb network'], 'cbs sports hq':['cbs sports hq'], 'cbs sports golazo network':['cbs sports golazo network','golazo network'], 'bein sports xtra':['bein sports xtra'], 'fubo sports network':['fubo sports network']
  };
  function aliasScore(term,ch){
    const key=canon(term.raw), cn=norm(ch.name), cc=canon(ch.name);
    const aliases=networkAliases[key]||[term.raw];
    let best=0;
    for(const alias of aliases){
      const an=norm(alias), ac=canon(alias);
      if(cc===ac||cn===an)best=Math.max(best,100);
      else if(an.length>=4&&(cn.startsWith(an+' ')||cn.endsWith(' '+an)))best=Math.max(best,90);
    }
    return Math.max(best,networkMatchScore(term,ch));
  }
  function matchEventChannel(ev,channels){
    const terms=broadcastTerms(ev);
    if(!terms.length)return null;
    const pool=[...channels].filter(c=>c.health==='working').sort((a,b)=>b.rank-a.rank);
    let best=null,bestScore=0;
    for(const c of pool){
      let score=0;
      for(const t of terms)score=Math.max(score,aliasScore(t,c));
      if(c.category==='Sports')score+=4;
      if(c.health==='working')score+=6;
      if(score>bestScore){best=c;bestScore=score}
    }
    return bestScore>=94?best:null;
  }

  function channelCard(ch){const b=document.createElement('button');b.className='duloChannelCard';const status=ch.health==='working'?'<span class="duloVerified">✓</span>':ch.health==='unknown'?'<span class="duloChecking">•</span>':'';const provider=(ch.providers&&ch.providers.length?ch.providers.join(' + '):(ch.provider||''));b.innerHTML=`<div class="duloChannelArt"><span class="duloLiveDot">● <i>Live</i></span>${status}${provider?`<span class="duloProvider">${esc(provider)}</span>`:''}${ch.logo?`<img src="${esc(ch.logo)}" alt="" loading="lazy">`:`<b class="duloFallback">${esc((ch.name||'TV').slice(0,3).toUpperCase())}</b>`}<strong>▶</strong></div><div class="duloChannelMeta"><b>${esc(ch.name)}</b><span>${esc(ch.rawCategory||ch.category||'Live TV')}</span></div>`;b.addEventListener('click',()=>openPlayer(ch));return b;}
  function channelRail(title,list){if(!list.length)return null;const section=document.createElement('section');section.className='duloRailSection';section.innerHTML=`<div class="duloRailHead"><h2>${esc(title)}</h2><span>${list.length} channels</span></div><div class="duloRailViewport"><div class="duloRail"></div><button class="duloRailNext" aria-label="Next">›</button></div>`;const rail=section.querySelector('.duloRail');list.slice(0,40).forEach(ch=>rail.appendChild(channelCard(ch)));section.querySelector('.duloRailNext').addEventListener('click',()=>rail.scrollBy({left:rail.clientWidth*.85,behavior:'smooth'}));return section;}

  function eventCard(ev,channels){
    const playback=eventPlayback(ev,channels);const timing=eventTiming(ev);const matched=playback?.channel||null;
    const card=document.createElement('button');
    const playableNow=timing.phase==='live'||timing.phase==='soon';
    card.className=`duloEventCard ${playback&&playableNow?'watchable':'scheduled'} ${timing.phase==='live'?'isLive':'isUpcoming'}`;
    const sourceLabel=playback?.type==='streamed'?'Sports stream':matched?.name||'Live channel';
    const action=timing.phase==='live'?'Checking stream…':timing.phase==='soon'?'Stream may open near start':'Stream opens near start';
    card.innerHTML=`<span class="duloLeague">${timing.phase==='live'?'● ':''}${esc(timing.label)} · ${esc(ev.league||'SPORTS')}</span><div class="duloMatchup"><div>${ev.away?.logo?`<img src="${esc(ev.away.logo)}" alt="">`:`<b>${esc(ev.away?.abbreviation||ev.away?.shortName?.slice(0,3)||'A')}</b>`}</div><i>vs</i><div>${ev.home?.logo?`<img src="${esc(ev.home.logo)}" alt="">`:`<b>${esc(ev.home?.abbreviation||ev.home?.shortName?.slice(0,3)||'H')}</b>`}</div></div><strong>${esc(ev.shortName||ev.name||'Live event')}</strong><small>${esc(timing.detail)}</small><em>${esc(action)}${playback?` · ${esc(sourceLabel)}`:''}${playableNow&&playback?' →':''}</em>`;
    if(!playback||!playableNow){card.disabled=true;return card}
    const em=card.querySelector('em');
    if(playback.type==='channel'){em.textContent=`${timing.phase==='live'?'Watch live':'Starting soon'} · ${sourceLabel} →`}
    else if(timing.phase==='live')resolveStreamedAvailability(ev).then(status=>{if(!document.contains(card))return;if(status.available){em.textContent='Watch live · Sports stream →';card.classList.add('streamReady')}else{em.textContent='Stream not available yet · retrying';card.classList.remove('watchable');card.classList.add('streamWaiting');quarantineEvent(ev,30000)}});
    card.addEventListener('click',async()=>{
      if(card.dataset.busy==='1'||isQuarantined(ev))return;
      card.dataset.busy='1';card.classList.add('resolving');
      try{
        if(playback.type==='streamed'){
          const status=await resolveStreamedAvailability(ev,true);
          if(!status.available){quarantineEvent(ev);em.textContent=timing.phase==='soon'?'Stream is not live yet · starts soon':'Stream unavailable · retrying shortly';card.classList.add('streamWaiting');return}
          const ok=await openStreamedEvent(ev);
          if(!ok&&matched){openPlayer(matched,ev.shortName||ev.name);return}
          if(!ok){quarantineEvent(ev);em.textContent='Stream unavailable · retrying shortly';card.classList.add('streamWaiting')}
        }else openPlayer(matched,ev.shortName||ev.name)
      }finally{card.dataset.busy='0';card.classList.remove('resolving')}
    });
    return card;
  }

  function heroSlides(sports,good,channels){const focus=sports.focus||{};const evs=Array.isArray(focus.events)?focus.events:[];const watchable=evs.map(event=>({type:'event',event,playback:eventPlayback(event,channels)})).filter(x=>x.playback);if(watchable.length)return watchable.slice(0,6);const sportsFallback=[...good].filter(c=>c.category==='Sports'&&c.health==='working').slice(0,6);const fallback=sportsFallback.length?sportsFallback:[...good].filter(c=>c.health==='working').slice(0,6);return fallback.map(channel=>({type:'channel',channel}));}
  function heroHTML(slide,focus,good,verified){if(slide?.type==='event'){const ev=slide.event,pb=slide.playback;const ch=pb?.channel||null;const timing=eventTiming(ev);const watchLabel=timing.phase==='live'?(pb?.type==='streamed'?'Watch live':ch?`Watch on ${esc(ch.name)}`:'Browse sports channels'):timing.phase==='soon'?'Starting soon':'Upcoming';const disabled=timing.phase==='upcoming'?'disabled':'';return `<div class="duloHeroCopy"><span class="duloHeroEyebrow">${timing.phase==='live'?'● LIVE':timing.phase==='soon'?'STARTING SOON':'UPCOMING'} · ${esc(ev.league)}</span><h1>${esc(ev.shortName||ev.name)}</h1><p>${esc(timing.detail)}${ev.broadcasts?.length?` · ${esc(ev.broadcasts.slice(0,2).join(' / '))}`:''}</p><div class="duloHeroCounts"><b>${esc(focus.label||'Live sports')}</b> · ${good.length} channels · ${verified.length} verified</div><button class="duloChoose" data-action="watch" ${disabled}>${watchLabel}</button></div><div class="duloHeroTeams">${ev.away?.logo?`<img src="${esc(ev.away.logo)}" alt="">`:''}${ev.home?.logo?`<img src="${esc(ev.home.logo)}" alt="">`:''}</div>`}const ch=slide?.channel;return `<div class="duloHeroCopy"><span class="duloHeroEyebrow">LIVE TV</span><h1>${esc(ch?.name||'Live TV')}</h1><p>${ch?'One of the best currently verified live channels.':'Watch live channels. New sources are checked continuously.'}</p><div class="duloHeroCounts"><b>${good.length}</b> channels · <b>${verified.length}</b> verified</div><button class="duloChoose" data-action="${ch?'watch':'channels'}">${ch?'Watch live':'Choose a channel'}</button></div><div class="duloHeroTeams">${ch?.logo?`<img src="${esc(ch.logo)}" alt="">`:''}</div>`;}

  function mountHero(shell,slides,focus,good,verified){const hero=shell.querySelector('.duloLiveHero');if(heroTimer)clearInterval(heroTimer);let idx=0;function draw(){const slide=slides[idx]||null;hero.innerHTML=heroHTML(slide,focus,good,verified)+`<div class="duloHeroDots">${slides.map((_,i)=>`<button aria-label="Slide ${i+1}" class="${i===idx?'active':''}" data-i="${i}"></button>`).join('')}</div>`;hero.querySelector('.duloChoose')?.addEventListener('click',async()=>{if(slide?.type==='event'){const timing=eventTiming(slide.event);if(timing.phase==='upcoming')return;if(slide.playback?.type==='streamed'){const status=await resolveStreamedAvailability(slide.event,true);if(!status.available)return;await openStreamedEvent(slide.event);return}if(slide.playback?.channel){openPlayer(slide.playback.channel,slide.event?.shortName||slide.event?.name||'');return}}if(slide?.channel)openPlayer(slide.channel,slide?.event?.shortName||slide?.event?.name||'');else shell.querySelector('.duloRails')?.scrollIntoView({behavior:'smooth',block:'start'})});hero.querySelector('.duloHeroDots')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;idx=Number(b.dataset.i)||0;draw()})}draw();if(slides.length>1)heroTimer=setInterval(()=>{idx=(idx+1)%slides.length;draw()},6500);}

  function render(page,channels,sports){page.querySelectorAll('.veloraLiveInjected').forEach(x=>x.remove());page.querySelector('.empty,.liveLoadingPanel')?.remove();[...page.children].forEach(child=>{if(!child.classList.contains('veloraLiveInjected'))child.classList.add('veloraLiveOriginal')});page.classList.add('livePageEnhanced','duloLivePage');const verified=channels.filter(c=>c.health==='working'),down=channels.filter(c=>c.health==='down'),unknown=channels.filter(c=>c.health==='unknown'),good=verified;const focus=sports.focus||{mode:'channels',label:'Best live channels',events:[]};
    const now=Date.now();
    const scheduledEvents=(sports.events||[]).filter(ev=>{
      const t=Date.parse(ev.date||'');const delta=t-now;
      return ev.state==='in'||(Number.isFinite(t)&&delta>=-5*60*1000&&delta<=48*60*60*1000);
    }).sort((a,b)=>{const order={live:0,soon:1,upcoming:2};const ap=eventTiming(a).phase,bp=eventTiming(b).phase;return order[ap]-order[bp]||Date.parse(a.date||0)-Date.parse(b.date||0)}).slice(0,18);
    const watchableFocusEvents=scheduledEvents;
    const shell=document.createElement('div');shell.className='veloraLiveInjected duloLiveShell';shell.innerHTML=`<section class="duloLiveHero"></section><div class="duloSearchRow"><input class="duloSearch" placeholder="Search channels" autocomplete="off"></div><div class="duloFilterRow"><div class="duloCategoryTabs"></div><div class="duloHealthTabs"><button data-health="working" class="active">Verified live <small>${verified.length}</small></button></div><select class="duloRegion">${countries.map(([code,name])=>`<option value="${code}" ${code===currentCountry?'selected':''}>🌐 ${name}</option>`).join('')}</select></div><div class="duloUpcomingWrap" ${watchableFocusEvents.length?'':'hidden'}><div class="duloSectionTop"><div><small>${focus.mode==='sport'?esc((focus.sport||'SPORTS').toUpperCase()):'LIVE SPORTS'}</small><h2>${esc(focus.label||'Live & Upcoming')}</h2></div><button class="duloRefresh">↻ Refresh</button></div><div class="duloEventRail"></div></div><div class="duloRails"></div><details class="duloUnavailable duloCheckingDrawer"><summary><span>Streams still being checked</span><b>${unknown.length}</b><small>Hidden until they pass a live check</small></summary><div class="duloCheckingGrid"></div></details><details class="duloUnavailable"><summary><span>Unavailable streams</span><b>${down.length}</b><small>Last health check failed</small></summary><div class="duloUnavailableGrid"></div></details>`;page.appendChild(shell);
    const heroFocus=watchableFocusEvents.length?{...focus,events:watchableFocusEvents}:{mode:'channels',label:'Verified live channels',sport:null,events:[]};
    const sportsForHero=watchableFocusEvents.length?{...sports,focus:heroFocus}:{...sports,focus:heroFocus};
    mountHero(shell,heroSlides(sportsForHero,good,channels),heroFocus,good,verified);
    const eventRail=shell.querySelector('.duloEventRail');watchableFocusEvents.slice(0,12).forEach(ev=>{const card=eventCard(ev,channels);if(card)eventRail.appendChild(card)});
    const categoryTabs=shell.querySelector('.duloCategoryTabs');const tabs=['All','Sports','Entertainment','News','Movies & Series','Documentary','Kids & Family'];tabs.forEach((name,i)=>{const b=document.createElement('button');b.textContent=name.replace(' & Series','');b.dataset.category=name;if(i===0)b.classList.add('active');categoryTabs.appendChild(b)});
    let activeCategory='All',activeHealth='working',query='';const rails=shell.querySelector('.duloRails');function redraw(){rails.innerHTML='';let pool=good.filter(ch=>activeHealth==='all'||ch.health===activeHealth).filter(ch=>!query||`${ch.name} ${ch.category} ${ch.rawCategory||''} ${(ch.providers||[]).join(' ')}`.toLowerCase().includes(query));if(activeCategory!=='All')pool=pool.filter(ch=>ch.category===activeCategory);const order=activeCategory==='All'?sections:[activeCategory];for(const cat of order){const sec=channelRail(cat,pool.filter(ch=>ch.category===cat));if(sec)rails.appendChild(sec)}if(activeCategory==='All'){const others=pool.filter(ch=>!sections.includes(ch.category));const sec=channelRail('More Live',others);if(sec)rails.appendChild(sec)}if(!rails.children.length)rails.innerHTML='<div class="duloNoChannels">No channels match those filters.</div>'}redraw();
    categoryTabs.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;categoryTabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeCategory=b.dataset.category;redraw()});shell.querySelector('.duloHealthTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;shell.querySelectorAll('.duloHealthTabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeHealth=b.dataset.health;redraw()});shell.querySelector('.duloSearch').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();redraw()});shell.querySelector('.duloRegion').addEventListener('change',async e=>{currentCountry=e.target.value;channelsPromise=null;await upgradeLivePage(page,true)});shell.querySelector('.duloRefresh')?.addEventListener('click',async()=>{sportsPromise=null;channelsPromise=null;await upgradeLivePage(page,true)});const checking=shell.querySelector('.duloCheckingGrid');unknown.slice(0,120).forEach(ch=>checking.appendChild(channelCard(ch)));const unavailable=shell.querySelector('.duloUnavailableGrid');down.slice(0,120).forEach(ch=>unavailable.appendChild(channelCard(ch)));
  }

  async function upgradeLivePage(page=findLivePage(),force=false){if(!page)return;if(!force&&page.dataset.veloraLiveState==='ready'&&page.querySelector('.duloLiveShell'))return;if(!force&&page.dataset.veloraLiveState==='loading')return;lastLivePage=page;page.dataset.veloraLiveState='loading';let empty=page.querySelector('.empty,.liveLoadingPanel');if(!empty){empty=document.createElement('div');page.appendChild(empty)}empty.className='liveLoadingPanel';empty.innerHTML='<span class="livePulse"></span><b>Tuning live channels</b><span>Loading the cached lineup while stream checks continue in the background.</span>';try{const channels=await loadChannels(force);if(!document.contains(page))return;const fallbackSports={events:[],focus:{mode:'channels',label:'Verified live channels',sport:null,events:[]}};let sports=await Promise.race([loadSports(force),new Promise(resolve=>setTimeout(()=>resolve(fallbackSports),850))]);if(!document.contains(page))return;render(page,channels,sports);page.dataset.veloraLiveState='ready';loadSports(force).then(sp=>{const p=findLivePage();if(p&&document.contains(p))render(p,channels,sp)}).catch(()=>{});if(!refreshScheduled){refreshScheduled=true;setTimeout(async()=>{refreshScheduled=false;try{const updated=await loadChannels(true),sp=await loadSports(false),p=findLivePage();if(p)render(p,updated,sp)}catch{}},6000)}}catch(err){if(!document.contains(page))return;page.dataset.veloraLiveState='error';empty.innerHTML=`<b>Live TV could not load</b><span>${esc(err.message||'Unknown provider error')}</span><button class="liveRetry">Retry</button>`;empty.querySelector('.liveRetry')?.addEventListener('click',()=>upgradeLivePage(page,true))}}
  function tick(){const page=findLivePage();if(page&&(page!==lastLivePage||!page.querySelector('.duloLiveShell')))upgradeLivePage(page)}
  setInterval(tick,300);setInterval(async()=>{const page=findLivePage();if(!page)return;try{sportsPromise=null;const [channels,sports]=await Promise.all([loadChannels(false),loadSports(true)]);if(document.contains(page))render(page,channels,sports)}catch{}},60000);new MutationObserver(tick).observe(document.documentElement,{subtree:true,childList:true});tick();addEventListener('popstate',()=>setTimeout(tick,0));addEventListener('keydown',e=>{if(e.key==='Escape')closePlayer()});
})();
