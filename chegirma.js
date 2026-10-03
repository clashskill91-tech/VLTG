/*!
 * VLTG — chegirma.js  (faqat chegirma.html uchun)
 *   jonli taymer · chegirma darajalari bo'yicha filtr · promo kartalar · aksiya
 * Mahsulotlar ro'yxati, filtr va savat — listing.js hamda main.js ichida.
 */
(function () {
  'use strict';
  var V = window.VLTG;
  if (!V) return;
  var L = V.listing;

  /* 1. Jonli taymer (yakshanba 23:59:59 gacha) */
  V.countdown(V.$$('.hcd-num'));

  /* 2. Chegirma darajalari: 10% / 20% / 30% / 40% — shu foizdan yuqori chegirmali mahsulotlar */
  V.$$('.tier-card').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var pct = parseInt((V.$('.tier-card__pct', a) || {}).textContent, 10) || 0;
      if (!L) return;
      L.setExtra('Chegirma ≥ ' + pct + '%', function (p) { return p.disc >= pct; });
      L.scrollToGrid();
    });
  });

  /* 3. Promo kartalar (Poyabzal / Erkaklar / Ayollar) — tegishli filtrni yoqadi */
  V.$$('.promo-s-card').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var t = V.norm((V.$('.promo-s-card__title', a) || {}).textContent);
      var chip = t.indexOf('poyabzal') > -1 ? 'poyabzal' : t.indexOf('erkaklar') > -1 ? 'erkaklar' : t.indexOf('ayollar') > -1 ? 'ayollar' : '';
      if (L && chip) { L.reset(); L.activate(chip); L.scrollToGrid(); }
    });
  });

  /* 4. "2 ta olsang 3-tasi bepul" banneri — to'plam mahsulotlarini ko'rsatadi.
        Aksiya savatda avtomatik hisoblanadi (har 3-to'plamdan biri bepul). */
  var wide = V.$('.promo-s-wide');
  if (wide && L) {
    wide.addEventListener('click', function (e) {
      e.preventDefault();
      L.reset();
      L.setExtra("To'plamlar (3-tasi bepul)", function (p) { return /\b(set|kit|tracksuit)\b/.test(p.hay); });
      L.scrollToGrid();
      V.toast("To'plam aksiyasi", "Savatda har 3-to'plamdan biri bepul bo'ladi", 'info');
    });
  }
})();
