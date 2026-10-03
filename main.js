/*!
 * VLTG — main.js
 * Barcha sahifalarda ishlaydigan umumiy funksiyalar:
 *   savat · qidiruv · tezkor ko'rish · sevimlilar · buyurtma · kuzatish ·
 *   a'zolik · bildirishnomalar · obuna · animatsiyalar
 *
 * Ma'lumotlar brauzer xotirasida (localStorage) saqlanadi.
 * Haqiqiy to'lov / buyurtma qabul qilish uchun keyinchalik server (backend) ulanadi.
 */
(function () {
  'use strict';

  /* =====================================================
     0. SOZLAMALAR — shu yerdan o'zgartirsangiz bo'ladi
     (yoki sahifada window.VLTG_CONFIG = {...} bering)
     ===================================================== */
  var CFG = Object.assign({
    currency: '$',
    freeShipping: 80,                          // shu summadan boshlab yetkazish bepul
    shippingFee: 5,                            // aks holda yetkazish narxi
    memberDiscount: 10,                        // a'zolar uchun avtomatik chegirma, %
    promoCodes: { VLTG10: 10, SALE20: 20 }     // promo kodlar: KOD: foiz
  }, window.VLTG_CONFIG || {});

  /* =====================================================
     1. YORDAMCHI FUNKSIYALAR
     ===================================================== */
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    n = Math.round(n * 100) / 100;
    return CFG.currency + (n % 1 === 0 ? n : n.toFixed(2));
  }
  function num(t) {
    var m = String(t || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }
  // qidiruv uchun: kichik harf, apostrofsiz ("o'" -> "o")
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[’'‘`ʻʼ]/g, '').replace(/\s+/g, ' ').trim();
  }
  // localStorage ishlamasa (maxfiy rejim, ba'zi brauzerlar) — sessiya davomida xotiradan foydalanadi
  var mem = {};
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { /* zaxiraga o'tamiz */ }
      return Object.prototype.hasOwnProperty.call(mem, k) ? JSON.parse(mem[k]) : d;
    },
    set: function (k, v) {
      var j = JSON.stringify(v); mem[k] = j;
      try { localStorage.setItem(k, j); } catch (e) { /* xotira to'la yoki yopiq */ }
    }
  };
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '') || 'index';
  var GENDERS = ['erkaklar', 'ayollar', 'bolalar'];

  var ICON = {
    ok:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    info:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>',
    err:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    close:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    heart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    bag:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    up:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>',
    tick:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  /* =====================================================
     2. MAHSULOT MA'LUMOTI (turi, jinsi, o'lchamlar)
     ===================================================== */
  var CLOTHES = /\b(tee|tees|hoodie|jacket|set|kit|tights|shorts?|bra|tracksuit|jogger|joggers|top|shirt|pants|suit)\b/i;
  function inferType(name) { return CLOTHES.test(name) ? 'kiyim' : 'poyabzal'; }

  function enrich(p) {
    p.type = p.type || inferType(p.name);
    var c = norm(p.cat), g = null;
    if (GENDERS.indexOf(page) > -1) g = page;
    else if (p.pages && p.pages.length === 1 && GENDERS.indexOf(p.pages[0]) > -1) g = p.pages[0];
    else if (/erkaklar/.test(c)) g = 'erkaklar';
    else if (/ayollar/.test(c)) g = 'ayollar';
    else if (/bolalar/.test(c)) g = 'bolalar';
    p.gender = g; p.kids = g === 'bolalar';
    return p;
  }

  // Sahifadagi kartochkadan ma'lumot o'qish (rasm yo'li o'zgartirilmaydi)
  function readCard(card) {
    var q = function (s) { return $(s, card); };
    var nameEl  = q('.product-card__name, .arrival-card__name');
    var catEl   = q('.product-card__cat, .product-card__category, .arrival-card__tag');
    var priceEl = q('.product-card__price--sale') || q('.product-card__price, .arrival-card__price');
    var origEl  = q('.product-card__price-orig, .product-card__price-original');
    var imgEl   = q('img'), descEl = q('.arrival-card__desc');
    var price = num(priceEl && priceEl.textContent), orig = origEl ? num(origEl.textContent) : 0;
    return enrich({
      name:  nameEl ? nameEl.textContent.trim() : '',
      cat:   catEl ? catEl.textContent.trim() : '',
      price: price,
      orig:  orig > price ? orig : 0,
      img:   imgEl ? imgEl.getAttribute('src') : '',
      desc:  descEl ? descEl.textContent.trim() : ''
    });
  }

  var CATALOG = (window.VLTG_PRODUCTS || []).map(function (p) { return Object.assign({}, p); });

  function sizesFor(p) {
    if (p.kids) return p.type === 'poyabzal' ? ['28', '30', '32', '34', '36', '38'] : ['3-4Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y', '13-14Y'];
    if (p.type === 'poyabzal') return p.gender === 'ayollar' ? ['35', '36', '37', '38', '39', '40', '41', '42'] : ['38', '39', '40', '41', '42', '43', '44', '45', '46'];
    return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  }

  /* =====================================================
     3. QULFLASH (modal ochiqligida sahifa aylanmasin)
     ===================================================== */
  var locks = 0;
  function lock()   { if (locks++ === 0) document.body.classList.add('vl-lock'); }
  function unlock() { if (--locks <= 0) { locks = 0; document.body.classList.remove('vl-lock'); } }

  /* =====================================================
     4. BILDIRISHNOMALAR (toast)
     ===================================================== */
  var toastBox;
  function toast(title, sub, kind) {
    kind = kind || 'ok';
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'vl-toasts';
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    while (toastBox.children.length >= 3) toastBox.removeChild(toastBox.firstChild);
    var t = document.createElement('div');
    t.className = 'vl-toast vl-toast--' + kind;
    t.innerHTML = '<span class="vl-toast__icon">' + (ICON[kind] || ICON.ok) + '</span><div><strong>' + esc(title) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
    toastBox.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 350); }, 3200);
  }

  /* =====================================================
     5. MODAL OYNA
     ===================================================== */
  var modalEl = null, lastFocus = null;

  function openModal(html, cls) {
    closeModal(true);
    modalEl = document.createElement('div');
    modalEl.className = 'vl-modal';
    modalEl.innerHTML = '<div class="vl-modal__dialog ' + (cls || '') + '" role="dialog" aria-modal="true" tabindex="-1">' +
      '<button class="vl-x vl-modal__close" data-modal-close aria-label="Yopish">' + ICON.close + '</button>' + html + '</div>';
    document.body.appendChild(modalEl);
    lock();
    lastFocus = document.activeElement;
    var el = modalEl;
    requestAnimationFrame(function () {
      el.classList.add('open');
      var d = $('.vl-modal__dialog', el);
      if (d && d.focus) d.focus({ preventScroll: true });
    });
    el.addEventListener('mousedown', function (e) { el._down = e.target === el; });
    el.addEventListener('click', function (e) {
      if ((e.target === el && el._down) || e.target.closest('[data-modal-close]')) closeModal();
    });
    return $('.vl-modal__dialog', el);
  }
  function closeModal(immediate) {
    if (!modalEl) return;
    var el = modalEl; modalEl = null; unlock();
    el.classList.remove('open');
    if (immediate) el.remove(); else setTimeout(function () { el.remove(); }, 250);
    if (!immediate && lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  /* =====================================================
     6. SEVIMLILAR
     ===================================================== */
  var wish = store.get('vltg_wish', []);
  function isWished(name) { return wish.some(function (w) { return w.name === name; }); }

  function toggleWish(p) {
    var i = -1;
    wish.forEach(function (w, k) { if (w.name === p.name) i = k; });
    if (i > -1) { wish.splice(i, 1); toast('Sevimlilardan olib tashlandi', p.name, 'info'); }
    else {
      wish.push({ name: p.name, cat: p.cat, price: p.price, orig: p.orig || 0, img: p.img, type: p.type, gender: p.gender, kids: p.kids, desc: p.desc || '' });
      toast("Sevimlilarga qo'shildi", p.name);
    }
    store.set('vltg_wish', wish);
    syncWish();
  }

  function syncWish() {
    $$('[data-wish-count]').forEach(function (el) { el.textContent = wish.length; el.classList.toggle('is-empty', !wish.length); });
    $$('.product-card').forEach(function (c) {
      var f = $('.product-card__fav', c), n = $('.product-card__name', c);
      if (!f || !n) return;
      var on = isWished(n.textContent.trim());
      f.classList.toggle('active', on);
      f.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function openWishlist() {
    if (!wish.length) {
      openModal('<h3 class="vl-title">Sevimlilar</h3><div class="vl-emptybox">' + ICON.heart + '<p>Hali hech narsa tanlanmagan</p><small>Mahsulot kartasidagi ♥ tugmasini bosing</small></div>');
      return;
    }
    var d = openModal('<h3 class="vl-title">Sevimlilar <small>(' + wish.length + ')</small></h3><ul class="vl-list">' +
      wish.map(function (w, i) {
        return '<li class="vl-list__item"><img src="' + esc(w.img) + '" alt=""><div><strong>' + esc(w.name) + '</strong><span>' + esc(w.cat) + '</span><b>' + fmt(w.price) + '</b></div>' +
          '<div class="vl-list__act"><button class="btn btn--primary btn--sm" data-w-add="' + i + '">Savatga</button><button class="vl-x" data-w-del="' + i + '" aria-label="O\'chirish">' + ICON.close + '</button></div></li>';
      }).join('') + '</ul>');
    d.addEventListener('click', function (e) {
      var a = e.target.closest('[data-w-add]'), x = e.target.closest('[data-w-del]');
      if (a) openQuickView(enrich(Object.assign({}, wish[+a.getAttribute('data-w-add')])));
      if (x) { wish.splice(+x.getAttribute('data-w-del'), 1); store.set('vltg_wish', wish); syncWish(); openWishlist(); }
    });
  }

  /* =====================================================
     7. SAVAT
     ===================================================== */
  var cart  = store.get('vltg_cart', []);
  var promo = store.get('vltg_promo', null);
  var drawer, backdrop, cartOpen = false, promoErr = '', promoDraft = '';
  function getMember() { return store.get('vltg_member', null); }

  // Chegirma sahifasidagi aksiya: to'plam (set/kit/tracksuit) mahsulotlarida har 3-tasi bepul
  var BUNDLE = /\b(set|kit|tracksuit)\b/i;

  function calc() {
    var subtotal = cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var units = [];
    cart.forEach(function (i) { if (BUNDLE.test(i.name)) for (var k = 0; k < i.qty; k++) units.push(i.price); });
    units.sort(function (a, b) { return a - b; });
    var bundle = units.slice(0, Math.floor(units.length / 3)).reduce(function (s, x) { return s + x; }, 0);
    var pct = 0, label = '';
    if (promo) { pct = promo.pct; label = 'Promo kod ' + promo.code; }
    else if (getMember()) { pct = CFG.memberDiscount; label = "A'zo chegirmasi"; }
    var base = subtotal - bundle;
    var discount = base * pct / 100, after = base - discount;
    var shipping = !cart.length ? 0 : (after >= CFG.freeShipping ? 0 : CFG.shippingFee);
    return {
      subtotal: subtotal, bundle: bundle, bundleUnits: units.length, pct: pct, label: label, discount: discount, after: after, shipping: shipping,
      total: after + shipping, count: cart.reduce(function (s, i) { return s + i.qty; }, 0)
    };
  }

  function saveCart() { store.set('vltg_cart', cart); syncCart(true); }

  function addToCart(p, size, qty) {
    qty = qty || 1;
    var key = p.name + '|' + size, ex = null;
    cart.forEach(function (i) { if (i.key === key) ex = i; });
    if (ex) { ex.qty = Math.min(10, ex.qty + qty); ex.price = Math.min(ex.price, p.price); }
    else cart.push({ key: key, name: p.name, cat: p.cat, img: p.img, price: p.price, orig: p.orig || 0, size: size, qty: qty });
    saveCart();
  }

  function syncCart(bump) {
    var c = calc();
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = c.count;
      if (el.classList.contains('cart-badge')) {
        el.classList.toggle('is-empty', !c.count);
        if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      }
    });
    if (drawer) renderCart();
  }

  function buildCart() {
    if (drawer) return;
    backdrop = document.createElement('div'); backdrop.className = 'vl-backdrop';
    drawer = document.createElement('aside'); drawer.className = 'vl-cart';
    drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-label', 'Savat'); drawer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop); document.body.appendChild(drawer);
    backdrop.addEventListener('click', closeCart);

    drawer.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act'), i = +b.getAttribute('data-i');
      if (act === 'close') { closeCart(); return; }          // havola bo'lsa — o'tib ketadi
      e.preventDefault();
      if (act === 'inc' && cart[i]) { cart[i].qty = Math.min(10, cart[i].qty + 1); saveCart(); }
      else if (act === 'dec' && cart[i]) { cart[i].qty -= 1; if (cart[i].qty <= 0) cart.splice(i, 1); saveCart(); }
      else if (act === 'del' && cart[i]) { var n = cart[i].name; cart.splice(i, 1); saveCart(); toast("Savatdan o'chirildi", n, 'info'); }
      else if (act === 'promo-on') applyPromo(($('[data-promo-input]', drawer) || {}).value || '');
      else if (act === 'promo-off') { promo = null; store.set('vltg_promo', null); promoErr = ''; renderCart(); }
      else if (act === 'checkout') openCheckout();
    });
    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('[data-promo-input]')) { e.preventDefault(); applyPromo(e.target.value); }
    });
  }

  function applyPromo(raw) {
    var code = String(raw).trim().toUpperCase(), pct = CFG.promoCodes[code];
    if (pct) { promo = { code: code, pct: pct }; store.set('vltg_promo', promo); promoErr = ''; promoDraft = ''; renderCart(); toast('Promo kod qo\'llandi', code + ' — −' + pct + '%'); }
    else { promoErr = code ? 'Bunday promo kod topilmadi' : 'Promo kodni kiriting'; promoDraft = raw; renderCart(); }
  }

  function renderCart() {
    if (!drawer) return;
    var c = calc();
    var h = '<div class="vl-cart__head"><h3>Savat <small>(' + c.count + ')</small></h3><button class="vl-x" data-act="close" aria-label="Yopish">' + ICON.close + '</button></div>';

    if (!cart.length) {
      h += '<div class="vl-cart__empty">' + ICON.bag + '<p>Savat bo\'sh</p><span>Yoqqan mahsulotni tanlang — u shu yerda paydo bo\'ladi.</span>' +
           '<a class="btn btn--primary" href="sport.html" data-act="close">Xaridni boshlash</a></div>';
    } else {
      var left = Math.max(0, CFG.freeShipping - c.after), bar = Math.min(100, c.after / CFG.freeShipping * 100);
      h += '<div class="vl-cart__ship' + (left ? '' : ' is-done') + '"><p>' +
           (left ? 'Bepul yetkazish uchun yana <b>' + fmt(left) + '</b> qoldi' : '<b>Bepul yetkazib berish</b> qo\'lga kiritildi!') +
           '</p><div class="vl-bar"><i style="width:' + bar + '%"></i></div></div>';

      h += '<ul class="vl-cart__list">' + cart.map(function (it, i) {
        return '<li class="vl-ci"><img src="' + esc(it.img) + '" alt="">' +
          '<div class="vl-ci__body"><strong>' + esc(it.name) + '</strong><span>O\'lcham: ' + esc(it.size) + '</span>' +
          '<div class="vl-ci__row"><div class="qty"><button data-act="dec" data-i="' + i + '" aria-label="Kamaytirish">−</button><span>' + it.qty +
          '</span><button data-act="inc" data-i="' + i + '" aria-label="Ko\'paytirish">+</button></div><b>' + fmt(it.price * it.qty) + '</b></div></div>' +
          '<button class="vl-x" data-act="del" data-i="' + i + '" aria-label="O\'chirish">' + ICON.close + '</button></li>';
      }).join('') + '</ul>';

      h += '<div class="vl-cart__foot">';
      if (c.bundleUnits % 3 === 2) h += '<p class="vl-promo__ok">' + ICON.tick + ' Yana 1 ta to\'plam qo\'shsangiz — biri bepul!</p>';
      if (promo) h += '<div class="vl-promo is-on"><span>Promo kod <b>' + esc(promo.code) + '</b> (−' + promo.pct + '%)</span><button data-act="promo-off">Olib tashlash</button></div>';
      else {
        h += '<div class="vl-promo"><input data-promo-input placeholder="Promo kod" maxlength="20" value="' + esc(promoDraft) + '"><button data-act="promo-on">Qo\'llash</button></div>';
        if (promoErr) h += '<p class="vl-promo__err">' + promoErr + '</p>';
        else if (getMember()) h += '<p class="vl-promo__ok">' + ICON.tick + ' A\'zo chegirmasi (−' + CFG.memberDiscount + '%) qo\'llangan</p>';
      }
      h += '<dl class="vl-sum"><div><dt>Mahsulotlar</dt><dd>' + fmt(c.subtotal) + '</dd></div>' +
           (c.bundle ? '<div class="is-off"><dt>To\'plam aksiyasi (3-tasi bepul)</dt><dd>−' + fmt(c.bundle) + '</dd></div>' : '') +
           (c.discount ? '<div class="is-off"><dt>' + esc(c.label) + '</dt><dd>−' + fmt(c.discount) + '</dd></div>' : '') +
           '<div><dt>Yetkazib berish</dt><dd>' + (c.shipping ? fmt(c.shipping) : 'Bepul') + '</dd></div>' +
           '<div class="is-total"><dt>Jami</dt><dd>' + fmt(c.total) + '</dd></div></dl>' +
           '<button class="btn btn--primary vl-wide" data-act="checkout">Buyurtma berish</button>' +
           '<button class="vl-link" data-act="close">Xaridni davom ettirish</button></div>';
    }
    drawer.innerHTML = h;
  }

  function openCart() {
    buildCart(); renderCart();
    var t = $('#nav-toggle'); if (t) t.checked = false;
    if (!cartOpen) { cartOpen = true; lock(); }
    drawer.classList.add('open'); backdrop.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
  }
  function closeCart() {
    if (!cartOpen) return;
    cartOpen = false; unlock();
    drawer.classList.remove('open'); backdrop.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
  }

  /* =====================================================
     8. TEZKOR KO'RISH (o'lcham tanlab savatga qo'shish)
     ===================================================== */
  function openQuickView(p) {
    var sizes = sizesFor(p), size = null, qty = 1;
    var pct = p.orig ? Math.round((1 - p.price / p.orig) * 100) : 0;
    var d = openModal(
      '<div class="qv"><div class="qv__media"><img src="' + esc(p.img) + '" alt="' + esc(p.name) + '">' + (pct ? '<span class="badge badge--sale qv__badge">−' + pct + '%</span>' : '') + '</div>' +
      '<div class="qv__info"><p class="qv__cat">' + esc(p.cat) + '</p><h3 class="qv__name">' + esc(p.name) + '</h3>' +
      '<div class="qv__price"><strong>' + fmt(p.price) + '</strong>' + (p.orig ? '<s>' + fmt(p.orig) + '</s>' : '') + '</div>' +
      (p.desc ? '<p class="qv__desc">' + esc(p.desc) + '</p>' : '') +
      '<div class="qv__label"><span>O\'lcham</span><a href="#" data-size-guide>O\'lcham jadvali</a></div>' +
      '<div class="qv__sizes" role="radiogroup" aria-label="O\'lcham">' + sizes.map(function (s) {
        return '<button type="button" class="qv__size" role="radio" aria-checked="false" data-size="' + esc(s) + '">' + esc(s) + '</button>';
      }).join('') + '</div>' +
      '<p class="qv__err" hidden>Iltimos, o\'lchamni tanlang</p>' +
      '<div class="qv__row"><div class="qty"><button type="button" data-q="-1" aria-label="Kamaytirish">−</button><span data-qv-qty>1</span><button type="button" data-q="1" aria-label="Ko\'paytirish">+</button></div>' +
      '<button type="button" class="btn btn--primary qv__add" data-qv-add>Savatga qo\'shish</button>' +
      '<button type="button" class="qv__fav' + (isWished(p.name) ? ' active' : '') + '" data-qv-fav aria-label="Sevimli">' + ICON.heart + '</button></div>' +
      '<ul class="qv__perks"><li>30 kun ichida bepul qaytarish</li><li>' + fmt(CFG.freeShipping) + ' dan yuqori buyurtmada yetkazish bepul</li></ul></div></div>',
      'vl-modal__dialog--wide');

    d.addEventListener('click', function (e) {
      var s = e.target.closest('[data-size]'), q = e.target.closest('[data-q]');
      if (s) {
        size = s.getAttribute('data-size');
        $$('.qv__size', d).forEach(function (b) { var on = b === s; b.classList.toggle('active', on); b.setAttribute('aria-checked', on); });
        $('.qv__err', d).hidden = true;
      } else if (q) {
        qty = Math.max(1, Math.min(10, qty + (+q.getAttribute('data-q'))));
        $('[data-qv-qty]', d).textContent = qty;
      } else if (e.target.closest('[data-qv-fav]')) {
        toggleWish(p);
        $('[data-qv-fav]', d).classList.toggle('active', isWished(p.name));
      } else if (e.target.closest('[data-size-guide]')) {
        e.preventDefault();
        openInfo('size', { back: function () { openQuickView(p); } });
      } else if (e.target.closest('[data-qv-add]')) {
        if (!size) {
          var err = $('.qv__err', d), row = $('.qv__sizes', d);
          err.hidden = false; row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
          return;
        }
        addToCart(p, size, qty);
        closeModal(true);
        openCart();
      }
    });
  }

  /* =====================================================
     9. BUYURTMA BERISH (checkout) VA KUZATISH
     ===================================================== */
  function openCheckout() {
    if (!cart.length) return;
    closeCart();
    var c = calc(), prof = store.get('vltg_profile', {});
    var d = openModal(
      '<h3 class="vl-title">Buyurtmani rasmiylashtirish</h3>' +
      '<form class="vl-form" novalidate data-checkout>' +
      field('name', 'Ism familiya', prof.name, 'Masalan: Aziz Karimov', 'name') +
      field('phone', 'Telefon', prof.phone, '+998 90 123 45 67', 'tel') +
      field('city', 'Shahar / viloyat', prof.city, 'Masalan: Namangan', 'address-level2') +
      field('address', 'Manzil', prof.address, "Ko'cha, uy, xonadon", 'street-address') +
      '<fieldset class="vl-pay"><legend>To\'lov usuli</legend>' +
      '<label><input type="radio" name="pay" value="Naqd pul" checked><span>Naqd pul <small>(qabul qilganda)</small></span></label>' +
      '<label><input type="radio" name="pay" value="Karta"><span>Karta orqali <small>(kuryerga)</small></span></label></fieldset>' +
      '<div class="vl-checkline"><span>' + c.count + ' ta mahsulot' + (c.discount + c.bundle ? ' · chegirma −' + fmt(c.discount + c.bundle) : '') + '</span><b>' + fmt(c.total) + '</b></div>' +
      '<button class="btn btn--primary vl-wide" type="submit">Buyurtmani tasdiqlash</button></form>');

    function field(n, label, val, ph, ac) {
      return '<div class="vl-field"><label for="f-' + n + '">' + label + '</label><input id="f-' + n + '" name="' + n + '" value="' + esc(val || '') + '" placeholder="' + esc(ph) + '" autocomplete="' + ac + '"><small class="vl-err"></small></div>';
    }
    d.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, v = {}, ok = true;
      ['name', 'phone', 'city', 'address'].forEach(function (k) { v[k] = f.elements[k].value.trim(); });
      var rules = {
        name:    [v.name.length >= 3, 'Ism familiyani to\'liq kiriting'],
        phone:   [/^\+?[\d\s\-()]{9,17}$/.test(v.phone) && v.phone.replace(/\D/g, '').length >= 9, 'Telefon raqamini to\'g\'ri kiriting'],
        city:    [v.city.length >= 2, 'Shaharni kiriting'],
        address: [v.address.length >= 5, 'Manzilni batafsil kiriting']
      };
      Object.keys(rules).forEach(function (k) {
        var box = f.elements[k].closest('.vl-field'), bad = !rules[k][0];
        box.classList.toggle('has-err', bad); $('.vl-err', box).textContent = bad ? rules[k][1] : '';
        if (bad) ok = false;
      });
      if (!ok) { var first = $('.has-err input', f); if (first) first.focus(); return; }

      var cc = calc();
      var order = {
        id: 'VLTG-' + Math.floor(100000 + Math.random() * 900000), ts: Date.now(),
        customer: v, pay: f.elements.pay.value,
        items: cart.map(function (i) { return { name: i.name, size: i.size, qty: i.qty, price: i.price, img: i.img }; }),
        subtotal: cc.subtotal, discount: cc.discount + cc.bundle, shipping: cc.shipping, total: cc.total
      };
      var orders = store.get('vltg_orders', []); orders.unshift(order); store.set('vltg_orders', orders.slice(0, 20));
      store.set('vltg_profile', v);
      cart = []; promo = null; store.set('vltg_promo', null); saveCart();

      var box = $('.vl-modal__dialog', modalEl);
      box.innerHTML = '<button class="vl-x vl-modal__close" data-modal-close aria-label="Yopish">' + ICON.close + '</button>' +
        '<div class="vl-done"><span class="vl-done__ico">' + ICON.ok + '</span><h3>Buyurtma qabul qilindi!</h3>' +
        '<p>Buyurtma raqamingiz</p><div class="vl-done__id">' + order.id + '</div>' +
        '<p class="vl-sub">Operatorimiz tez orada <b>' + esc(v.phone) + '</b> raqami orqali bog\'lanadi. Jami: <b>' + fmt(order.total) + '</b></p>' +
        '<div class="vl-done__act"><button class="btn btn--primary" data-track-now="' + order.id + '">Buyurtmani kuzatish</button><button class="btn btn--ghost" data-modal-close>Xaridni davom ettirish</button></div></div>';
    });
  }

  var STEPS = ['Qabul qilindi', "Yig'ilmoqda", "Yo'lda", 'Yetkazildi'];
  // Server yo'q bo'lgani uchun holat vaqt o'tishi bilan avtomatik ko'rsatiladi (namuna).
  function orderStatus(o) { var m = (Date.now() - o.ts) / 60000; return m < 2 ? 0 : m < 15 ? 1 : m < 90 ? 2 : 3; }

  function openTrack(prefill) {
    var last = (store.get('vltg_orders', [])[0] || {}).id || '';
    var d = openModal('<h3 class="vl-title">Buyurtmani kuzatish</h3><p class="vl-sub">Buyurtma raqamini kiriting (masalan: VLTG-123456)</p>' +
      '<form class="vl-form vl-form--row" data-track novalidate><input name="id" value="' + esc(prefill || last) + '" placeholder="VLTG-123456" autocomplete="off" aria-label="Buyurtma raqami"><button class="btn btn--primary" type="submit">Qidirish</button></form>' +
      '<div data-track-result></div>');
    var form = $('[data-track]', d), out = $('[data-track-result]', d);
    function run() {
      var raw = form.elements.id.value.trim().toUpperCase(), digits = raw.replace(/\D/g, '');
      var o = null;
      store.get('vltg_orders', []).forEach(function (x) { if (x.id === raw || (digits && x.id.replace(/\D/g, '') === digits)) o = x; });
      if (!o) { out.innerHTML = '<p class="vl-notfound">' + (raw ? 'Bunday raqamli buyurtma topilmadi.' : 'Buyurtma raqamini kiriting.') + '</p>'; return; }
      var s = orderStatus(o);
      out.innerHTML = '<div class="vl-order"><div class="vl-order__top"><b>' + o.id + '</b><span>' + new Date(o.ts).toLocaleString('uz-UZ') + '</span></div>' +
        '<ol class="vl-steps">' + STEPS.map(function (t, i) { return '<li class="' + (i <= s ? 'done' : '') + (i === s ? ' now' : '') + '"><i></i><span>' + t + '</span></li>'; }).join('') + '</ol>' +
        '<ul class="vl-list vl-list--sm">' + o.items.map(function (i) {
          return '<li class="vl-list__item"><img src="' + esc(i.img) + '" alt=""><div><strong>' + esc(i.name) + '</strong><span>O\'lcham: ' + esc(i.size) + ' · ' + i.qty + ' dona</span></div><b>' + fmt(i.price * i.qty) + '</b></li>';
        }).join('') + '</ul><div class="vl-checkline"><span>' + esc(o.pay) + ' · ' + esc(o.customer.city) + '</span><b>' + fmt(o.total) + '</b></div></div>';
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    if (prefill || last) run();
  }

  /* =====================================================
     10. MA'LUMOT OYNALARI (yetkazish, qaytarish, o'lcham...)
     ===================================================== */
  // Matnlarni o'zingizning shartlaringizga moslab o'zgartiring.
  var INFO = {
    shipping: { title: 'Yetkazib berish', html:
      '<table class="vl-table"><tr><th>Hudud</th><th>Muddat</th></tr><tr><td>Shahar ichida</td><td>1–2 ish kuni</td></tr><tr><td>Viloyatlar</td><td>2–5 ish kuni</td></tr></table>' +
      '<p class="vl-sub">' + fmt(CFG.freeShipping) + ' dan yuqori buyurtmalarda yetkazib berish <b>bepul</b>, qolgan hollarda ' + fmt(CFG.shippingFee) + '. To\'lov mahsulotni qabul qilganda amalga oshiriladi.</p>' },
    returns: { title: 'Qaytarish', html:
      '<ul class="vl-bullets"><li>Mahsulotni <b>30 kun</b> ichida qaytarishingiz mumkin.</li><li>Mahsulot ishlatilmagan, yorlig\'i va qadog\'i joyida bo\'lishi kerak.</li><li>Qaytarish uchun buyurtma raqamingiz bilan biz bilan bog\'laning.</li><li>Mablag\' qaytarilgan mahsulot tekshirilgach, 3–5 ish kunida qaytariladi.</li></ul>' },
    size: { title: 'O\'lcham jadvali', html:
      '<h4 class="vl-h4">Poyabzal</h4><table class="vl-table"><tr><th>EU</th><th>38</th><th>39</th><th>40</th><th>41</th><th>42</th><th>43</th><th>44</th><th>45</th><th>46</th></tr>' +
      '<tr><td>Oyoq (sm)</td><td>24.0</td><td>24.7</td><td>25.3</td><td>26.0</td><td>26.7</td><td>27.3</td><td>28.0</td><td>28.7</td><td>29.3</td></tr></table>' +
      '<h4 class="vl-h4">Kiyim</h4><table class="vl-table"><tr><th>O\'lcham</th><th>XS</th><th>S</th><th>M</th><th>L</th><th>XL</th><th>XXL</th></tr>' +
      '<tr><td>Ko\'krak (sm)</td><td>82–88</td><td>88–94</td><td>94–100</td><td>100–106</td><td>106–112</td><td>112–118</td></tr></table>' +
      '<p class="vl-sub">Ikki o\'lcham orasida qolsangiz — kattasini tanlang.</p>' },
    faq: { title: 'Ko\'p so\'raladigan savollar', html:
      '<div class="vl-faq"><details open><summary>Buyurtma qancha vaqtda yetib keladi?</summary><p>Shahar ichida 1–2, viloyatlarga 2–5 ish kuni.</p></details>' +
      '<details><summary>To\'lov qanday amalga oshiriladi?</summary><p>Naqd pul yoki karta orqali — mahsulotni qabul qilganda.</p></details>' +
      '<details><summary>O\'lcham mos kelmasa-chi?</summary><p>30 kun ichida almashtirish yoki qaytarish mumkin.</p></details>' +
      '<details><summary>Promo kodni qayerga kiritaman?</summary><p>Savat oynasidagi "Promo kod" maydoniga kiriting.</p></details></div>' },
    privacy: { title: 'Maxfiylik siyosati', html:
      '<p class="vl-sub">Buyurtmani yetkazish uchun faqat zarur ma\'lumotlar — ism, telefon va manzil — so\'raladi. Ma\'lumotlaringiz uchinchi shaxslarga berilmaydi.</p>' },
    terms: { title: 'Foydalanish shartlari', html:
      '<p class="vl-sub">Saytdan foydalanish orqali siz buyurtma, to\'lov va qaytarish qoidalariga rozilik bildirasiz. Narxlar va mavjudlik oldindan ogohlantirmasdan o\'zgarishi mumkin.</p>' }
  };
  var INFO_LINKS = {
    'yetkazib berish': 'shipping', 'qaytarish': 'returns', 'olcham jadvali': 'size', 'buyurtmani kuzatish': 'track',
    'kop soraladigan savollar': 'faq', 'maxfiylik siyosati': 'privacy', 'foydalanish shartlari': 'terms'
  };

  function openInfo(key, opts) {
    if (key === 'track') return openTrack();
    var it = INFO[key]; if (!it) return;
    var d = openModal((opts && opts.back ? '<button type="button" class="vl-back" data-back>← Orqaga</button>' : '') +
      '<h3 class="vl-title">' + it.title + '</h3>' + it.html, 'vl-modal__dialog--info');
    if (opts && opts.back) $('[data-back]', d).addEventListener('click', opts.back);
  }

  /* =====================================================
     11. A'ZOLIK
     ===================================================== */
  function applyMember() {
    var m = getMember(); if (!m) return;
    $$('.membership-card__name').forEach(function (el) { el.textContent = m.name; });
    $$('.membership-card__since').forEach(function (el) { el.textContent = 'A\'zo bo\'lgan sana: ' + m.since; });
  }

  function openMember() {
    var m = getMember();
    var perks = '<ul class="vl-bullets"><li>Barcha buyurtmalarga <b>qo\'shimcha ' + CFG.memberDiscount + '% chegirma</b></li><li>Yangi mahsulotlarga erta kirish</li><li>Har doim bepul yetkazib berish</li></ul>';
    if (m) {
      var d = openModal('<div class="vl-done"><span class="vl-done__ico">' + ICON.ok + '</span><h3>Salom, ' + esc(m.name) + '!</h3><p class="vl-sub">Siz ' + esc(m.since) + '-yildan beri a\'zosiz. Chegirma savatda avtomatik qo\'llanadi.</p></div>' + perks +
        '<div class="vl-done__act"><button class="btn btn--ghost" data-leave>A\'zolikdan chiqish</button></div>');
      $('[data-leave]', d).addEventListener('click', function () { store.set('vltg_member', null); closeModal(); syncCart(); toast('A\'zolikdan chiqdingiz', '', 'info'); });
      return;
    }
    var dlg = openModal('<h3 class="vl-title">A\'zo bo\'lish — bepul</h3>' + perks +
      '<form class="vl-form" novalidate data-join>' +
      '<div class="vl-field"><label for="j-name">Ism</label><input id="j-name" name="name" placeholder="Ismingiz" autocomplete="name"><small class="vl-err"></small></div>' +
      '<div class="vl-field"><label for="j-email">Email</label><input id="j-email" name="email" type="email" placeholder="email@manzil.com" autocomplete="email"><small class="vl-err"></small></div>' +
      '<button class="btn btn--primary vl-wide" type="submit">Ro\'yxatdan o\'tish</button></form>');
    $('[data-join]', dlg).addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, name = f.elements.name.value.trim(), email = f.elements.email.value.trim(), ok = true;
      [['name', name.length >= 2, 'Ismingizni kiriting'], ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Email manzilni to\'g\'ri kiriting']].forEach(function (r) {
        var box = f.elements[r[0]].closest('.vl-field'); box.classList.toggle('has-err', !r[1]); $('.vl-err', box).textContent = r[1] ? '' : r[2]; if (!r[1]) ok = false;
      });
      if (!ok) return;
      store.set('vltg_member', { name: name, email: email, since: new Date().getFullYear() });
      closeModal(); applyMember(); syncCart();
      toast('Xush kelibsiz, ' + name + '!', 'Endi barcha buyurtmalarga −' + CFG.memberDiscount + '% chegirma');
    });
  }

  /* =====================================================
     12. QIDIRUV
     ===================================================== */
  var searchEl, searchOpen = false, searchTimer;

  function productHay(p) {
    var h = [p.name, p.cat, p.type || inferType(p.name), (p.pages || []).join(' ')];
    if (p.orig > p.price || (p.pages || []).indexOf('chegirma') > -1) h.push('chegirma sale');
    return norm(h.join(' '));
  }

  function doSearch(q) {
    var words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return [];
    var nq = norm(q);
    return CATALOG.map(function (p) { return { p: p, hay: productHay(p), n: norm(p.name) }; })
      .filter(function (x) { return words.every(function (w) { return x.hay.indexOf(w) > -1; }); })
      .sort(function (a, b) {
        var sa = a.n.indexOf(nq) === 0 ? 0 : a.n.indexOf(nq) > -1 ? 1 : 2, sb = b.n.indexOf(nq) === 0 ? 0 : b.n.indexOf(nq) > -1 ? 1 : 2;
        return sa - sb || a.p.price - b.p.price;
      }).map(function (x) { return x.p; });
  }

  function buildSearch() {
    if (searchEl) return;
    searchEl = document.createElement('div');
    searchEl.className = 'vl-search'; searchEl.setAttribute('aria-hidden', 'true');
    searchEl.innerHTML = '<div class="vl-search__box" role="dialog" aria-label="Qidiruv">' +
      '<div class="vl-search__field">' + ICON.search + '<input type="text" placeholder="Mahsulot qidirish… (masalan: hoodie, poyabzal)" autocomplete="off" aria-label="Qidirish"><button class="vl-x" data-s-close aria-label="Yopish">' + ICON.close + '</button></div>' +
      '<div class="vl-search__hints"><span>Mashhur:</span>' + ['Runner X1', 'Hoodie', 'Poyabzal', 'Yoga', 'Chegirma'].map(function (h) { return '<button type="button" data-hint="' + h + '">' + h + '</button>'; }).join('') + '</div>' +
      '<div class="vl-search__results" data-s-results></div></div>';
    document.body.appendChild(searchEl);

    var input = $('input', searchEl), out = $('[data-s-results]', searchEl);
    function render() {
      var q = input.value.trim();
      if (!q) { out.innerHTML = ''; return; }
      var res = doSearch(q);
      out.innerHTML = res.length
        ? '<p class="vl-search__count">' + res.length + ' ta natija</p>' + res.slice(0, 8).map(function (p, i) {
            return '<button type="button" class="vl-sr" data-i="' + i + '"><img src="' + esc(p.img) + '" alt=""><span><strong>' + esc(p.name) + '</strong><small>' + esc(p.cat) + '</small></span>' +
                   '<b>' + fmt(p.price) + (p.orig ? '<s>' + fmt(p.orig) + '</s>' : '') + '</b></button>';
          }).join('')
        : '<p class="vl-search__none">«' + esc(q) + '» bo\'yicha hech narsa topilmadi.<br><small>Boshqa so\'z bilan urinib ko\'ring.</small></p>';
      out._res = res;
    }
    function pick(i) {
      var p = out._res && out._res[i]; if (!p) return;
      closeSearch(); openQuickView(enrich(Object.assign({}, p)));
    }
    input.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(render, 80); });
    input.addEventListener('keydown', function (e) {
      var items = $$('.vl-sr', out), cur = items.findIndex(function (b) { return b.classList.contains('is-focus'); });
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!items.length) return;
        var next = e.key === 'ArrowDown' ? (cur + 1) % items.length : (cur - 1 + items.length) % items.length;
        items.forEach(function (b, k) { b.classList.toggle('is-focus', k === next); });
        items[next].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); pick(cur > -1 ? cur : 0); }
    });
    searchEl.addEventListener('click', function (e) {
      if (e.target === searchEl || e.target.closest('[data-s-close]')) { closeSearch(); return; }
      var h = e.target.closest('[data-hint]'); if (h) { input.value = h.getAttribute('data-hint'); render(); input.focus(); return; }
      var r = e.target.closest('.vl-sr'); if (r) pick(+r.getAttribute('data-i'));
    });
  }
  function openSearch() {
    buildSearch();
    var t = $('#nav-toggle'); if (t) t.checked = false;
    if (!searchOpen) { searchOpen = true; lock(); }
    searchEl.classList.add('open'); searchEl.setAttribute('aria-hidden', 'false');
    setTimeout(function () { $('input', searchEl).focus(); }, 60);
  }
  function closeSearch() {
    if (!searchOpen) return;
    searchOpen = false; unlock();
    searchEl.classList.remove('open'); searchEl.setAttribute('aria-hidden', 'true');
  }

  /* =====================================================
     13. TAYMER (yakshanba 23:59:59 gacha)
     ===================================================== */
  function countdown(nodes) {
    if (!nodes || nodes.length < 4) return;
    function nextSunday() {
      var d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7); d.setHours(23, 59, 59, 0); return d.getTime();
    }
    var target = nextSunday();
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) { target = nextSunday(); if (target <= Date.now()) target += 7 * 864e5; diff = target - Date.now(); }
      var v = [Math.floor(diff / 864e5), Math.floor(diff % 864e5 / 36e5), Math.floor(diff % 36e5 / 6e4), Math.floor(diff % 6e4 / 1e3)];
      nodes.forEach(function (n, i) { n.textContent = pad(v[i]); });
    }
    tick(); setInterval(tick, 1000);
  }

  /* =====================================================
     14. OBUNA (newsletter)
     ===================================================== */
  function initNewsletter() {
    $$('.newsletter-input').forEach(function (inp) {
      var btn = inp.parentElement.querySelector('.btn');
      function go(e) {
        if (e) e.preventDefault();
        var v = inp.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast('Email noto\'g\'ri', 'Iltimos, to\'g\'ri email manzil kiriting', 'err'); inp.focus(); return; }
        var list = store.get('vltg_newsletter', []); if (list.indexOf(v) < 0) list.push(v); store.set('vltg_newsletter', list);
        inp.value = ''; toast('Obuna bo\'ldingiz!', v);
      }
      if (btn) btn.addEventListener('click', go);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(e); });
    });
  }

  /* =====================================================
     15. ANIMATSIYALAR (header, yuqoriga tugmasi, paydo bo'lish)
     ===================================================== */
  function initScrollUI() {
    var header = $('.site-header');
    var top = document.createElement('button');
    top.className = 'vl-top'; top.setAttribute('aria-label', 'Yuqoriga'); top.innerHTML = ICON.up;
    document.body.appendChild(top);
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || document.documentElement.scrollTop;
        if (header) header.classList.toggle('scrolled', y > 10);
        top.classList.toggle('visible', y > 500);
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  function initReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('vl-anim');
    var sel = '.product-card, .arrival-card, .cat-card, .sport-cat, .tier-card, .promo-s-card, .promo-s-wide, .value-item, .section-header, .section-head, .membership-inner, .footer-col';
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, sibs = el.parentElement ? $$(':scope > .reveal', el.parentElement) : [el];
        el.style.setProperty('--d', (Math.max(0, sibs.indexOf(el)) % 6) * 70 + 'ms');
        el.classList.add('in-view'); io.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    $$(sel).forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  /* =====================================================
     16. GLOBAL HODISALAR (bosish, klaviatura)
     ===================================================== */
  function onClick(e) {
    var t = e.target;
    if (t.closest('[data-open-search]')) { e.preventDefault(); openSearch(); return; }
    if (t.closest('[data-open-cart]'))   { e.preventDefault(); openCart(); return; }
    if (t.closest('[data-open-wish]'))   { e.preventDefault(); var mt = $('#nav-toggle'); if (mt) mt.checked = false; openWishlist(); return; }
    if (t.closest('[data-register]'))    { e.preventDefault(); openMember(); return; }
    var info = t.closest('[data-info]');
    if (info) { e.preventDefault(); openInfo(info.getAttribute('data-info')); return; }
    var tn = t.closest('[data-track-now]');
    if (tn) { openTrack(tn.getAttribute('data-track-now')); return; }

    // mahsulot kartochkalari
    var fav = t.closest('.product-card__fav');
    if (fav) { e.preventDefault(); toggleWish(readCard(fav.closest('.product-card'))); return; }
    var card = t.closest('.product-card, .arrival-card');
    if (card && !t.closest('.color-dot') && t.closest('.btn, .product-card__media, .arrival-card__media, .product-card__name, .arrival-card__name')) {
      e.preventDefault(); openQuickView(readCard(card)); return;
    }
    // qolgan bo'sh "#" havolalar sahifani tepaga sakratmasin
    var a = t.closest('a[href="#"]'); if (a) e.preventDefault();
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (modalEl) closeModal(); else if (searchOpen) closeSearch(); else if (cartOpen) closeCart();
    var mt = $('#nav-toggle'); if (mt && mt.checked) mt.checked = false;
  }

  /* =====================================================
     17. ISHGA TUSHIRISH
     ===================================================== */
  function init() {
    // sevimlilar tugmasi (headerga qo'shiladi)
    var cartBtn = $('.header-actions .cart-icon');
    if (cartBtn && !$('.wish-icon')) {
      var w = document.createElement('a');
      w.href = '#'; w.className = 'header-icon wish-icon'; w.setAttribute('data-open-wish', ''); w.setAttribute('aria-label', 'Sevimlilar');
      w.innerHTML = ICON.heart + '<span class="cart-badge is-empty" data-wish-count>0</span>';
      cartBtn.parentNode.insertBefore(w, cartBtn);
    }
    // footerdagi havolalarni ma'lumot oynalariga ulash
    $$('.footer-links a, .footer-legal-links a').forEach(function (a) {
      var k = INFO_LINKS[norm(a.textContent)]; if (k) a.setAttribute('data-info', k);
    });
    // faol menyu
    $$('.nav-list .nav-link').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === page + '.html'); });
    // mobil menyu havolalari bosilganda menyu yopilsin
    $$('.mobile-nav a').forEach(function (a) { a.addEventListener('click', function () { var t = $('#nav-toggle'); if (t) t.checked = false; }); });

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('storage', function (e) {
      if (e.key === 'vltg_cart')  { cart = store.get('vltg_cart', []); syncCart(); }
      if (e.key === 'vltg_wish')  { wish = store.get('vltg_wish', []); syncWish(); }
    });

    syncCart(); syncWish(); applyMember();
    initNewsletter(); initScrollUI(); initReveal();
  }

  /* =====================================================
     18. BOSHQA FAYLLAR UCHUN API
     ===================================================== */
  window.VLTG = {
    $: $, $$: $$, esc: esc, fmt: fmt, num: num, norm: norm, store: store, page: page, CFG: CFG,
    toast: toast, openModal: openModal, closeModal: closeModal,
    openCart: openCart, openSearch: openSearch, openQuickView: openQuickView, openMember: openMember, openInfo: openInfo,
    readCard: readCard, enrich: enrich, inferType: inferType, countdown: countdown,
    cart: { add: addToCart, items: function () { return cart.slice(); }, calc: calc }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
