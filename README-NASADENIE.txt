PP AUTO – právne dokumenty a cookie lišta
Posledná aktualizácia balíka: 4. máj 2026

Obsah balíka
------------
1. gdpr.html
   - hlavný dokument „Ochrana osobných údajov“.

2. cookies.html
   - samostatné zásady používania cookies.

3. podmienky-pouzivania.html
   - náhrada za nepresné „VOP“ pri webe, ktorý nie je e-shop.
   - ide o podmienky používania webovej stránky, nie obchodné podmienky online predaja.

4. css/legal.css
   - štýly právnych stránok.

5. css/cookie-consent.css
   - štýly cookie lišty.

6. js/cookie-consent.js
   - cookie lišta, nastavenia cookies, Google Consent Mode default denied,
     voliteľné načítanie Google Analytics a Google Maps iba po súhlase.

7. snippets/
   - hotové HTML bloky na vloženie do existujúcich stránok.

Ako nasadiť
-----------
1. Skopíruj súbory:
   - gdpr.html, cookies.html, podmienky-pouzivania.html do koreňa webu.
   - css/legal.css a css/cookie-consent.css do priečinka css/.
   - js/cookie-consent.js do priečinka js/.

2. Na verejné stránky vlož:
   Do <head>:
   <link rel="stylesheet" href="css/cookie-consent.css">

   Pred </body>:
   <script src="js/cookie-consent.js"></script>

3. V pätičke nahraď aktuálne prázdne odkazy na dokumenty obsahom zo súboru:
   snippets/footer-dokumenty-snippet.html

4. Google Maps iframe v index.html nahraď obsahom zo súboru:
   snippets/google-map-consent-snippet.html
   Dôvod: aktuálny iframe sa načítava hneď pri otvorení stránky. Pre správny consent režim musí byť src presunuté do data-src.

5. Do formulárov vlož informačný checkbox zo súboru:
   snippets/formular-privacy-notice-snippet.html

Google Analytics
----------------
V nahraných súboroch som nenašiel konkrétne GA4 Measurement ID. V súbore js/cookie-consent.js je preto placeholder:
const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';

Ak Google Analytics na produkcii používaš, nahraď ho reálnym ID, napr. G-ABC123XYZ.
Ak máš v index.html alebo inde natvrdo vložený starý Google Analytics/gtag script, odstráň ho. Analytika sa má načítať cez js/cookie-consent.js až po súhlase.

Formuláre a EmailJS
-------------------
Web používa EmailJS pre kontaktný formulár a testovaciu jazdu. Táto služba je popísaná v gdpr.html.
Pri formulároch je vhodnejší text „Beriem na vedomie spracúvanie…“ než „Súhlasím so spracúvaním…“, pretože vybavenie dopytu/testovacej jazdy je typicky predzmluvná komunikácia, nie marketingový súhlas.

Čo ešte skontrolovať pred publikovaním
--------------------------------------
- či e-mail pre ochranu údajov má byť sulak@ppauto.sk alebo predaj@ppauto.sk,
- či na stránke existuje ďalší marketingový nástroj, napr. Meta Pixel,
- či je uzatvorená alebo akceptovaná DPA/zmluva o spracúvaní údajov s EmailJS, Vercel, Google a prípadne ďalšími poskytovateľmi,
- či reálna doba uchovávania e-mailových dopytov zodpovedá textu v gdpr.html,
- či Google Maps iframe je skutočne zablokovaný bez súhlasu.

Poznámka
--------
Balík je pripravený ako praktický webový podklad podľa informácií o PP AUTO a aktuálneho technického stavu nahraných súborov. Pred ostrým použitím pri komerčnom webe je rozumné dať text skontrolovať osobe zodpovednej za právnu/GDPR agendu firmy.
