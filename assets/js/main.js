/**
 * PRAVA Hero Slider
 * - loop: yalnızca 2+ slayt; tek slayt düz mod
 * - Parallax: slide.progress × width × 0.5 → .hero-parallax-layer translateX
 * - Custom pagination: thumb halka + prev yok, yalnızca #hero-next
 * - Autoplay: imagesReady / load ile başlar
 */
(function () {
  'use strict';

  function initLenisScroll() {
    if (window.PRAVA_LENIS) return window.PRAVA_LENIS;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

    var LenisCtor =
      window.Lenis ||
      (window.lenis && window.lenis.Lenis) ||
      (typeof Lenis !== 'undefined' ? Lenis : null);

    if (!LenisCtor) return null;

    var lenis = new LenisCtor({
      duration: 0.65,
      smoothWheel: true,
      wheelMultiplier: 1.15,
      touchMultiplier: 1.1,
      easing: function (t) {
        return 1 - Math.pow(1 - t, 3);
      },
    });

    lenis.on('scroll', function () {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
    });

    function raf(time) {
      lenis.raf(time);
      window.requestAnimationFrame(raf);
    }
    window.requestAnimationFrame(raf);

    window.PRAVA_LENIS = lenis;
    return lenis;
  }

  function initLenisWithFallback() {
    var lenis = initLenisScroll();
    if (lenis) return lenis;

    var fallbackId = 'prava-lenis-fallback-script';
    if (!document.getElementById(fallbackId)) {
      var s = document.createElement('script');
      s.id = fallbackId;
      s.src = 'https://unpkg.com/lenis@1.1.16/dist/lenis.min.js';
      s.defer = true;
      s.onload = function () {
        initLenisScroll();
      };
      document.head.appendChild(s);
    }
    return null;
  }

  var lenisInstance = initLenisWithFallback();

  var interleaveOffset = 0.5;

  var mainEl  = document.querySelector('.hero-main');
  var pagHost = document.getElementById('hero-pagination-custom');
  var btnNext = document.getElementById('hero-next');
  if (mainEl) {
  var paginationEnabled =
    mainEl.getAttribute('data-hero-pagination') !== 'false' && !!pagHost;
  var navigationEnabled =
    mainEl.getAttribute('data-hero-navigation') !== 'false' && !!btnNext;

  /* Orijinal slaytları Swiper init'ten ÖNCE oku (klonlar henüz yok) */
  var origSlides = Array.prototype.slice.call(
    mainEl.querySelectorAll('.swiper-wrapper > .swiper-slide')
  );
  var slideCount  = origSlides.length;
  var thumbsData  = origSlides.map(function (s) {
    return s.getAttribute('data-thumb') || '';
  });

  var heroVideoReduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function attachHeroVideoSrcOnce(video) {
    var src = video.getAttribute('data-src');
    if (!src) return;
    if (!video.getAttribute('src')) {
      video.setAttribute('src', src);
    }
  }

  function loadAndPlayHeroVideo(video) {
    if (!video || heroVideoReduceMotion) return;
    attachHeroVideoSrcOnce(video);
    video.load();
    var p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {});
    }
  }

  function pauseHeroVideo(video) {
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch (e) {}
  }

  function syncHeroVideoSlide(swiper) {
    mainEl.querySelectorAll('.hero-slide-video').forEach(pauseHeroVideo);
    var slide = swiper.slides[swiper.activeIndex];
    if (!slide) return;
    var video = slide.querySelector('.hero-slide-video[data-src]');
    if (video) {
      if (swiper.autoplay && swiper.autoplay.stop) swiper.autoplay.stop();
      loadAndPlayHeroVideo(video);
    } else {
      if (swiper.autoplay && swiper.autoplay.start) swiper.autoplay.start();
    }
  }

  var mainSwiper = null;
  if (slideCount > 0) {
  var loopEnabled = slideCount > 1;

  mainSwiper = new Swiper(mainEl, {
    loop: loopEnabled,
    speed: 1000,
    grabCursor: true,
    watchSlidesProgress: true,
    slidesPerView: 1,
    spaceBetween: 0,
    autoplay: {
      delay: 4000,
      disableOnInteraction: false,
    },
    navigation: navigationEnabled
      ? {
          nextEl: '#hero-next',
          disabledClass: 'opacity-30 pointer-events-none',
        }
      : false,
    on: {
      init: function () {
        var s = this;
        if (s.autoplay && s.autoplay.stop) s.autoplay.stop();
        buildPagination(s);
        applyParallax(s);
        syncHeroVideoSlide(s);
      },
      imagesReady: function () {
        var s = this;
        if (s.autoplay && s.autoplay.start) s.autoplay.start();
        applyParallax(s);
        syncHeroVideoSlide(s);
      },
      progress: function () {
        applyParallax(this);
      },
      touchStart: function () {
        clearBgTransition(this);
      },
      setTransition: function (swiper, speed) {
        /* Swiper 11: (swiper, speed) — eski sürümlerde (speed) */
        var ms = typeof speed === 'number' ? speed : this.params.speed;
        setBgTransition(this, ms);
      },
      slideChange: function () {
        updatePagination(this);
      },
      slideChangeTransitionEnd: function () {
        setBgTransition(this, this.params.speed);
        applyParallax(this);
        updatePagination(this);
        syncHeroVideoSlide(this);
      },
      touchEnd: function () {
        setBgTransition(this, this.params.speed);
      },
    },
  });

  if (!heroVideoReduceMotion) {
    mainEl.querySelectorAll('.hero-slide-video[data-src]').forEach(function (heroVideoEl) {
      heroVideoEl.addEventListener('ended', function () {
        if (!mainSwiper) return;
        var activeSlide = mainSwiper.slides[mainSwiper.activeIndex];
        if (!activeSlide || !activeSlide.contains(heroVideoEl)) return;
        mainSwiper.slideNext();
        if (mainSwiper.autoplay && mainSwiper.autoplay.start) mainSwiper.autoplay.start();
      });
    });
  }

  /* ── Autoplay güvenli başlatma ─────────────────────────────────────── */
  window.addEventListener('load', function () {
    if (mainSwiper && mainSwiper.autoplay && mainSwiper.autoplay.start) {
      mainSwiper.autoplay.start();
    }
    if (mainSwiper) syncHeroVideoSlide(mainSwiper);
  });

  /* ── Parallax ──────────────────────────────────────────────────────── */
  function applyParallax(swiper) {
    var w      = swiper.width || swiper.el.offsetWidth || 2;
    var offset = w * interleaveOffset;
    for (var i = 0; i < swiper.slides.length; i++) {
      var slide    = swiper.slides[i];
      var progress = typeof slide.progress === 'number' ? slide.progress : 0;
      var layer    = slide.querySelector('.hero-parallax-layer');
      if (layer) layer.style.transform = 'translateX(' + (progress * offset) + 'px)';
    }
  }

  function clearBgTransition(swiper) {
    for (var i = 0; i < swiper.slides.length; i++) {
      swiper.slides[i].style.transition = '';
      var layer = swiper.slides[i].querySelector('.hero-parallax-layer');
      if (layer) layer.style.transition = '';
    }
  }

  function setBgTransition(swiper, ms) {
    for (var i = 0; i < swiper.slides.length; i++) {
      swiper.slides[i].style.transition = ms + 'ms';
      var layer = swiper.slides[i].querySelector('.hero-parallax-layer');
      if (layer) layer.style.transition = ms + 'ms';
    }
  }

  /* ── Özel sayfalama (DOM sabit; is-active ile CSS animasyonu) ───────── */
  function buildPagination(swiper) {
    if (!paginationEnabled || !pagHost) return;
    pagHost.innerHTML = '';
    for (var i = 0; i < slideCount; i++) {
      (function (idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hero-pag-btn';
        btn.setAttribute('role', 'tab');
        var slideAriaPrefix =
          window.PRAVA_I18N && window.PRAVA_I18N.slide_aria
            ? window.PRAVA_I18N.slide_aria
            : 'Slide';
        btn.setAttribute('aria-label', slideAriaPrefix + ' ' + (idx + 1));

        var inner = document.createElement('span');
        inner.className = 'hero-pag-thumb-inner';
        inner.appendChild(makeThumbImg(idx));
        btn.appendChild(inner);

        if (idx === swiper.realIndex) {
          btn.classList.add('is-active');
          btn.setAttribute('aria-selected', 'true');
        } else {
          btn.setAttribute('aria-selected', 'false');
        }

        btn.addEventListener('click', function () {
          if (mainSwiper.autoplay && mainSwiper.autoplay.stop) {
            mainSwiper.autoplay.stop();
          }
          if (mainSwiper.params.loop) {
            mainSwiper.slideToLoop(idx);
          } else {
            mainSwiper.slideTo(idx);
          }
        });

        pagHost.appendChild(btn);
      })(i);
    }
  }

  function updatePagination(swiper) {
    if (!paginationEnabled || !pagHost) return;
    var active = swiper.realIndex;
    var buttons = pagHost.querySelectorAll('.hero-pag-btn');
    for (var i = 0; i < slideCount; i++) {
      var b = buttons[i];
      if (!b) continue;
      var on = i === active;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) b.classList.add('is-active');
      else b.classList.remove('is-active');
    }
  }

  function makeThumbImg(idx) {
    var unsplash = [
      'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&q=80',
      'https://images.unsplash.com/photo-1476703993599-d85b5853188c?w=400&q=80',
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&q=80',
    ];
    var img = document.createElement('img');
    img.src = thumbsData[idx] || '';
    img.alt = '';
    img.onerror = (function (i) {
      return function () {
        this.onerror = null;
        this.src = unsplash[i] || unsplash[0];
      };
    })(idx);
    return img;
  }

  }

  }

  /* Yatay Swiper: SVG imleç yalnızca watchOverflow ile kilitli değilken (CSS: .prava-swiper--scrollable) */
  var PRAVA_SWIPER_SCROLLABLE_ON = {
    init: function () {
      this.el.classList.toggle('prava-swiper--scrollable', !this.isLocked);
    },
    resize: function () {
      this.el.classList.toggle('prava-swiper--scrollable', !this.isLocked);
    },
    breakpoint: function () {
      this.el.classList.toggle('prava-swiper--scrollable', !this.isLocked);
    },
    lock: function () {
      this.el.classList.toggle('prava-swiper--scrollable', !this.isLocked);
    },
    unlock: function () {
      this.el.classList.toggle('prava-swiper--scrollable', !this.isLocked);
    },
  };

  /** Kart/widget rayları: .prava-swiper-widget içindeki okları bağlar */
  function getPravaSwiperWidgetNav(swiperEl) {
    var wrap = swiperEl.closest('.prava-swiper-widget');
    if (!wrap) return null;
    var prev = wrap.querySelector('.prava-swiper-widget__btn--prev');
    var next = wrap.querySelector('.prava-swiper-widget__btn--next');
    if (!prev || !next) return null;
    return { prevEl: prev, nextEl: next };
  }

  function wirePravaSwiperWidgetChrome(swiper) {
    var wrap = swiper.el.closest('.prava-swiper-widget');
    if (!wrap) return;
    wrap.classList.toggle('prava-swiper-widget--locked', !!swiper.isLocked);
  }

  /** Scrollable + kilit sınıfı; userOn ile çakışmayı önlemek için aynı fn iki kez çağrılmaz */
  function mergePravaSwiperWidgetChromeIntoOpts(opts) {
    var userOn = opts.on || {};
    opts.on = {};
    ['init', 'resize', 'breakpoint', 'lock', 'unlock'].forEach(function (ev) {
      opts.on[ev] = function () {
        var base = PRAVA_SWIPER_SCROLLABLE_ON[ev];
        var user = userOn[ev];
        if (typeof base === 'function') base.call(this);
        if (typeof user === 'function' && user !== base) user.call(this);
        wirePravaSwiperWidgetChrome(this);
      };
    });
    Object.keys(userOn).forEach(function (key) {
      if (opts.on[key] !== undefined) return;
      opts.on[key] = userOn[key];
    });
  }

  /** Sağ alt pill + progressbar */
  function applyPravaSwiperWidgetChrome(el, opts) {
    var wrap = el.closest('.prava-swiper-widget');
    if (!wrap) return;
    var pag = wrap.querySelector('.prava-swiper-widget__pagination');
    if (pag) {
      opts.pagination = {
        el: pag,
        type: 'progressbar',
      };
    }
    mergePravaSwiperWidgetChromeIntoOpts(opts);
  }

  /* ── Kategori rayı (hero altı; ~3 tam + 4. kısmi) ───────────────────── */
  document.querySelectorAll('.prava-category-rail__swiper').forEach(function (el) {
    if (!el.querySelector('.swiper-slide')) return;
    var opts = {
      slidesPerView: 1.12,
      spaceBetween: 14,
      speed: 450,
      /* CSS cursor:url !important Swiper inline cursor’ı geçer; grab/grabbing sınıfları çalışır */
      grabCursor: true,
      watchOverflow: true,
      on: Object.assign({}, PRAVA_SWIPER_SCROLLABLE_ON),
      breakpoints: {
        520: {
          slidesPerView: 1.35,
          spaceBetween: 16,
        },
        768: {
          slidesPerView: 2.2,
          spaceBetween: 20,
        },
        1024: {
          slidesPerView: 3.1,
          spaceBetween: 24,
        },
        1440: {
          slidesPerView: 3.1,
          spaceBetween: 28,
        },
      },
    };
    applyPravaSwiperWidgetChrome(el, opts);
    var widgetNav = getPravaSwiperWidgetNav(el);
    if (widgetNav) opts.navigation = widgetNav;
    new Swiper(el, opts);
  });

  /* ── Ürün detay: ana galeri — mobilde Swiper (slidesPerView auto, genişlikler CSS); md+ enabled:false + grid CSS ── */
  document.querySelectorAll('[data-prava-pdp-gallery-swiper]').forEach(function (el) {
    if (!el.querySelector('.swiper-slide')) return;
    var pag = el.querySelector('.swiper-pagination');
    var opts = {
      slidesPerView: 'auto',
      /* Genişlik ve aralık CSS’te; JS ile slide boyutu hesaplanmaz */
      spaceBetween: 0,
      speed: 400,
      /* Diğer ray swiper’lardan farklı: ürün görsellerinde özel kaydırma imleci yok */
      grabCursor: false,
      watchOverflow: true,
      loop: true,
      breakpoints: {
        768: {
          enabled: false,
        },
      },
    };
    if (pag) {
      opts.pagination = {
        el: pag,
        type: 'progressbar',
      };
    }
    new Swiper(el, opts);
  });

  /* ── Ürün detay: benzer ürünler (sections/main-product-detail — product-card-atc) ── */
  document.querySelectorAll('.prava-pdp-related__swiper').forEach(function (el) {
    if (!el.querySelector('.swiper-slide')) return;
    var opts = {
      slidesPerView: 1.12,
      spaceBetween: 16,
      speed: 450,
      grabCursor: true,
      watchOverflow: true,
      on: Object.assign({}, PRAVA_SWIPER_SCROLLABLE_ON),
      breakpoints: {
        520: {
          slidesPerView: 1.35,
          spaceBetween: 18,
        },
        768: {
          slidesPerView: 2.15,
          spaceBetween: 22,
        },
        1024: {
          slidesPerView: 3,
          spaceBetween: 24,
        },
        1440: {
          slidesPerView: 3,
          spaceBetween: 28,
        },
      },
    };
    applyPravaSwiperWidgetChrome(el, opts);
    var widgetNav = getPravaSwiperWidgetNav(el);
    if (widgetNav) opts.navigation = widgetNav;
    new Swiper(el, opts);
  });

  /* ── Ürün detay: özellik kartları (metaobject list) ───────────────────── */
  document.querySelectorAll('[data-prava-pdp-features-swiper]').forEach(function (el) {
    if (!el.querySelector('.swiper-slide')) return;
    var opts = {
      slidesPerView: 1.12,
      spaceBetween: 16,
      speed: 450,
      grabCursor: true,
      watchOverflow: true,
      on: Object.assign({}, PRAVA_SWIPER_SCROLLABLE_ON),
      breakpoints: {
        520: {
          slidesPerView: 1.35,
          spaceBetween: 18,
        },
        768: {
          slidesPerView: 2.15,
          spaceBetween: 22,
        },
        1024: {
          slidesPerView: 3.05,
          spaceBetween: 24,
        },
        1440: {
          slidesPerView: 3.25,
          spaceBetween: 28,
        },
      },
    };
    applyPravaSwiperWidgetChrome(el, opts);
    var widgetNav = getPravaSwiperWidgetNav(el);
    if (widgetNav) opts.navigation = widgetNav;
    new Swiper(el, opts);
  });

  /* ── Ürün detay: 360° görsel (Cloudimage 360 View; metafield images_360) ── */
  document.querySelectorAll('[data-prava-pdp-360]').forEach(function (wrap) {
    var root = wrap.querySelector('[data-prava-pdp-360-root]');
    var payload = wrap.querySelector('script.prava-pdp-360__payload');
    if (!root || !payload) return;

    /* CDN: window.CI360 tekil örnek (constructor değil) */
    var ci360 = typeof window.CI360 !== 'undefined' ? window.CI360 : null;
    if (!ci360 || typeof ci360.init !== 'function') return;

    var urls;
    try {
      urls = JSON.parse(payload.textContent || '[]');
    } catch (e) {
      return;
    }
    if (!Array.isArray(urls) || urls.length === 0) return;

    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    try {
      ci360.init(root, {
        imageListX: urls,
        amountX: urls.length,
        aspectRatio: '3/4',
        draggable: true,
        swipeable: true,
        pinchZoom: true,
        keys: true,
        inertia: true,
        fullscreen: true,
        zoomMax: isMobile ? 2.5 : 4,
        lazyload: true,
        hints: false,
        initialIconShown: true,
        bottomCircle: true,
      });
    } catch (err) {}
  });

  /* ── En çok satılanlar (yatay Swiper; masaüstünde ~3 kart) ──────────── */
  document.querySelectorAll('.prava-bestsellers__swiper').forEach(function (el) {
    if (!el.querySelector('.swiper-slide')) return;
    var bestsellerOpts = {
      slidesPerView: 1.12,
      spaceBetween: 16,
      speed: 450,
      grabCursor: true,
      watchOverflow: true,
      on: Object.assign({}, PRAVA_SWIPER_SCROLLABLE_ON),
      breakpoints: {
        520: {
          slidesPerView: 1.35,
          spaceBetween: 18,
        },
        768: {
          slidesPerView: 2.15,
          spaceBetween: 22,
        },
        1024: {
          slidesPerView: 3,
          spaceBetween: 24,
        },
        1440: {
          slidesPerView: 3,
          spaceBetween: 28,
        },
      },
    };
    applyPravaSwiperWidgetChrome(el, bestsellerOpts);
    var bestsellerNav = getPravaSwiperWidgetNav(el);
    if (bestsellerNav) bestsellerOpts.navigation = bestsellerNav;
    var swiper = new Swiper(el, bestsellerOpts);

    /* Hover’da başlayan ve her hover’da başa saran kart videoları */
    el.querySelectorAll('.prava-bestsellers-card').forEach(function (card) {
      var video = card.querySelector('video[data-bestseller-hover-video]');
      if (!video) return;

      card.addEventListener('mouseenter', function () {
        try {
          video.currentTime = 0;
        } catch (e) {}
        video.load();
        var p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {});
        }
      });

      card.addEventListener('mouseleave', function () {
        video.pause();
        try {
          video.currentTime = 0;
        } catch (e) {}
      });
    });
  });

  /* ── Blog rayı: slidesPerView 'auto' + slayt genişliği CSS (300px) ───── */
  document.querySelectorAll('.prava-blog-rail__swiper').forEach(function (el) {
    if (!el.querySelector('.swiper-slide')) return;
    var opts = {
      slidesPerView: 'auto',
      spaceBetween: 14,
      speed: 450,
      grabCursor: true,
      watchOverflow: true,
      on: Object.assign({}, PRAVA_SWIPER_SCROLLABLE_ON),
      breakpoints: {
        480: {
          spaceBetween: 16,
        },
        640: {
          spaceBetween: 18,
        },
        768: {
          spaceBetween: 20,
        },
        1024: {
          spaceBetween: 22,
        },
        1280: {
          spaceBetween: 24,
        },
      },
    };
    applyPravaSwiperWidgetChrome(el, opts);
    var widgetNav = getPravaSwiperWidgetNav(el);
    if (widgetNav) opts.navigation = widgetNav;
    new Swiper(el, opts);
  });

  /* ── Mega menü ─────────────────────────────────────────────────────── */
  var mega = document.getElementById('mega-menu');
  var btnMenu = document.getElementById('btn-menu');
  var siteHeader = document.getElementById('site-header');
  var headerGradient = document.getElementById('site-header-gradient');
  var btnClose = document.getElementById('mega-menu-close');
  var megaBackdrop = document.getElementById('mega-menu-backdrop');
  var footerDiscover = document.getElementById('mega-footer-discover');
  var footerCta = document.getElementById('mega-footer-cta');
  var mqDesktop =
    typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)') : null;
  var mqReducedMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  var megaTabs = mega ? mega.querySelectorAll('.mega-menu__tab') : [];
  var megaPanels = mega ? mega.querySelectorAll('.mega-menu__panel') : [];
  var activePanelIndex = 0;
  var megaTimers = { hover: null, close: null, content: null };
  var megaMotionMs = 720;
  var megaContentRevealMs = 680;

  function isDesktopMega() {
    return mqDesktop && mqDesktop.matches;
  }

  function megaHasMotion() {
    return mqReducedMotion ? !mqReducedMotion.matches : true;
  }

  function parseMegaMotionMs() {
    if (!mega) return;
    var styles = window.getComputedStyle(mega);
    var panelMs = parseFloat(styles.getPropertyValue('--mega-motion-duration')) * 1000;
    var contentMs = parseFloat(styles.getPropertyValue('--mega-content-reveal-delay')) * 1000;
    if (panelMs) megaMotionMs = panelMs;
    if (contentMs) megaContentRevealMs = contentMs;
  }

  function clearMegaTimer(key) {
    if (!megaTimers[key]) return;
    clearTimeout(megaTimers[key]);
    megaTimers[key] = null;
  }

  function megaVisualSrcFromItem(item) {
    if (!item) return '';
    var row = item.closest('li');
    return row ? row.getAttribute('data-gorsel') || '' : '';
  }

  function updateMegaPanelVisual(panel) {
    if (!panel) return;
    var img = panel.querySelector('[data-mega-visual-img]');
    var visual = panel.querySelector('.mega-menu__visual');
    var video = panel.querySelector('[data-mega-visual-video]');
    if (!img || !visual) return;

    var active = panel.querySelector('.mega-menu__subitem.is-active');
    var itemSrc = megaVisualSrcFromItem(active);
    var defaultSrc = visual.getAttribute('data-default-src') || '';
    var defaultVideo = visual.getAttribute('data-default-video');
    var src = itemSrc || defaultSrc;
    var showVideo = !!(defaultVideo && (!itemSrc || itemSrc === defaultSrc));

    if (video) {
      video.classList.toggle('mega-menu__visual-video--hidden', !showVideo);
      if (showVideo) {
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(function () {});
      } else {
        video.pause();
      }
    }

    img.classList.toggle('mega-menu__visual-img--hidden', showVideo);
    if (showVideo) return;

    if (!src || img.getAttribute('src') === src) return;

    img.setAttribute('src', src);
    var titleEl = active ? active.querySelector('.mega-menu__subtitle') : null;
    img.setAttribute('alt', titleEl ? titleEl.textContent.trim() : '');
  }

  function setHeaderMegaOpen(on) {
    if (!isDesktopMega()) {
      if (siteHeader) siteHeader.classList.remove('is-mega-open');
      if (headerGradient) headerGradient.classList.remove('is-hidden-by-mega');
      return;
    }
    if (siteHeader) siteHeader.classList.toggle('is-mega-open', !!on);
    if (headerGradient) headerGradient.classList.toggle('is-hidden-by-mega', !!on);
  }

  function syncBtnMenuState(open) {
    if (!btnMenu) return;
    btnMenu.setAttribute('aria-expanded', open ? 'true' : 'false');
    var labelKey = open ? 'data-label-close' : 'data-label-open';
    var label = btnMenu.getAttribute(labelKey);
    if (label) btnMenu.setAttribute('aria-label', label);
    var closePanel = btnMenu.querySelector('.btn-menu__panel--close');
    if (closePanel) closePanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function clearMegaContentReveal() {
    if (!mega) return;
    mega.classList.remove('mega-menu--content-ready');
    clearMegaTimer('content');
  }

  function scheduleMegaContentReveal() {
    if (!mega) return;
    clearMegaTimer('content');
    if (!megaHasMotion()) {
      mega.classList.add('mega-menu--content-ready');
      return;
    }
    megaTimers.content = setTimeout(function () {
      megaTimers.content = null;
      if (!mega.hasAttribute('hidden') && mega.classList.contains('mega-menu--open')) {
        mega.classList.add('mega-menu--content-ready');
      }
    }, megaContentRevealMs);
  }

  function syncFooterFromPanel(index) {
    var panel = megaPanels[index];
    if (!panel || !footerDiscover || !footerCta) return;
    var d = panel.getAttribute('data-footer-discover');
    var dh = panel.getAttribute('data-footer-discover-href') || '#';
    var c = panel.getAttribute('data-footer-cta');
    var ch = panel.getAttribute('data-footer-cta-href') || '#';
    if (d) footerDiscover.textContent = d;
    footerDiscover.setAttribute('href', dh);
    if (c) footerCta.textContent = c;
    footerCta.setAttribute('href', ch);
  }

  function setMegaTab(index) {
    if (index < 0 || index >= megaPanels.length) return;
    activePanelIndex = index;
    for (var i = 0; i < megaTabs.length; i++) {
      var on = i === index;
      megaTabs[i].classList.toggle('is-active', on);
      megaTabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (var j = 0; j < megaPanels.length; j++) {
      if (j === index) megaPanels[j].removeAttribute('hidden');
      else megaPanels[j].setAttribute('hidden', '');
    }
    syncFooterFromPanel(index);
    updateMegaPanelVisual(megaPanels[index]);
  }

  function openMegaMenu(opts) {
    opts = opts || {};
    if (!mega) return;
    clearMegaTimer('close');
    clearMegaTimer('hover');
    clearMegaContentReveal();
    mega.classList.remove('mega-menu--closing');
    mega.removeAttribute('hidden');
    syncBtnMenuState(true);
    document.body.classList.add('mega-menu-open');
    setHeaderMegaOpen(true);
    mega.classList.remove('mega-menu--open');
    requestAnimationFrame(function () {
      mega.classList.add('mega-menu--open');
      scheduleMegaContentReveal();
    });
    syncFooterFromPanel(activePanelIndex);
    if (btnClose && !opts.skipFocus && !isDesktopMega()) btnClose.focus();
  }

  function finishMegaClose() {
    if (!mega) return;
    clearMegaTimer('close');
    mega.classList.remove('mega-menu--closing');
    mega.setAttribute('hidden', '');
    document.body.classList.remove('mega-menu-open');
    if (btnMenu && !isDesktopMega()) btnMenu.focus();
  }

  function closeMegaMenu() {
    if (!mega || mega.hasAttribute('hidden')) return;
    clearMegaTimer('hover');
    clearMegaContentReveal();
    syncBtnMenuState(false);
    setHeaderMegaOpen(false);
    mega.classList.add('mega-menu--closing');
    mega.classList.remove('mega-menu--open');

    if (!megaHasMotion()) {
      finishMegaClose();
      return;
    }

    var inner = mega.querySelector('.mega-menu__inner');
    var done = false;

    function onPanelTransitionEnd(e) {
      if (done || e.target !== inner || e.propertyName !== 'transform') return;
      done = true;
      inner.removeEventListener('transitionend', onPanelTransitionEnd);
      finishMegaClose();
    }

    if (inner) inner.addEventListener('transitionend', onPanelTransitionEnd);
    clearMegaTimer('close');
    megaTimers.close = setTimeout(function () {
      if (done) return;
      done = true;
      if (inner) inner.removeEventListener('transitionend', onPanelTransitionEnd);
      finishMegaClose();
    }, megaMotionMs + 80);
  }

  function isMegaHoverZone(el) {
    if (!el || !mega) return false;
    if (siteHeader && siteHeader.contains(el)) return true;
    var inner = mega.querySelector('.mega-menu__inner');
    return !!(inner && inner.contains(el));
  }

  function onMegaHoverLeave(e) {
    if (!isDesktopMega()) return;
    if (isMegaHoverZone(e.relatedTarget)) return;
    clearMegaTimer('hover');
    megaTimers.hover = setTimeout(closeMegaMenu, 220);
  }

  if (mega) {
    parseMegaMotionMs();

    setMegaTab(0);

    if (btnMenu) {
      btnMenu.addEventListener('click', function () {
        if (mega.hasAttribute('hidden')) openMegaMenu({ skipFocus: isDesktopMega() });
        else closeMegaMenu();
      });
    }

    if (siteHeader) {
      siteHeader.addEventListener('mouseleave', onMegaHoverLeave);
      siteHeader.addEventListener('mouseenter', function () {
        clearMegaTimer('hover');
      });
    }

    mega.addEventListener('mouseleave', onMegaHoverLeave);
    mega.addEventListener('mouseenter', function () {
      clearMegaTimer('hover');
    });

    mega.addEventListener('click', function (e) {
      var tab = e.target.closest('.mega-menu__tab');
      if (!tab) return;
      var idx = parseInt(tab.getAttribute('data-mega-tab'), 10);
      if (!isNaN(idx)) setMegaTab(idx);
    });

    mega.addEventListener('mouseover', function (e) {
      var item = e.target.closest('.mega-menu__subitem');
      if (!item) return;
      var list = item.closest('.mega-menu__sublist');
      if (!list) return;
      var prev = list.querySelector('.mega-menu__subitem.is-active');
      if (prev === item) return;
      if (prev) prev.classList.remove('is-active');
      item.classList.add('is-active');
      updateMegaPanelVisual(item.closest('.mega-menu__panel'));
    });

    if (btnClose) btnClose.addEventListener('click', closeMegaMenu);
    if (megaBackdrop) {
      megaBackdrop.addEventListener('click', closeMegaMenu);
      megaBackdrop.addEventListener('mouseenter', function () {
        if (!isDesktopMega() || mega.hasAttribute('hidden')) return;
        clearMegaTimer('hover');
        closeMegaMenu();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !mega.hasAttribute('hidden')) {
        e.preventDefault();
        closeMegaMenu();
      }
    });

    var megaResizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(megaResizeTimer);
      megaResizeTimer = setTimeout(function () {
        if (mega.hasAttribute('hidden')) return;
        if (isDesktopMega()) {
          setHeaderMegaOpen(true);
        } else {
          clearMegaTimer('hover');
          setHeaderMegaOpen(false);
        }
      }, 120);
    });
  }

  /* ── Header: aşağı kaydırınca gizle, yukarı kaydırınca göster (animasyonlu) ─ */
  function initHeaderScrollConceal() {
    var header = document.getElementById('site-header');
    if (!header) return;

    var gradient = document.getElementById('site-header-gradient');
    var miniSearchRoot = document.getElementById('mini-search');
    var scrollThreshold = 12;
    var deltaMin = 8;
    var lastY = window.scrollY || document.documentElement.scrollTop || 0;
    var concealed = false;
    var rafId = 0;

    function setConcealed(on) {
      if (concealed === on) return;
      concealed = on;
      var fn = on ? 'add' : 'remove';
      header.classList[fn]('is-concealed-by-scroll');
      if (gradient) gradient.classList[fn]('is-concealed-by-scroll');
    }

    function mustStayVisible() {
      if (document.body.classList.contains('mega-menu-open')) return true;
      if (miniSearchRoot && miniSearchRoot.classList.contains('mini-search--open')) return true;
      return false;
    }

    function onScrollFrame() {
      rafId = 0;
      if (mustStayVisible()) {
        setConcealed(false);
        lastY = window.scrollY || document.documentElement.scrollTop || 0;
        return;
      }
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y < scrollThreshold) {
        setConcealed(false);
      } else {
        var delta = y - lastY;
        if (delta > deltaMin) setConcealed(true);
        else if (delta < -deltaMin) setConcealed(false);
      }
      lastY = y;
    }

    function onScroll() {
      if (rafId) return;
      rafId = window.requestAnimationFrame(onScrollFrame);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /*
   * Intro metin: PointC CodePen (MWQJWqJ) tarzı — satır mask, scroll’da scaleX:0, origin sağ.
   * https://codepen.io/PointC/pen/MWQJWqJ — SplitText/ScrollSmoother yok, manuel satır.
   */
  function escapeHtmlIntro(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function initIntroLineReveal() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    document.querySelectorAll('.prava-intro-split__text--line-reveal').forEach(function (root) {
      var section = root.closest('.prava-intro-split');
      if (!section) return;

      var raw = (root.innerText || root.textContent || '').trim();
      if (!raw) return;

      var lines = raw.split(/\n+/).map(function (l) {
        return l.trim();
      }).filter(Boolean);

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.innerHTML = lines
          .map(function (line) {
            return '<p class="prava-intro-line-plain">' + escapeHtmlIntro(line) + '</p>';
          })
          .join('');
        return;
      }

      root.innerHTML = lines
        .map(function (line) {
          return (
            '<span class="prava-intro-line">' +
            '<span class="prava-intro-line__text">' +
            escapeHtmlIntro(line) +
            '</span>' +
            '<span class="prava-intro-line__mask" aria-hidden="true"></span>' +
            '</span>'
          );
        })
        .join('');

      gsap.registerPlugin(ScrollTrigger);

      root.querySelectorAll('.prava-intro-line').forEach(function (lineEl) {
        var mask = lineEl.querySelector('.prava-intro-line__mask');
        if (!mask) return;

        gsap.set(mask, { scaleX: 1 });

        gsap.to(mask, {
          scaleX: 0,
          transformOrigin: 'right center',
          ease: 'none',
          scrollTrigger: {
            trigger: lineEl,
            start: 'top center',
            end: 'bottom center',
            scrub: true,
          },
        });
      });
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }, 200);
    });
  }

  function initIntroFigureReveal() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.prava-intro-split__figure-wrap--reveal').forEach(function (wrap) {
      var offset = window.matchMedia('(min-width: 768px)').matches ? -150 : 0;

      /* Görsel alan viewport’a girdiğinden çıkana kadar: animasyonun tamamı kaydırma boyunca görünür */
      gsap.fromTo(
        wrap,
        { opacity: 0, x: offset },
        {
          opacity: 1,
          x: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: wrap,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.9,
            invalidateOnRefresh: true,
          },
        }
      );
    });
  }

  function initHeadingStaggeredLetters() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    var headings = gsap.utils.toArray('main h2').filter(function (el) {
      if (!el || el.dataset.headingReveal === 'off') return false;
      if (el.closest('#hero')) return false;
      if (el.closest('.landing-history')) return false;
      if (el.closest('.prava-intro-split__text--line-reveal')) return false;
      return true;
    });

    headings.forEach(function (heading) {
      if (heading.dataset.lettersReady === 'true') return;
      heading.dataset.lettersReady = 'true';

      var rawText = heading.textContent || '';
      if (!rawText.trim()) return;

      heading.textContent = '';
      var letterEls = [];
      var words = rawText.split(/\s+/).filter(Boolean);

      words.forEach(function (word, wordIndex) {
        var wordWrap = document.createElement('span');
        wordWrap.className = 'heading-word-nowrap';

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

        heading.appendChild(wordWrap);
        if (wordIndex < words.length - 1) {
          heading.appendChild(document.createTextNode(' '));
        }
      });

      if (!letterEls.length) return;

      gsap.set(letterEls, { yPercent: 95, autoAlpha: 0 });

      gsap.to(letterEls, {
        yPercent: 0,
        autoAlpha: 1,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.018,
        scrollTrigger: {
          trigger: heading,
          start: 'top 75%',
          once: true,
        },
      });
    });
  }

  function initParallaxEffects() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('.parallax-item, .parallax-container').forEach(function (container) {
      var content = container.children[0];
      if (!content) return;

      var speed = parseFloat(container.dataset.speed) || 1;
      var startY = parseFloat(container.dataset.start) || -20;
      var endY = parseFloat(container.dataset.end) || 20;
      var direction = container.dataset.direction || 'vertical';
      var trigger = container.dataset.trigger || container;
      var scrub = container.dataset.scrub !== undefined ? parseFloat(container.dataset.scrub) : true;
      var pin = container.dataset.pin === 'true';
      var scaleEffect = container.dataset.scale === 'true';

      var targetElement = container.classList.contains('parallax-item')
        ? (container.querySelector('.parallax-content') || content)
        : content;

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: trigger,
          scrub: scrub,
          pin: pin,
        },
      });

      if (scaleEffect) {
        tl.fromTo(targetElement, {
          scale: 0.8,
          ease: 'none',
        }, {
          scale: 1.2,
          ease: 'none',
        }, 0);
      }

      if (direction === 'horizontal') {
        tl.fromTo(targetElement, {
          xPercent: startY,
          ease: 'none',
        }, {
          xPercent: endY,
          ease: 'none',
        }, 0);
      } else if (direction === 'both') {
        tl.fromTo(targetElement, {
          xPercent: startY,
          yPercent: startY,
          ease: 'none',
        }, {
          xPercent: endY,
          yPercent: endY,
          ease: 'none',
        }, 0);
      } else {
        tl.fromTo(targetElement, {
          yPercent: startY,
          ease: 'none',
        }, {
          yPercent: endY,
          ease: 'none',
        }, 0);
      }

      tl.timeScale(speed);
    });
  }

  function initSectionBackgroundGradients() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    /*
     * Performans stratejisi:
     * Her bölüm için statik gradient içeren bir <div.prava-bg-overlay> DOM'a enjekte edilir.
     * GSAP yalnızca bu elementin `opacity` değerini (0 → 1) animate eder.
     * opacity animasyonu compositor thread'de çalışır: repaint yok, style recalc yok,
     * renk interpolasyonu yok. Baz renk bg-custom-color (#f5f5f3) ile aynıdır; geçiş
     * bölüm girerken uzun süre düz renk, ortaya doğru gradient belirginleşir.
     */
    var PRAVA_BG_BASE = '#f5f5f3';
    var bgConfigs = [
      {
        selector: '#blog-rail-bg-section',
        base: PRAVA_BG_BASE,
        gradient: 'linear-gradient(135deg, #fff2ec 0%, #ecc8bc 50%, #d49888 100%)',
        scrollStart: 'top bottom',
        scrollEnd: 'center center',
        scrub: 0.7,
        ease: 'power2.in',
      },
      {
        selector: '.site-footer',
        base: PRAVA_BG_BASE,
        gradient: 'linear-gradient(135deg, #e9f0eb 0%, #e2c8cf 50%, #c4d8e8 100%)',
        scrollStart: 'top 92%',
        scrollEnd: 'center 58%',
        scrub: 0.7,
        ease: 'power2.in',
      },
      {
        selector: '#popular-split-bg-section',
        base: PRAVA_BG_BASE,
        gradient: 'linear-gradient(135deg, #e7e2d6 0%, #d7d4b9 100%)',
        scrollStart: 'top bottom',
        scrollEnd: 'center center',
        scrub: 0.75,
        ease: 'power2.in',
      },
    ];

    bgConfigs.forEach(function (cfg) {
      var bgSection = document.querySelector(cfg.selector);
      if (!bgSection) return;

      bgSection.style.backgroundColor = cfg.base;

      var overlay = document.createElement('div');
      overlay.className = 'prava-bg-overlay';
      overlay.style.backgroundImage = cfg.gradient;
      overlay.setAttribute('aria-hidden', 'true');
      bgSection.insertBefore(overlay, bgSection.firstChild);

      gsap.fromTo(
        overlay,
        { opacity: 0 },
        {
          opacity: 1,
          ease: cfg.ease || 'power2.in',
          scrollTrigger: {
            trigger: bgSection,
            start: cfg.scrollStart || 'top bottom',
            end: cfg.scrollEnd || 'center center',
            scrub: cfg.scrub != null ? cfg.scrub : 0.7,
            invalidateOnRefresh: true,
          },
        }
      );
    });
  }

  /* Öne çıkan ürün kartı — yalnızca desktop (lg+): scroll scrub, sadece dikey kayma */
  function initProductSpotlightScrollReveal() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    ScrollTrigger.matchMedia({
      '(min-width: 1024px)': function () {
        document.querySelectorAll('[data-product-spotlight]').forEach(function (card) {
          var motion = card.querySelector('[data-product-spotlight-motion]');
          if (!motion) return;

          /* Geniş dikey ofset + kısa scroll aralığı: hareket viewport’a girerken yoğunlaşır, daha belirgin */
          gsap.fromTo(
            motion,
            { yPercent: 36 },
            {
              yPercent: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                start: 'top bottom',
                end: 'top 38%',
                scrub: 0.65,
                invalidateOnRefresh: true,
              },
            }
          );
        });
      },
    });
  }

  function initSupportFaqAccordion() {
    document.querySelectorAll('.prava-support-faq__list').forEach(function (list) {
      list.querySelectorAll('details.prava-support-faq__item').forEach(function (el) {
        el.addEventListener('toggle', function () {
          if (!this.open) return;
          list.querySelectorAll('details.prava-support-faq__item').forEach(function (other) {
            if (other !== el) other.removeAttribute('open');
          });
        });
      });
    });
  }

  function escapeHtmlMini(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function initMiniSearch() {
    var root = document.getElementById('mini-search');
    var openBtn = document.getElementById('mini-search-open');
    var input = document.getElementById('mini-search-input');
    var resultsEl = document.getElementById('mini-search-results');
    var form = document.getElementById('mini-search-form');
    var viewAll = document.getElementById('mini-search-view-all');
    var clearInputBtn = document.getElementById('mini-search-clear-input');
    if (!root || !openBtn || !input || !resultsEl) return;

    var debounceMs = 300;
    var timer = null;
    var controller = null;
    var routes = window.routes || {};
    var suggestPath = routes.predictive_search_url || '/search/suggest';
    var searchUrl = routes.search_url || '/search';
    var i18n = window.PRAVA_I18N || {};

    function closeMegaIfOpen() {
      var m = document.getElementById('mega-menu');
      if (m && !m.hasAttribute('hidden')) closeMegaMenu();
    }

    function syncClearInputVisibility() {
      if (!clearInputBtn) return;
      if (input.value.trim()) {
        clearInputBtn.removeAttribute('hidden');
      } else {
        clearInputBtn.setAttribute('hidden', '');
      }
    }

    function openSearch() {
      closeMegaIfOpen();
      root.classList.add('mini-search--open');
      root.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      syncClearInputVisibility();
      setTimeout(function () {
        input.focus();
        try {
          input.select();
        } catch (e) {}
      }, 10);
    }

    function closeSearch() {
      root.classList.remove('mini-search--open');
      root.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (controller) {
        controller.abort();
        controller = null;
      }
    }

    function productImageUrl(p) {
      var fi = p.featured_image || p.image;
      if (!fi) return '';
      if (typeof fi === 'string') return fi;
      if (fi.url) return fi.url;
      return '';
    }

    function productPrice(p) {
      if (p.price != null && p.price !== '') return String(p.price);
      if (p.price_min != null && p.price_min !== '') return String(p.price_min);
      return '';
    }

    function renderProducts(products) {
      if (!products || products.length === 0) {
        resultsEl.innerHTML =
          '<p class="mini-search__empty">' + escapeHtmlMini(i18n.mini_search_no_results || '') + '</p>';
        if (viewAll) viewAll.hidden = true;
        return;
      }
      var html = '<ul class="mini-search__list" role="list">';
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var url = p.url || '#';
        var title = p.title || '';
        var src = productImageUrl(p);
        var img = '';
        if (src) {
          img =
            '<img src="' +
            escapeHtmlMini(src) +
            '" alt="" class="mini-search__thumb" width="48" height="48" loading="lazy">';
        }
        var price = productPrice(p);
        html += '<li><a class="mini-search__item" href="' + escapeHtmlMini(url) + '">';
        html += img;
        html += '<span class="mini-search__meta"><span class="mini-search__title">' + escapeHtmlMini(title) + '</span>';
        if (price) {
          html += '<span class="mini-search__price">' + escapeHtmlMini(price) + '</span>';
        }
        html += '</span></a></li>';
      }
      html += '</ul>';
      resultsEl.innerHTML = html;
      if (viewAll) {
        viewAll.hidden = false;
        var q = input.value.trim();
        viewAll.href = searchUrl + (q ? '?q=' + encodeURIComponent(q) : '');
      }
    }

    function runSearch(raw) {
      var query = (raw || '').trim();
      if (query.length < 2) {
        resultsEl.innerHTML = '';
        if (viewAll) viewAll.hidden = true;
        return;
      }
      if (controller) controller.abort();
      controller = new AbortController();
      var sp = new URLSearchParams();
      sp.set('q', query);
      sp.set('resources[type]', 'product');
      sp.set('resources[limit]', '10');
      var fetchUrl = suggestPath + (suggestPath.indexOf('?') >= 0 ? '&' : '?') + sp.toString();

      fetch(fetchUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
        .then(function (r) {
          if (!r.ok) throw new Error('predictive_search_http');
          return r.json();
        })
        .then(function (data) {
          var products = [];
          if (
            data &&
            data.resources &&
            data.resources.results &&
            data.resources.results.products
          ) {
            products = data.resources.results.products;
          }
          renderProducts(products);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          resultsEl.innerHTML =
            '<p class="mini-search__empty mini-search__empty--error">' +
            escapeHtmlMini(i18n.mini_search_error || '') +
            '</p>';
          if (viewAll) viewAll.hidden = true;
        });
    }

    openBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openSearch();
    });

    root.querySelectorAll('[data-mini-search-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeSearch();
      });
    });

    if (clearInputBtn) {
      clearInputBtn.addEventListener('click', function (e) {
        e.preventDefault();
        input.value = '';
        resultsEl.innerHTML = '';
        if (viewAll) viewAll.hidden = true;
        if (controller) {
          controller.abort();
          controller = null;
        }
        syncClearInputVisibility();
        input.focus();
      });
    }

    input.addEventListener('input', function () {
      syncClearInputVisibility();
      var v = input.value;
      clearTimeout(timer);
      timer = setTimeout(function () {
        runSearch(v);
      }, debounceMs);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('mini-search--open')) {
        e.preventDefault();
        closeSearch();
        openBtn.focus();
      }
    });

    if (form) {
      form.addEventListener('submit', function () {
        closeSearch();
      });
    }
  }

  /** Grid / layout sonrası ScrollTrigger yeniden ölçsün (footer gradient vb.). */
  function scheduleScrollTriggerRefresh() {
    if (typeof ScrollTrigger === 'undefined') return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        try {
          ScrollTrigger.refresh();
        } catch (e) {}
      });
    });
  }

  function initCollectionGridToggle() {
    var section = document.querySelector('.main-collection-catalog');
    if (!section) return;
    var buttons = section.querySelectorAll('[data-collection-grid-cols]');
    if (!buttons.length) return;

    var STORAGE_KEY = 'prava-collection-grid-cols';

    var grid = section.querySelector('[data-collection-product-grid]');

    function syncAria(is4) {
      buttons.forEach(function (btn) {
        var v = btn.getAttribute('data-collection-grid-cols');
        var active = (is4 && v === '4') || (!is4 && v === '3');
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function syncGridClass(is4) {
      if (!grid) return;
      grid.classList.toggle('is-collection-grid-4', is4);
    }

    function apply(cols) {
      var is4 = cols === '4';
      document.documentElement.classList.toggle('prava-collection-grid-4', is4);
      try {
        localStorage.setItem(STORAGE_KEY, is4 ? '4' : '3');
      } catch (e) {}
      syncGridClass(is4);
      syncAria(is4);
      scheduleScrollTriggerRefresh();
    }

    syncGridClass(document.documentElement.classList.contains('prava-collection-grid-4'));
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-collection-grid-cols') || '3');
      });
    });
  }

  /** Koleksiyon promo videoları: viewport’ta görünürken oynat, çıkınca duraklat */
  function initCollectionPromoVideos() {
    if (typeof IntersectionObserver === 'undefined') return;

    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}

    var section = document.querySelector('.main-collection-catalog');
    if (!section) return;

    var videos = section.querySelectorAll('.collection-inline-promo video[data-collection-promo-video]');
    if (!videos.length) return;

    var opts = {
      root: null,
      rootMargin: '0px',
      threshold: 0,
    };

    function tryPlay(video) {
      var p = video.play();
      if (p !== undefined && p && typeof p.catch === 'function') {
        p.catch(function () {});
      }
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;
        if (entry.isIntersecting) {
          tryPlay(video);
        } else {
          try {
            video.pause();
          } catch (e2) {}
        }
      });
    }, opts);

    videos.forEach(function (video) {
      try {
        video.pause();
      } catch (e) {}
      observer.observe(video);
    });
  }

  function initScrollTopButton() {
    var btn = document.getElementById('scroll-top-btn');
    if (!btn) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;

    var hero = document.getElementById('hero');
    var showAfter = hero
      ? (hero.offsetTop + hero.offsetHeight - 120)
      : window.innerHeight;

    function setVisible(on) {
      btn.classList.toggle('is-visible', !!on);
    }

    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      setVisible(y > showAfter);
    }

    btn.addEventListener('click', function () {
      if (window.PRAVA_LENIS && typeof window.PRAVA_LENIS.scrollTo === 'function') {
        window.PRAVA_LENIS.scrollTo(0, { duration: 1 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    window.addEventListener('resize', function () {
      showAfter = hero
        ? (hero.offsetTop + hero.offsetHeight - 120)
        : window.innerHeight;
      onScroll();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  initIntroLineReveal();
  initIntroFigureReveal();
  initHeadingStaggeredLetters();
  initParallaxEffects();
  initSectionBackgroundGradients();
  initProductSpotlightScrollReveal();
  initSupportFaqAccordion();
  initMiniSearch();
  initHeaderScrollConceal();
  initCollectionGridToggle();
  initCollectionPromoVideos();
  initScrollTopButton();
  if (lenisInstance && typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
})();
