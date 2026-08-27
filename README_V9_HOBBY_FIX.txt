PP AUTO – V9 Hobby-limit fix
=============================

Dôvod:
Vercel Hobby povoľuje maximálne 12 Serverless Functions. Aktuálny main ich má 15.

Riešenie:
- api/public-bootstrap.js sa ruší; jeho verejný bootstrap je presunutý do existujúceho api/orders.js ako GET /api/orders?mode=bootstrap
- api/public-promos.js sa ruší; fallback aktualít používa existujúce /api/promos
- api/order-options.js sa ruší; objednávkové možnosti sa vracajú v bootstrap payload-e

Výsledok:
15 -> 12 serverless functions.

Funkčnosť zachovaná:
- 1 verejný bootstrap request pre autá + objednávkové možnosti + aktuality
- 60 s sessionStorage cache
- Vercel/CDN cache bootstrapu
- normálny POST/GET/PUT/DELETE objednávok na /api/orders ostáva nezmenený
- admin endpointy ostávajú bez cache

APLIKOVANIE
1. Rozbaľ obsah patchu do rootu projektu a prepíš existujúce súbory.
2. Spusti:
   .\APPLY_V9_HOBBY_FIX.ps1
3. Potom staging/commit/push podľa príkazov, ktoré skript vypíše.

Súbory, ktoré sa MUSIA zmazať:
- api/order-options.js
- api/public-bootstrap.js
- api/public-promos.js

Testy:
- node --check upravených JS/API: PASS
- bootstrap payload: PASS
- hidden car/promo filter: PASS
- cache header: PASS
- admin GET auth: PASS
- POST objednávky + increment orderNumber: PASS
