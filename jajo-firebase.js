/* Jajo: wspólne połączenie z Firebase dla przepisów od czytelników i panelu moderacji. */
import config from './firebase-config.js';

const VERSION = '12.19.0';
const CDN = `https://www.gstatic.com/firebasejs/${VERSION}`;

let loading = null;

export const configured = Boolean(config);
const TIMEOUT_MS = 20000;

/** Zwraca { auth, db, A, F } albo null, gdy Firebase nie jest skonfigurowany lub się nie wczytał. */
export function connect() {
  if (!config) return Promise.resolve(null);
  if (!loading) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));
    loading = Promise.race([Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]), timeout]).then(([appMod, A, F]) => {
      const app = appMod.initializeApp(config);
      const auth = A.getAuth(app);
      auth.languageCode = 'pl';
      const db = F.getFirestore(app);
      if (config.emulators) {
        A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      }
      return { auth, db, A, F };
    }).catch((err) => {
      console.error('Firebase się nie wczytał', err);
      return null;
    });
  }
  return loading;
}

/** Konto Google (nie gość anonimowy). */
export const isMember = (user) => Boolean(user && !user.isAnonymous);

/**
 * Logowanie przez Google. Jeśli ktoś był gościem (np. polubił przepis), jego konto gościa
 * łączy się z Google, więc polubienia i komentarze zostają przy nim.
 */
export async function signIn(fb) {
  const { A, auth } = fb;
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const current = auth.currentUser;
  if (current && current.isAnonymous) {
    try {
      const result = await A.linkWithPopup(current, provider);
      const cred = A.GoogleAuthProvider.credentialFromResult(result);
      // Nowe logowanie odświeża token, żeby baza widziała konto Google, a nie gościa.
      return cred ? await A.signInWithCredential(auth, cred) : result;
    } catch (err) {
      const cred = err && err.code === 'auth/credential-already-in-use' && A.GoogleAuthProvider.credentialFromError(err);
      if (cred) return A.signInWithCredential(auth, cred);
      throw err;
    }
  }
  return A.signInWithPopup(auth, provider);
}

/** Konto gościa, żeby niezalogowani mogli polubić przepis i napisać komentarz. */
export async function ensureGuest(fb) {
  if (fb.auth.currentUser) return fb.auth.currentUser;
  const result = await fb.A.signInAnonymously(fb.auth);
  return result.user;
}

/** Wywołuje cb(user) przy zalogowaniu, wylogowaniu i zamianie gościa w konto Google. */
export function watchUser(fb, cb) {
  let last = null;
  return fb.A.onIdTokenChanged(fb.auth, (user) => {
    const key = user ? user.uid + (user.isAnonymous ? ':gosc' : ':konto') : '';
    if (key === last) return;
    last = key;
    cb(user);
  });
}

const profiles = new Map();

/** Profil zalogowanego użytkownika. Przy pierwszym logowaniu zakłada go z imieniem z konta Google. */
export function ensureProfile(fb, user) {
  if (!isMember(user)) return Promise.resolve(null);
  if (!profiles.has(user.uid)) {
    const { F, db } = fb;
    const ref = F.doc(db, 'profile', user.uid);
    profiles.set(user.uid, F.getDoc(ref).then(async (snap) => {
      if (snap.exists()) return snap.data();
      // Po połączeniu konta gościa z Google imię bywa tylko w danych dostawcy.
      const google = (user.providerData || []).find((p) => p.providerId === 'google.com');
      let name = (user.displayName || (google && google.displayName) || '').trim().split(/\s+/)[0] || '';
      if (name.length < 2) name = 'Kucharz';
      const data = { name: name.slice(0, 40), bio: '', egg: '', joinedAt: F.serverTimestamp() };
      await F.setDoc(ref, data);
      return { ...data, joinedAt: null };
    }).catch((err) => {
      profiles.delete(user.uid);
      console.error(err);
      return null;
    }));
  }
  return profiles.get(user.uid);
}

export function forgetProfile(uid) {
  profiles.delete(uid);
}

let socialCheck = null;

/** Czy w bazie są już reguły dla polubień, komentarzy i profili (właściciel musi je wkleić). */
export function socialReady(fb) {
  if (!socialCheck) {
    const { F, db } = fb;
    socialCheck = F.getDocs(F.query(F.collection(db, 'reakcje'), F.limit(1)))
      .then(() => true)
      .catch((err) => {
        console.warn('Polubienia i komentarze są wyłączone: brak nowych reguł w Firestore.', err && err.code);
        return false;
      });
  }
  return socialCheck;
}

