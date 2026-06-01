(function () {
  'use strict';

  let deferredInstallPrompt = null;
  const installButton = document.getElementById('pwa-install-btn');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js').catch(function () {});
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.classList.remove('hidden');
  });

  if (installButton) {
    installButton.addEventListener('click', async function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installButton.classList.add('hidden');
    });
  }

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    if (installButton) installButton.classList.add('hidden');
  });
})();
