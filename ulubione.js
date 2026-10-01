/* Jajo: ulubione przepisy na koncie. Bez logowania zostają w pamięci przeglądarki (przepisy.js). */
import { connect, isMember, watchUser } from './jajo-firebase.js';

const MAX = 300;

function apiReady() {
  if (window.JAJO_PRZEPISY_API) return Promise.resolve(window.JAJO_PRZEPISY_API);
  return new Promise((resolve) => {
    document.addEventListener('jajo:przepisy-gotowe', () => resolve(window.JAJO_PRZEPISY_API), { once: true });
  });
}

(async function start() {
  const [api, fb] = await Promise.all([apiReady(), connect()]);
  if (!fb || !api || !api.favorites) return;
  const fav = api.favorites;
  const { F, db } = fb;
  let token = 0;

  watchUser(fb, async (u) => {
    const mine = ++token;
    if (!isMember(u)) {
      fav.useLocal();
      return;
    }
    const ref = F.doc(db, 'ulubione', u.uid);
    try {
      const snap = await F.getDoc(ref);
      const saved = snap.exists() && Array.isArray(snap.data().przepisy) ? snap.data().przepisy : [];
      // Ulubione dodane przed zalogowaniem przenosimy na konto.
      const local = fav.local();
      const merged = [...new Set([...saved, ...local])].slice(0, MAX);
      if (merged.length !== saved.length) await F.setDoc(ref, { przepisy: merged });
      if (local.length) fav.clearLocal();
      if (mine !== token) return;
      fav.useAccount(merged, (id, on) => F.setDoc(ref, { przepisy: on ? F.arrayUnion(id) : F.arrayRemove(id) }, { merge: true }));
    } catch (err) {
      // Brak reguł dla ulubionych w bazie: zostają w przeglądarce.
      console.warn('Ulubione zostają w przeglądarce.', err && err.code);
      if (mine === token) fav.useLocal();
    }
  });
})();
