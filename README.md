# Jajo

**Strona: [snipergames.github.io/Jajo](https://snipergames.github.io/Jajo/)**

Interaktywny przewodnik po jajku kurzym: ile gotować jajko na miękko i na twardo, co oznacza kod na jajku i jak sprawdzić, czy jajko jest świeże. Statyczna strona bez żadnego procesu budowania: sam HTML, CSS i JavaScript.

## Co jest na stronie

- **Jajko w nagłówku**: litera „o” w słowie „Jajo” to jajko. Stuknij je cztery razy, a się wykluje.
- **Minutnik**: liczy czas gotowania ze wzoru fizyka Charlesa Williamsa (Uniwersytet w Exeter). Uwzględnia rozmiar jajka (S, M, L, XL), temperaturę startową, wysokość nad poziomem morza (od Gdańska po Rysy) i to, jak ścięte ma być żółtko. Odlicza czas i daje sygnał dźwiękowy na koniec.
- **Przekrój jajka**: osiem części, od skorupki po tarczkę zarodkową, z podświetlaniem.
- **Skala**: jaja kolibra, przepiórki, kury, kaczki, gęsi, emu i strusia narysowane w tej samej skali. Opcjonalnie z jajem wymarłego mamutaka.
- **Dekoder kodu ze skorupki**: wpisz kod typu `1-PL-30241301`, a strona powie, jak żyła kura, z jakiego kraju jest jajo i z którego województwa pochodzi.
- **Test szklanki wody**: suwak postarza jajko i pokazuje, jak zachowuje się w wodzie.
- **Przepisy z jajkiem** (`przepisy.html`): dwanaście przepisów ze zdjęciami. Wytłaczanka pokazuje, na ile porcji wystarczą Twoje jajka, a w każdym przepisie można przeliczyć porcje, odhaczać składniki i kroki oraz włączać minutniki.
- **Przepisy od czytelników**: zalogowani (kontem Google albo e-mailem i hasłem) mogą dodawać własne przepisy z jajkami (ze zdjęciem). Przepis pojawia się po akceptacji w panelu `moderacja.html`. Działa na darmowym Firebase, instrukcja podłączenia w [FIREBASE.md](FIREBASE.md).
- **Polubienia, komentarze i profile**: przycisk „Smakuje mi” przy każdym przepisie i komentarze pod nim, także bez logowania (jako „Niezalogowany użytkownik”). Każdy zalogowany ma publiczny profil (`profil.html`) ze swoimi przepisami, liczbą polubień i komentarzy oraz ulubionym jajkiem.
- **Ulubione**: serduszko na każdym przepisie i filtr „Ulubione” nad listą (adres `przepisy.html#ulubione`). Bez logowania ulubione zostają w przeglądarce, po zalogowaniu są na koncie.
- **Forum** (`forum.html`): wątki z tagami, wyszukiwarka, odpowiedzi na żywo, zamykanie wątków przez autora i moderacja. Czytać może każdy, a pisać zalogowani. Wątki autora widać też w jego profilu.
- **Gry z jajem** (`gry.html`): Łap jajka, Lot kurczaka, Jajo 2048 i Pary pisanek. Działają myszą, klawiaturą i palcem. Zalogowani trafiają na tablice wyników z miejscami, a reguły bazy sprawdzają, czy wynik dało się zdobyć w takim czasie.
- **Kury z procy** (`procy.html`): gra w stylu Angry Birds. Kury wystrzelone z procy rozbijają twierdze zgniłych jajek z drewna, lodu i kamienia. 15 poziomów w trzech rozdziałach, sześć kur z mocami (rozdzielanie się, przyspieszenie, wybuch, zrzut jajka, ciężki kogut), gwiazdki za wynik. Postęp zapisuje się w przeglądarce, a po zalogowaniu na koncie, z tablicą sumy punktów. Fizyka to [planck.js](https://github.com/piqnt/planck.js) (licencja MIT).
- **Zdjęcie profilowe i baner**: osiem gotowych zdjęć i sześć banerów do wyboru albo własne zdjęcia. Zdjęcie widać w profilu, przy komentarzach i w ikonie konta.

Strona ma jasny i ciemny motyw, działa na telefonie i szanuje ustawienie „ogranicz ruch”.

## Uruchomienie

Wystarczy otworzyć `index.html` w przeglądarce. Można też postawić lokalny serwer:

```bash
python3 -m http.server 8000
```

i wejść na <http://localhost:8000>.

## Publikacja na GitHub Pages

W ustawieniach repozytorium: **Settings → Pages → Build and deployment**, źródło **Deploy from a branch**, gałąź z plikiem `index.html` i folder `/ (root)`.

## Pliki

| Plik         | Zawartość                                   |
| ------------ | ------------------------------------------- |
| `index.html` | Treść i ilustracje SVG                      |
| `style.css`  | Wygląd, motywy jasny i ciemny, układ        |
| `script.js`  | Minutnik, dekoder, wykres skali, animacje   |
| `przepisy.html`, `przepisy.js` | Strona z przepisami i jej interakcje |
| `przepisy-dane.js` | Treść przepisów |
| `spolecznosc.js`, `moderacja.html`, `moderacja.js`, `jajo-firebase.js` | Przepisy od czytelników i panel moderacji |
| `reakcje.js`, `profil.html`, `profil.js` | Polubienia, komentarze i profile |
| `konto.js` | Ikona konta w prawym górnym rogu: logowanie, profil, wylogowanie |
| `logowanie.js` | Okno logowania: Google albo e-mail i hasło, zakładanie konta, nowe hasło |
| `ulubione.js` | Ulubione przepisy na koncie zalogowanego |
| `forum.html`, `forum.js` | Forum: wątki, tagi, odpowiedzi i moderacja |
| `gry.html`, `gry.js`, `gry/` | Gry z jajem i tablice wyników (każda gra w osobnym pliku w `gry/`) |
| `procy.html`, `procy.js`, `gry/procy/` | Kury z procy: fizyka i moce kur (`swiat.js`), poziomy (`poziomy.js`), rysunki (`rysunki.js`), sterowanie (`gra.js`) |
| `gry/lib/planck.min.mjs` | Silnik fizyki planck.js 1.5.0 (MIT) |
| `firebase-config.js`, `firestore.rules` | Konfiguracja Firebase i reguły bezpieczeństwa bazy |
| `img/przepisy/` | Zdjęcia potraw (Wikimedia Commons, autorzy podani na stronie) |
| `img/awatary/`, `img/banery/` | Gotowe zdjęcia profilowe i banery |
| `sitemap.xml`, `og-image.png`, `favicon.*` | Mapa strony dla wyszukiwarek, obrazek podglądu linku, ikony |

Strona na GitHub Pages jest serwowana z gałęzi `gh-pages`.

Liczby na stronie to przybliżone średnie. Czas gotowania to wynik modelu fizycznego, więc pierwsze jajko warto sprawdzić łyżeczką.

## Jak dodać przepis

1. Wrzuć zdjęcie do `img/przepisy/` (najlepiej ok. 960 px szerokości).
2. W `przepisy-dane.js` skopiuj jeden przepis i zmień jego pola. Opis każdego pola jest na górze pliku.
3. Jajka oznacz w składnikach polem `egg` (`'whole'`, `'yolk'` albo `'white'`), żeby wytłaczanka i licznik jajek je policzyły.
4. Jeśli zdjęcie nie jest Twoje, podaj autora i licencję w polu `photo`. Strona sama doda podpis.
