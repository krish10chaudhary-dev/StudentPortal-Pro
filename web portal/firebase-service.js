(function () {
  'use strict';

  const BRIDGE = {
    enabled: false,
    ready: false,
    uid: null,
    docId: null,
    status: 'Local Mode',
    lastServerUpdatedAt: 0,
    docRef: null,
    unsub: null,
    onStatus: function () {},
    applyData: function () {},
    getData: function () { return {}; },
    sessionId: `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };

  function publishStatus(text, isOnline) {
    BRIDGE.status = text;
    BRIDGE.onStatus({ text, isOnline: Boolean(isOnline) });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureFirebaseConfigLoaded() {
    if (window.STUDENT_PORTAL_FIREBASE_CONFIG) return true;
    try {
      await loadScript('./firebase-config.js');
      return Boolean(window.STUDENT_PORTAL_FIREBASE_CONFIG);
    } catch {
      return false;
    }
  }

  async function ensureFirebaseSdkLoaded() {
    if (window.firebase && window.firebase.apps) return;
    await loadScript('https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore-compat.js');
  }

  function buildSnapshotPayload() {
    return {
      ...BRIDGE.getData(),
      meta: {
        updatedAt: Date.now(),
        sessionId: BRIDGE.sessionId,
      },
    };
  }

  function attachRealtimeListener() {
    if (!BRIDGE.docRef) return;
    BRIDGE.unsub = BRIDGE.docRef.onSnapshot(snapshot => {
      if (!snapshot.exists) return;
      const data = snapshot.data() || {};
      const updatedAt = Number(data.meta && data.meta.updatedAt) || 0;
      if (updatedAt && updatedAt <= BRIDGE.lastServerUpdatedAt) return;
      if (data.meta && data.meta.sessionId === BRIDGE.sessionId) {
        BRIDGE.lastServerUpdatedAt = updatedAt;
        return;
      }
      BRIDGE.lastServerUpdatedAt = updatedAt;
      BRIDGE.applyData(data);
      publishStatus('Firebase Live', true);
    }, () => {
      publishStatus('Local Mode', false);
    });
  }

  async function init(options = {}) {
    BRIDGE.onStatus = typeof options.onStatus === 'function' ? options.onStatus : function () {};
    BRIDGE.getData = typeof options.getData === 'function' ? options.getData : BRIDGE.getData;
    BRIDGE.applyData = typeof options.applyData === 'function' ? options.applyData : BRIDGE.applyData;

    const hasConfig = await ensureFirebaseConfigLoaded();
    if (!hasConfig) {
      BRIDGE.enabled = false;
      BRIDGE.ready = false;
      publishStatus('Local Mode', false);
      return BRIDGE;
    }

    try {
      await ensureFirebaseSdkLoaded();
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(window.STUDENT_PORTAL_FIREBASE_CONFIG);
      }

      const auth = window.firebase.auth();
      if (!auth.currentUser) {
        await auth.signInAnonymously();
      }
      BRIDGE.uid = auth.currentUser.uid;
      BRIDGE.docId = (typeof options.getDocId === 'function' ? options.getDocId() : '') || BRIDGE.uid;
      BRIDGE.docRef = window.firebase.firestore().collection('portalUsers').doc(BRIDGE.docId);

      const first = await BRIDGE.docRef.get();
      if (first.exists) {
        const data = first.data() || {};
        BRIDGE.lastServerUpdatedAt = Number(data.meta && data.meta.updatedAt) || 0;
        BRIDGE.applyData(data);
      } else {
        const payload = buildSnapshotPayload();
        BRIDGE.lastServerUpdatedAt = Number(payload.meta.updatedAt) || Date.now();
        await BRIDGE.docRef.set(payload, { merge: true });
      }

      attachRealtimeListener();
      BRIDGE.enabled = true;
      BRIDGE.ready = true;
      publishStatus('Firebase Live', true);
      return BRIDGE;
    } catch (error) {
      console.error('Firebase bridge init error', error);
      BRIDGE.enabled = false;
      BRIDGE.ready = false;
      publishStatus('Local Mode', false);
      return BRIDGE;
    }
  }

  let syncTimer = null;
  function scheduleSync(delayMs = 700) {
    if (!BRIDGE.ready || !BRIDGE.docRef) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        const payload = buildSnapshotPayload();
        BRIDGE.lastServerUpdatedAt = Number(payload.meta.updatedAt) || Date.now();
        await BRIDGE.docRef.set(payload, { merge: true });
      } catch {
        publishStatus('Local Mode', false);
      }
    }, delayMs);
  }

  function destroy() {
    if (BRIDGE.unsub) BRIDGE.unsub();
    BRIDGE.unsub = null;
    BRIDGE.ready = false;
    BRIDGE.enabled = false;
    publishStatus('Local Mode', false);
  }

  window.FirebaseBridge = {
    init,
    scheduleSync,
    destroy,
    getState: () => ({
      enabled: BRIDGE.enabled,
      ready: BRIDGE.ready,
      uid: BRIDGE.uid,
      docId: BRIDGE.docId,
      status: BRIDGE.status,
    }),
  };
})();
