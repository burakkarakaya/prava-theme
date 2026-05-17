/**
 * landing-history — scroll kart sahnesi (GSAP / ScrollTrigger)
 */
(function () {
  'use strict';

  var MOBILE_MAX_VW = 767;
  var RESIZE_WAIT_MS = 200;

  var CARD_CONFIGS = [
    { xP: 0.14, yP: 0.18, z: -280, w: 240, ar: 1.5, rot: 2.5, op: 0.55 },
    { xP: 0.82, yP: 0.16, z: -60, w: 290, ar: 0.68, rot: -2.1, op: 0.72 },
    { xP: 0.12, yP: 0.5, z: 240, w: 350, ar: 1.52, rot: -1.8, op: 1.0, hideOnMobile: true },
    { xP: 0.86, yP: 0.48, z: 260, w: 300, ar: 0.67, rot: 2.2, op: 1.0, hideOnMobile: true },
    { xP: 0.16, yP: 0.76, z: 30, w: 290, ar: 1.45, rot: 1.4, op: 0.78 },
    { xP: 0.8, yP: 0.74, z: -240, w: 220, ar: 1.38, rot: -3.0, op: 0.5 },
    { xP: 0.32, yP: 0.14, z: -80, w: 270, ar: 1.6, rot: -1.2, op: 0.7 },
    { xP: 0.66, yP: 0.8, z: 180, w: 320, ar: 1.5, rot: 1.9, op: 0.9 },
  ];

  var gsapRegistered = false;
  var finePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function registerGsap() {
    if (gsapRegistered || typeof gsap === 'undefined') return;
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
    gsapRegistered = true;
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function isMobile(vw) {
    return vw <= MOBILE_MAX_VW;
  }

  function getScale(vw) {
    var narrow = 390;
    var wide = 1200;
    if (vw >= wide) return 1;
    if (vw <= narrow) return 0.5;
    return 0.5 + ((vw - narrow) / (wide - narrow)) * 0.5;
  }

  function layoutKey(vw, vh) {
    return vw + 'x' + vh + (isMobile(vw) ? 'm' : 'd');
  }

  function scatterOffset(c, vw, vh, scale) {
    var cx = c.x + c.w / 2 - vw * 0.5;
    var cy = c.y + c.h / 2 - vh * 0.5;
    var len = Math.hypot(cx, cy) || 1;
    var push = (170 + Math.abs(c.z) * 0.22) * scale;
    return { x: (cx / len) * push, y: (cy / len) * push - 40 * scale };
  }

  function appendWordLetters(container, text, letterEls) {
    var words = text.split(/\s+/).filter(Boolean);
    for (var wi = 0; wi < words.length; wi++) {
      var wordWrap = document.createElement('span');
      wordWrap.className = 'heading-word-nowrap';
      var word = words[wi];
      for (var i = 0; i < word.length; i++) {
        var wrap = document.createElement('span');
        wrap.className = 'heading-letter-wrap';
        var inner = document.createElement('span');
        inner.className = 'heading-letter';
        inner.textContent = word.charAt(i);
        wrap.appendChild(inner);
        wordWrap.appendChild(wrap);
        letterEls.push(inner);
      }
      container.appendChild(wordWrap);
      if (wi < words.length - 1) container.appendChild(document.createTextNode(' '));
    }
  }

  function resetHeadline(headline) {
    if (!headline || !headline.dataset.headlineHtml) return;
    headline.innerHTML = headline.dataset.headlineHtml;
    delete headline.dataset.lettersReady;
  }

  function splitHeadline(headline) {
    if (!headline) return [];
    var html = headline.dataset.headlineHtml || headline.innerHTML;
    if (!html.trim()) return [];

    headline.dataset.headlineHtml = html;
    headline.innerHTML = '';
    headline.dataset.lettersReady = 'true';

    var letterEls = [];
    var lines = html.split(/<br\s*\/?>/i);
    for (var li = 0; li < lines.length; li++) {
      var lineEl = document.createElement('span');
      lineEl.className = 'landing-history__headline-line';
      var tmp = document.createElement('div');
      tmp.innerHTML = lines[li];
      var text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) appendWordLetters(lineEl, text, letterEls);
      if (lineEl.childNodes.length) headline.appendChild(lineEl);
    }
    return letterEls;
  }

  /** Görseller yalnızca Liquid’in yazdığı data-gallery-images üzerinden gelir (panel + yer tutucu). */
  function parseImages(root) {
    var raw = root.getAttribute('data-gallery-images');
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) {
      /* ignore */
    }
    return [];
  }

  function destroyInstance(root) {
    var inst = root._landingHistory;
    if (!inst) return;
    inst.stopParallax();
    if (inst.onResize) window.removeEventListener('resize', inst.onResize);
    inst.triggers.forEach(function (t) {
      t.kill();
    });
    if (inst.timeline) inst.timeline.kill();
    if (inst.headlineLetters.length) gsap.killTweensOf(inst.headlineLetters);
    resetHeadline(inst.headline);
    root._landingHistory = null;
    root.dataset.landingHistoryInit = '';
  }

  function initLandingHistory(root) {
    if (!root || root.dataset.landingHistoryInit === '1') return;
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    destroyInstance(root);
    registerGsap();

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scrollEl = root.querySelector('[data-landing-history-scroll]');
    var stageEl = root.querySelector('[data-landing-history-stage]');
    if (!scrollEl || !stageEl) return;

    var imgs = parseImages(root);
    if (!imgs.length) return;

    var cards = [];
    var inst = {
      triggers: [],
      timeline: null,
      sectionActive: false,
      headlineLetters: [],
      headline: root.querySelector('.landing-history__headline'),
      eyebrow: root.querySelector('.landing-history__eyebrow'),
      layoutScale: 1,
      layoutKey: '',
      sortedEnter: [],
      sortedExit: [],
      parallaxAllowed: finePointer && !isMobile(window.innerWidth),
    };

    root._landingHistory = inst;
    root.dataset.landingHistoryInit = '1';

    function initHeadlineLetters() {
      resetHeadline(inst.headline);
      inst.headlineLetters = splitHeadline(inst.headline);
      if (inst.headlineLetters.length) {
        gsap.set(inst.headlineLetters, { yPercent: 120, autoAlpha: 0, scale: 0.76 });
      }
    }

    function buildDOM() {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var scale = getScale(vw);
      var mobile = isMobile(vw);
      var fragment = document.createDocumentFragment();

      inst.layoutScale = scale;
      cards = [];
      inst.sortedEnter = [];
      inst.sortedExit = [];

      CARD_CONFIGS.forEach(function (cfg, i) {
        if (mobile && cfg.hideOnMobile) return;

        var w = Math.round(cfg.w * scale);
        var h = Math.round(w / cfg.ar);
        var z = Math.round(cfg.z * scale);
        var card = {
          cfg: cfg,
          w: w,
          h: h,
          z: z,
          x: cfg.xP * vw - w * 0.5,
          y: cfg.yP * vh - h * 0.5,
        };

        var el = document.createElement('div');
        el.className = 'landing-history__card';
        el.style.cssText =
          'width:' +
          w +
          'px;height:' +
          h +
          'px;left:' +
          card.x +
          'px;top:' +
          card.y +
          'px;opacity:0;transform:translateZ(' +
          z +
          'px) rotate(' +
          cfg.rot +
          'deg)';

        var img = document.createElement('img');
        img.src = imgs[i % imgs.length];
        img.alt = '';
        img.loading = i < 2 ? 'eager' : 'lazy';
        img.decoding = 'async';
        if (i === 0) img.fetchPriority = 'high';
        el.appendChild(img);
        fragment.appendChild(el);

        card.el = el;
        card.scatter = scatterOffset(card, vw, vh, scale);
        cards.push(card);
        inst.sortedEnter.push(card);
        inst.sortedExit.push(card);
      });

      stageEl.replaceChildren(fragment);
      inst.sortedEnter.sort(function (a, b) {
        return a.cfg.yP - b.cfg.yP;
      });
      inst.sortedExit.sort(function (a, b) {
        return a.cfg.z - b.cfg.z;
      });
    }

    function initScroll() {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var eyebrow = inst.eyebrow;

      var CARD_INTRO_END = 0.58;
      var CARD_INTRO_DUR = 0.24;
      var HEADLINE_START = 0.14;
      var HEADLINE_DUR = 0.15;
      var HEADLINE_STAGGER = 0.26;
      var EXIT_START = Math.max(CARD_INTRO_END, HEADLINE_START + HEADLINE_STAGGER + HEADLINE_DUR) + 0.02;
      var exitSpan = 1 - EXIT_START;
      var EXIT_DUR = exitSpan * 0.52;
      var EXIT_STAGGER = exitSpan * 0.38;
      var cardStaggerSpan = Math.max(CARD_INTRO_END - CARD_INTRO_DUR, 0.08);
      var enter = inst.sortedEnter;
      var exit = inst.sortedExit;
      var enterN = enter.length;
      var exitN = exit.length;
      var enterDenom = enterN > 1 ? enterN - 1 : 1;
      var exitDenom = exitN > 1 ? exitN - 1 : 1;

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: scrollEl,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.1,
          invalidateOnRefresh: true,
          onToggle: function (self) {
            setParallaxActive(self.isActive);
          },
        },
      });

      inst.timeline = tl;
      if (tl.scrollTrigger) inst.triggers.push(tl.scrollTrigger);

      inst.syncTimelineToScroll = function () {
        if (inst.timeline && inst.timeline.scrollTrigger) {
          inst.timeline.progress(inst.timeline.scrollTrigger.progress);
        }
      };

      for (var i = 0; i < enterN; i++) {
        var c = enter[i];
        var off = c.scatter;
        var t0 = enterN > 1 ? (i / enterDenom) * cardStaggerSpan : 0;
        tl.fromTo(
          c.el,
          { opacity: 0, x: off.x, y: off.y, scale: 0.78, immediateRender: false },
          {
            opacity: c.cfg.op,
            x: 0,
            y: 0,
            scale: 1,
            duration: CARD_INTRO_DUR,
            ease: 'power1.out',
            immediateRender: false,
          },
          t0
        );
      }

      if (eyebrow) {
        tl.fromTo(
          eyebrow,
          { opacity: 0, y: 32, immediateRender: false },
          { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', immediateRender: false },
          HEADLINE_START - 0.1
        );
      }

      if (inst.headlineLetters.length) {
        tl.fromTo(
          inst.headlineLetters,
          { yPercent: 120, autoAlpha: 0, scale: 0.76, immediateRender: false },
          {
            yPercent: 0,
            autoAlpha: 1,
            scale: 1,
            duration: HEADLINE_DUR,
            ease: 'power2.out',
            stagger: { amount: HEADLINE_STAGGER, from: 'start' },
            immediateRender: false,
          },
          HEADLINE_START
        );
      }

      tl.addLabel('exit', EXIT_START);

      for (var j = 0; j < exitN; j++) {
        var cx = exit[j];
        var offX = cx.scatter;
        tl.to(
          cx.el,
          {
            x: offX.x,
            y: offX.y,
            opacity: 0,
            scale: 0.82,
            duration: EXIT_DUR,
            ease: 'power2.in',
            immediateRender: false,
          },
          'exit+=' + (exitN > 1 ? (j / exitDenom) * EXIT_STAGGER : 0)
        );
      }

      if (inst.headlineLetters.length) {
        tl.to(
          inst.headlineLetters,
          {
            yPercent: -95,
            autoAlpha: 0,
            scale: 0.82,
            duration: EXIT_DUR + 0.06,
            ease: 'power2.in',
            stagger: { amount: EXIT_STAGGER + 0.08, from: 'end' },
            immediateRender: false,
          },
          'exit'
        );
      }

      if (eyebrow) {
        tl.to(
          eyebrow,
          { opacity: 0, y: -22, duration: EXIT_DUR, ease: 'power2.in', immediateRender: false },
          'exit'
        );
      }

      tl.to({}, { duration: 0.001 }, 1);
      inst.syncTimelineToScroll();
      setParallaxActive(tl.scrollTrigger && tl.scrollTrigger.isActive);
    }

    var rotYTo = gsap.quickTo(stageEl, 'rotationY', { duration: 0.45, ease: 'power2.out' });
    var rotXTo = gsap.quickTo(stageEl, 'rotationX', { duration: 0.45, ease: 'power2.out' });

    function onParallaxMove(e) {
      if (!inst.sectionActive) return;
      rotYTo((e.clientX / window.innerWidth - 0.5) * 9);
      rotXTo(-(e.clientY / window.innerHeight - 0.5) * 6);
    }

    inst.stopParallax = function () {
      inst.sectionActive = false;
      if (inst.onMouseMove) {
        window.removeEventListener('mousemove', inst.onMouseMove);
        inst.onMouseMove = null;
      }
      rotYTo(0);
      rotXTo(0);
    };

    function setParallaxActive(active) {
      if (!inst.parallaxAllowed) {
        inst.stopParallax();
        return;
      }
      if (inst.sectionActive === active) return;
      inst.sectionActive = active;
      if (active) {
        if (!inst.onMouseMove) {
          inst.onMouseMove = onParallaxMove;
          window.addEventListener('mousemove', inst.onMouseMove, { passive: true });
        }
      } else {
        inst.stopParallax();
      }
    }

    function rebuild() {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var key = layoutKey(vw, vh);
      if (inst.layoutKey === key) return;
      inst.layoutKey = key;
      inst.parallaxAllowed = finePointer && !isMobile(vw);

      inst.stopParallax();
      if (inst.timeline) inst.timeline.kill();
      inst.triggers.forEach(function (t) {
        t.kill();
      });
      inst.triggers = [];

      buildDOM();
      initHeadlineLetters();
      initScroll();

      ScrollTrigger.refresh();
      inst.syncTimelineToScroll();
    }

    buildDOM();
    initHeadlineLetters();

    if (!reducedMotion) {
      initScroll();
      ScrollTrigger.refresh();
      inst.syncTimelineToScroll();
      inst.onResize = debounce(rebuild, RESIZE_WAIT_MS);
      window.addEventListener('resize', inst.onResize);
    } else {
      gsap.set(root.querySelectorAll('.landing-history__card'), { opacity: 1, x: 0, y: 0 });
      if (inst.eyebrow) gsap.set(inst.eyebrow, { opacity: 1, y: 0 });
      if (inst.headlineLetters.length) {
        gsap.set(inst.headlineLetters, { yPercent: 0, autoAlpha: 1, scale: 1 });
      }
    }
  }

  function whenGsapReady(fn) {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      fn();
      return;
    }
    var n = 0;
    var timer = setInterval(function () {
      n += 1;
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        clearInterval(timer);
        fn();
      } else if (n > 80) clearInterval(timer);
    }, 50);
  }

  function initAll() {
    whenGsapReady(function () {
      document.querySelectorAll('[data-landing-history]').forEach(initLandingHistory);
      ScrollTrigger.refresh();
    });
  }

  function sectionRoot(target) {
    return target.matches('[data-landing-history]') ? target : target.querySelector('[data-landing-history]');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (e) {
    var root = e.target && sectionRoot(e.target);
    if (root) whenGsapReady(function () {
      initLandingHistory(root);
      ScrollTrigger.refresh();
    });
  });

  document.addEventListener('shopify:section:unload', function (e) {
    var root = e.target && sectionRoot(e.target);
    if (root) destroyInstance(root);
  });
})();
