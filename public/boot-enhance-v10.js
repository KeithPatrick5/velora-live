(() => {
  console.info('[Velora] cinematic intro v10 loaded');
  const root = document.documentElement;
  if (!root) return;

  // Keep this outside <body>. The recovered React app owns the body and can
  // replace body children during hydration; an html-level sibling survives it.
  let overlay = document.getElementById('veloraBootOverlayV10');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'veloraBootOverlayV10';
    overlay.innerHTML = '<canvas id="veloraBootCanvasV10" aria-hidden="true"></canvas>';
    root.appendChild(overlay);
  }
  root.classList.add('veloraBootingV10');

  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const start = performance.now();
  const MIN_MS = 3900;
  const HARD_STOP_MS = 7800;
  let stopped = false;
  let dpr = 1;

  function resize() {
    dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(innerHeight * dpr));
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  addEventListener('resize', resize);

  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const cubic=t=>1-Math.pow(1-clamp(t),3);
  const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};

  function line(x1,y1,x2,y2,p,width,color,blur=0){
    p=clamp(p); if(!p)return;
    ctx.save();
    ctx.lineWidth=width;ctx.lineCap='square';ctx.strokeStyle=color;
    if(blur){ctx.shadowBlur=blur;ctx.shadowColor=color;}
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x1+(x2-x1)*p,y1+(y2-y1)*p);ctx.stroke();ctx.restore();
  }

  function appReady(){
    const body=document.body;
    if(!body)return false;
    const old=[...body.querySelectorAll('.catalogState,.empty,.liveLoadingPanel')].some(el=>/Loading the live catalog|Starting Velora|Syncing the live catalog/i.test(el.textContent||''));
    if(old)return false;
    return !!body.querySelector('nav,header,.duloLiveShell,[class*="hero" i],[class*="rail" i]');
  }

  function finish(force=false){
    if(stopped)return;
    if(!force && (performance.now()-start<MIN_MS || !appReady()))return;
    stopped=true;
    overlay.style.opacity='0';
    root.classList.remove('veloraBootingV10');
    setTimeout(()=>overlay.remove(),520);
  }

  function frame(now){
    if(stopped)return;
    const ms=now-start,w=innerWidth,h=innerHeight,cx=w/2,cy=h/2;
    ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);

    // 0-900ms: two red blades arrive and form the V.
    const form=cubic((ms-120)/820);
    const base=Math.min(w,h)*.25;
    const top=cy-base*.78, bottom=cy+base*.78;
    const lx=cx-base*.46, rx=cx+base*.46;
    line(lx,top,cx,bottom,form,Math.max(26,base*.20),'#d60812',26);
    line(rx,top,cx,bottom,form,Math.max(26,base*.20),'#ff1838',28);

    // 750-1450ms: white/red core wakes up inside the V.
    const core=smooth((ms-760)/620);
    if(core>0){
      ctx.save();ctx.globalCompositeOperation='screen';
      const g=ctx.createLinearGradient(cx,top,cx,bottom);
      g.addColorStop(0,'rgba(255,255,255,0)');
      g.addColorStop(.46,`rgba(255,255,255,${.95*core})`);
      g.addColorStop(.56,`rgba(255,26,67,${.95*core})`);
      g.addColorStop(1,'rgba(255,0,40,0)');
      line(cx,top,cx,bottom,core,5,g,45);
      ctx.restore();
    }

    // 1250-3200ms: Netflix-style fiber/light tunnel grows out of the V.
    const tunnel=cubic((ms-1220)/1550);
    if(tunnel>0){
      ctx.save();ctx.globalCompositeOperation='screen';
      const rays=112;
      for(let i=0;i<rays;i++){
        const u=i/(rays-1), ang=(u-.5)*Math.PI*.98;
        const wobble=Math.sin(i*2.17+ms*.003)*.02;
        const len=Math.max(w,h)*(0.12+tunnel*1.4);
        const inner=18+tunnel*90;
        const sx=cx+Math.cos(ang)*inner, sy=cy+Math.sin(ang)*inner;
        const ex=cx+Math.cos(ang+wobble)*len, ey=cy+Math.sin(ang+wobble)*len;
        const hue=(i*7+ms*.055)%360;
        const grad=ctx.createLinearGradient(sx,sy,ex,ey);
        grad.addColorStop(0,'rgba(0,0,0,0)');
        grad.addColorStop(.10,`hsla(${hue},100%,60%,${.20*tunnel})`);
        grad.addColorStop(.48,`hsla(${(hue+36)%360},100%,60%,${.88*tunnel})`);
        grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.strokeStyle=grad;ctx.lineWidth=1+(i%9===0?7:2)*tunnel;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
      }
      ctx.restore();
    }

    // 2100-3350ms: the V punches through the camera while the tunnel fills frame.
    const zoom=cubic((ms-2050)/1150);
    if(zoom>0){
      const z=1+zoom*14;
      ctx.save();ctx.translate(cx,cy);ctx.scale(z,z);ctx.translate(-cx,-cy);ctx.globalAlpha=1-zoom*.72;
      line(lx,top,cx,bottom,1,Math.max(26,base*.20),'#d60812',24);
      line(rx,top,cx,bottom,1,Math.max(26,base*.20),'#ff1838',26);
      ctx.restore();
    }

    // 3150ms: white hit, then reveal.
    const flash=clamp(1-Math.abs(ms-3220)/330);
    if(flash>0){ctx.fillStyle=`rgba(255,255,255,${flash*.82})`;ctx.fillRect(0,0,w,h);}
    const blackout=clamp((ms-3480)/380);
    if(blackout>0){ctx.fillStyle=`rgba(0,0,0,${blackout})`;ctx.fillRect(0,0,w,h);}

    if(ms>=MIN_MS && appReady()) finish(); else requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  setTimeout(()=>finish(true),HARD_STOP_MS);
})();
