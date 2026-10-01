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

export async function signIn(fb) {
  const provider = new fb.A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return fb.A.signInWithPopup(fb.auth, provider);
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
