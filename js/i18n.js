(function () {
  'use strict';

  const STORAGE_KEY = 'ppauto.lang';
  const SUPPORTED = new Set(['sk', 'en']);
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

  const normalize = (value) =>
    String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const translations = {
    'PP AUTO s.r.o. - Subaru • KGM • Jeep | Poprad': 'PP AUTO s.r.o. - Subaru • KGM • Jeep | Poprad',
    'PP AUTO s.r.o. - Subaru • KGM • Jeep • Chery | Poprad': 'PP AUTO s.r.o. - Subaru • KGM • Jeep • Chery | Poprad',
    'Vyber značku • PP AUTO': 'Choose a Brand • PP AUTO',
    'Vyberte značku | PP AUTO Poprad - Subaru, KGM, Jeep': 'Choose a Brand | PP AUTO Poprad - Subaru, KGM, Jeep',
    'Vyberte značku | PP AUTO Poprad - Subaru, KGM, Jeep, Chery': 'Choose a Brand | PP AUTO Poprad - Subaru, KGM, Jeep, Chery',
    'Detail vozidla | PP AUTO s.r.o.': 'Vehicle Detail | PP AUTO s.r.o.',
    'Autorizovaný predaj a servis Subaru, KGM a Jeep v Poprade. Skladové vozidlá, testovacie jazdy, financovanie, servis a náhradné diely.': 'Authorized Subaru, KGM and Jeep sales and service in Poprad. Stock vehicles, test drives, financing, service and genuine parts.',
    'Autorizovaný predaj a servis Subaru, KGM, Jeep a Chery v Poprade. Skladové vozidlá, testovacie jazdy, financovanie, servis a náhradné diely.': 'Authorized Subaru, KGM, Jeep and Chery sales and service in Poprad. Stock vehicles, test drives, financing, service and genuine parts.',
    'Vyberte si značku vozidiel v PP AUTO Poprad. Autorizovaný predaj a servis Subaru, KGM a Jeep, skladové vozidlá a testovacie jazdy.': 'Choose a vehicle brand at PP AUTO Poprad. Authorized Subaru, KGM and Jeep sales and service, stock vehicles and test drives.',
    'Vyberte si značku vozidiel v PP AUTO Poprad. Autorizovaný predaj a servis Subaru, KGM, Jeep a Chery, skladové vozidlá a testovacie jazdy.': 'Choose a vehicle brand at PP AUTO Poprad. Authorized Subaru, KGM, Jeep and Chery sales and service, stock vehicles and test drives.',
    'Detail vozidla z ponuky PP AUTO s.r.o. – Subaru • KGM • Jeep | Poprad': 'Vehicle detail from the PP AUTO s.r.o. offer - Subaru • KGM • Jeep | Poprad',
    'Detail vozidla z ponuky PP AUTO s.r.o. – Subaru • KGM • Jeep • Chery | Poprad': 'Vehicle detail from the PP AUTO s.r.o. offer - Subaru • KGM • Jeep • Chery | Poprad',

    'Ponuka áut': 'Vehicle Offer',
    'Servis': 'Service',
    'Financovanie': 'Financing',
    'Značky': 'Brands',
    'Tím': 'Team',
    'Kontakt': 'Contact',
    'Zmeniť značku': 'Change Brand',
    'Prihlásiť sa': 'Sign In',
    'Otvoriť menu': 'Open Menu',
    'Prepnúť jazyk': 'Switch Language',
    'Od roku 2011 prinášame v Poprade profesionálne služby pri predaji a servise vozidiel. Pomôžeme s výberom, financovaním aj poistením a postaráme sa o vaše auto počas celej životnosti.': 'Since 2011, we have been providing professional vehicle sales and service in Poprad. We help you choose the right car, arrange financing and insurance, and take care of your vehicle throughout its entire lifetime.',
    'Nové aj skladové vozidlá.': 'New and stock vehicles.',
    'Férové podmienky.': 'Fair terms.',
    'Servis, ktorému veríte.': 'Service you can trust.',
    'Od roku 2011 prinášame v Poprade profesionálne služby pri predaji a servise vozidiel. Pomôžeme s': 'Since 2011, we have provided professional vehicle sales and service in Poprad. We help with',
    'výberom, financovaním aj poistením a postaráme sa o': 'selection, financing and insurance, and we take care of',
    'vaše auto počas celej životnosti.': 'your vehicle throughout its entire life.',
    'Pozrieť skladové vozidlá': 'View Stock Vehicles',
    'Objednať servis': 'Book Service',
    'Značky a demo jazdy': 'Brands and Demo Drives',
    'Subaru a demo jazdy': 'Subaru and Demo Drives',
    'KGM a demo jazdy': 'KGM and Demo Drives',
    'Jeep a demo jazdy': 'Jeep and Demo Drives',
    'Chery a demo jazdy': 'Chery and Demo Drives',
    'Skladom': 'In Stock',
    'Expresný odber': 'Fast Delivery',
    'Vybrané modely ihneď k odberu – pripravíme na prihlásenie.': 'Selected models are ready for immediate delivery - we will prepare them for registration.',
    'Originálne diely': 'Genuine Parts',
    'Diagnostika, záruka, pozáručný servis a sezónne prehliadky.': 'Diagnostics, warranty, post-warranty service and seasonal inspections.',
    'Leasing & poistenie': 'Leasing & Insurance',
    'Transparentné mesačné splátky na mieru vašemu rozpočtu.': 'Transparent monthly payments tailored to your budget.',
    'Rezervujte si termín': 'Reserve a Time',
    'Zažite Subaru, KGM alebo Jeep naživo na cestách.': 'Experience Subaru, KGM or Jeep on the road.',
    'Zažite Subaru, KGM, Jeep alebo Chery naživo na cestách.': 'Experience Subaru, KGM, Jeep or Chery on the road.',
    'Zažite Subaru naživo na cestách.': 'Experience Subaru on the road.',
    'Zažite KGM naživo na cestách.': 'Experience KGM on the road.',
    'Zažite Jeep naživo na cestách.': 'Experience Jeep on the road.',
    'Zažite Chery naživo na cestách.': 'Experience Chery on the road.',
    'Aktuálne ponuky': 'Current Offers',
    'Ovládanie slidera': 'Slider Controls',
    'Predchádzajúci': 'Previous',
    'Ďalší': 'Next',
    'Modely áut': 'Car Models',
    'Aktuálna ponuka áut': 'Current Vehicle Offers',
    'Všetko': 'All',
    'Novinky': 'New Arrivals',
    'Predvádzacie': 'Demo Vehicles',
    'Predvádzacie vozidlo': 'Demo Vehicle',

    'Financovanie a poistenie bez stresu': 'Stress-Free Financing and Insurance',
    'Vyberieme vhodnú formu financovania, nastavíme akontáciu a splátky, pripravíme poistenie a vybavíme administratívu. Všetko zrozumiteľne a bez skrytých poplatkov.': 'We will choose the right financing option, set the down payment and installments, prepare insurance and handle the paperwork. Everything is clear, with no hidden fees.',
    'Úver': 'Loan',
    'Finančný leasing': 'Finance Lease',
    'Operatívny leasing': 'Operating Lease',
    'PZP + havarijné': 'Liability + Comprehensive Insurance',
    'GAP / pripoistenia': 'GAP / Add-On Insurance',
    'Ponuka na mieru': 'Tailored Offer',
    'Zohľadníme cenu vozidla, akontáciu, dobu splácania a vaše preferencie.': 'We take the vehicle price, down payment, repayment period and your preferences into account.',
    'Rýchle schválenie': 'Fast Approval',
    'Väčšinu dopytov vyriešime v ten istý deň (podľa partnera).': 'Most requests are handled the same day, depending on the financing partner.',
    'Poistenie a prepis': 'Insurance and Registration',
    'Pomôžeme s PZP/havarijným a papiermi, aby ste odchádzali pripravení.': 'We help with liability/comprehensive insurance and paperwork so you leave ready.',
    'Možnosti financovania': 'Financing Options',
    'Najčastejšie riešenia pre nové aj jazdené vozidlá.': 'The most common solutions for new and used vehicles.',
    'Vozidlo je vaše, splácate dohodnutú sumu. Flexibilná akontácia a doba splácania.': 'The vehicle is yours while you repay the agreed amount. Flexible down payment and repayment period.',
    'Vhodné pri podnikaní aj súkromne. Nastavíme splátky a odkúpenie po skončení.': 'Suitable for business and private use. We set installments and the buyout after the term.',
    'Jazdíte, platíte mesačný paušál. Po skončení vozidlo vrátite alebo vymeníte.': 'You drive and pay a monthly fee. At the end, you return or replace the vehicle.',
    'Poistenie': 'Insurance',
    'PZP, havarijné, GAP a pripoistenia. Porovnáme varianty a nastavíme krytie.': 'Liability, comprehensive, GAP and add-on insurance. We compare options and set the right cover.',
    'Ako to prebieha': 'How It Works',
    'Jednoduchý proces od dopytu po odovzdanie vozidla.': 'A simple process from inquiry to vehicle handover.',
    'Vyberiete vozidlo': 'Choose a Vehicle',
    'Vyberiete si auto z ponuky alebo si dohodnete konfiguráciu.': 'Choose a vehicle from stock or agree on a configuration.',
    'Spoločné nastavenie splátok': 'Set the Payments Together',
    'Akontácia, doba splácania, prípadne poistenie. Vysvetlíme rozdiely.': 'Down payment, repayment period and optional insurance. We explain the differences.',
    'Schválenie': 'Approval',
    'Vyplníme podklady a odošleme žiadosť na schválenie k partnerovi.': 'We complete the documents and send the application to the partner for approval.',
    'Podpis a odovzdanie': 'Signing and Handover',
    'Podpis zmlúv, poistka, prepis a odovzdanie pripraveného vozidla.': 'Contract signing, insurance, registration and handover of the prepared vehicle.',
    'Orientačná kalkulačka splátok': 'Indicative Payment Calculator',
    'Výpočet je informatívny. Presnú ponuku pripravíme podľa vozidla a partnera.': 'The calculation is informative. We prepare the final offer according to the vehicle and partner.',
    'Cena vozidla (€)': 'Vehicle Price (€)',
    'Akontácia (€)': 'Down Payment (€)',
    'Doba splácania (mesiace)': 'Repayment Period (months)',
    'Úrok p.a. (%)': 'Interest p.a. (%)',
    'Orientačná mesačná splátka': 'Estimated Monthly Payment',
    'Financovaná suma': 'Financed Amount',
    'Celkom zaplatíte': 'Total Amount Paid',
    'Čo si pripraviť': 'What to Prepare',
    'Základné dokumenty pre rýchle vybavenie (môže sa líšiť podľa typu financovania).': 'Basic documents for faster processing. Requirements may vary by financing type.',
    'Fyzická osoba': 'Private Person',
    'Občiansky preukaz (príp. 2. doklad)': 'ID card, or a second document if required',
    'Potvrdenie o príjme / výpisy (podľa partnera)': 'Income confirmation / statements, depending on the partner',
    'Kontaktné údaje + adresa': 'Contact details + address',
    'Firma / SZČO': 'Company / Sole Trader',
    'IČO, údaje spoločnosti': 'Company ID and company details',
    'Daňové priznanie / výkazy (podľa partnera)': 'Tax return / statements, depending on the partner',
    'Podpisové práva a splnomocnenia': 'Signing authority and authorizations',
    'Chcete ponuku na mieru?': 'Want a Tailored Offer?',
    'Napíšte nám základné údaje. Ozveme sa s návrhom financovania a poistenia.': 'Send us the basic details. We will get back to you with a financing and insurance proposal.',
    'Zavolať predaj': 'Call Sales',
    'Kontakt formulár': 'Contact Form',
    'Predaj': 'Sales',
    'Otváracie hodiny': 'Opening Hours',
    'Po–Pia · 8:00–17:00': 'Mon-Fri · 8:00-17:00',
    'Rýchly dopyt': 'Quick Inquiry',
    'Beriem na vedomie, že PP AUTO s.r.o. spracúva moje údaje za účelom vybavenia dopytu na financovanie. Viac informácií nájdete v dokumente': 'I acknowledge that PP AUTO s.r.o. processes my data to handle this financing inquiry. More information is available in',
    'Ochrana osobných údajov': 'Privacy Policy',
    'Odoslať dopyt': 'Send Inquiry',
    'Poznámka': 'Note',
    'Financovanie je predmetom schválenia financujúcou spoločnosťou. Podmienky sa môžu líšiť podľa produktu.': 'Financing is subject to approval by the financing company. Terms may vary by product.',

    'Servis PP AUTO, ktorému veríte': 'PP AUTO Service You Can Trust',
    'Profesionálna starostlivosť pre Subaru, KGM a Jeep. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.': 'Professional care for Subaru, KGM and Jeep. Genuine parts, modern diagnostics, facilities and processes that protect the value of your vehicle.',
    'Profesionálna starostlivosť pre Subaru, KGM, Jeep a Chery. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.': 'Professional care for Subaru, KGM, Jeep and Chery. Genuine parts, modern diagnostics, facilities and processes that protect the value of your vehicle.',
    'Profesionálna starostlivosť pre Subaru. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.': 'Professional care for Subaru. Genuine parts, modern diagnostics, facilities and processes that protect the value of your vehicle.',
    'Profesionálna starostlivosť pre KGM. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.': 'Professional care for KGM. Genuine parts, modern diagnostics, facilities and processes that protect the value of your vehicle.',
    'Profesionálna starostlivosť pre Jeep. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.': 'Professional care for Jeep. Genuine parts, modern diagnostics, facilities and processes that protect the value of your vehicle.',
    'Profesionálna starostlivosť pre Chery. Originálne diely, moderná diagnostika, zázemie a procesy, ktoré chránia hodnotu vášho auta.': 'Professional care for Chery. Genuine parts, modern diagnostics, facilities and processes that protect the value of your vehicle.',
    'Diagnostika': 'Diagnostics',
    'Záručný': 'Warranty',
    'pozáručný servis': 'Post-Warranty Service',
    'Pneuservis': 'Tire Service',
    'STK/EK príprava': 'STK/EK Preparation',
    'Služby servisu': 'Service Work',
    'Najčastejšie servisné úkony, ktoré riešime každý deň.': 'The most common service tasks we handle every day.',
    'Servis podľa postupov výrobcu, prehliadky a opravy.': 'Service, inspections and repairs according to manufacturer procedures.',
    'elektronika': 'Electronics',
    'Riadiace jednotky, snímače, diagnostické testy a merania.': 'Control units, sensors, diagnostic tests and measurements.',
    'sezónne prehliadky': 'Seasonal Inspections',
    'Prezutie, vyváženie, kontrola bŕzd, kvapalín a podvozku.': 'Tire changes, balancing, brake, fluid and chassis checks.',
    'STK / EK príprava': 'STK / EK Preparation',
    'Kontrola vozidla + odstránenie závad pred kontrolou.': 'Vehicle check and fault removal before inspection.',
    'Brzdy, podvozok, olejový servis': 'Brakes, Chassis, Oil Service',
    'Výmena bŕzd, tlmičov, čapov, oleja, filtrov a ďalších dielov.': 'Replacement of brakes, shock absorbers, joints, oil, filters and other parts.',
    'Klimatizácia': 'Air Conditioning',
    'Servis klímy, dezinfekcia, kontrola tesnosti a doplnenie.': 'A/C service, disinfection, leak check and refill.',
    'Ako prebieha servis': 'How Service Works',
    'Kontakt a termín': 'Contact and Appointment',
    'Zavoláte / napíšete – dohodneme termín a popis problému.': 'Call or write to us - we agree on a date and describe the issue.',
    'Príjem vozidla': 'Vehicle Intake',
    'Diagnostika & návrh riešenia': 'Diagnostics & solution proposal',
    'Kontrola stavu, spísanie požiadaviek a odporúčaní.': 'Condition check, recording requests and recommendations.',
    'návrh riešenia': 'Solution Proposal',
    'Ak treba, diagnostika a konzultácia ďalších krokov.': 'If needed, diagnostics and consultation on next steps.',
    'Realizácia + odovzdanie': 'Work and Handover',
    'Oprava / servis, kontrola a odovzdanie vozidla.': 'Repair / service, check and vehicle handover.',
    'Akcie a servisné balíky': 'Promotions and Service Packages',
    'Aktuálne ponuky – kliknite na obrázok pre zväčšenie.': 'Current offers - click an image to enlarge it.',
    'Predchádzajúci banner': 'Previous Banner',
    'Nasledujúci banner': 'Next Banner',
    'Zväčšený banner': 'Enlarged Banner',
    'Objednať servis': 'Book Service',
    'Zavolajte alebo napíšte – termín dohodneme rýchlo.': 'Call or write to us - we will arrange a time quickly.',
    'Zavolať technikovi': 'Call the Service Advisor',
    'Servis e-mail': 'Service Email',
    'Príjmací technik': 'Service Advisor',

    'Naše značky': 'Our Brands',
    'Symetrický AWD, BOXER motory a bezpečnosť EyeSight. Ideálne do Tatier aj na každý deň. Subaru spája tradíciu spoľahlivosti s modernými technológiami, ktoré prinášajú istotu v každom počasí. Vďaka nízkemu ťažisku a stabilite na ceste si užijete komfort aj v náročných horských podmienkach, pričom oceníte aj priestrannosť interiéru a praktické riešenia pre rodiny i dobrodruhov.': 'Symmetrical AWD, BOXER engines and EyeSight safety. Ideal for the Tatras and everyday driving. Subaru combines a tradition of reliability with modern technologies that bring confidence in every weather. Thanks to a low center of gravity and road stability, you enjoy comfort even in demanding mountain conditions, along with a spacious interior and practical solutions for families and adventurers.',
    'Moderné SUV a hybridné modely, spoľahlivý pohon 4x4 a elektrická budúcnosť – napríklad Torres EVX, Tivoli, Rexton či Musso. KGM prináša robustnosť spojenú s eleganciou, technológie pre vyššiu bezpečnosť a komfort, ako aj priaznivý pomer ceny a výkonu. Vozidlá sú navrhnuté tak, aby zvládli mestskú premávku aj dlhé cesty, pričom v teréne ukážu svoju skutočnú silu.': 'Modern SUVs and hybrid models, reliable 4x4 drive and an electric future - including Torres EVX, Tivoli, Rexton and Musso. KGM brings robustness combined with elegance, technologies for greater safety and comfort, and strong value for money. The vehicles are designed for city traffic and long journeys, while showing their true strength off road.',
    'DNA terénu a sloboda na každom kilometri. Od mesta po off-road, vždy s charakterom. Jeep je symbolom dobrodružstva a nezávislosti, ponúka robustný dizajn, vysokú priechodnosť terénom a moderné technológie pre pohodlie vodiča aj posádky. Či už hľadáte istotu v náročných podmienkach, alebo štýlového spoločníka do mesta, Jeep vám vždy poskytne pravý pocit slobody.': 'Off-road DNA and freedom on every kilometer. From the city to off-road trails, always with character. Jeep is a symbol of adventure and independence, offering robust design, strong off-road capability and modern technology for driver and passenger comfort. Whether you need confidence in demanding conditions or a stylish city companion, Jeep always gives you a true feeling of freedom.',
    'Moderné SUV z Číny s dôrazom na technológie, komfort a výbornú hodnotu. Chery prináša modely Tiggo s bohatou výbavou, priestranným interiérom, pokročilými asistenčnými systémami a efektívnymi hybridnými alebo plug-in hybridnými pohonmi. Je to praktická voľba pre rodiny aj vodičov, ktorí chcú veľa moderného auta za férové peniaze.': 'Modern SUVs from China with a focus on technology, comfort and strong value. Chery brings Tiggo models with rich equipment, a spacious interior, advanced assistance systems and efficient hybrid or plug-in hybrid powertrains. It is a practical choice for families and drivers who want a lot of modern car for fair money.',
    'Test jazda': 'Test Drive',
    'Čo hovoria zákazníci': 'What Customers Say',
    'Skúsenosti našich zákazníkov': 'Customer Experiences',
    '„Profesionálny prístup, rýchle dodanie a perfektný servis. Odporúčam.“': '"Professional approach, fast delivery and excellent service. I recommend them."',
    '— Zákazník z Popradu': '- Customer from Poprad',
    '— zákazník z Popradu': '- Customer from Poprad',
    '„Test jazda vybavená na počkanie, vysvetlené financovanie bez skrytých poplatkov.“': '"The test drive was arranged immediately and the financing was explained without hidden fees."',
    '— P. J., Kežmarok': '- P. J., Kežmarok',
    '„Subaru kvôli AWD – v zime neoceniteľné. PP AUTO sa o všetko postaralo.“': '"I chose Subaru for AWD - invaluable in winter. PP AUTO took care of everything."',
    '— M. K., Svit': '- M. K., Svit',
    'Náš tím': 'Our Team',
    'Predaj / Majiteľ:': 'Sales / Owner:',
    'Predaj:': 'Sales:',
    'Garancia:': 'Warranty:',
    'Servis:': 'Service:',
    'Fotogaléria autosalónu': 'Showroom Photo Gallery',
    'Kontakt a navigácia': 'Contact and Directions',
    'Prevádzka': 'Location',
    'Otváracie hodiny:': 'Opening Hours:',
    'Po–Pia 8:00–17:00': 'Mon-Fri 8:00-17:00',
    'Technik:': 'Service Advisor:',
    'Spustiť navigáciu': 'Start Navigation',
    'Napíšte nám': 'Write to Us',
    'Beriem na vedomie, že PP AUTO s.r.o. spracúva moje údaje za účelom vybavenia správy. Viac informácií nájdete v dokumente': 'I acknowledge that PP AUTO s.r.o. processes my data to handle this message. More information is available in',
    'Odoslať': 'Send',
    'Tu nás nájdete': 'Where to Find Us',
    'Autorizovaný predaj a servis Subaru,': 'Authorized Subaru,',
    'KGM a Jeep v Poprade od roku 2011.': 'KGM and Jeep sales and service in Poprad since 2011.',
    'KGM, Jeep a Chery v Poprade od roku 2011.': 'KGM, Jeep and Chery sales and service in Poprad since 2011.',
    'Autorizovaný predaj a servis Subaru v Poprade od roku 2011.': 'Authorized Subaru sales and service in Poprad since 2011.',
    'Autorizovaný predaj a servis KGM v Poprade od roku 2011.': 'Authorized KGM sales and service in Poprad since 2011.',
    'Autorizovaný predaj a servis Jeep v Poprade od roku 2011.': 'Authorized Jeep sales and service in Poprad since 2011.',
    'Autorizovaný predaj a servis Chery v Poprade od roku 2011.': 'Authorized Chery sales and service in Poprad since 2011.',
    'Navigácia': 'Navigation',
    'Dokumenty': 'Documents',
    'Podmienky používania': 'Terms of Use',
    'Po–Pia: 8:00–17:00': 'Mon-Fri: 8:00-17:00',
    '© 2025 PP AUTO s.r.o. – Všetky práva vyhradené.': '© 2025 PP AUTO s.r.o. - All rights reserved.',

    'Vyberte si značku, ktorú chcete prehliadať': 'Choose the brand you want to browse',
    'Symetrický AWD, BOXER motory a bezpečnosť EyeSight. Istota na každom kilometri.': 'Symmetrical AWD, BOXER engines and EyeSight safety. Confidence on every kilometer.',
    'Robustné SUV, moderné technológie a poctivý výkon. Auto pripravené na každý deň.“': 'Robust SUVs, modern technology and honest performance. A vehicle ready for every day.',
    'Ikonický dizajn, skutočný off‑road a sloboda ísť kamkoľvek. Dobrodružstvo bez hraníc.': 'Iconic design, genuine off-road ability and the freedom to go anywhere. Adventure without limits.',
    'Moderné čínske SUV, hybridné technológie a bohatá výbava pre každý deň.': 'Modern Chinese SUVs, hybrid technology and rich equipment for everyday driving.',
    'Prejsť na officiálnu stránku': 'Go to Official Website',
    'Prejsť na oficiálnu stránku': 'Go to Official Website',
    'Zobraziť všetko': 'Show All',
    'Zobraziť ponuku Subaru': 'View Subaru Offer',
    'Zobraziť ponuku KGM': 'View KGM Offer',
    'Zobraziť ponuku Jeep': 'View Jeep Offer',
    'Zobraziť ponuku Chery': 'View Chery Offer',
    'Subaru – vstúpiť': 'Subaru - enter',
    'KGM – vstúpiť': 'KGM - enter',
    'Jeep – vstúpiť': 'Jeep - enter',
    'Chery – vstúpiť': 'Chery - enter',
    'Subaru – ilustračné vozidlo': 'Subaru - illustrative vehicle',
    'KGM – ilustračné vozidlo': 'KGM - illustrative vehicle',
    'Jeep – ilustračné vozidlo': 'Jeep - illustrative vehicle',
    'Chery – ilustračné vozidlo': 'Chery - illustrative vehicle',

    '← Späť na ponuku': '← Back to Offer',
    'Zavolať predaj': 'Call Sales',
    'Testovacia jazda': 'Test Drive',
    'Navigovať / Kontakt': 'Directions / Contact',
    'Cena na vyžiadanie': 'Price on Request',
    'Údaje zatiaľ nie sú doplnené.': 'The data has not been added yet.',
    'Fotky nie sú doplnené.': 'Photos have not been added yet.',
    'Vozidlo z ponuky PP AUTO.': 'Vehicle from the PP AUTO offer.',
    'Pre presnú dostupnosť a detaily nás prosím kontaktujte.': 'Please contact us for exact availability and details.',
    'Základné údaje': 'Basic Information',
    'Technické údaje': 'Technical Details',
    'Značka': 'Brand',
    'Model': 'Model',
    'Rok výroby': 'Year of Manufacture',
    'Karoséria': 'Body Type',
    'Pohon': 'Drive',
    'Farba': 'Color',
    'Metalíza': 'Metallic Paint',
    'Palivo': 'Fuel',
    'Prevodovka': 'Transmission',
    'Výbava': 'Equipment',
    'Objem': 'Engine Size',
    'Výkon': 'Power',
    'Najazdené': 'Mileage',
    'Výbava zatiaľ nie je doplnená.': 'Equipment has not been added yet.',
    'Preferovaný dátum': 'Preferred Date',
    'Časť dňa': 'Part of Day',
    'Nezáleží': 'No Preference',
    'Ráno (8:00–10:00)': 'Morning (8:00-10:00)',
    'Dopoludnia (10:00–12:00)': 'Late Morning (10:00-12:00)',
    'Obed (12:00–14:00)': 'Midday (12:00-14:00)',
    'Popoludní (14:00–17:00)': 'Afternoon (14:00-17:00)',
    'Konkrétny čas': 'Exact Time',
    'Vyberte čas': 'Choose a Time',
    'Meno': 'Name',
    'Telefón': 'Phone',
    'Poznámka (voliteľné)': 'Note (optional)',
    'Napíšte nám preferencie, otázky, …': 'Write your preferences, questions, ...',
    'Súhlasím so spracovaním osobných údajov za účelom kontaktovania ohľadom testovacej jazdy.': 'I agree to the processing of personal data for the purpose of being contacted about the test drive.',
    'Odoslať žiadosť': 'Send Request',
    'Predchádzajúca fotka': 'Previous Photo',
    'Ďalšia fotka': 'Next Photo',
    'Zavrieť': 'Close',
    'Náhľad obrázka': 'Image Preview',
    'Foto': 'Photo',

    'Rok': 'Year',
    'Zľava': 'Discount',
    'Novinka': 'New',
    'Bez fotky': 'No Photo',
    'Zobraziť viac': 'View More',
    'Automat': 'Automatic',
    'Manuál': 'Manual',
    'Automatická prevodovka': 'Automatic Transmission',
    'Manuálna prevodovka': 'Manual Transmission',
    'Benzín': 'Petrol',
    'Benzín + MHEV': 'Petrol + MHEV',
    'Benzín / Hybrid': 'Petrol / Hybrid',
    'Diesel': 'Diesel',
    'Elektromotor': 'Electric Motor',
    'Hybrid': 'Hybrid',
    'Predný': 'Front-Wheel Drive',
    'Žltá': 'Yellow',
    'Áno': 'Yes',
    'Airbagy': 'Airbags',
    'Asistent jazdných pruhov': 'Lane Keeping Assistant',
    'Lakťová opierka': 'Armrest',

    'Načítavam…': 'Loading...',
    'Momentálne nie sú žiadne aktuálne ponuky.': 'There are currently no active offers.',
    'Momentálne nie sú žiadne актуálne ponuky.': 'There are currently no active offers.',
    'Pozrieť ponuku': 'View Offer',
    'Aktuality sa nepodarilo načítať.': 'Updates could not be loaded.',
    'Pre túto značku momentálne nie sú žiadne aktuálne ponuky.': 'There are currently no active offers for this brand.',
    'Mapa je zablokovaná': 'The Map Is Blocked',
    'Google Maps sa načíta až po povolení kategórie „Mapy a externý obsah“.': 'Google Maps will load only after allowing the "Maps and external content" category.',
    'Povoliť mapu': 'Allow Map',
    'Nastavenie cookies': 'Cookie Settings',
    'Cookies a externé služby': 'Cookies and External Services',
    'Používame nevyhnutné súbory pre fungovanie webu. Analytiku Google Analytics a Google Maps načítame iba po vašom súhlase. Nastavenie môžete kedykoľvek zmeniť.': 'We use necessary files for the website to work. Google Analytics and Google Maps load only after your consent. You can change your settings at any time.',
    'Odmietnuť voliteľné': 'Reject Optional',
    'Nastavenia': 'Settings',
    'Prijať všetko': 'Accept All',
    'Nastavenia cookies': 'Cookie Settings',
    'Zvoľte, ktoré voliteľné služby môže web používať. Nevyhnutné technické uloženia sú vždy aktívne, pretože bez nich web alebo bezpečnostné funkcie nevedia fungovať.': 'Choose which optional services the website may use. Necessary technical storage is always active because the website or security functions cannot work without it.',
    'Nevyhnutné': 'Necessary',
    'Zapamätanie nastavení cookies, technická bezpečnosť, základné fungovanie webu a administrácie.': 'Remembering cookie settings, technical security, basic website and administration functionality.',
    'Analytika': 'Analytics',
    'Google Analytics – meranie návštevnosti a zlepšovanie webu. Spustí sa len po súhlase.': 'Google Analytics - traffic measurement and website improvement. It starts only after consent.',
    'Mapy a externý obsah': 'Maps and External Content',
    'Google Maps iframe v sekcii „Tu nás nájdete“. Bez súhlasu ostane mapa nahradená bezpečným placeholderom.': 'Google Maps iframe in the "Where to Find Us" section. Without consent, the map remains replaced by a safe placeholder.',
    'Uložiť nastavenia': 'Save Settings',

    'Ďakujeme! Správa bola odoslaná.': 'Thank you! Your message has been sent.',
    'Odosielam…': 'Sending...',
    'Odosielam...': 'Sending...',
    'Nepodarilo sa odoslať. Skúste neskôr.': 'Could not send. Please try again later.',
    'Dopyt bol odoslaný. Ozveme sa vám čo najskôr.': 'Your inquiry has been sent. We will contact you as soon as possible.',
    'Odoslanie formulára nie je dostupné (EmailJS). Použite prosím e-mail alebo telefón.': 'Form submission is not available (EmailJS). Please use email or phone.',
    'Odoslanie zlyhalo. Skúste to prosím znova alebo použite e-mail.': 'Sending failed. Please try again or use email.',
    'Chýba EmailJS script v auto.html.': 'The EmailJS script is missing in auto.html.',
    'Ďakujeme! Žiadosť bola odoslaná.': 'Thank you! Your request has been sent.',
    'Ďakujeme! Termín vám potvrdíme telefonicky alebo e-mailom.': 'Thank you! We will confirm the appointment by phone or email.',
    'Nepodarilo sa odoslať. Skúste neskôr alebo nám zavolajte.': 'Could not send. Please try again later or call us.',
    'Vyberte značku.': 'Choose a brand.',
    'Vyberte model (alebo zvoľte „Iný“).': 'Choose a model, or select "Other".',
    'Ďakujeme! Ozveme sa vám kvôli potvrdeniu termínu.': 'Thank you! We will contact you to confirm the appointment.',
    'Vyberte značku a model': 'Choose a brand and model',
    'vyberte model': 'choose a model',
    'Najprv vyberte značku': 'Choose a brand first',
    'Vyberte model': 'Choose a model',
    'Modely sa nepodarilo načítať – zvoľte Iný': 'Models could not be loaded - choose Other',
    'Iný (napísať)': 'Other (write in)',

    'Filtrovanie ponuky': 'Offer Filtering',
    'Jeep – servisná akcia 1': 'Jeep - service promotion 1',
    'Jeep – servisná akcia 2': 'Jeep - service promotion 2',
    'Jeep – servisná akcia 3': 'Jeep - service promotion 3',
    'Jeep – servisná akcia 4': 'Jeep - service promotion 4',
    'Subaru – servisná akcia 5': 'Subaru - service promotion 5',
    'Mapa PP AUTO': 'PP AUTO Map',
    'Vaša správa': 'Your Message',
    'O aké vozidlo máte záujem a aké máte predstavy o splátkach?': 'Which vehicle are you interested in and what are your payment expectations?',

    'Kontaktovať': 'Contact Us',
    'PP AUTO domov': 'PP AUTO home',
    'Hlavná navigácia': 'Main Navigation',
    'Posledná aktualizácia: 4. máj 2026': 'Last updated: May 4, 2026',
    'Ochrana osobných údajov | PP AUTO s.r.o.': 'Privacy Policy | PP AUTO s.r.o.',
    'Zásady používania cookies | PP AUTO s.r.o.': 'Cookie Policy | PP AUTO s.r.o.',
    'Podmienky používania webovej stránky | PP AUTO s.r.o.': 'Website Terms of Use | PP AUTO s.r.o.',
    'Podmienky používania webovej stránky': 'Website Terms of Use',
    'Informácie o spracúvaní osobných údajov návštevníkov webu, zákazníkov a záujemcov o vozidlá, servis alebo testovaciu jazdu.': 'Information on the processing of personal data of website visitors, customers and people interested in vehicles, service or a test drive.',
    'Informácie o technických cookies, analytike, Google Maps a správe súhlasov na webovej stránke PP AUTO.': 'Information about technical cookies, analytics, Google Maps and consent management on the PP AUTO website.',
    'Základné pravidlá používania webu PP AUTO, informácie k ponuke vozidiel a právne upozornenia.': 'Basic rules for using the PP AUTO website, information about vehicle offers and legal notices.',

    '1. Prevádzkovateľ': '1. Controller',
    'Prevádzkovateľom osobných údajov je:': 'The personal data controller is:',
    'Obchodné meno': 'Business Name',
    'IČO': 'Company ID',
    'DIČ': 'Tax ID',
    'Sídlo / prevádzka': 'Registered Office / Location',
    'Partizánska 5660/107, 058 01 Poprad, Slovenská republika': 'Partizánska 5660/107, 058 01 Poprad, Slovak Republic',
    'Kontakt pre ochranu údajov': 'Data Protection Contact',
    'Prevádzkovateľ nemá určenú zodpovednú osobu podľa čl. 37 GDPR, ak mu takáto povinnosť nevzniká. Otázky k ochrane osobných údajov posielajte na vyššie uvedený e-mail.': 'The controller has not appointed a data protection officer under Article 37 GDPR unless such an obligation applies. Please send data protection questions to the email address above.',
    '2. Aké údaje spracúvame': '2. What Data We Process',
    'Spracúvame iba údaje, ktoré sú primerané konkrétnemu účelu. Typicky ide o:': 'We process only data that is adequate for the specific purpose. This typically includes:',
    'identifikačné a kontaktné údaje: meno, priezvisko, e-mail, telefónne číslo,': 'identification and contact details: first name, surname, email, phone number,',
    'obsah správy alebo dopytu, ktorý nám pošlete cez kontaktný formulár,': 'the content of the message or inquiry you send via the contact form,',
    'údaje potrebné pre rezerváciu testovacej jazdy: značka, model, požadovaný dátum, čas alebo časť dňa, poznámka,': 'data needed to reserve a test drive: brand, model, requested date, time or part of day, note,',
    'údaje súvisiace s dopytom na financovanie: orientačná cena vozidla, akontácia, doba splácania, úrok a doplnená správa,': 'data related to a financing inquiry: indicative vehicle price, down payment, repayment period, interest rate and added message,',
    'technické údaje pri návšteve webu: IP adresa, typ prehliadača, informácie o zariadení, logy servera, informácie o súboroch cookies a súhlasoch,': 'technical data during a website visit: IP address, browser type, device information, server logs, information about cookies and consents,',
    'údaje z administrácie webu, ak ide o interný prístup správcu: prihlasovací stav, záznamy o úpravách vozidiel, nahrané fotografie a súvisiace technické logy.': 'website administration data in case of internal admin access: login status, records of vehicle edits, uploaded photos and related technical logs.',
    '3. Účely, právne základy a doba uchovávania': '3. Purposes, Legal Bases and Retention Periods',
    'Účel': 'Purpose',
    'Údaje': 'Data',
    'Právny základ': 'Legal Basis',
    'Doba uchovávania': 'Retention Period',
    'Vybavenie kontaktného formulára': 'Handling the Contact Form',
    'Meno, e-mail, telefón, správa': 'Name, email, phone, message',
    'Čl. 6 ods. 1 písm. b) GDPR – predzmluvná komunikácia; prípadne čl. 6 ods. 1 písm. f) GDPR – oprávnený záujem na vybavení dopytu': 'Article 6(1)(b) GDPR - pre-contractual communication; where applicable Article 6(1)(f) GDPR - legitimate interest in handling the inquiry',
    'Spravidla 12 mesiacov od vybavenia dopytu; dlhšie iba ak nadviaže obchodný vzťah alebo vznikne zákonná povinnosť': 'Usually 12 months after the inquiry is handled; longer only if a business relationship follows or a legal obligation arises',
    'Rezervácia testovacej jazdy': 'Test Drive Reservation',
    'Meno, e-mail, telefón, značka/model, termín, poznámka': 'Name, email, phone, brand/model, appointment, note',
    'Čl. 6 ods. 1 písm. b) GDPR – kroky pred uzatvorením zmluvy alebo poskytnutím služby': 'Article 6(1)(b) GDPR - steps before entering into a contract or providing a service',
    'Spravidla 12 mesiacov od termínu alebo vybavenia žiadosti': 'Usually 12 months from the appointment date or handling of the request',
    'Dopyt na financovanie alebo ponuku vozidla': 'Financing or Vehicle Offer Inquiry',
    'Kontaktné údaje, parametre dopytu, správa': 'Contact details, inquiry parameters, message',
    'Čl. 6 ods. 1 písm. b) GDPR – predzmluvné rokovanie': 'Article 6(1)(b) GDPR - pre-contractual negotiations',
    'Spravidla 12 mesiacov od vybavenia dopytu; pri uzatvorení zmluvy podľa účtovných a právnych predpisov': 'Usually 12 months after the inquiry is handled; if a contract is concluded, according to accounting and legal regulations',
    'Prevádzka, bezpečnosť a administrácia webu': 'Website Operation, Security and Administration',
    'Technické logy, IP adresa, bezpečnostné udalosti, admin cookie, údaje o zmenách obsahu': 'Technical logs, IP address, security events, admin cookie, data about content changes',
    'Čl. 6 ods. 1 písm. f) GDPR – oprávnený záujem na bezpečnej prevádzke webu a ochrane administrácie': 'Article 6(1)(f) GDPR - legitimate interest in secure website operation and administration protection',
    'Logy zvyčajne po dobu nevyhnutnú na bezpečnosť a diagnostiku; pri incidente po dobu riešenia incidentu': 'Logs usually for the period necessary for security and diagnostics; in case of an incident, for the incident resolution period',
    'Meranie návštevnosti webu': 'Website Traffic Measurement',
    'Cookie identifikátory, údaje o návšteve, zariadení a prehliadači v Google Analytics': 'Cookie identifiers, visit, device and browser data in Google Analytics',
    'Čl. 6 ods. 1 písm. a) GDPR – súhlas používateľa': 'Article 6(1)(a) GDPR - user consent',
    'Podľa nastavení Google Analytics a platnosti súhlasu; súhlas na webe uchovávame najviac 180 dní': 'According to Google Analytics settings and consent validity; website consent is stored for a maximum of 180 days',
    'Zobrazenie mapy prevádzky': 'Displaying the Location Map',
    'Technické údaje prenášané službe Google Maps po načítaní mapy': 'Technical data transferred to Google Maps after the map is loaded',
    'Čl. 6 ods. 1 písm. a) GDPR – súhlas používateľa s externým obsahom': 'Article 6(1)(a) GDPR - user consent to external content',
    'Podľa pravidiel Google; súhlas na webe uchovávame najviac 180 dní': 'According to Google rules; website consent is stored for a maximum of 180 days',
    '4. Komu môžu byť údaje sprístupnené': '4. Who May Access the Data',
    'Údaje sprístupňujeme iba v rozsahu potrebnom na prevádzku webu a vybavenie požiadaviek:': 'We disclose data only to the extent necessary to operate the website and handle requests:',
    '– technické odoslanie údajov z kontaktných formulárov na firemný e-mail,': '- technical sending of data from contact forms to the company email,',
    '– hosting webovej stránky a serverless API,': '- website hosting and serverless API,',
    '– ukladanie dát webu, napr. verejná ponuka vozidiel, obrázky a aktuality spravované cez admin panel,': '- storage of website data, e.g. public vehicle offers, images and updates managed through the admin panel,',
    '– Google Analytics a Google Maps, iba ak sú tieto služby povolené alebo načítané podľa nastavenia cookies,': '- Google Analytics and Google Maps, only if these services are allowed or loaded according to cookie settings,',
    'poskytovatelia IT služieb': 'IT service providers',
    'a osoby poverené správou webu,': 'and persons entrusted with website administration,',
    'orgány verejnej moci': 'public authorities',
    ', ak to vyžaduje zákon.': ', if required by law.',
    'Pri využívaní niektorých služieb môže dôjsť k prenosu údajov mimo Európskeho hospodárskeho priestoru. V takom prípade sa prenos vykonáva len pri existencii primeraných záruk, napríklad na základe štandardných zmluvných doložiek, rozhodnutia o primeranosti alebo iného právneho mechanizmu podľa GDPR.': 'When using some services, data may be transferred outside the European Economic Area. In such cases, transfer takes place only where adequate safeguards exist, such as standard contractual clauses, an adequacy decision or another legal mechanism under GDPR.',
    '5. EmailJS a formuláre': '5. EmailJS and Forms',
    'Kontaktné formuláre a formuláre testovacej jazdy neposkytujú online nákup vozidla. Slúžia na odoslanie dopytu spoločnosti PP AUTO s.r.o. Údaje z formulárov sú odosielané cez službu EmailJS na firemné e-mailové schránky. Vo formulároch preto neuvádzajte osobitné kategórie osobných údajov, rodné číslo, čísla dokladov ani platobné údaje.': 'Contact forms and test drive forms do not provide online vehicle purchase. They are used to send an inquiry to PP AUTO s.r.o. Form data is sent via EmailJS to company email inboxes. Therefore, do not enter special categories of personal data, birth numbers, document numbers or payment details in the forms.',
    '6. Cookies a externé služby': '6. Cookies and External Services',
    'Podrobné informácie o súboroch cookies, analytike a Google Maps sú uvedené v samostatnom dokumente': 'Detailed information about cookies, analytics and Google Maps is provided in the separate document',
    'Zásady používania cookies': 'Cookie Policy',
    '7. Práva dotknutej osoby': '7. Rights of the Data Subject',
    'V súvislosti so spracúvaním osobných údajov máte najmä právo:': 'In connection with personal data processing, you mainly have the right to:',
    'požadovať prístup k osobným údajom,': 'request access to personal data,',
    'požadovať opravu nepresných alebo neúplných údajov,': 'request correction of inaccurate or incomplete data,',
    'požadovať vymazanie údajov, ak sú splnené zákonné podmienky,': 'request deletion of data if legal conditions are met,',
    'požadovať obmedzenie spracúvania,': 'request restriction of processing,',
    'namietať proti spracúvaniu založenému na oprávnenom záujme,': 'object to processing based on legitimate interest,',
    'požadovať prenosnosť údajov, ak je to technicky možné a právne relevantné,': 'request data portability where technically possible and legally relevant,',
    'kedykoľvek odvolať súhlas, ak je spracúvanie založené na súhlase,': 'withdraw consent at any time if processing is based on consent,',
    'podať sťažnosť dozornému orgánu: Úrad na ochranu osobných údajov Slovenskej republiky.': 'file a complaint with the supervisory authority: the Office for Personal Data Protection of the Slovak Republic.',
    'Práva môžete uplatniť e-mailom na': 'You may exercise your rights by email at',
    '. Pred vybavením žiadosti môžeme požadovať primerané overenie identity, aby sme chránili vaše údaje.': '. Before handling a request, we may require reasonable identity verification to protect your data.',
    '8. Bezpečnosť': '8. Security',
    'Prijímame primerané technické a organizačné opatrenia na ochranu údajov, najmä obmedzenie prístupu k administrácii webu, používanie HTTPS, oddelenie interného admin rozhrania, kontrolu prístupov a využívanie služieb poskytovateľov s bezpečnostnými mechanizmami.': 'We take appropriate technical and organizational measures to protect data, especially limiting access to website administration, using HTTPS, separating the internal admin interface, access control and using providers with security mechanisms.',
    '9. Zmeny dokumentu': '9. Document Changes',
    'Tento dokument môžeme aktualizovať, najmä pri zmene webu, poskytovateľov služieb alebo právnych požiadaviek. Aktuálna verzia je vždy dostupná na tejto stránke.': 'We may update this document, especially when the website, service providers or legal requirements change. The current version is always available on this page.',

    '1. Čo sú cookies': '1. What Cookies Are',
    'Cookies sú malé dátové súbory alebo podobné technológie, ktoré webová stránka ukladá do zariadenia používateľa alebo z neho číta informácie. Niektoré sú nevyhnutné na fungovanie webu, iné sa môžu používať iba po súhlase používateľa.': 'Cookies are small data files or similar technologies that a website stores on a user device or reads from it. Some are necessary for the website to function, while others may be used only after user consent.',
    'Na webe PP AUTO sa voliteľné cookies a externé služby, najmä Google Analytics a Google Maps, majú načítať až po udelení súhlasu cez cookie lištu.': 'On the PP AUTO website, optional cookies and external services, especially Google Analytics and Google Maps, should load only after consent is granted through the cookie bar.',
    '2. Kategórie cookies a služieb': '2. Categories of Cookies and Services',
    'Kategória': 'Category',
    'Dá sa odmietnuť?': 'Can It Be Rejected?',
    'Základné fungovanie webu, bezpečnosť, zapamätanie voľby cookies, interné prihlásenie do administrácie.': 'Basic website functionality, security, remembering cookie choices, internal admin login.',
    'Oprávnený záujem / zákonná výnimka pre nevyhnutné technické uloženie.': 'Legitimate interest / legal exemption for necessary technical storage.',
    'Nie cez cookie lištu. Môžete ich blokovať v prehliadači, ale web nemusí fungovať správne.': 'Not through the cookie bar. You may block them in your browser, but the website may not work properly.',
    'Analytické': 'Analytics',
    'Meranie návštevnosti, agregované štatistiky a zlepšovanie webu cez Google Analytics.': 'Traffic measurement, aggregated statistics and website improvement through Google Analytics.',
    'Súhlas používateľa.': 'User consent.',
    'Zobrazenie mapy prevádzky cez Google Maps iframe.': 'Displaying the location map via Google Maps iframe.',
    'Áno. Bez súhlasu sa zobrazí iba placeholder.': 'Yes. Without consent, only a placeholder is shown.',
    '3. Prehľad používaných cookies a úložísk': '3. Overview of Cookies and Storage Used',
    'Názov': 'Name',
    'Poskytovateľ': 'Provider',
    'Doba': 'Duration',
    'Zapamätanie, či používateľ povolil alebo odmietol analytiku a mapy.': 'Remembering whether the user allowed or rejected analytics and maps.',
    '180 dní v localStorage': '180 days in localStorage',
    'Interný administrátorský prístup do neverejnej administrácie webu.': 'Internal administrator access to non-public website administration.',
    'Session cookie, bez trvalej expirácie': 'Session cookie, without permanent expiration',
    'a podobné': 'and similar',
    'Rozlíšenie návštev, meranie návštevnosti a používania webu.': 'Distinguishing visits, measuring traffic and website usage.',
    'Spravidla do 2 rokov podľa nastavenia Google Analytics': 'Usually up to 2 years according to Google Analytics settings',
    'Cookies Google Maps, napr. podľa aktuálneho nastavenia Google': 'Google Maps cookies, e.g. according to current Google settings',
    'Zobrazenie mapy, bezpečnosť a funkčnosť služby Google Maps.': 'Displaying the map, security and functionality of Google Maps.',
    'Podľa pravidiel Google': 'According to Google rules',
    'Konkrétne cookies tretích strán sa môžu meniť podľa technického nastavenia služieb Google. Ak v budúcnosti pridáte Meta Pixel, reklamné skripty alebo iné meracie nástroje, treba tento dokument aktualizovať.': 'Specific third-party cookies may change according to the technical settings of Google services. If Meta Pixel, advertising scripts or other measurement tools are added in the future, this document must be updated.',
    '4. Ako spravovať súhlas': '4. How to Manage Consent',
    'Pri prvej návšteve web zobrazí cookie lištu. Používateľ môže:': 'On the first visit, the website displays a cookie bar. The user may:',
    'prijať všetky voliteľné služby,': 'accept all optional services,',
    'odmietnuť voliteľné služby,': 'reject optional services,',
    'otvoriť nastavenia a povoliť iba vybrané kategórie.': 'open settings and allow only selected categories.',
    'Súhlas môžete kedykoľvek zmeniť kliknutím na tlačidlo „Nastavenia cookies“ v dolnej časti webu alebo týmto tlačidlom:': 'You can change consent at any time by clicking the "Cookie Settings" button at the bottom of the website or with this button:',
    'Otvoriť nastavenia cookies': 'Open Cookie Settings',
    '5. Blokovanie cookies v prehliadači': '5. Blocking Cookies in the Browser',
    'Cookies môžete blokovať alebo vymazať aj priamo v nastaveniach svojho internetového prehliadača. Blokovanie nevyhnutných cookies však môže spôsobiť, že niektoré časti webu nebudú fungovať správne.': 'You can also block or delete cookies directly in your internet browser settings. However, blocking necessary cookies may cause some parts of the website not to work properly.',
    '6. Kontakt': '6. Contact',
    'Otázky k používaniu cookies môžete poslať na': 'Questions about cookie use can be sent to',

    '1. Prevádzkovateľ webu': '1. Website Operator',
    'Webovú stránku prevádzkuje PP AUTO s.r.o., IČO: 45 868 751, DIČ: 2023115842, so sídlom / prevádzkou Partizánska 5660/107, 058 01 Poprad, Slovenská republika.': 'The website is operated by PP AUTO s.r.o., Company ID: 45 868 751, Tax ID: 2023115842, with registered office / location at Partizánska 5660/107, 058 01 Poprad, Slovak Republic.',
    '2. Charakter webovej stránky': '2. Nature of the Website',
    'Webová stránka má informačný a prezentačný charakter. Zobrazuje ponuku vozidiel, informácie o autorizovanom predaji a servise značiek Subaru, KGM a Jeep, kontaktné údaje, formuláre dopytu a možnosť požiadať o testovaciu jazdu.': 'The website is informational and presentational. It displays vehicle offers, information about authorized sales and service of Subaru, KGM and Jeep brands, contact details, inquiry forms and the option to request a test drive.',
    'Webová stránka nie je internetovým obchodom. Odoslaním formulára nedochádza k uzatvoreniu kúpnej zmluvy, servisnej zmluvy ani zmluvy o financovaní.': 'The website is not an online store. Sending a form does not conclude a purchase contract, service contract or financing contract.',
    '3. Ponuka vozidiel, ceny a dostupnosť': '3. Vehicle Offers, Prices and Availability',
    'Údaje o vozidlách, výbave, dostupnosti a cenách majú informatívny charakter.': 'Information about vehicles, equipment, availability and prices is for information purposes.',
    'Skutočná dostupnosť vozidla, konečná cena, výbava a obchodné podmienky sa potvrdzujú individuálne pri komunikácii s predajcom.': 'Actual vehicle availability, final price, equipment and business terms are confirmed individually during communication with the salesperson.',
    'Prevádzkovateľ si vyhradzuje právo opraviť zjavné chyby v texte, cene, technických údajoch alebo fotografiách.': 'The operator reserves the right to correct obvious errors in text, price, technical data or photographs.',
    'Fotografie môžu mať ilustračný charakter, ak nie je pri konkrétnom vozidle výslovne uvedené inak.': 'Photographs may be illustrative unless expressly stated otherwise for a specific vehicle.',
    '4. Formuláre a komunikácia': '4. Forms and Communication',
    'Kontaktný formulár, dopyt na financovanie a formulár testovacej jazdy slúžia na odoslanie nezáväznej požiadavky. Prevádzkovateľ vás môže kontaktovať späť e-mailom alebo telefonicky za účelom vybavenia dopytu.': 'The contact form, financing inquiry and test drive form are used to send a non-binding request. The operator may contact you back by email or phone to handle the inquiry.',
    'Vo formulároch neuvádzajte citlivé údaje, čísla dokladov, rodné číslo, platobné údaje ani iné informácie, ktoré nie sú potrebné na vybavenie dopytu.': 'Do not enter sensitive data, document numbers, birth numbers, payment details or other information not needed to handle the inquiry in the forms.',
    '5. Duševné vlastníctvo': '5. Intellectual Property',
    'Texty, grafika, fotografie, dizajn, logo a technické riešenia webu sú chránené príslušnými právnymi predpismi. Ich kopírovanie, šírenie alebo používanie bez súhlasu prevádzkovateľa nie je povolené, s výnimkou bežného používania webu a zákonných výnimiek.': 'Texts, graphics, photographs, design, logo and technical solutions of the website are protected by applicable legal regulations. Copying, distributing or using them without the operator consent is not permitted, except for ordinary website use and statutory exceptions.',
    '6. Externé odkazy a služby tretích strán': '6. External Links and Third-Party Services',
    'Web môže obsahovať odkazy na externé služby, napríklad Google Maps, Facebook, Instagram alebo webové stránky výrobcov a partnerov. Prevádzkovateľ nezodpovedá za obsah, dostupnosť ani pravidlá ochrany osobných údajov týchto externých stránok.': 'The website may contain links to external services such as Google Maps, Facebook, Instagram or manufacturer and partner websites. The operator is not responsible for the content, availability or privacy rules of these external websites.',
    '7. Dostupnosť a bezpečnosť webu': '7. Website Availability and Security',
    'Prevádzkovateľ sa usiluje o bezpečnú a stabilnú prevádzku webu, negarantuje však nepretržitú dostupnosť, bezchybnosť ani kompatibilitu so všetkými zariadeniami a prehliadačmi. Web nesmiete používať spôsobom, ktorý by mohol poškodiť jeho bezpečnosť, dostupnosť alebo práva iných osôb.': 'The operator strives for secure and stable website operation, but does not guarantee uninterrupted availability, error-free operation or compatibility with all devices and browsers. You may not use the website in a way that could harm its security, availability or the rights of others.',
    '8. Ochrana osobných údajov a cookies': '8. Privacy and Cookies',
    'Informácie o spracúvaní osobných údajov sú uvedené v dokumente': 'Information about personal data processing is provided in the document',
    '. Informácie o cookies sú uvedené v dokumente': '. Information about cookies is provided in the document',
    '9. Kontakt': '9. Contact',
    'V prípade otázok k webu nás kontaktujte na': 'For website-related questions, contact us at',
    'alebo telefonicky na': 'or by phone at',
    'Admin portál': 'Admin Portal',
    'PP AUTO · interný prístup': 'PP AUTO · internal access',
    'Admin kľúč': 'Admin Key',
    'Neplatný prístupový kľúč': 'Invalid Access Key',
    'PP AUTO s.r.o.': 'PP AUTO s.r.o.',
    'Autorizovaný predaj a servis áut v Poprade': 'Authorized Vehicle Sales and Service in Poprad',
    'V PP AUTO sa postaráme o celý životný cyklus vozidla: od výberu modelu a testovacej jazdy, cez individuálne financovanie a poistenie, až po pravidelný servis, diagnostiku, sezónne prehliadky a originálne diely.': 'At PP AUTO, we take care of the entire vehicle lifecycle: from choosing a model and taking a test drive, through tailored financing and insurance, to regular servicing, diagnostics, seasonal inspections and genuine parts.',

    'Skladové vozidlá a nové autá': 'Stock Vehicles and New Cars',
    'Ponuka zahŕňa modely Subaru, KGM, Jeep a Chery, dostupné vozidlá na sklade aj autá pripravené na objednávku. Pri výbere pomôžeme porovnať výbavy, pohon, prevádzkové náklady a možnosti financovania.': 'Our offer includes Subaru, KGM, Jeep and Chery models, vehicles available in stock as well as cars available to order. We will help you compare equipment levels, powertrains, running costs and financing options.',

    'Servis Subaru, KGM, Jeep a Chery': 'Subaru, KGM, Jeep and Chery Service',
    'Servisné oddelenie v Poprade rieši záručný aj pozáručný servis, pravidelné prehliadky, diagnostiku, pneumatiky a náhradné diely. Pracujeme so zázemím autorizovaného predajcu a so skúsenosťami od roku 2011.': 'Our service department in Poprad provides warranty and post-warranty service, regular inspections, diagnostics, tire services and spare parts. We operate with the facilities of an authorized dealer and experience dating back to 2011.',

    'Testovacie jazdy v regióne Tatry': 'Test Drives in the Tatras Region',
    'Vozidlá si môžete vyskúšať na cestách okolo Popradu, Svitu, Kežmarku alebo Vysokých Tatier. Pri testovacej jazde vysvetlíme rozdiely medzi výbavami, bezpečnostnými systémami, pohonom 4x4 a hybridnými technológiami.': 'You can test our vehicles on roads around Poprad, Svit, Kežmarok or the High Tatras. During the test drive, we will explain the differences between equipment levels, safety systems, 4x4 drivetrains and hybrid technologies.',
    'Robustné SUV, moderné technológie a poctivý výkon. Auto pripravené na každý deň.': 'Robust SUVs, modern technology and solid performance. A vehicle ready for every day.',
    'Autorizovaný predaj a servis vozidiel Subaru, KGM, Jeep a Chery v Poprade.': 'Authorized sales and service of Subaru, KGM, Jeep and Chery vehicles in Poprad.',
  };

  const inlineTranslations = [
    ['Automatická prevodovka', 'Automatic Transmission'],
    ['Manuálna prevodovka', 'Manual Transmission'],
    ['Benzín + MHEV', 'Petrol + MHEV'],
    ['Benzín / Hybrid', 'Petrol / Hybrid'],
    ['Benzín', 'Petrol'],
    ['Elektromotor', 'Electric Motor'],
    ['Predný', 'Front-Wheel Drive'],
    ['Žltá', 'Yellow'],
    ['Novinka', 'New'],
    ['Skladom', 'In Stock'],
    ['Výbava', 'Equipment']
  ];

  const translate = (value) => {
    const key = normalize(value);
    if (translations[key]) return translations[key];

    let output = String(value || '');
    inlineTranslations.forEach(([from, to]) => {
      output = output.split(from).join(to);
    });
    return output !== String(value || '') ? output : value;
  };

  function getUrlLang() {
    const raw = new URLSearchParams(location.search).get('lang');
    const lang = normalize(raw).toLowerCase();
    return SUPPORTED.has(lang) ? lang : null;
  }

  function getStoredLang() {
    try {
      const lang = normalize(localStorage.getItem(STORAGE_KEY)).toLowerCase();
      return SUPPORTED.has(lang) ? lang : null;
    } catch (e) {
      return null;
    }
  }

  let currentLang = getUrlLang() || getStoredLang() || 'sk';

  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch (e) {}

  document.documentElement.lang = currentLang;

  function withLang(href, lang) {
    const targetLang = lang || currentLang;
    const raw = String(href || '');
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;

    const hashIndex = raw.indexOf('#');
    const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
    const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;

    const queryIndex = beforeHash.indexOf('?');
    const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
    const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

    const isCleanLocalPath =
      path === '/' ||
      path === '/ponuka' ||
      path === '/subaru' ||
      path === '/kgm' ||
      path === '/jeep' ||
      path === '/chery' ||
      path.startsWith('/auta/');

    if (!path || (!/\.html$/i.test(path) && !isCleanLocalPath)) return raw;

    const params = new URLSearchParams(query);
    if (/^index\.html$/i.test(path) && !params.has('brand')) {
      params.set('brand', 'all');
    }

    if (targetLang === 'en') params.set('lang', 'en');
    else params.delete('lang');

    const nextQuery = params.toString();
    return path + (nextQuery ? `?${nextQuery}` : '') + hash;
  }

  function setLanguage(lang) {
    if (!SUPPORTED.has(lang)) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}

    const url = new URL(location.href);
    if (/\/index\.html$/i.test(url.pathname) && !url.searchParams.has('brand')) {
      const brand = normalize(document.documentElement.getAttribute('data-brand')).toLowerCase();
      url.searchParams.set('brand', ['subaru', 'kgm', 'jeep', 'chery'].includes(brand) ? brand : 'all');
    }

    if (lang === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    location.href = url.toString();
  }

  function shouldSkipNode(node) {
    const parent = node.parentElement || node.parentNode;
    if (!parent) return true;
    if (SKIP_TAGS.has(parent.nodeName)) return true;
    if (parent.closest && parent.closest('[data-no-i18n]')) return true;
    return false;
  }

  function translateTextNode(node) {
    if (shouldSkipNode(node)) return;
    const original = node.nodeValue;
    const normalized = normalize(original);
    if (!normalized) return;
    const translated = translate(normalized);
    if (translated === normalized) return;

    const leading = (original.match(/^\s*/) || [''])[0];
    const trailing = (original.match(/\s*$/) || [''])[0];
    node.nodeValue = leading + translated + trailing;
  }

  function translateElementAttributes(el) {
    if (!el || el.nodeType !== 1) return;
    if (SKIP_TAGS.has(el.nodeName)) return;
    if (el.closest && el.closest('[data-no-i18n]')) return;

    ['placeholder', 'aria-label', 'alt', 'title', 'data-title'].forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const original = el.getAttribute(attr);
      const translated = translate(original);
      if (translated !== original) el.setAttribute(attr, translated);
    });

    if (el.matches && el.matches('meta[name="description"][content]')) {
      const original = el.getAttribute('content');
      const translated = translate(original);
      if (translated !== original) el.setAttribute('content', translated);
    }
  }

  function walk(root) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has(node.nodeName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.nodeType === Node.ELEMENT_NODE && node.closest && node.closest('[data-no-i18n]')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else translateElementAttributes(node);
      node = walker.nextNode();
    }
  }

  function translateHead() {
    if (document.title) document.title = translate(document.title);
    document.querySelectorAll('meta[name="description"][content]').forEach(translateElementAttributes);
  }

  function decorateLinks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      const next = withLang(href);
      if (next !== href) a.setAttribute('href', next);
    });
  }

  function refreshSwitchers() {
    const nextLang = currentLang === 'en' ? 'sk' : 'en';
    document.querySelectorAll('[data-lang-switch]').forEach((el) => {
      const label = currentLang === 'en' ? 'SK' : 'EN';
      const aria = currentLang === 'en' ? 'Prepnúť na slovenčinu' : 'Switch to English';
      if (el.textContent !== label) el.textContent = label;
      if (el.getAttribute('aria-label') !== aria) el.setAttribute('aria-label', aria);
      if (el.getAttribute('href') !== '#') el.setAttribute('href', '#');
      if (el.dataset.langBound !== 'true') {
        el.dataset.langBound = 'true';
        el.addEventListener('click', (event) => {
          event.preventDefault();
          const next = currentLang === 'en' ? 'sk' : 'en';
          setLanguage(next);
        });
      }
    });
  }

  let scheduled = false;
  function apply(root) {
    if (currentLang === 'en') {
      translateHead();
      walk(root || document.body);
    }
    decorateLinks(root || document);
    refreshSwitchers();
  }

  function schedule(root) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply(root || document.body);
    });
  }

  function start() {
    apply(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          schedule(document.body);
          return;
        }
        if (mutation.type === 'attributes') {
          schedule(document.body);
          return;
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'alt', 'title', 'data-title', 'href', 'content']
    });
  }

  window.ppI18n = {
    getLanguage: () => currentLang,
    isEnglish: () => currentLang === 'en',
    t: translate,
    withLang,
    setLanguage,
    apply
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
