/**
 * Giriş: pembe tam ekran → çift satır metin (sıfır boşluk, eşzamanlı geçiş) → yukarı kapanma.
 */
(function () {
  'use strict';

  var DUR = 0.56;
  var STAGGER = 0.02;
  var DUR_PRAVA = 0.9;
  var STAGGER_PRAVA = 0.062;
  var HOLD = 0.24;
  var START_DELAY = 0.12;
  var CLOSE_DELAY = 0.2;
  var CLOSE_DUR = 0.95;
  var SESSION_KEY = 'prava-preloader-seen';

  var root = document.getElementById('prava-preloader');
  if (!root) return;

  function isPageReload() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav) return nav.type === 'reload';
    return !!(performance.navigation && performance.navigation.type === 1);
  }

  function hasSeenPreloader() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function shouldPlayPreloader() {
    if (window.__PRAVA_SKIP_PRELOADER) return false;
    return !hasSeenPreloader() || isPageReload();
  }

  function markPreloaderSeen() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) {}
  }

  function skipPreloader() {
    root.remove();
    done();
  }

  function done() {
    document.documentElement.classList.remove('prava-preloader-pending');
    document.body.classList.remove('prava-preloader-active');
    window.dispatchEvent(new CustomEvent('prava:preloader-complete'));
  }

  if (!shouldPlayPreloader()) {
    skipPreloader();
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    markPreloaderSeen();
    root.remove();
    done();
    return;
  }

  function readSteps() {
    var el = document.getElementById('prava-preloader-data');
    if (!el) return null;
    try {
      var data = JSON.parse(el.textContent || '{}');
      return data.steps && data.steps.length ? data.steps : null;
    } catch (e) {
      return null;
    }
  }

  function buildWord(text) {
    var wrap = document.createElement('div');
    wrap.className = 'prava-preloader__word';
    var chars = [];
    var i;
    for (i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var clip = document.createElement('div');
      clip.className = 'prava-preloader__char-clip';
      var span = document.createElement('span');
      span.className = 'prava-preloader__char';
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      if (ch === ' ') span.style.width = '0.28em';
      clip.appendChild(span);
      wrap.appendChild(clip);
      chars.push(span);
    }
    return { wrap: wrap, chars: chars };
  }

  function fitWordToTrack(wrap, track) {
    wrap.style.transform = '';
    var trackW = track.clientWidth;
    var wordW = wrap.scrollWidth;
    if (trackW > 0 && wordW > trackW) {
      wrap.style.transform = 'scale(' + (trackW / wordW).toFixed(4) + ')';
    }
  }

  function run() {
    if (typeof gsap === 'undefined') return;

    var steps = readSteps();
    if (!steps || !steps.length) return;

    var topTrack = root.querySelector('[data-track="top"]');
    var botTrack = root.querySelector('[data-track="bot"]');
    if (!topTrack || !botTrack) return;

    topTrack.innerHTML = '';
    botTrack.innerHTML = '';

    var built = steps.map(function (s) {
      var track = s.track === 'top' ? topTrack : botTrack;
      var word = buildWord(s.text);
      track.appendChild(word.wrap);
      fitWordToTrack(word.wrap, track);
      gsap.set(word.chars, { y: s.inY + '%' });
      return {
        track: s.track,
        text: s.text,
        brand: !!s.brand,
        inY: s.inY,
        outY: s.outY,
        chars: word.chars,
        wrap: word.wrap,
        trackEl: track,
      };
    });

    var ease = 'power3.inOut';
    var lenis = window.PRAVA_LENIS;
    var last = built[built.length - 1];
    var i;

    document.body.classList.add('prava-preloader-active');
    if (lenis && typeof lenis.stop === 'function') lenis.stop();

    var tl = gsap.timeline({
      paused: true,
      delay: START_DELAY,
      onComplete: function () {
        markPreloaderSeen();
        gsap.set(root, { display: 'none' });
        if (lenis && typeof lenis.start === 'function') lenis.start();
        done();
      },
    });

    tl.to(built[0].chars, {
      y: '0%',
      duration: DUR,
      ease: ease,
      stagger: { each: STAGGER, from: 'start' },
    }, 0);

    for (i = 1; i < built.length; i++) {
      tl.to({}, { duration: HOLD });

      var prev = built[i - 1];
      var curr = built[i];
      var inDur = curr.brand ? DUR_PRAVA : DUR;
      var inStagger = curr.brand ? STAGGER_PRAVA : STAGGER;

      if (prev.outY != null) {
        tl.to(prev.chars, {
          y: prev.outY + '%',
          duration: DUR,
          ease: ease,
          stagger: { each: STAGGER, from: 'start' },
        });
      }
      tl.to(curr.chars, {
        y: '0%',
        duration: inDur,
        ease: ease,
        stagger: { each: inStagger, from: 'start' },
      }, '<');
    }

    tl.to({}, { duration: HOLD });

    if (last.outY != null) {
      var exitStagger = (last.chars.length - 1) * STAGGER_PRAVA;
      var exitDur = DUR_PRAVA + exitStagger;

      gsap.set(root, { transformOrigin: 'top center' });

      tl.to(last.chars, {
        y: last.outY + '%',
        duration: DUR_PRAVA,
        ease: ease,
        stagger: { each: STAGGER_PRAVA, from: 'start' },
      });
      tl.to(
        root,
        {
          yPercent: -100,
          duration: exitDur,
          ease: ease,
        },
        '<'
      );
    } else {
      tl.to({}, { duration: CLOSE_DELAY });
      gsap.set(root, { transformOrigin: 'top center' });
      tl.to(root, {
        yPercent: -100,
        duration: CLOSE_DUR,
        ease: 'power4.out',
      }      );
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        tl.play(0);
      });
    });
  }

  if (typeof gsap !== 'undefined') {
    run();
    return;
  }

  var n = 0;
  var poll = window.setInterval(function () {
    n += 1;
    if (typeof gsap !== 'undefined') {
      window.clearInterval(poll);
      run();
    } else if (n > 80) {
      window.clearInterval(poll);
      markPreloaderSeen();
      root.remove();
      done();
    }
  }, 50);
})();
