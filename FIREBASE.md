# Przepisy od czytelników: podłączenie Firebase

Strona stoi na GitHub Pages, które serwuje tylko gotowe pliki. Przepisy od czytelników muszą się gdzieś zapisywać, dlatego korzystamy z darmowego planu Firebase (Google): baza Firestore i logowanie kontem Google albo e-mailem i hasłem. Karta płatnicza nie jest potrzebna.

Całość zajmuje około 10 minut. Nazwy w konsoli Firebase mogą być po angielsku, dlatego w nawiasach podaję też angielskie odpowiedniki.

## 1. Utwórz projekt

1. Wejdź na <https://console.firebase.google.com> i zaloguj się kontem Google.
2. Kliknij **Utwórz projekt** (*Create a project*), nazwij go np. `jajo`.
3. Google Analytics możesz wyłączyć. Kliknij **Utwórz projekt**.

## 2. Włącz logowanie przez Google

1. W menu po lewej: **Kompilacja → Authentication** (*Build → Authentication*) → **Rozpocznij** (*Get started*).
2. Zakładka **Metoda logowania** (*Sign-in method*) → **Google** → włącz przełącznik, wybierz swój adres e-mail pomocy → **Zapisz**.
3. Zakładka **Ustawienia** (*Settings*) → **Autoryzowane domeny** (*Authorized domains*) → **Dodaj domenę** → wpisz `snipergames.github.io`.

## 3. Utwórz bazę danych

1. **Kompilacja → Firestore Database** → **Utwórz bazę danych** (*Create database*).
2. Lokalizacja: **europe-central2 (Warszawa)**.
3. Tryb: **produkcyjny** (*production mode*) → **Utwórz**.

## 4. Wklej reguły bezpieczeństwa

1. W Firestore Database otwórz zakładkę **Reguły** (*Rules*).
2. Usuń wszystko, co tam jest, i wklej całą zawartość pliku [`firestore.rules`](firestore.rules).
3. Kliknij **Opublikuj** (*Publish*).

Reguły pilnują, żeby:
- każdy widział tylko zatwierdzone przepisy,
- nowy przepis zawsze czekał na moderację,
- nikt nie zmienił cudzego przepisu ani nie zatwierdził sam siebie,
- przepis bez jajek nie dał się zapisać,
- jedna osoba mogła wysłać najwyżej jeden przepis na 2 minuty.

## 5. Zarejestruj stronę jako aplikację

1. Kliknij koło zębate obok „Przegląd projektu” → **Ustawienia projektu** (*Project settings*).
2. Na dole, w sekcji **Twoje aplikacje** (*Your apps*), kliknij ikonę **`</>`** (Web).
3. Nazwa: `Jajo`. Hostingu Firebase **nie** zaznaczaj. Kliknij **Zarejestruj aplikację**.
4. Pojawi się kod z obiektem `firebaseConfig`, który wygląda mniej więcej tak:

   ```js
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "jajo-xxxx.firebaseapp.com",
     projectId: "jajo-xxxx",
     storageBucket: "jajo-xxxx.firebasestorage.app",
     messagingSenderId: "123…",
     appId: "1:123…:web:abc…"
   };
   ```

5. Skopiuj go i wklej w pliku [`firebase-config.js`](firebase-config.js) w miejsce `null`:

   ```js
   export default {
     apiKey: "AIza…",
     authDomain: "jajo-xxxx.firebaseapp.com",
     projectId: "jajo-xxxx",
     storageBucket: "jajo-xxxx.firebasestorage.app",
     messagingSenderId: "123…",
     appId: "1:123…:web:abc…"
   };
   ```

   Te dane nie są tajne i mogą być publiczne. Bazę chronią reguły z kroku 4.

## 6. Zostań moderatorem

