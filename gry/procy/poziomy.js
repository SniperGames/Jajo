/* Jajo, „Kury z procy”: poziomy. Wymiary w metrach, ziemia na wysokości 0, proca stoi przy x = 3,2.
   Funkcje budujące przyjmują środek w poziomie (x) i spód (y), a zwracają wysokość górnej krawędzi. */

const T = 0.25; // grubość deski

export const CHAPTERS = [
  { name: 'Podwórko', theme: 'dzien', text: 'Zgniłe jajka zajęły podwórko. Pora je przegonić!' },
  { name: 'Kurnik o zmierzchu', theme: 'zmierzch', text: 'Zgniłki budują z kamienia. Na pomoc ruszają Rakieta i Bomba.' },
  { name: 'Zamek Zgniłków', theme: 'noc', text: 'Ostatnia twierdza i sam Król Zgniłków. Do boju, Nioska i Kogucie!' },
];

function level(id, name, chapter, hens, build) {
  const pieces = [];
  const api = {
    rect(m, x, y, w, h) {
      pieces.push({ t: 'b', m, x, y: y + h / 2, w, h });
      return y + h;
    },
    col(m, x, y, h, w = T) {
      return api.rect(m, x, y, w, h);
    },
    beam(m, x, y, w, h = T) {
      return api.rect(m, x, y, w, h);
    },
    blk(m, x, y, s = 1) {
      return api.rect(m, x, y, s, s);
    },
    // Dwie kolumny i belka na górze
    frame(m, x, y, w, h, roof = m) {
      api.col(m, x - w / 2 + T / 2, y, h);
      api.col(m, x + w / 2 - T / 2, y, h);
      return api.beam(roof, x, y + h, w);
    },
    egg(k, x, y) {
      pieces.push({ t: 'e', k, x, y });
    },
    tnt(x, y) {
      return api.blk('tnt', x, y, 0.8);
    },
    // Nieruchome podwyższenie (pagórek, skała)
    plat(x, y, w, h) {
      pieces.push({ t: 'p', x, y: y + h / 2, w, h });
      return y + h;
    },
  };
  build(api);
  return { id, name, chapter, hens, pieces };
}

