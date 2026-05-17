/**
 * PRAVA ürün detay (PDP) — sections/main-product-detail.liquid ile eşleşir.
 *
 * Sepete ekle: form gönderimini yakalayıp fetch + FormData ile routes.cart_add_url’e POST
 * (Ajax Cart API; vitrin drawer ile uyumlu). Renk vb. ayrı ürün URL’leri — sayfada tek varyant, seçici yok.
 *
 * window.routes: layout/theme.liquid içinde tanımlanır (cart_add_url, cart_url).
 */
(function () {
  'use strict';

  var root = document.querySelector('[data-prava-pdp]');
  if (!root) return;

  var sectionId = root.getAttribute('data-section-id');
  if (!sectionId) return;

  /** Alt merkez toast (favori mesajları); role=status ile ekran okuyucu duyuru */
  var _pravaToastTimer;
  function pravaToast(message) {
    var text = message && String(message).trim();
    if (!text) return;
    var el = document.getElementById('prava-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'prava-toast';
      el.className = 'prava-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      document.body.appendChild(el);
    }
    el.textContent = text;
    window.clearTimeout(_pravaToastTimer);
    el.classList.remove('prava-toast--visible');
    void el.offsetWidth;
    el.classList.add('prava-toast--visible');
    _pravaToastTimer = window.setTimeout(function () {
      el.classList.remove('prava-toast--visible');
    }, 3600);
  }

  /**
   * Dawn product-form.js ile aynı fikir: formu Ajax ile /cart/add’a gönder, JSON yanıtı işle.
   * FormData kullanıldığında Content-Type header’ını set etme (boundary için tarayıcıya bırak).
   */
  function bindAjaxAddToCart(form) {
    if (!form || form.getAttribute('data-prava-ajax-cart') === 'bound') return;
    form.setAttribute('data-prava-ajax-cart', 'bound');

    var btn = form.querySelector('button[type="submit"][name="add"]');

    form.addEventListener('submit', function (evt) {
      var routes = window.routes;
      if (!routes || !routes.cart_add_url) {
        return;
      }

      evt.preventDefault();

      if (btn && btn.disabled) return;

      var fd = new FormData(form);
      if (typeof window.PravaCartSections === 'string' && window.PravaCartSections.length) {
        fd.append('sections', window.PravaCartSections);
        try {
          fd.append('sections_url', window.location.pathname);
        } catch (e2) {}
      }
      if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-70');
      }

      fetch(routes.cart_add_url, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json, application/javascript, text/javascript, */*',
        },
        body: fd,
      })
        .then(function (res) {
          return res.json().catch(function () {
            return {};
          });
        })
        .then(function (data) {
          if (data && data.status) {
            var msg =
              (data.description && String(data.description)) ||
              (data.message && String(data.message)) ||
              (window.PRAVA_I18N && window.PRAVA_I18N.cart_add_error) ||
              'Error';
            window.alert(msg);
            return;
          }
          var drawer = document.querySelector('cart-drawer');
          if (data && data.sections && drawer && typeof drawer.renderContents === 'function') {
            drawer.renderContents(data);
            return;
          }
          if (routes.cart_url) {
            window.location.href = routes.cart_url;
          } else {
            window.location.reload();
          }
        })
        .catch(function () {
          var net =
            (window.PRAVA_I18N && window.PRAVA_I18N.cart_add_network) || 'Network error';
          window.alert(net);
        })
        .finally(function () {
          if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-70');
          }
        });
    });
  }

  var mainForm = document.getElementById('ProductForm-' + sectionId);
  bindAjaxAddToCart(mainForm);

  /** Sepete ekle metnini başlıklardaki gibi harflere böl (heading-letter-wrap / heading-letter) */
  function splitPdpAtcButtonLabel(btn) {
    if (!btn || btn.disabled) return;
    var label = btn.querySelector('.prava-pdp-atc-btn__label');
    if (!label || label.getAttribute('data-prava-atc-letters') === 'ready') return;
    var rawText = (label.textContent || '').trim();
    if (!rawText) return;
    label.setAttribute('data-prava-atc-letters', 'ready');
    label.textContent = '';
    var letterIndex = 0;
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
        inner.style.setProperty('--prava-letter-i', String(letterIndex));
        letterIndex += 1;
        wrap.appendChild(inner);
        wordWrap.appendChild(wrap);
      }
      label.appendChild(wordWrap);
      if (wordIndex < words.length - 1) {
        label.appendChild(document.createTextNode(' '));
      }
    });
  }

  splitPdpAtcButtonLabel(document.getElementById('PdpSubmit-' + sectionId));

  root.querySelectorAll('.prava-pdp-related-card form').forEach(function (f) {
    bindAjaxAddToCart(f);
  });

  /* PDP paylaş menüsü: “Bağlantıyı kopyala” — snippets/pdp-share-dropdown.liquid */
  root.addEventListener('click', function (e) {
    var copyBtn = e.target && e.target.closest('[data-prava-share-copy]');
    if (!copyBtn || !root.contains(copyBtn)) return;
    e.preventDefault();
    var url =
      copyBtn.getAttribute('data-share-url') || copyBtn.getAttribute('data-url') || window.location.href;
    var i18n = window.PRAVA_I18N || {};
    var copiedMsg = i18n.pdp_share_copied || 'Copied';
    var failedMsg = i18n.pdp_share_failed || 'Could not copy';
    var details = root.querySelector('.prava-pdp-share-dropdown details');
    function closeShareMenu() {
      if (details && details instanceof HTMLDetailsElement) details.open = false;
    }
    function flashCopyHint() {
      var prevTitle = copyBtn.getAttribute('title') || '';
      copyBtn.setAttribute('title', copiedMsg);
      window.setTimeout(function () {
        if (prevTitle) copyBtn.setAttribute('title', prevTitle);
        else copyBtn.removeAttribute('title');
      }, 2500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () {
          flashCopyHint();
          closeShareMenu();
        },
        function () {
          window.prompt(failedMsg, url);
        }
      );
    } else {
      window.prompt(failedMsg, url);
    }
  });

  /* Favori: Shopify’ın yerel wishlist’i yok; seçenek açıksa tarayıcı (localStorage). Uygulama entegrasyonu: prava:wishlist-changed olayı veya tema düğmesini kapatarak app snippet kullanın. */
  var wishBtn = root.querySelector('[data-prava-pdp-wishlist]');
  var WISHLIST_KEY = 'prava-wishlist-handles';
  function pravaWishlistRead() {
    try {
      var raw = localStorage.getItem(WISHLIST_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function pravaWishlistWrite(arr) {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(arr));
    } catch (e) {}
  }
  if (wishBtn) {
    var handle = wishBtn.getAttribute('data-product-handle');
    var labelAdd = wishBtn.getAttribute('data-label-add') || 'Add';
    var labelRemove = wishBtn.getAttribute('data-label-remove') || 'Remove';
    function syncWishlistUi() {
      var list = pravaWishlistRead();
      var on = Boolean(handle && list.indexOf(handle) !== -1);
      wishBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      wishBtn.setAttribute('aria-label', on ? labelRemove : labelAdd);
      var sr = wishBtn.querySelector('.sr-only');
      if (sr) sr.textContent = on ? labelRemove : labelAdd;
      var ic = wishBtn.querySelector('[data-prava-wishlist-icon]');
      if (
        ic &&
        ic.tagName === 'IMG' &&
        typeof ic.getAttribute === 'function' &&
        ic.getAttribute('data-src-off') &&
        ic.getAttribute('data-src-on')
      ) {
        ic.setAttribute('src', on ? ic.getAttribute('data-src-on') : ic.getAttribute('data-src-off'));
      }
    }
    syncWishlistUi();
    wishBtn.addEventListener('click', function () {
      if (!handle) return;
      var list = pravaWishlistRead();
      var idx = list.indexOf(handle);
      var added = false;
      if (idx === -1) {
        list.push(handle);
        added = true;
      } else {
        list.splice(idx, 1);
      }
      pravaWishlistWrite(list);
      syncWishlistUi();
      var i18nW = window.PRAVA_I18N || {};
      var toastMsg = added ? i18nW.pdp_wishlist_added : i18nW.pdp_wishlist_removed;
      if (toastMsg) pravaToast(toastMsg);
      try {
        document.dispatchEvent(
          new CustomEvent('prava:wishlist-changed', { detail: { handle: handle, added: added } })
        );
      } catch (e1) {}
    });
  }

  /* PDP — tam ekran galeri modalı (yalnızca görseller; ok / şerit / kaydırma) */
  var pdpGalleryModal = null;
  var pdpGalleryModalEls = {};
  var pdpGalleryItems = [];
  var pdpGalleryIndex = 0;
  var pdpGalleryLastFocus = null;
  var pdpGalleryTouchStartX = 0;

  function pdpGalleryCollectItems() {
    var nodes = root.querySelectorAll('[data-prava-pdp-gallery-modal-open]');
    return Array.prototype.map.call(nodes, function (n) {
      return {
        el: n,
        src: n.getAttribute('data-prava-modal-src') || '',
        thumb: n.getAttribute('data-prava-modal-thumb') || n.getAttribute('data-prava-modal-src') || '',
        alt: n.getAttribute('data-prava-modal-alt') || '',
      };
    }).filter(function (x) {
      return Boolean(x.src);
    });
  }

  function pdpGalleryEnsureModal() {
    if (pdpGalleryModal) return;
    var i18n = window.PRAVA_I18N || {};
    var modal = document.createElement('div');
    modal.id = 'prava-pdp-gallery-modal';
    modal.className = 'prava-pdp-gallery-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-label', i18n.pdp_gallery_modal_title || 'Gallery');

    modal.innerHTML =
      '<div class="prava-pdp-gallery-modal__top">' +
      '<p class="prava-pdp-gallery-modal__title" id="prava-pdp-gallery-modal-title"></p>' +
      '<p class="prava-pdp-gallery-modal__counter" id="prava-pdp-gallery-modal-counter" aria-live="polite"></p>' +
      '<button type="button" class="prava-pdp-gallery-modal__close" data-prava-pdp-gallery-modal-close>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button></div>' +
      '<div class="prava-pdp-gallery-modal__stage" data-prava-pdp-gallery-modal-stage>' +
      '<button type="button" class="prava-pdp-gallery-modal__nav prava-pdp-gallery-modal__nav--prev" data-prava-pdp-gallery-modal-prev hidden>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>' +
      '<img class="prava-pdp-gallery-modal__img" alt="" data-prava-pdp-gallery-modal-img>' +
      '<button type="button" class="prava-pdp-gallery-modal__nav prava-pdp-gallery-modal__nav--next" data-prava-pdp-gallery-modal-next hidden>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>' +
      '</div>' +
      '<div class="prava-pdp-gallery-modal__thumbs" data-prava-pdp-gallery-modal-thumbs></div>';

    document.body.appendChild(modal);
    var closeB = modal.querySelector('[data-prava-pdp-gallery-modal-close]');
    var prevB = modal.querySelector('[data-prava-pdp-gallery-modal-prev]');
    var nextB = modal.querySelector('[data-prava-pdp-gallery-modal-next]');
    if (closeB) closeB.setAttribute('aria-label', i18n.pdp_gallery_modal_close || 'Close');
    if (prevB) prevB.setAttribute('aria-label', i18n.pdp_gallery_modal_prev || 'Previous');
    if (nextB) nextB.setAttribute('aria-label', i18n.pdp_gallery_modal_next || 'Next');
    pdpGalleryModal = modal;
    pdpGalleryModalEls = {
      title: modal.querySelector('#prava-pdp-gallery-modal-title'),
      counter: modal.querySelector('#prava-pdp-gallery-modal-counter'),
      img: modal.querySelector('[data-prava-pdp-gallery-modal-img]'),
      prev: modal.querySelector('[data-prava-pdp-gallery-modal-prev]'),
      next: modal.querySelector('[data-prava-pdp-gallery-modal-next]'),
      thumbs: modal.querySelector('[data-prava-pdp-gallery-modal-thumbs]'),
      stage: modal.querySelector('[data-prava-pdp-gallery-modal-stage]'),
    };
    if (pdpGalleryModalEls.title) {
      pdpGalleryModalEls.title.textContent = i18n.pdp_gallery_modal_title || 'Gallery';
    }

    modal.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-prava-pdp-gallery-modal-close]')) {
        ev.preventDefault();
        pdpGalleryCloseModal();
      }
    });
    modal.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-prava-pdp-gallery-modal-prev]')) {
        ev.preventDefault();
        pdpGalleryStep(-1);
      }
    });
    modal.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-prava-pdp-gallery-modal-next]')) {
        ev.preventDefault();
        pdpGalleryStep(1);
      }
    });
    var thumbsHost = pdpGalleryModalEls.thumbs;
    if (thumbsHost) {
      thumbsHost.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-prava-pdp-gallery-modal-thumb-idx]');
        if (!t || !thumbsHost.contains(t)) return;
        ev.preventDefault();
        var idx = parseInt(t.getAttribute('data-prava-pdp-gallery-modal-thumb-idx'), 10);
        if (!isNaN(idx)) pdpGalleryGoTo(idx);
      });
    }

    var st = pdpGalleryModalEls.stage;
    if (st) {
      st.addEventListener('click', function (ev) {
        if (ev.target === st) pdpGalleryCloseModal();
      });
      st.addEventListener(
        'touchstart',
        function (e) {
          if (!e.touches || !e.touches[0]) return;
          pdpGalleryTouchStartX = e.touches[0].clientX;
        },
        { passive: true }
      );
      st.addEventListener(
        'touchend',
        function (e) {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          var dx = e.changedTouches[0].clientX - pdpGalleryTouchStartX;
          if (Math.abs(dx) < 56) return;
          if (dx > 0) pdpGalleryStep(-1);
          else pdpGalleryStep(1);
        },
        { passive: true }
      );
    }
  }

  function pdpGalleryRenderThumbs() {
    var host = pdpGalleryModalEls.thumbs;
    if (!host) return;
    host.textContent = '';
    for (var i = 0; i < pdpGalleryItems.length; i++) {
      (function (idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'prava-pdp-gallery-modal__thumb' + (idx === pdpGalleryIndex ? ' is-active' : '');
        b.setAttribute('data-prava-pdp-gallery-modal-thumb-idx', String(idx));
        b.setAttribute('aria-label', String(idx + 1));
        var im = document.createElement('img');
        im.src = pdpGalleryItems[idx].thumb;
        im.alt = '';
        im.loading = 'lazy';
        im.decoding = 'async';
        b.appendChild(im);
        host.appendChild(b);
      })(i);
    }
    if (pdpGalleryItems.length <= 1) {
      host.hidden = true;
      host.setAttribute('aria-hidden', 'true');
    } else {
      host.hidden = false;
      host.removeAttribute('aria-hidden');
    }
  }

  function pdpGalleryUpdateUi() {
    var item = pdpGalleryItems[pdpGalleryIndex];
    var imgEl = pdpGalleryModalEls.img;
    if (item && imgEl) {
      imgEl.src = item.src;
      imgEl.alt = item.alt || '';
    }
    var c = pdpGalleryModalEls.counter;
    if (c) {
      c.textContent = String(pdpGalleryIndex + 1) + ' / ' + String(pdpGalleryItems.length);
    }
    var prev = pdpGalleryModalEls.prev;
    var next = pdpGalleryModalEls.next;
    if (prev) prev.hidden = pdpGalleryItems.length < 2;
    if (next) next.hidden = pdpGalleryItems.length < 2;
    var host = pdpGalleryModalEls.thumbs;
    if (host && !host.hidden) {
      var btns = host.querySelectorAll('.prava-pdp-gallery-modal__thumb');
      for (var j = 0; j < btns.length; j++) {
        btns[j].classList.toggle('is-active', j === pdpGalleryIndex);
      }
      var active = host.querySelector('[data-prava-pdp-gallery-modal-thumb-idx="' + pdpGalleryIndex + '"]');
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  function pdpGalleryGoTo(idx) {
    if (!pdpGalleryItems.length) return;
    if (idx < 0) idx = pdpGalleryItems.length - 1;
    if (idx >= pdpGalleryItems.length) idx = 0;
    pdpGalleryIndex = idx;
    pdpGalleryUpdateUi();
  }

  function pdpGalleryStep(delta) {
    if (pdpGalleryItems.length < 2) return;
    pdpGalleryGoTo(pdpGalleryIndex + delta);
  }

  function pdpGalleryOnKey(ev) {
    if (ev.key === 'Escape') {
      pdpGalleryCloseModal();
      return;
    }
    if (pdpGalleryItems.length < 2) return;
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      pdpGalleryStep(-1);
    }
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      pdpGalleryStep(1);
    }
  }

  function pdpGalleryOpenModal(startBtn) {
    pdpGalleryItems = pdpGalleryCollectItems();
    if (!pdpGalleryItems.length) return;
    var start = 0;
    for (var s = 0; s < pdpGalleryItems.length; s++) {
      if (pdpGalleryItems[s].el === startBtn) {
        start = s;
        break;
      }
    }
    pdpGalleryIndex = start;
    pdpGalleryEnsureModal();
    pdpGalleryLastFocus = document.activeElement;
    pdpGalleryRenderThumbs();
    pdpGalleryUpdateUi();
    pdpGalleryModal.classList.add('prava-pdp-gallery-modal--open');
    pdpGalleryModal.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('prava-pdp-gallery-modal-open');
    document.addEventListener('keydown', pdpGalleryOnKey);
    var closeBtn = pdpGalleryModal.querySelector('[data-prava-pdp-gallery-modal-close]');
    window.setTimeout(function () {
      if (closeBtn && typeof closeBtn.focus === 'function') {
        try {
          closeBtn.focus();
        } catch (eF) {}
      }
    }, 40);
  }

  function pdpGalleryCloseModal() {
    if (!pdpGalleryModal || !pdpGalleryModal.classList.contains('prava-pdp-gallery-modal--open')) return;
    pdpGalleryModal.classList.remove('prava-pdp-gallery-modal--open');
    pdpGalleryModal.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('prava-pdp-gallery-modal-open');
    document.removeEventListener('keydown', pdpGalleryOnKey);
    var imgEl = pdpGalleryModalEls.img;
    if (imgEl) {
      imgEl.removeAttribute('src');
      imgEl.alt = '';
    }
    if (pdpGalleryLastFocus && typeof pdpGalleryLastFocus.focus === 'function') {
      try {
        pdpGalleryLastFocus.focus();
      } catch (eL) {}
    }
    pdpGalleryLastFocus = null;
    pdpGalleryItems = [];
  }

  root.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest('[data-prava-pdp-gallery-modal-open]');
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    pdpGalleryOpenModal(btn);
  });
})();