1. Otwórz <https://snipergames.github.io/Jajo/moderacja.html> i zaloguj się.
2. Strona pokaże Twój identyfikator. Skopiuj go.
3. W konsoli Firebase: **Firestore Database → Dane** (*Data*) → **Rozpocznij kolekcję** (*Start collection*).
4. ID kolekcji: `admins`. ID dokumentu: wklej swój identyfikator. Dodaj pole `rola` (typ string) z wartością `admin`. Zapisz.
5. Odśwież stronę moderacji. Zobaczysz przepisy czekające na akceptację.

Kolejnego moderatora dodasz tak samo: poproś go o identyfikator ze strony moderacji i dopisz dokument w kolekcji `admins`.

## 7. Polubienia, komentarze i profile

Te funkcje potrzebują dwóch dodatkowych ustawień. Dopóki ich nie ma, strona działa jak wcześniej, tylko bez przycisku „Smakuje mi”, komentarzy i profili.

1. **Logowanie gości.** **Authentication → Sign-in method → Add new provider → Anonymous** → włącz → **Save**. Dzięki temu niezalogowani mogą polubić przepis i napisać komentarz. Strona nadaje im w tle niewidoczny identyfikator, więc jedna osoba polubi przepis tylko raz.
2. **Nowe reguły.** **Firestore Database → Reguły**: usuń wszystko, wklej aktualną zawartość pliku [`firestore.rules`](firestore.rules) i kliknij **Opublikuj**.

Co pilnują nowe reguły:
- licznik polubień zmienia się zawsze o jeden i tylko razem z polubieniem, więc nie da się go podkręcić,
- gość podpisuje komentarz jako „Niezalogowany użytkownik” i nie może wstawiać linków,
- każdy może napisać najwyżej jeden komentarz na 30 sekund,
- komentarz usuwa jego autor albo moderator, a nikt go nie edytuje,
- profil zakłada i zmienia tylko jego właściciel (konto Google albo e-mail z potwierdzonym adresem), a goście nie mają profili ani nie dodają przepisów.

Komentarze pojawiają się od razu. Niestosowne usuniesz w panelu moderacji, w zakładce **Komentarze**.

## 8. Zdjęcia profilowe i banery

Wystarczy jeszcze raz wkleić reguły: **Firestore Database → Reguły**, usuń wszystko, wklej aktualną zawartość pliku [`firestore.rules`](firestore.rules) i kliknij **Opublikuj**. Dopóki tego nie zrobisz, profile działają jak wcześniej, tylko bez wyboru zdjęcia i banera.

W **Edytuj profil** każdy zalogowany wybiera jedno z gotowych zdjęć (folder `img/awatary/`) i banerów (`img/banery/`) albo wgrywa własne. Własne zdjęcie strona zmniejsza w przeglądarce: zdjęcie profilowe do 320 px, baner do 1500 px w proporcji 3:1. Trafiają one do kolekcji `awatary` i `banery`.

Co pilnują reguły:
- własne zdjęcie zapisuje i zmienia tylko jego właściciel, a usuwa właściciel albo moderator,
- zapisać można tylko obrazek JPG, PNG albo WebP i nie większy niż ok. 45 KB (zdjęcie profilowe) albo 260 KB (baner),
- w profilu można wskazać tylko gotowy obrazek ze strony albo własne zdjęcie, a nie dowolny adres z internetu.

Niestosowne zdjęcie usuniesz, wchodząc jako moderator w profil tej osoby: nad profilem są przyciski **Usuń zdjęcie profilowe** i **Usuń baner**.

## 9. Logowanie e-mailem i hasłem

Kolejność ma znaczenie: najpierw reguły, potem włączenie logowania.

1. **Nowe reguły.** **Firestore Database → Reguły**: usuń wszystko, wklej aktualną zawartość pliku [`firestore.rules`](firestore.rules) i kliknij **Opublikuj**. Nowe reguły traktują konto e-mail z niepotwierdzonym adresem jak gościa. Stare reguły uznałyby je za pełne konto.
2. **Włącz logowanie.** **Authentication → Metoda logowania** (*Sign-in method*) → **Dodaj nowego dostawcę** (*Add new provider*) → **E-mail/hasło** (*Email/Password*). Włącz pierwszy przełącznik (*Email/Password*). Drugiego (*Email link (passwordless sign-in)*) nie włączaj. Kliknij **Zapisz**.
3. **Nazwa w e-mailach** (warto sprawdzić). Wiadomości z linkami są podpisane nazwą projektu. Jeśli widać w nich coś w rodzaju „project-287547519251”, wejdź w **Ustawienia projektu** (koło zębate) → **Ogólne** (*General*) → **Nazwa publiczna** (*Public-facing name*) i wpisz „Jajo”.

