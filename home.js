/*!
 * VLTG — home.js  (faqat index.html uchun)
 *   promo bannerdagi jonli taymer
 * Savat, qidiruv, kartochkalar, kategoriyalar (havolalar) va obuna — main.js ichida.
 */
(function () {
  'use strict';
  var V = window.VLTG;
  if (!V) return;

  // Promo banner: yakshanba yarim kechagacha qolgan vaqt
  V.countdown(V.$$('.promo-countdown .countdown-num'));
})();
