/*!
 * VLTG — listing.js
 * Mahsulotlar ro'yxati sahifalari uchun (erkaklar, ayollar, bolalar, sport, chegirma):
 *   narx / kategoriya / yosh filtrlari · saralash · sahifalash · "topilmadi" holati
 *   · havola orqali filtr (masalan sport.html#yugurish)
 *
 * Filtrlar HTML'dagi tugmalarning MATNIDAN o'qiladi — yangi tugma qo'shsangiz ham ishlayveradi.
 */
(function () {
  'use strict';
  var V = window.VLTG;
  if (!V) return;
  var $ = V.$, $$ = V.$$, norm = V.norm;

  var grid = $('.products-grid-page');
  if (!grid) return;
  var container = grid.parentElement;
  var PAGE_SIZE = 8;
  var state = { page: 1, extra: null };

  /* ---------- 1. Kartochkalardan ma'lumot yig'ish ---------- */
  var infos = $$('.product-card', grid).map(function (el, i) {
    var p = V.readCard(el), age = null, ageEl = $('.badge--age', el);
    if (ageEl) { var m = ageEl.textContent.match(/(\d+)\s*[–\-]\s*(\d+)/); if (m) age = [+m[1], +m[2]]; }
    return {
      el: el, i: i, price: p.price, orig: p.orig, type: p.type, age: age,
      disc: p.orig ? Math.round((1 - p.price / p.orig) * 100) : 0,
      hay: norm(p.cat + ' ' + p.name + ' ' + p.type),
      isNew: !!$('.badge--new', el)
    };
  });

  /* ---------- 2. Shartlar (predicate) yasash ---------- */
  function stem(w) { return w.slice(0, Math.max(4, Math.ceil(w.length * 0.7))); }

  // "a & b" => YOKI,  "a b" => VA
  function wordPred(t) {
    var alts = t.split(/\s*&\s*/).map(function (a) { return a.split(' ').filter(Boolean); });
    return function (p) {
      return alts.some(function (words) {
        return words.every(function (w) {
          if (w === 'poyabzal' || w === 'kiyim') return p.type === w;
          if (w === 'erkaklar' || w === 'ayollar') return p.hay.indexOf(w) > -1 || p.hay.indexOf('unisex') > -1;
          return p.hay.indexOf(stem(w)) > -1;
        });
      });
    };
  }

  function chipPred(label) {
    var t = norm(label);
    if (t === 'hammasi' || t === 'barcha narxlar') return null;
    var m = label.match(/\$\s*(\d+)\s*[–\-—]\s*\$?\s*(\d+)/);       // "$50 – $100"
    if (m) { var lo = +m[1], hi = +m[2]; return function (p) { return p.price >= lo && p.price <= hi; }; }
    m = label.match(/\$\s*(\d+)\s*\+/);                              // "$200 +"
    if (m) { var min = +m[1]; return function (p) { return p.price >= min; }; }
    return wordPred(t);
  }
  function subPred(label) { var t = norm(label); return t === 'hammasi' ? null : wordPred(t); }

  function agePred(label) {
    if (norm(label) === 'hammasi') return null;
    var m = label.match(/\((\d+)\s*(?:[–\-]\s*(\d+)|\+)/);          // "Kichik (2–6)", "O'smirlar (14+)"
    if (!m) return null;
    var a = +m[1], b = m[2] ? +m[2] : 99;
    return function (p) { return !!p.age && p.age[0] <= b && a <= p.age[1]; };
  }

  /* ---------- 3. Filtr guruhlari ---------- */
  var groups = [];
  function addGroup(rootSel, itemSel, makePred) {
    var root = $(rootSel); if (!root) return;
    var g = { root: root, itemSel: itemSel, make: makePred, pred: null };
    var act = $(itemSel + '.active', root) || $(itemSel, root);
    if (act) g.pred = makePred(act.textContent.trim());
    root.addEventListener('click', function (e) {
      var it = e.target.closest(itemSel); if (!it || !root.contains(it)) return;
      e.preventDefault();
      $$(itemSel, root).forEach(function (x) { x.classList.toggle('active', x === it); });
      g.pred = makePred(it.textContent.trim());
      state.page = 1; apply(true);
    });
    groups.push(g);
  }
  addGroup('.filter-chips', '.chip', chipPred);
  addGroup('.subcats', '.subcat-link', subPred);
  addGroup('.age-filter', '.age-btn', agePred);

  /* ---------- 4. Qo'shimcha (olib tashlanadigan) filtr ---------- */
  var extraBar = document.createElement('div');
  extraBar.className = 'vl-extra'; extraBar.hidden = true;
  container.insertBefore(extraBar, grid);
  extraBar.addEventListener('click', function (e) {
    if (e.target.closest('[data-clear]')) { state.extra = null; renderExtra(); state.page = 1; apply(true); }
  });
  function renderExtra() {
    extraBar.hidden = !state.extra;
    extraBar.innerHTML = state.extra ? '<span>Filtr:</span><button type="button" class="vl-pill" data-clear>' + V.esc(state.extra.label) + ' ✕</button>' : '';
  }
  function setExtra(label, pred) { state.extra = { label: label, pred: pred }; state.page = 1; renderExtra(); apply(true); }

  /* ---------- 5. "Topilmadi" holati ---------- */
  var empty = document.createElement('div');
  empty.className = 'vl-empty'; empty.hidden = true;
  empty.innerHTML = '<strong>Hech narsa topilmadi</strong><span>Tanlangan filtrlarga mos mahsulot yo\'q.</span><button type="button" class="btn btn--primary btn--sm" data-reset>Filtrlarni tozalash</button>';
  grid.appendChild(empty);
  empty.addEventListener('click', function (e) { if (e.target.closest('[data-reset]')) reset(); });

  /* ---------- 6. Saralash ---------- */
  var sortSel = $('.filter-sort select');
  function sortList(list) {
    var txt = sortSel ? norm(sortSel.options[sortSel.selectedIndex].text) : '';
    var cmp = function (a, b) { return a.i - b.i; };
    if (/narx/.test(txt)) {
      var asc = txt.indexOf('past') < txt.indexOf('yuqori');
      cmp = function (a, b) { return (asc ? a.price - b.price : b.price - a.price) || a.i - b.i; };
    } else if (/yangi/.test(txt)) cmp = function (a, b) { return (b.isNew - a.isNew) || a.i - b.i; };
    else if (/chegirma/.test(txt)) cmp = function (a, b) { return (b.disc - a.disc) || a.i - b.i; };
    list.sort(cmp);
  }
  if (sortSel) sortSel.addEventListener('change', function () { state.page = 1; apply(true); });

  /* ---------- 7. Sahifalash ---------- */
  var pag = $('.pagination', container);
  function renderPag(pages) {
    if (!pag) return;
    if (pages <= 1) { pag.style.display = 'none'; return; }
    pag.style.display = '';
    var h = '';
    if (state.page > 1) h += '<button class="page-btn page-btn--wide" data-p="' + (state.page - 1) + '">← Oldingi</button>';
    for (var i = 1; i <= pages; i++) h += '<button class="page-btn' + (i === state.page ? ' active' : '') + '" data-p="' + i + '">' + i + '</button>';
    if (state.page < pages) h += '<button class="page-btn page-btn--wide" data-p="' + (state.page + 1) + '">Keyingi →</button>';
    pag.innerHTML = h;
  }
  if (pag) pag.addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    state.page = +b.getAttribute('data-p'); apply(true); scrollToGrid();
  });

  /* ---------- 8. Asosiy: filtrni qo'llash ---------- */
  var head = $('.section-head', container);
  var countEl = head ? $('span', head) : null;
  var origCount = countEl ? countEl.textContent : '';

  function apply(animate) {
    var preds = groups.map(function (g) { return g.pred; });
    if (state.extra) preds.push(state.extra.pred);
    preds = preds.filter(Boolean);

    var shown = infos.filter(function (p) { return preds.every(function (f) { return f(p); }); });
    sortList(shown);

    var pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var visible = shown.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    var frag = document.createDocumentFragment();
    visible.forEach(function (p) { p.el.style.display = ''; frag.appendChild(p.el); });
    infos.forEach(function (p) { if (visible.indexOf(p) < 0) { p.el.style.display = 'none'; frag.appendChild(p.el); } });
    grid.insertBefore(frag, empty);

    if (animate && document.documentElement.classList.contains('vl-anim')) {
      visible.forEach(function (p, k) {
        var el = p.el;
        el.classList.add('reveal'); el.classList.remove('in-view');
        el.style.setProperty('--d', k * 50 + 'ms');
        void el.offsetWidth; el.classList.add('in-view');
      });
    }
    empty.hidden = visible.length > 0;
    if (countEl) countEl.textContent = preds.length ? shown.length + ' ta mahsulot topildi' : origCount;
    renderPag(pages);
  }

  /* ---------- 9. Yordamchi amallar ---------- */
  function activate(label) {
    var t = norm(label), hit = false;
    groups.forEach(function (g) {
      if (hit) return;
      $$(g.itemSel, g.root).forEach(function (it) { if (!hit && norm(it.textContent) === t) { hit = true; it.click(); } });
    });
    return hit;
  }
  function reset() {
    groups.forEach(function (g) {
      var first = $(g.itemSel, g.root); if (!first) return;
      $$(g.itemSel, g.root).forEach(function (x) { x.classList.toggle('active', x === first); });
      g.pred = g.make(first.textContent.trim());
    });
    state.extra = null; renderExtra();
    if (sortSel) sortSel.selectedIndex = 0;
    state.page = 1; apply(true);
  }
  function scrollToGrid() {
    var h = $('.site-header'), bar = $('.filter-bar'), target = head || grid;
    var off = (h ? h.offsetHeight : 70) + (bar ? bar.offsetHeight : 0) + 16;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - off, behavior: 'smooth' });
  }
  function setText(label) { setExtra(label, wordPred(norm(label))); }

  /* ---------- 10. Havola (#yugurish) va sport turlari kartalari ---------- */
  function fromHash() {
    var h = decodeURIComponent((location.hash || '').slice(1));
    if (!h || h === 'mahsulotlar') return;
    var label = h.replace(/-/g, ' ');
    if (!activate(label)) setText(label.charAt(0).toUpperCase() + label.slice(1));
    setTimeout(scrollToGrid, 150);
  }
  window.addEventListener('hashchange', function () { reset(); fromHash(); });

  $$('.sport-cat').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var label = ($('.sport-cat__title', a) || {}).textContent || '';
      reset();
      if (!activate(label.trim())) setText(label.trim());
      scrollToGrid();
    });
  });
  $$('.section-head a[href="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); reset(); scrollToGrid(); });
  });

  /* ---------- 11. Boshqa fayllar uchun API ---------- */
  V.listing = { activate: activate, setExtra: setExtra, setText: setText, reset: reset, scrollToGrid: scrollToGrid };

  apply(false);
  fromHash();
})();