Jak to działa na stronie:
- w oknie logowania jest przycisk Google, a pod nim zakładki **Mam konto** i **Nowe konto**,
- przy zakładaniu konta podaje się imię lub pseudonim, e-mail i hasło (co najmniej 8 znaków), a strona wysyła link potwierdzający adres,
- do czasu kliknięcia linku konto działa jak gość: może polubić przepis i komentować jako „Niezalogowany użytkownik”, ale nie doda przepisu i nie ma profilu. Po kliknięciu linku i powrocie na stronę konto samo staje się pełne,
- „Nie pamiętam hasła” w oknie logowania i „Zmień hasło” w profilu wysyłają link do ustawienia nowego hasła.

Wiadomości przychodzą z adresu `noreply@jajo-85b16.firebaseapp.com` i czasem trafiają do spamu. Strona prosi Firebase o polskie wersje wiadomości. Ich treść możesz zmienić w **Authentication → Szablony** (*Templates*).

## 10. Ulubione przepisy

Wystarczy jeszcze raz wkleić reguły: **Firestore Database → Reguły**, usuń wszystko, wklej aktualną zawartość pliku [`firestore.rules`](firestore.rules) i kliknij **Opublikuj**.

Serduszko „Ulubione” działa od razu, także bez logowania. Ulubione niezalogowanych zostają w pamięci przeglądarki. Zalogowanym strona zapisuje je na koncie (kolekcja `ulubione`), więc widzą je na każdym urządzeniu. Przy logowaniu ulubione z przeglądarki przechodzą na konto. Dopóki nie wkleisz nowych reguł, także zalogowani mają ulubione tylko w przeglądarce.

Listę ulubionych widzi i zmienia tylko jej właściciel, a jedna osoba może mieć najwyżej 300 ulubionych przepisów.

## 11. Forum

Wystarczy jeszcze raz wkleić reguły: **Firestore Database → Reguły**, usuń wszystko, wklej aktualną zawartość pliku [`firestore.rules`](firestore.rules) i kliknij **Opublikuj**. Dopóki tego nie zrobisz, strona `forum.html` pokazuje napis „Forum ruszy wkrótce”. Żadnych indeksów nie trzeba zakładać.

Kto co może:
- czytać forum może każdy, także bez logowania,
- wątki zakładają i odpisują zalogowani (kontem Google albo e-mailem z potwierdzonym adresem),
- przy zakładaniu wątku wybiera się od 1 do 3 tagów z listy (Pytanie, Gotowanie jajek, Przepisy, Wypieki i desery, Zdrowie i dieta, Kury i hodowla, Zakupy i przechowywanie, Pochwal się, Inne). Po tagach i słowach z tytułu i treści można wątki filtrować i wyszukiwać,
- autor poprawia swój wątek, zamyka go (wtedy nikt już nie odpisze) i otwiera ponownie. Usunąć wątek może, dopóki nikt nie odpisał,
- każdy poprawia i usuwa swoje odpowiedzi. Po usuniętej zostaje napis „Odpowiedź usunięta”,
- jeden wątek na 2 minuty i jedna odpowiedź na 15 sekund na osobę (ochrona przed spamem).

Moderator (ten sam co od przepisów, z kolekcji `admins`) widzi w każdym wątku przyciski **Przypnij na górze**, **Zamknij wątek** i **Usuń wątek** (razem z odpowiedziami), a przy każdej odpowiedzi **Usuń**. Wątki są w kolekcji `watki`, a odpowiedzi w podkolekcji `odpowiedzi` każdego wątku.