export const EGG_PREFS = {
  'na-miekko': 'Na miękko',
  mollet: 'Mollet',
  'na-twardo': 'Na twardo',
  sadzone: 'Sadzone',
  jajecznica: 'Jajecznica',
  'w-koszulce': 'W koszulce',
  omlet: 'Omlet',
  faszerowane: 'Faszerowane',
};

/** „przed chwilą”, „5 min temu”, „wczoraj”… */
export function relTime(ms) {
  const diff = Math.max(0, Date.now() - ms) / 1000;
  if (diff < 60) return 'przed chwilą';
  if (diff < 3600) return Math.floor(diff / 60) + ' min temu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' godz. temu';
  if (diff < 172800) return 'wczoraj';
  if (diff < 604800) return Math.floor(diff / 86400) + ' dni temu';
  return new Date(ms).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Awatar w kształcie jajka z pierwszą literą imienia. */
export function avatarHtml(name, uid, size = '') {
  let hash = 0;
  for (const ch of uid || '?') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const tone = uid ? 'av-' + (hash % 5) : 'av-guest';
  return `<span class="avatar ${tone}${size ? ' avatar-' + size : ''}" aria-hidden="true">${initial.replace(/[<>&"']/g, '')}</span>`;
}

export function signInError(err) {
  const code = err && err.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/popup-blocked') return 'Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna dla tej strony i spróbuj jeszcze raz.';
  if (code === 'auth/unauthorized-domain') return 'Ta domena nie jest dopisana w ustawieniach logowania Firebase.';
  if (code === 'auth/network-request-failed') return 'Brak połączenia z internetem. Spróbuj jeszcze raz.';
  return 'Nie udało się zalogować. Spróbuj jeszcze raz.';
}

/** Zamienia dokument z bazy na przepis w formacie używanym przez stronę. */
export function toRecipe(fb, id, d) {
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false));
  return {
    id: 'c-' + id,
    docId: id,
    community: true,
    authorName: d.authorName,
    authorUid: d.authorUid,
    name: d.name,
    category: d.category,
    intro: d.intro,
    time: d.time,
    wait: d.wait || undefined,
    difficulty: d.difficulty,
    servings: d.servings,
    minServings: d.minServings || 1,
    ingredients: (d.ingredients || []).map((it) => clean({
      n: it.n, q: typeof it.q === 'number' ? it.q : undefined, u: it.u, t: it.t, egg: it.egg, opt: it.opt,
    })),
    steps: (d.steps || []).map((s) => (s.timer ? { t: s.t, timer: s.timer } : s.t)),
    tip: d.tip || undefined,
    photo: d.thumb ? { file: d.thumb, w: 480, h: 360, focus: '50% 50%', author: d.authorName } : null,
    loadPhoto: d.hasPhoto ? () => fb.F.getDoc(fb.F.doc(fb.db, 'zdjecia', id)).then((s) => (s.exists() ? s.data().data : null)) : null,
    hasPhoto: Boolean(d.hasPhoto),
    status: d.status,
    rejectReason: d.rejectReason,
    createdAt: d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : Date.now(),
  };
}

export async function isAdmin(fb, uid) {
  try {
    return (await fb.F.getDoc(fb.F.doc(fb.db, 'admins', uid))).exists();
  } catch {
    return false;
  }
}

/**
 * Zmniejsza zdjęcie w przeglądarce do JPEG-a o podanym rozmiarze.
 * crop: proporcje kadru (np. 4/3) albo 0, żeby zostawić oryginalne.
 * maxChars: limit długości wyniku jako data URL.
 */
export async function shrinkImage(file, { width, crop = 0, maxChars }) {
  const img = await loadImage(file);
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  let sx = 0;
  let sy = 0;
  let cw = sw;
  let ch = sh;
  if (crop) {
    if (sw / sh > crop) {
      cw = Math.round(sh * crop);
      sx = Math.round((sw - cw) / 2);
    } else {
      ch = Math.round(sw / crop);
      sy = Math.round((sh - ch) / 2);
    }
  }
  let w = Math.min(width, cw);
  for (let attempt = 0; attempt < 6; attempt++) {
    const h = Math.round((w * ch) / cw);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
    for (const q of [0.78, 0.68, 0.58, 0.5]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= maxChars) return url;
    }
    w = Math.round(w * 0.8);
  }
  throw new Error('too-big');
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}
