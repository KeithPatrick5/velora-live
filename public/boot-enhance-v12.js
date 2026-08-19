(() => {
  const root=document.documentElement;if(!root)return;
  root.classList.add('veloraBootingV12');
  let overlay=document.createElement('div');overlay.id='veloraBootOverlayV12';overlay.innerHTML='<canvas id="veloraBootCanvasV12" aria-hidden="true"></canvas>';
  // defer guarantees parsing has created body; html-level sibling now cannot be re-parented by the parser.
  root.appendChild(overlay);
  const canvas=overlay.firstChild,ctx=canvas.getContext('2d',{alpha:false});
  const start=performance.now(),MIN=2550,MAX=4500;let done=false,dpr=1;
  function resize(){dpr=Math.max(1,Math.min(2,devicePixelRatio||1));canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}resize();addEventListener('resize',resize);
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=t=>1-Math.pow(1-clamp(t),3),smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
  function ready(){return !!document.body?.querySelector('.navShell,.cinemaHero,.browseLanding,.livePage,.duloLiveShell')}
  function finish(force=false){if(done||(!force&&(performance.now()-start<MIN||!ready())))return;done=true;overlay.style.opacity='0';root.classList.remove('veloraBootingV12');root.classList.add('veloraBootDone');setTimeout(()=>overlay.remove(),460)}
  function seg(x1,y1,x2,y2,p,w,c,blur=0){if(p<=0)return;ctx.save();ctx.lineCap='round';ctx.lineWidth=w;ctx.strokeStyle=c;if(blur){ctx.shadowBlur=blur;ctx.shadowColor=c}ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x1+(x2-x1)*clamp(p),y1+(y2-y1)*clamp(p));ctx.stroke();ctx.restore()}
  function frame(now){if(done)return;const ms=now-start,w=innerWidth,h=innerHeight,cx=w/2,cy=h/2,base=Math.min(w,h)*.23;ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    // deep red ambient glow
    const ag=ctx.createRadialGradient(cx,cy,0,cx,cy,base*2.8);ag.addColorStop(0,`rgba(239,26,72,${.12*smooth(ms/500)})`);ag.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=ag;ctx.fillRect(0,0,w,h);
    const form=ease((ms-80)/620),top=cy-base*.76,bottom=cy+base*.76,lx=cx-base*.43,rx=cx+base*.43;seg(lx,top,cx,bottom,form,Math.max(22,base*.17),'#d70732',24);seg(rx,top,cx,bottom,form,Math.max(22,base*.17),'#ff315d',26);
    const slice=ease((ms-560)/760);if(slice){ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<66;i++){const u=i/65,a=(u-.5)*2.7,j=Math.sin(i*12.4)*.035,len=(.18+slice*1.18)*Math.max(w,h);const sx=cx+Math.sin(a)*base*.14,sy=cy+Math.cos(a)*base*.08,ex=cx+Math.sin(a+j)*len,ey=cy+Math.cos(a+j)*len;const hue=(342+i*5+ms*.035)%360,g=ctx.createLinearGradient(sx,sy,ex,ey);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.24,`hsla(${hue},100%,62%,${.18*slice})`);g.addColorStop(.72,`hsla(${(hue+45)%360},100%,67%,${.72*slice})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.strokeStyle=g;ctx.lineWidth=i%8===0?5:1.4;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke()}ctx.restore()}
    const punch=ease((ms-1450)/850);if(punch){ctx.save();ctx.translate(cx,cy);const z=1+punch*15;ctx.scale(z,z);ctx.translate(-cx,-cy);ctx.globalAlpha=1-punch*.82;seg(lx,top,cx,bottom,1,Math.max(22,base*.17),'#d70732',25);seg(rx,top,cx,bottom,1,Math.max(22,base*.17),'#ff315d',28);ctx.restore()}
    const flash=clamp(1-Math.abs(ms-2190)/210);if(flash){ctx.fillStyle=`rgba(255,255,255,${flash*.88})`;ctx.fillRect(0,0,w,h)}const dark=smooth((ms-2300)/420);if(dark){ctx.fillStyle=`rgba(0,0,0,${dark})`;ctx.fillRect(0,0,w,h)}
    if(ms>=MIN&&ready())finish();else requestAnimationFrame(frame)
  }requestAnimationFrame(frame);setTimeout(()=>finish(true),MAX);
})();