## 12. Gry i tablice wyników

Wystarczy jeszcze raz wkleić reguły: **Firestore Database → Reguły**, usuń wszystko, wklej aktualną zawartość pliku [`firestore.rules`](firestore.rules) i kliknij **Opublikuj**. Gry na stronie `gry.html` działają też bez tego, ale wtedy rekordy zapisują się tylko na danym urządzeniu, a zamiast tablic wyników jest napis „Tablice wyników ruszą wkrótce”.

Jak to działa:
- grać może każdy, także bez logowania. Rekord zapisuje się wtedy w przeglądarce,
- zalogowany (kontem Google albo e-mailem z potwierdzonym adresem) trafia na tablicę danej gry ze swoim najlepszym wynikiem i widzi swoje miejsce,
- tablica pokazuje 10 najlepszych, a w profilu każdej osoby widać jej rekordy.

Jak reguły utrudniają oszukiwanie (gra działa w przeglądarce, więc w 100% się nie da, ale wpisanie wyniku z konsoli nic nie da):
- na początku każdej gry serwer zapisuje godzinę startu (kolekcja `sesje_gier`). Wynik musi przyjść razem z zamknięciem tej sesji, więc jedna gra daje jeden wpis,
- wynik nie może przyjść szybciej, niż da się go zdobyć: w Łap jajka najwyżej 10 punktów na sekundę, w Locie kurczaka 2 punkty na sekundę, w Jajo 2048 około 330 punktów na sekundę, a Pary pisanek trwają co najmniej 8 sekund,
- każda gra ma górny limit punktów (Łap jajka 5000, Lot kurczaka 2000, Jajo 2048 1 000 000, Pary pisanek 3000),
- zapisuje się tylko wynik lepszy od poprzedniego.

Moderator widzi przy każdym wyniku na tablicy przycisk **×**, którym usuwa podejrzane wyniki. Tablice są w kolekcji `wyniki`, osobno dla każdej gry (`wyniki/{gra}/gracze`).

## 13. Kury z procy (postęp poziomów)

Znowu wystarczy wkleić reguły: **Firestore Database → Reguły**, usuń wszystko, wklej aktualną zawartość pliku [`firestore.rules`](firestore.rules) i kliknij **Opublikuj**. Gra `procy.html` działa też bez tego, ale postęp zapisuje się wtedy tylko w przeglądarce, a zamiast tablicy jest napis „Tablica wyników ruszy wkrótce”.

Jak to działa:
- przejście poziomu odblokowuje następny. Gwiazdki i najlepszy wynik każdego poziomu zapisują się od razu w przeglądarce, więc po powrocie gra się od miejsca, w którym się skończyło,
- po zalogowaniu postęp z przeglądarki łączy się z kontem (z każdego poziomu brany jest lepszy wynik) i zapisuje w kolekcji `procy`, jeden dokument na osobę. Na innym urządzeniu po zalogowaniu poziomy są już odblokowane,
- tablica wyników liczy sumę punktów ze wszystkich poziomów, a w profilu widać gwiazdki i punkty.

Reguły pilnują, żeby zapis był rozsądny: najwyżej 3 gwiazdki i 150 000 punktów na poziom, suma nie może spaść, a kolejny zapis może przyjść najwcześniej po 5 sekundach. Moderator usuwa podejrzane wyniki przyciskiem **×** na tablicy.

## Koszty i limity

Darmowy plan Spark wystarcza z dużym zapasem: 1 GiB danych, 50 000 odczytów i 20 000 zapisów dziennie. Jedno wejście na stronę z przepisami to kilkadziesiąt odczytów (liczniki polubień i przepisy czytelników). Zdjęcia są zmniejszane w przeglądarce i zapisywane w bazie, więc płatny Cloud Storage nie jest potrzebny. Jeśli limit kiedyś się skończy, strona nie przestanie działać: do północy (czasu USA) nie wczytają się tylko przepisy od czytelników.
