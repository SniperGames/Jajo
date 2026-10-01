# Przepisy od czytelników: podłączenie Firebase

Strona stoi na GitHub Pages, które serwuje tylko gotowe pliki. Przepisy od czytelników muszą się gdzieś zapisywać, dlatego korzystamy z darmowego planu Firebase (Google): baza Firestore i logowanie kontem Google. Karta płatnicza nie jest potrzebna.

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

## Koszty i limity

Darmowy plan Spark wystarcza z dużym zapasem: 1 GiB danych, 50 000 odczytów i 20 000 zapisów dziennie. Zdjęcia są zmniejszane w przeglądarce i zapisywane w bazie, więc płatny Cloud Storage nie jest potrzebny. Jeśli limit kiedyś się skończy, strona nie przestanie działać: do północy (czasu USA) nie wczytają się tylko przepisy od czytelników.
