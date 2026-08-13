/*! ============================================================
    InSync — Holographic Hero Scan                        v1.0
    HOMEPAGE ONLY. Pair file: holo-edges.js (every other page).
    ------------------------------------------------------------
    Include once, before </body>:

        <script src="/js/holo-hero.js" defer></script>

    Self-installing. It removes the old #apHolo glitch-lines
    element, injects an animated holographic canvas over the hero
    face (right side, clear of the headline), and gives it a
    subtle cursor float. No other edits needed.

    TUNING — data-* on the script tag (or data-holo-* on <body>,
    which wins):
        data-host        hero selector            (#apHeroS1)
        data-strength    cursor-float px          (34)
        data-hide-below  hide under this px width (1025)
        data-colors      comma-separated hex list

    Skip it on a page entirely with <body data-holo="off">.

    Where it paints is set by the xmask (horizontal) and vmask
    (vertical) functions near the top of the engine — those are
    the two dials if the face sits higher, lower, or further
    across in the hero video.

    Desktop only; static on reduced-motion; hidden at <=1024
    where the hero copy centers. Never blocks clicks.
    ============================================================ */
(function () {
  'use strict';

  if (window.__insyncHoloHero) return;
  window.__insyncHoloHero = true;

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

  function initHero(host) {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var HIDE = num('HideBelow', 1025);

    // 1) remove the old glitch-lines element if it exists
    var old = document.getElementById('apHolo');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    // 2) host = hero scene-1 container
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    // 3) inject CSS
    var st = document.createElement('style');
    st.textContent =
      '.ap-holocv{position:absolute;inset:0;width:100%;height:100%;z-index:6;pointer-events:none;mix-blend-mode:screen;will-change:transform}' +
      '@media (max-width:' + (HIDE - 1) + 'px){.ap-holocv{display:none}}';
    document.head.appendChild(st);

    // 4) inject canvas
    var cv = document.createElement('canvas');
    cv.className = 'ap-holocv'; cv.id = 'apHoloCanvas'; cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    var ctx = cv.getContext('2d');

    // ---- engine ----
    var COL = list('Colors', PALETTE);
    function pick(a){return a[(Math.random()*a.length)|0];}
    function hexA(hex,a){var n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+Math.min(a,1).toFixed(3)+')';}
    function xmask(nx){ if(nx<0.5) return 0; if(nx>0.63) return 1; return (nx-0.5)/0.13; }
    function vmask(ny){ var d=(ny-0.52)/0.4; var v=1-d*d*0.85; return v<0?0:v; }
    var W=0,H=0,dpr=1, dots=[],streaks=[],sparks=[],gridV=[],gridH=[];
    function newStreak(init){ var y=0.08+Math.random()*0.84;
      return {x: init?(0.5+Math.random()*0.5):(0.55+Math.random()*0.15), y:y,
        len:0.05+Math.random()*0.15, v:0.0014+Math.random()*0.0038,
        w:(Math.random()<0.3?1.6:0.9), a:0.5+Math.random()*0.5, c:pick(COL)}; }
    function newSpark(){ return {x:0.55+Math.random()*0.45, y:0.6+Math.random()*0.5,
      vy:0.0006+Math.random()*0.0014, vx:(Math.random()-.5)*0.0006, a:Math.random(), c:pick(COL)}; }
    function build(){
      dots=[]; var sx=0.016, sy=0.03;
      for(var nx=0.5; nx<=1.001; nx+=sx){ for(var ny=0.04; ny<=0.98; ny+=sy){
        var m=xmask(nx)*vmask(ny); if(m<0.05) continue;
        dots.push({x:nx+(Math.random()-.5)*sx*0.7, y:ny+(Math.random()-.5)*sy*0.7, m:m,
          ph:Math.random()*6.28, sp:0.6+Math.random()*1.8, c:pick(COL), r:(Math.random()<0.12?1.5:0.9)}); } }
      streaks=[]; for(var i=0;i<14;i++) streaks.push(newStreak(true));
      sparks=[]; for(i=0;i<9;i++) sparks.push(newSpark());
      gridV=[]; for(var gx=0.54; gx<1.0; gx+=0.08) gridV.push(gx);
      gridH=[]; for(var gy=0.08; gy<0.96; gy+=0.085) gridH.push(gy);
    }
    function size(){ var r=host.getBoundingClientRect(); W=r.width; H=r.height; if(W===0||H===0) return false;
      dpr=Math.min(window.devicePixelRatio||1,2); cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0); return true; }
    function drawStatic(){ if(!size()) return; ctx.clearRect(0,0,W,H); ctx.globalCompositeOperation='lighter';
      for(var i=0;i<dots.length;i++){ var d=dots[i]; var a=0.42*d.m; if(a<=0.02) continue;
        ctx.fillStyle=hexA(d.c,a); ctx.fillRect(d.x*W-d.r,d.y*H-d.r,d.r*2,d.r*2); } }
    // cursor float
    var pmx=0,pmy=0,px=0,py=0, STR=num('Strength',34);
    function onMove(ev){ var r=host.getBoundingClientRect();
      pmx = ((ev.clientX-r.left)/r.width - 0.5) * -2 * STR;
      pmy = ((ev.clientY-r.top)/Math.max(r.height,1) - 0.5) * -2 * (STR*0.7); }
    var t=0, sweep=0, raf=0, running=false, heroVisible=true;
    function frame(){ raf=0; if(!heroVisible){ running=false; return; } if(!size()){ raf=requestAnimationFrame(frame); return; }
      t+=0.016; sweep+=0.0032; if(sweep>0.62) sweep-=0.62; var sxp=0.5+sweep/0.62*0.5;
      ctx.clearRect(0,0,W,H); ctx.globalCompositeOperation='lighter'; var i;
      for(i=0;i<gridV.length;i++){ var gx=gridV[i]; var fl=0.6+0.4*Math.sin(t*1.3+i); var a=0.05*xmask(gx)*fl; if(a<=0.01) continue;
        ctx.strokeStyle='rgba(239,90,40,'+a.toFixed(3)+')'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(gx*W,0.05*H); ctx.lineTo(gx*W,0.97*H); ctx.stroke(); }
      for(i=0;i<gridH.length;i++){ var gy=gridH[i]; var flh=0.6+0.4*Math.sin(t*1.1+i*0.7);
        for(var seg=0.5; seg<1.0; seg+=0.032){ var a2=0.05*xmask(seg)*vmask(gy)*flh; if(a2<=0.01) continue;
          ctx.strokeStyle='rgba(255,144,96,'+a2.toFixed(3)+')'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(seg*W,gy*H); ctx.lineTo((seg+0.02)*W,gy*H); ctx.stroke(); } }
      for(i=0;i<dots.length;i++){ var d=dots[i]; var tw=0.45+0.55*Math.sin(t*d.sp+d.ph); var boost=Math.exp(-Math.pow((d.x-sxp)/0.05,2))*1.7;
        var av=(0.5*d.m*tw+boost*d.m); if(av<=0.02) continue; if(av>1)av=1; var rr=d.r*(1+boost*0.8);
        ctx.fillStyle=hexA(d.c,av); ctx.fillRect(d.x*W-rr,d.y*H-rr,rr*2,rr*2); }
      for(i=0;i<streaks.length;i++){ var s=streaks[i]; s.x+=s.v; if(s.x-s.len>1.03){ streaks[i]=newStreak(false); continue; }
        var mA=xmask(s.x)*s.a; if(mA<=0.02) continue; var g=ctx.createLinearGradient((s.x-s.len)*W,0,s.x*W,0);
        g.addColorStop(0,'rgba(239,90,40,0)'); g.addColorStop(0.7,hexA(s.c,mA*0.5)); g.addColorStop(1,hexA('#ffd9b0',mA));
        ctx.strokeStyle=g; ctx.lineWidth=s.w; ctx.beginPath(); ctx.moveTo((s.x-s.len)*W,s.y*H); ctx.lineTo(s.x*W,s.y*H); ctx.stroke();
        ctx.fillStyle=hexA('#ffe9d0',mA); ctx.fillRect(s.x*W-s.w,s.y*H-s.w,s.w*2,s.w*2); }
      for(i=0;i<sparks.length;i++){ var p=sparks[i]; p.y-=p.vy; p.x+=p.vx; if(p.y<0.02){ sparks[i]=newSpark(); sparks[i].y=0.6+Math.random()*0.4; continue; }
        var ap=(0.5+0.5*Math.sin(t*2+p.a*6))*xmask(p.x)*vmask(p.y)*0.9; if(ap<=0.02) continue; ctx.fillStyle=hexA(p.c,ap); ctx.fillRect(p.x*W-1.1,p.y*H-1.1,2.2,2.2); }
      var bx=sxp*W, bw=0.028*W; var gg=ctx.createLinearGradient(bx-bw,0,bx+bw,0);
      gg.addColorStop(0,'rgba(255,144,96,0)'); gg.addColorStop(0.5,'rgba(255,144,96,0.055)'); gg.addColorStop(1,'rgba(255,144,96,0)');
      ctx.fillStyle=gg; ctx.fillRect(bx-bw,0.05*H,bw*2,0.92*H);
      px+=(pmx-px)*0.08; py+=(pmy-py)*0.08; cv.style.transform='translate3d('+px.toFixed(1)+'px,'+py.toFixed(1)+'px,0)';
      raf=requestAnimationFrame(frame); }
    function startAnim(){ if(running) return; running=true; raf=requestAnimationFrame(frame); }

    build();
    var visMq = window.matchMedia('(min-width:' + HIDE + 'px)');
    function boot(){ if(!visMq.matches){ running=false; return; } if(reduced){ drawStatic(); return; } heroVisible=true; startAnim(); }
    function checkVis(){ heroVisible = window.scrollY < window.innerHeight*1.15; if(heroVisible && visMq.matches && !reduced) startAnim(); }
    if(!reduced){ window.addEventListener('mousemove', onMove, {passive:true}); }
    window.addEventListener('scroll', checkVis, {passive:true});
    window.addEventListener('resize', function(){ build(); if(reduced) drawStatic(); });
    if (visMq.addEventListener) visMq.addEventListener('change', boot);
    boot();
  }

  function start() {
    var b = document.body, h = document.documentElement;
    var off = (b && b.dataset && b.dataset.holo) || (h && h.dataset && h.dataset.holo);
    if (off && /^(off|none|false)$/i.test(off)) return;

    var host = document.querySelector(str('Host', '#apHeroS1')) ||
               document.querySelector('.ap-hero__s1');
    if (!host) return;   // not the homepage — nothing to do
    initHero(host);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