export const LEVELS = [
  /* ---------- Rozdział 1: Podwórko ---------- */
  level(1, 'Pierwsze jajko', 0, ['kokoszka', 'kokoszka', 'kokoszka'], ({ frame, egg }) => {
    const top = frame('drewno', 22, 0, 2.4, 2);
    egg('zwykly', 22, 0);
    egg('maly', 22, top);
  }),
  level(2, 'Dwie wieżyczki', 0, ['kokoszka', 'kokoszka', 'kokoszka'], ({ frame, blk, egg }) => {
    const a1 = frame('drewno', 18.5, 0, 2.2, 1.8);
    frame('drewno', 18.5, a1, 2.2, 1.8);
    egg('zwykly', 18.5, 0);
    egg('zwykly', 18.5, a1);
    const b1 = frame('lod', 24.5, 0, 2.2, 1.8);
    const b2 = blk('drewno', 24.5, b1, 1);
    egg('zwykly', 24.5, 0);
    egg('maly', 24.5, b2);
  }),
  level(3, 'Lodowy domek', 0, ['pisklaki', 'pisklaki', 'kokoszka'], ({ frame, beam, egg }) => {
    const f1 = frame('lod', 21, 0, 3, 2);
    const f2 = frame('lod', 21, f1, 2, 1.5);
    beam('lod', 21, f2, 2.6);
    egg('zwykly', 20.4, 0);
    egg('maly', 21.6, 0);
    egg('zwykly', 21, f1);
    const g1 = frame('lod', 26, 0, 2, 1.6);
    egg('maly', 26, 0);
    egg('maly', 26, g1);
  }),
  level(4, 'Piramida skrzynek', 0, ['kokoszka', 'pisklaki', 'kokoszka'], ({ blk, egg }) => {
    [19.5, 20.5, 21.5, 22.5].forEach((x) => blk('drewno', x, 0, 1));
    [20, 21, 22].forEach((x) => blk(x === 21 ? 'lod' : 'drewno', x, 1, 1));
    [20.5, 21.5].forEach((x) => blk('lod', x, 2, 1));
    blk('drewno', 21, 3, 1);
    egg('zwykly', 21, 4);
    egg('zwykly', 18.4, 0);
    egg('zwykly', 23.6, 0);
  }),
  level(5, 'Twierdza na wzgórzu', 0, ['kokoszka', 'pisklaki', 'pisklaki', 'kokoszka'], ({ plat, frame, beam, egg }) => {
    const hill = plat(24, 0, 8.4, 2);
    const a = frame('drewno', 22, hill, 2.4, 2);
    frame('lod', 26, hill, 2.4, 2);
    const bridge = beam('drewno', 24, a, 6.4);
    frame('drewno', 24, bridge, 2.2, 1.6);
    egg('zwykly', 22, hill);
    egg('zwykly', 26, hill);
    egg('maly', 24, hill);
    egg('zwykly', 24, bridge);
  }),

  /* ---------- Rozdział 2: Kurnik o zmierzchu ---------- */
  level(6, 'Rakieta!', 1, ['rakieta', 'rakieta', 'kokoszka'], ({ blk, frame, egg }) => {
    [0, 1, 2, 3].forEach((i) => blk('drewno', 18, i, 1));
    const f1 = frame('drewno', 22, 0, 2.6, 2.2);
    frame('drewno', 22, f1, 2.6, 2.2);
    egg('zwykly', 22, 0);
    egg('zwykly', 22, f1);
    blk('drewno', 25.3, 0, 1);
    blk('drewno', 25.3, 1, 1);
    egg('zwykly', 26.6, 0);
  }),
  level(7, 'Kamienny mur', 1, ['bomba', 'kokoszka', 'rakieta'], ({ blk, beam, frame, col, egg }) => {
    blk('kamien', 21, 0, 1);
    blk('kamien', 23, 0, 1);
    const base = beam('kamien', 22, 1, 3, 0.4);
    egg('zwykly', 22, 0);
    const f = frame('drewno', 22, base, 2.6, 1.8);
    egg('zwykly', 22, base);
    const roof = beam('kamien', 22, f, 3, 0.4);
    egg('kask', 22, roof);
    const c = col('kamien', 25.8, 0, 3, 0.6);
    egg('maly', 25.8, c);
  }),
  level(8, 'Domino', 1, ['kokoszka', 'rakieta', 'pisklaki'], ({ col, plat, frame, egg }) => {
    [14.6, 16.2, 17.8, 19.4, 21].forEach((x) => col('drewno', x, 0, 3.2, 0.3));
    const ledge = plat(25.5, 0, 4.2, 1.5);
    const f = frame('lod', 25.5, ledge, 3.6, 1.8);
    egg('zwykly', 24.6, ledge);
    egg('zwykly', 26.4, ledge);
    egg('maly', 25.5, f);
  }),
  level(9, 'Wieża', 1, ['bomba', 'rakieta', 'kokoszka', 'pisklaki'], ({ frame, blk, egg }) => {
    const f1 = frame('kamien', 23, 0, 3, 2);
    egg('zwykly', 22.4, 0);
    egg('zwykly', 23.6, 0);
    const f2 = frame('drewno', 23, f1, 2.6, 2);
    egg('zwykly', 23, f1);
    const f3 = frame('lod', 23, f2, 2.2, 1.8);
    egg('maly', 23, f2);
    egg('kask', 23, f3);
    const s = blk('drewno', 27, 0, 1);
    const s2 = blk('drewno', 27, s, 1);
    egg('maly', 27, s2);
  }),
  level(10, 'Bunkier', 1, ['bomba', 'bomba', 'rakieta'], ({ col, beam, blk, egg }) => {
    col('kamien', 20.5, 0, 2.2, 0.5);
    col('kamien', 24.5, 0, 2.2, 0.5);
    const roof = beam('kamien', 22.5, 2.2, 5, 0.5);
    egg('kask', 21.7, 0);
    egg('kask', 23.3, 0);
    blk('kamien', 21.3, roof, 1);
    blk('kamien', 23.7, roof, 1);
    const top = beam('drewno', 22.5, roof + 1, 3.6);
    egg('maly', 22.5, roof);
    egg('zwykly', 22.5, top);
    const c = col('kamien', 27.8, 0, 1.5, 1);
    egg('zwykly', 27.8, c);
  }),

  /* ---------- Rozdział 3: Zamek Zgniłków ---------- */
  level(11, 'Nioska', 2, ['nioska', 'nioska', 'kokoszka'], ({ col, beam, blk, egg }) => {
    [18.5, 22.5, 26.5].forEach((x) => {
      col('drewno', x - 1, 0, 1.6);
      col('drewno', x + 1, 0, 1.6);
      beam('kamien', x, 1.6, 2.6, 0.35);
      blk('kamien', x - 1.55, 0, 0.6);
      blk('kamien', x - 1.55, 0.6, 0.6);
      egg('zwykly', x, 0);
    });
  }),
  level(12, 'Beczki z prochem', 2, ['kokoszka', 'rakieta', 'nioska'], ({ frame, tnt, blk, egg }) => {
    tnt(18.4, 0);
    const f1 = frame('drewno', 22.5, 0, 3, 2.2);
    egg('kask', 22.5, 0);
    const f2 = frame('drewno', 22.5, f1, 3, 2);
    tnt(21.8, f1);
    egg('zwykly', 23.2, f1);
    egg('kask', 22.5, f2);
    blk('kamien', 25.6, 0, 1);
    tnt(26.6, 0);
    egg('zwykly', 27.6, 0);
  }),
  level(13, 'Kogut wkracza', 2, ['kogut', 'bomba', 'pisklaki'], ({ col, beam, frame, blk, egg }) => {
    col('kamien', 19, 0, 3, 0.8);
    col('kamien', 21.5, 0, 3, 0.8);
    beam('kamien', 20.25, 3, 3.3, 0.5);
    egg('kask', 20.25, 0);
    const f = frame('drewno', 25.5, 0, 3, 2.5);
    egg('zwykly', 24.9, 0);
    egg('zwykly', 26.1, 0);
    const b = blk('kamien', 25.5, f, 1.2);
    egg('maly', 25.5, b);
  }),
  level(14, 'Mosty', 2, ['nioska', 'rakieta', 'bomba', 'pisklaki'], ({ plat, beam, frame, blk, egg }) => {
    const left = plat(19, 0, 3, 3);
    plat(28, 0, 3, 3);
    const bridge = beam('drewno', 23.5, left, 7);
    const f = frame('lod', 23.5, bridge, 4, 1.6);
    egg('zwykly', 22.6, bridge);
    egg('zwykly', 24.4, bridge);
    egg('maly', 23.5, f);
    blk('kamien', 22.2, 0, 1);
    blk('kamien', 24.8, 0, 1);
    egg('kask', 23.5, 0);
    frame('drewno', 18.8, left, 2.2, 1.8);
    egg('zwykly', 18.8, left);
    egg('zwykly', 28, left);
  }),
  level(15, 'Król Zgniłków', 2, ['kogut', 'bomba', 'nioska', 'rakieta', 'kokoszka'], ({ plat, frame, beam, blk, tnt, egg }) => {
    const base = plat(25, 0, 9, 1);
    const tower = frame('kamien', 21.8, base, 2.2, 3);
    frame('kamien', 28.2, base, 2.2, 3);
    egg('kask', 21.8, base);
    egg('kask', 28.2, base);
    frame('drewno', 25, base, 3.6, 2.2);
    tnt(24, base);
    egg('zwykly', 25.8, base);
    const deck = beam('drewno', 25, tower, 7.6);
    const throne = blk('kamien', 25, deck, 1.2);
    egg('krol', 25, throne);
    egg('maly', 22.6, deck);
    egg('maly', 27.6, deck);
    tnt(26.6, deck);
  }),
];
