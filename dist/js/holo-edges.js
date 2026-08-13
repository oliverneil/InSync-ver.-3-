/*! ============================================================
    InSync — Holographic Edges                            v1.0
    EVERY PAGE EXCEPT THE HOMEPAGE. Pair file: holo-hero.js.
    ------------------------------------------------------------
    Include once, before </body>:

        <script src="/js/holo-edges.js" defer></script>

    Best: put that line in the footer partial so every page built
    by build.py inherits it, and give the homepage holo-hero.js
    instead.

    Paints an animated holographic scan on the LEFT and RIGHT
    edges with a clear center, and depth parallax — near particles
    drift more than far ones as the cursor moves. Fixed full-
    viewport overlay by default, so it persists on scroll.

    TUNING — data-* on the script tag (or data-holo-* on <body>,
    which wins):
        data-sides       both | left | right      (both)
        data-side-width  how far in from each edge (0.22 = 22%)
        data-intensity   0.6 subtle ... 1.6 bold  (1.0)
        data-parallax    px the nearest layer drifts (40, 0 = off)
        data-z           stacking order           (9998)
        data-blend       screen | normal          (screen)
        data-hide-below  hide under this px width (0 = always show)
        data-target      null = viewport, or a selector to scope it
        data-colors      comma-separated hex list

    Skip it on a page entirely with <body data-holo="off">.

    'screen' blend brightens, so it shows best on dark pages.
    Parallax follows the mouse — a desktop touch, no-op on touch.
    Static on reduced-motion. Never blocks clicks.
    ============================================================ */
