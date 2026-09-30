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
| `sitemap.xml`, `og-image.png`, `favicon.*` | Mapa strony dla wyszukiwarek, obrazek podglądu linku, ikony |

Strona na GitHub Pages jest serwowana z gałęzi `gh-pages`.

Liczby na stronie to przybliżone średnie. Czas gotowania to wynik modelu fizycznego, więc pierwsze jajko warto sprawdzić łyżeczką.
