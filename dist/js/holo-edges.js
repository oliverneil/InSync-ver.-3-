/*! ============================================================
    InSync — Holographic Edges                            v2.0
    Engine: portable "Ambient Holographic Edges" v5.
    EVERY PAGE EXCEPT THE HOMEPAGE. Pair file: holo-hero.js.
    ------------------------------------------------------------
    Include once, before </body>:

        <script src="/js/holo-edges.js" defer></script>

    Animated holographic scan on the LEFT and RIGHT edges with a
    clear centre: streaming scan-lines, a soft sweep bar per side,
    a faint grid, and subtle glassy particles at low capped
    opacity. Depth parallax follows the cursor — near layers drift
    more than far ones.

    The whole overlay fades out with scroll, so it reads on the
    hero and is gone by the next section. It stops animating once
    faded and restarts when you scroll back up.

    TUNING — data-* on the script tag (or data-holo-* on <body>,
    which wins):
        data-sides           both | left | right      (both)
        data-side-width      how far in from each edge (0.22 = 22%)
        data-intensity       0.6 subtle ... 1.6 bold  (1.0)
        data-parallax        px the nearest layer drifts (40, 0 = off)
        data-fade-viewports  fade out across this fraction of a
                             viewport of scroll (0.85; 0 = never
                             fade, overlay stays on every screen)
        data-z               stacking order           (9998)
        data-blend           screen | normal          (screen)
        data-hide-below      hide under this px width (0 = always)
        data-target          null = viewport, or a selector
        data-colors          comma-separated hex list

    Skip it on a page entirely with <body data-holo="off">.

    'screen' blend brightens, so it shows best on dark pages.
    Parallax follows the mouse — a desktop touch, no-op on touch.
    Static on reduced-motion (the fade still applies). Never
    blocks clicks. Safe to include twice.

    Changed from v1.0: particles are much subtler and opacity-
    capped, the spark layer is gone, more streaks, and the scroll
    fade is new. For the old always-on behaviour set
    data-fade-viewports="0".
    ============================================================ */