(function () {
  'use strict';

  if (window.__insyncHoloEdges) return;
  window.__insyncHoloEdges = true;

  // ---- locate our own <script> tag (works with defer) ----
  var ME = document.currentScript || (function () {
    var s = document.querySelectorAll('script[src]');
    for (var i = s.length - 1; i >= 0; i--) if (/holo\.js(\?|$)/.test(s[i].src)) return s[i];
    return null;
  })();

  function raw(name) {
    var b = document.body, h = document.documentElement, k = 'holo' + name;
    if (b && b.dataset && b.dataset[k] != null) return b.dataset[k];
    if (h && h.dataset && h.dataset[k] != null) return h.dataset[k];
    if (ME && ME.dataset && ME.dataset[name.charAt(0).toLowerCase() + name.slice(1)] != null) {
      return ME.dataset[name.charAt(0).toLowerCase() + name.slice(1)];
    }
    return null;
  }
  function str(name, dflt) { var v = raw(name); return v == null || v === '' ? dflt : v; }
  function num(name, dflt) { var v = raw(name); if (v == null || v === '') return dflt; v = parseFloat(v); return isNaN(v) ? dflt : v; }
  function list(name, dflt) {
    var v = raw(name); if (!v) return dflt;
    var a = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    return a.length ? a : dflt;
  }

  var PALETTE = ['#ef5a28', '#ff7a4d', '#ff9060', '#ffb891'];

  function initEdges() {
    var CFG = {
      target:    str('Target', null),
      z:         num('Z', 9998),
      sides:     str('Sides', 'both'),
      sideWidth: num('SideWidth', 0.22),
      intensity: num('Intensity', 1.0),
      colors:    list('Colors', PALETTE),
      blend:     str('Blend', 'screen'),
      hideBelow: num('HideBelow', 0),
      parallax:  num('Parallax', 40)
    };
    if (CFG.target === 'null' || CFG.target === '') CFG.target = null;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var host, fixed=false;
    if (CFG.target){ host=document.querySelector(CFG.target); if(!host) return;
      if(getComputedStyle(host).position==='static') host.style.position='relative'; }
    else { host=document.body; if(!host) return; fixed=true; }

    var cv=document.createElement('canvas'); cv.setAttribute('aria-hidden','true');
    var s=cv.style; s.position=fixed?'fixed':'absolute'; s.left='0'; s.top='0'; s.right='0'; s.bottom='0';
    s.width='100%'; s.height='100%'; s.pointerEvents='none'; s.zIndex=String(CFG.z); s.mixBlendMode=CFG.blend;
    host.appendChild(cv);
    var ctx=cv.getContext('2d');

    var COL=CFG.colors, INT=CFG.intensity, SW=CFG.sideWidth, PAR=CFG.parallax||0, GDEP=0.35;
    function pick(a){return a[(Math.random()*a.length)|0];}
    function hexA(hex,a){var n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+Math.min(a,1).toFixed(3)+')';}
    function sideOf(nx){ return nx<0.5?'L':'R'; }
    function allow(sd){ return CFG.sides==='both'||(CFG.sides==='left'&&sd==='L')||(CFG.sides==='right'&&sd==='R'); }
    function xmask(nx){ var sd=sideOf(nx); if(!allow(sd)) return 0;
      var d=Math.min(nx,1-nx); if(d>SW) return 0; var f=1-(d/SW); return Math.min(1,f/0.55); }
    function vmask(ny){ var e=Math.min(ny,1-ny); return e<0.06?e/0.06:1; }

    var W=0,H=0,dpr=1, dots=[],streaks=[],sparks=[],gridV=[];
    function newStreak(sd,init){ var y=0.05+Math.random()*0.9;
      return { side:sd, x: init?(sd==='L'?Math.random()*SW:1-Math.random()*SW):(sd==='L'?SW*(0.55+Math.random()*0.45):1-SW*(0.55+Math.random()*0.45)),
        y:y, len:0.04+Math.random()*0.10, v:0.0016+Math.random()*0.004,
        w:(Math.random()<0.3?1.5:0.85), a:0.5+Math.random()*0.5, c:pick(COL), dep:0.4+Math.random()*0.6 }; }
    function newSpark(sd){ return { side:sd, x: sd==='L'?Math.random()*SW:1-Math.random()*SW,
      y:0.6+Math.random()*0.5, vy:0.0006+Math.random()*0.0014, vx:(Math.random()-.5)*0.0004, a:Math.random(), c:pick(COL), dep:0.5+Math.random()*0.5 }; }
    function build(){
      dots=[]; var sx=0.014, sy=0.028;
      for(var nx=0; nx<=1.0001; nx+=sx){ for(var ny=0.03; ny<=0.99; ny+=sy){
        var m=xmask(nx)*vmask(ny); if(m<0.05) continue;
        dots.push({x:nx+(Math.random()-.5)*sx*0.7, y:ny+(Math.random()-.5)*sy*0.7, m:m, side:sideOf(nx),
          ph:Math.random()*6.28, sp:0.6+Math.random()*1.8, c:pick(COL), r:(Math.random()<0.12?1.5:0.9), dep:0.3+Math.random()*0.7}); } }
      streaks=[]; sparks=[]; gridV=[];
      var sides = CFG.sides==='both'?['L','R']:(CFG.sides==='left'?['L']:['R']);
      for(var k=0;k<sides.length;k++){ for(var i=0;i<9;i++) streaks.push(newStreak(sides[k],true)); for(i=0;i<6;i++) sparks.push(newSpark(sides[k])); }
      for(var gx=0.015; gx<1.0; gx+=0.03){ if(xmask(gx)>0.05) gridV.push(gx); }
    }
    function size(){ W=cv.clientWidth; H=cv.clientHeight; if(W===0||H===0) return false;
      dpr=Math.min(window.devicePixelRatio||1,2); cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0); return true; }
    function drawStatic(){ if(!size()) return; ctx.clearRect(0,0,W,H); ctx.globalCompositeOperation='lighter';
      for(var i=0;i<dots.length;i++){ var d=dots[i]; var a=0.42*d.m*INT; if(a<=0.02) continue;
        ctx.fillStyle=hexA(d.c,a); ctx.fillRect(d.x*W-d.r,d.y*H-d.r,d.r*2,d.r*2); } }

    // ---- parallax cursor tracking ----
    var tpx=0,tpy=0,px=0,py=0;
    function onMove(e){ tpx=((e.clientX/window.innerWidth)-0.5)*-2*PAR; tpy=((e.clientY/window.innerHeight)-0.5)*-2*PAR; }
    if(PAR>0 && !reduced) window.addEventListener('mousemove', onMove, {passive:true});

    var t=0, sw=0, raf=0, running=false;
    function frame(){ raf=0; if(document.hidden){ running=false; return; } if(!size()){ raf=requestAnimationFrame(frame); return; }
      t+=0.016; sw+=0.0032; if(sw>1) sw-=1; var swLx=SW*(1-sw), swRx=(1-SW)+sw*SW;
      px+=(tpx-px)*0.06; py+=(tpy-py)*0.06;
      ctx.clearRect(0,0,W,H); ctx.globalCompositeOperation='lighter'; var i;
      for(i=0;i<gridV.length;i++){ var gx=gridV[i]; var fl=0.6+0.4*Math.sin(t*1.2+i); var a=0.05*xmask(gx)*INT*fl; if(a<=0.01) continue;
        var gxp=gx*W+px*GDEP; ctx.strokeStyle='rgba(239,90,40,'+a.toFixed(3)+')'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(gxp,0.03*H+py*GDEP); ctx.lineTo(gxp,0.97*H+py*GDEP); ctx.stroke(); }
      for(i=0;i<dots.length;i++){ var d=dots[i]; var tw=0.45+0.55*Math.sin(t*d.sp+d.ph);
        var swx=d.side==='L'?swLx:swRx; var boost=Math.exp(-Math.pow((d.x-swx)/0.045,2))*1.7;
        var av=(0.5*d.m*tw+boost*d.m)*INT; if(av<=0.02) continue; if(av>1)av=1; var rr=d.r*(1+boost*0.8);
        ctx.fillStyle=hexA(d.c,av); ctx.fillRect(d.x*W+px*d.dep-rr,d.y*H+py*d.dep-rr,rr*2,rr*2); }
      for(i=0;i<streaks.length;i++){ var st=streaks[i];
        if(st.side==='R'){ st.x+=st.v; if(st.x-st.len>1.03){ streaks[i]=newStreak('R',false); continue; } }
        else { st.x-=st.v; if(st.x+st.len<-0.03){ streaks[i]=newStreak('L',false); continue; } }
        var mA=xmask(st.x)*st.a*INT; if(mA<=0.02) continue; var x0=st.side==='R'?(st.x-st.len):(st.x+st.len);
        var ox=px*st.dep, oy=py*st.dep;
        var g=ctx.createLinearGradient(x0*W+ox,0,st.x*W+ox,0);
        g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.7,hexA(st.c,mA*0.5)); g.addColorStop(1,hexA('#ffe9d0',mA));
        ctx.strokeStyle=g; ctx.lineWidth=st.w; ctx.beginPath(); ctx.moveTo(x0*W+ox,st.y*H+oy); ctx.lineTo(st.x*W+ox,st.y*H+oy); ctx.stroke();
        ctx.fillStyle=hexA('#ffe9d0',mA); ctx.fillRect(st.x*W+ox-st.w,st.y*H+oy-st.w,st.w*2,st.w*2); }
      for(i=0;i<sparks.length;i++){ var p=sparks[i]; p.y-=p.vy; p.x+=p.vx; if(p.y<0.02){ sparks[i]=newSpark(p.side); continue; }
        var ap=(0.5+0.5*Math.sin(t*2+p.a*6))*xmask(p.x)*vmask(p.y)*INT*0.9; if(ap<=0.02) continue;
        ctx.fillStyle=hexA(p.c,ap); ctx.fillRect(p.x*W+px*p.dep-1.1,p.y*H+py*p.dep-1.1,2.2,2.2); }
      function bar(cx){ var bw=0.02*W; var gg=ctx.createLinearGradient(cx*W-bw,0,cx*W+bw,0);
        gg.addColorStop(0,'rgba(255,144,96,0)'); gg.addColorStop(0.5,hexA('#ff9060',0.05*INT)); gg.addColorStop(1,'rgba(255,144,96,0)');
        ctx.fillStyle=gg; ctx.fillRect(cx*W-bw,0.02*H,bw*2,0.96*H); }
      if(CFG.sides!=='right') bar(swLx); if(CFG.sides!=='left') bar(swRx);
      raf=requestAnimationFrame(frame); }
    function startAnim(){ if(running) return; running=true; raf=requestAnimationFrame(frame); }
    function hidden(){ return CFG.hideBelow>0 && window.innerWidth < CFG.hideBelow; }
    build();
    function boot(){ if(hidden()){ cv.style.display='none'; running=false; return; } cv.style.display='';
      if(reduced){ drawStatic(); return; } startAnim(); }
    document.addEventListener('visibilitychange', function(){ if(!document.hidden && !reduced && !hidden()) startAnim(); });
    window.addEventListener('resize', function(){ build(); if(reduced) drawStatic(); else if(!hidden()) startAnim(); });
    boot();
  }

  function start() {
    var b = document.body, h = document.documentElement;
    var off = (b && b.dataset && b.dataset.holo) || (h && h.dataset && h.dataset.holo);
    if (off && /^(off|none|false)$/i.test(off)) return;
    initEdges();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
