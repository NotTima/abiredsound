// Mobile & cross-device compatibility: never block mobile/tablet browsers with phone-gate.
(function () {
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
  if (isMobile) {
    document.documentElement.classList.add('is-mobile');
  }
})();