(function () {
  'use strict';

  if (window.__insyncHoloEdges) return;
  window.__insyncHoloEdges = true;

  // ---- locate our own <script> tag (works with defer) ----
  var ME = document.currentScript || (function () {
    var s = document.querySelectorAll('script[src]');
    for (var i = s.length - 1; i >= 0; i--) if (/holo-edges\.js(\?|$)/.test(s[i].src)) return s[i];
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

  function initEdges(){
    var CFG = {
      target:        str('Target', null),
      z:             num('Z', 9998),
      sides:         str('Sides', 'both'),
      sideWidth:     num('SideWidth', 0.22),
      intensity:     num('Intensity', 1.0),
      colors:        list('Colors', PALETTE),
      blend:         str('Blend', 'screen'),
      hideBelow:     num('HideBelow', 0),
      parallax:      num('Parallax', 40),
      fadeViewports: num('FadeViewports', 0.85)
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

    var COL=CFG.colors, INT=CFG.intensity, SW=CFG.sideWidth, PAR=CFG.parallax||0, GDEP=0.35, FV=CFG.fadeViewports||0;
    function pick(a){return a[(Math.random()*a.length)|0];}
    function hexA(hex,a){var n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+Math.min(a,1).toFixed(3)+')';}
    function sideOf(nx){ return nx<0.5?'L':'R'; }
    function allow(sd){ return CFG.sides==='both'||(CFG.sides==='left'&&sd==='L')||(CFG.sides==='right'&&sd==='R'); }
    function xmask(nx){ var sd=sideOf(nx); if(!allow(sd)) return 0;
      var d=Math.min(nx,1-nx); if(d>SW) return 0; var f=1-(d/SW); return Math.min(1,f/0.55); }
    function vmask(ny){ var e=Math.min(ny,1-ny); return e<0.06?e/0.06:1; }
    // whole-overlay opacity based on scroll: 1 on the hero, 0 by the next section
    function scrollOpacity(){ if(FV<=0) return 1;
      var sy=window.pageYOffset||document.documentElement.scrollTop||0; var vh=window.innerHeight||1;
      var o=1-sy/(vh*FV); return o<0?0:(o>1?1:o); }

    var W=0,H=0,dpr=1, dots=[],streaks=[],gridV=[];
    function newStreak(sd,init){ var y=0.05+Math.random()*0.9;
      return { side:sd, x: init?(sd==='L'?Math.random()*SW:1-Math.random()*SW):(sd==='L'?SW*(0.55+Math.random()*0.45):1-SW*(0.55+Math.random()*0.45)),
        y:y, len:0.05+Math.random()*0.12, v:0.0016+Math.random()*0.004,
        w:(Math.random()<0.3?1.6:0.9), a:0.5+Math.random()*0.5, c:pick(COL), dep:0.4+Math.random()*0.6 }; }
    function build(){
      dots=[]; var sx=0.016, sy=0.03;
      for(var nx=0; nx<=1.0001; nx+=sx){ for(var ny=0.03; ny<=0.99; ny+=sy){
        var m=xmask(nx)*vmask(ny); if(m<0.05) continue;
        dots.push({x:nx+(Math.random()-.5)*sx*0.7, y:ny+(Math.random()-.5)*sy*0.7, m:m, side:sideOf(nx),
          ph:Math.random()*6.28, sp:0.5+Math.random()*1.6, c:pick(COL), r:(Math.random()<0.12?1.3:0.85), dep:0.3+Math.random()*0.7}); } }
      streaks=[]; gridV=[];
      var sides = CFG.sides==='both'?['L','R']:(CFG.sides==='left'?['L']:['R']);
      for(var k=0;k<sides.length;k++){ for(var i=0;i<12;i++) streaks.push(newStreak(sides[k],true)); }
      for(var gx=0.015; gx<1.0; gx+=0.028){ if(xmask(gx)>0.05) gridV.push(gx); }
    }
    function size(){ W=cv.clientWidth; H=cv.clientHeight; if(W===0||H===0) return false;
      dpr=Math.min(window.devicePixelRatio||1,2); cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0); return true; }
    function drawStatic(){ if(!size()) return; cv.style.opacity=scrollOpacity().toFixed(3); ctx.clearRect(0,0,W,H); ctx.globalCompositeOperation='lighter';
      for(var i=0;i<gridV.length;i++){ var gx=gridV[i]; var a=0.06*xmask(gx)*INT; if(a<=0.01) continue;
        ctx.strokeStyle=hexA(COL[0],a); ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(gx*W,0.03*H); ctx.lineTo(gx*W,0.97*H); ctx.stroke(); }
      for(i=0;i<dots.length;i++){ var d=dots[i]; var a2=0.14*d.m*INT; if(a2<=0.01) continue;
        ctx.fillStyle=hexA(d.c,a2); ctx.fillRect(d.x*W-d.r,d.y*H-d.r,d.r*2,d.r*2); } }

    var tpx=0,tpy=0,px=0,py=0;
    function onMove(e){ tpx=((e.clientX/window.innerWidth)-0.5)*-2*PAR; tpy=((e.clientY/window.innerHeight)-0.5)*-2*PAR; }
    if(PAR>0 && !reduced) window.addEventListener('mousemove', onMove, {passive:true});

    var t=0, sw=0, raf=0, running=false;
    function frame(){ raf=0; if(document.hidden){ running=false; return; } if(!size()){ raf=requestAnimationFrame(frame); return; }
      var op=scrollOpacity(); cv.style.opacity=op.toFixed(3);
      if(op<=0.01){ running=false; return; }   // fully faded past the hero — stop until scrolled back
      t+=0.016; sw+=0.0032; if(sw>1) sw-=1; var swLx=SW*(1-sw), swRx=(1-SW)+sw*SW;
      px+=(tpx-px)*0.06; py+=(tpy-py)*0.06;
      ctx.clearRect(0,0,W,H); ctx.globalCompositeOperation='lighter'; var i;
      // faint grid
      for(i=0;i<gridV.length;i++){ var gx=gridV[i]; var fl=0.6+0.4*Math.sin(t*1.2+i); var a=0.055*xmask(gx)*INT*fl; if(a<=0.01) continue;
        var gxp=gx*W+px*GDEP; ctx.strokeStyle='rgba(239,90,40,'+a.toFixed(3)+')'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(gxp,0.03*H+py*GDEP); ctx.lineTo(gxp,0.97*H+py*GDEP); ctx.stroke(); }
      // glassy subtle square particles (low, capped opacity + soft shimmer)
      for(i=0;i<dots.length;i++){ var d=dots[i]; var tw=0.5+0.5*Math.sin(t*d.sp+d.ph);
        var swx=d.side==='L'?swLx:swRx; var boost=Math.exp(-Math.pow((d.x-swx)/0.05,2))*0.9;
        var av=(0.16*d.m*tw + boost*d.m*0.5)*INT; if(av<=0.015) continue; if(av>0.5)av=0.5;
        var rr=d.r*(1+boost*0.4); ctx.fillStyle=hexA(d.c,av); ctx.fillRect(d.x*W+px*d.dep-rr,d.y*H+py*d.dep-rr,rr*2,rr*2); }
      // streaming scan lines
      for(i=0;i<streaks.length;i++){ var st=streaks[i];
        if(st.side==='R'){ st.x+=st.v; if(st.x-st.len>1.03){ streaks[i]=newStreak('R',false); continue; } }
        else { st.x-=st.v; if(st.x+st.len<-0.03){ streaks[i]=newStreak('L',false); continue; } }
        var mA=xmask(st.x)*st.a*INT; if(mA<=0.02) continue; var x0=st.side==='R'?(st.x-st.len):(st.x+st.len);
        var ox=px*st.dep, oy=py*st.dep;
        var g=ctx.createLinearGradient(x0*W+ox,0,st.x*W+ox,0);
        g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.7,hexA(st.c,mA*0.5)); g.addColorStop(1,hexA('#ffe9d0',mA));
        ctx.strokeStyle=g; ctx.lineWidth=st.w; ctx.beginPath(); ctx.moveTo(x0*W+ox,st.y*H+oy); ctx.lineTo(st.x*W+ox,st.y*H+oy); ctx.stroke(); }
      // soft sweep bar per side
      function bar(cx){ var bw=0.02*W; var gg=ctx.createLinearGradient(cx*W-bw,0,cx*W+bw,0);
        gg.addColorStop(0,'rgba(255,144,96,0)'); gg.addColorStop(0.5,hexA('#ff9060',0.045*INT)); gg.addColorStop(1,'rgba(255,144,96,0)');
        ctx.fillStyle=gg; ctx.fillRect(cx*W-bw,0.02*H,bw*2,0.96*H); }
      if(CFG.sides!=='right') bar(swLx); if(CFG.sides!=='left') bar(swRx);
      raf=requestAnimationFrame(frame); }
    function startAnim(){ if(running) return; running=true; raf=requestAnimationFrame(frame); }
    function hidden(){ return CFG.hideBelow>0 && window.innerWidth < CFG.hideBelow; }
    build();
    function boot(){ if(hidden()){ cv.style.display='none'; running=false; return; } cv.style.display='';
      if(reduced){ drawStatic(); return; } startAnim(); }
    // restart the loop when scrolling back up into the hero
    window.addEventListener('scroll', function(){
      if(reduced){ cv.style.opacity=scrollOpacity().toFixed(3); return; }
      if(!hidden() && scrollOpacity()>0.01) startAnim();
    }, {passive:true});
    document.addEventListener('visibilitychange', function(){ if(!document.hidden && !reduced && !hidden() && scrollOpacity()>0.01) startAnim(); });
    window.addEventListener('resize', function(){ build(); if(reduced) drawStatic(); else if(!hidden() && scrollOpacity()>0.01) startAnim(); });
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
