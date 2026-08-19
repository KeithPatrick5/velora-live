(() => {
  console.info('[Velora] cinematic canvas intro v9 loaded');
  const overlay = document.getElementById('veloraBootOverlay');
  if (!overlay) return;

  const MIN_MS = 4300;
  const HARD_STOP_MS = 9000;
  const start = performance.now();
  let finished = false;

  // Replace the old static/CSS-driven V with a frame-by-frame canvas intro.
  // This cannot get "stuck" on a single CSS keyframe because every frame is drawn in JS.
  overlay.innerHTML = '<canvas id="veloraBootCanvas" aria-hidden="true"></canvas>';
  const canvas = document.getElementById('veloraBootCanvas');
  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  addEventListener('resize', resize);

  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const ease = t => 1-Math.pow(1-clamp(t),3);
  const easeInOut = t => t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

  function pathLine(x1,y1,x2,y2,p,width,color,glow=0) {
    p=clamp(p); if (!p) return;
    const x=x1+(x2-x1)*p, y=y1+(y2-y1)*p;
    ctx.save();
    ctx.lineCap='square'; ctx.lineWidth=width; ctx.strokeStyle=color;
    if(glow){ctx.shadowBlur=glow;ctx.shadowColor=color;}
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x,y);ctx.stroke();ctx.restore();
  }

  function drawFrame(now) {
    const ms = now-start;
    const w=innerWidth,h=innerHeight,cx=w/2,cy=h/2;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);

    // Phase 1: the V slams together from darkness.
    const form=ease((ms-180)/850);
    const pulse=clamp((ms-720)/520);
    const zoom=easeInOut((ms-1450)/1250);
    const streak=ease((ms-1650)/1800);
    const flash=clamp(1-Math.abs(ms-3200)/430);
    const fade=clamp((ms-3650)/650);
    const base=Math.min(w,h)*.22;
    const scale=1 + zoom*18;
    const vh=base*1.48*scale;
    const vw=base*scale;
    const top=cy-vh*.5, bot=cy+vh*.5;
    const left=cx-vw*.34, right=cx+vw*.34;

    // Colored light tunnel behind the V. Starts only after the logo has formed.
    if(streak>0){
      ctx.save();ctx.globalCompositeOperation='screen';
      const rays=82;
      for(let i=0;i<rays;i++){
        const a=(i/(rays-1)-.5)*Math.PI*.95;
        const len=(Math.max(w,h)*1.35)*(0.15+streak*1.2);
        const inner=15+streak*60;
        const ex=cx+Math.cos(a)*len, ey=cy+Math.sin(a)*len;
        const sx=cx+Math.cos(a)*inner, sy=cy+Math.sin(a)*inner;
        const hue=(i*11 + ms*.05)%360;
        const grad=ctx.createLinearGradient(sx,sy,ex,ey);
        grad.addColorStop(0,'rgba(255,255,255,0)');
        grad.addColorStop(.12,`hsla(${hue},100%,60%,${.28*streak})`);
        grad.addColorStop(.52,`hsla(${(hue+55)%360},100%,58%,${.82*streak})`);
        grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.strokeStyle=grad;ctx.lineWidth=1+(i%5===0?5:1)*streak;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
      }
      ctx.restore();
    }

    // V shape. Drawn line-by-line, then expands through the camera.
    ctx.save();ctx.globalAlpha=1-fade;
    pathLine(left,top,cx,bot,form,Math.max(12,base*.16)*scale,'#e50914',34);
    pathLine(right,top,cx,bot,form,Math.max(12,base*.16)*scale,'#ff1836',34);
    // A bright central blade gives the signature light burst.
    if(pulse>0){
      ctx.globalCompositeOperation='screen';
      const g=ctx.createLinearGradient(cx,top,cx,bot);
      g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.45,`rgba(255,255,255,${.9*pulse})`);g.addColorStop(1,'rgba(255,0,45,0)');
      pathLine(cx,top,cx,bot,pulse,Math.max(2,5*scale),g,50);
    }
    ctx.restore();

    if(flash>0){ctx.fillStyle=`rgba(255,255,255,${flash*.68})`;ctx.fillRect(0,0,w,h);}

    if(ms < MIN_MS || !appReady()) requestAnimationFrame(drawFrame);
    else finish();
  }

  function appReady(){
    const legacy=[...document.querySelectorAll('.catalogState,.empty,.liveLoadingPanel')].some(el=>/Loading the live catalog|Starting Velora|Syncing the live catalog/i.test(el.textContent||''));
    if(legacy)return false;
    return !!document.querySelector('nav,header,.duloLiveShell,[class*="hero" i],[class*="rail" i]');
  }

  function finish(force=false){
    if(finished)return;
    if(!force && (performance.now()-start<MIN_MS || !appReady())) return;
    finished=true;
    overlay.style.transition='opacity .55s ease';
    overlay.style.opacity='0';
    document.documentElement.classList.remove('veloraBooting');
    setTimeout(()=>overlay.remove(),600);
  }

  document.documentElement.classList.add('veloraBooting');
  requestAnimationFrame(drawFrame);
  setTimeout(()=>finish(true),HARD_STOP_MS);
})();
