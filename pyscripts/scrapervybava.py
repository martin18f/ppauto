from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from playwright.sync_api import (
    Page,
    sync_playwright,
    TimeoutError as PlaywrightTimeoutError,
)


# ============================================================
# NASTAVENIA
# ============================================================

HEADLESS = True

# Ak chceš počas testovania vidieť browser:
# HEADLESS = False

DEFAULT_TIMEOUT = 20_000
PAGE_LOAD_TIMEOUT = 60_000


CHERY_CATEGORIES = [
    "Asistent",
    "Bezpečnosť",
    "Exteriér",
    "Infotainment",
    "Interiér",
    "Komfort",
]


# ============================================================
# SCRAPE JOB
# ============================================================

@dataclass
class ScrapeJob:
    brand: str
    model: str
    url: str
    output_file: str
    scraper: str
    options: dict[str, Any] = field(default_factory=dict)


# ============================================================
# REGISTRY SCRAPEROV
# ============================================================

SCRAPER_REGISTRY: dict[
    str,
    Callable[[Page, ScrapeJob], dict[str, Any]]
] = {}


def register_scraper(name: str):
    def decorator(func):
        SCRAPER_REGISTRY[name] = func
        return func

    return decorator


# ============================================================
# VŠEOBECNÉ FUNKCIE
# ============================================================

def clean_text(text: str | None) -> str:
    if not text:
        return ""

    return re.sub(
        r"\s+",
        " ",
        text.replace("\xa0", " ")
    ).strip()


def dismiss_cookies(page: Page) -> None:

    labels = [
        "Prijať všetko",
        "Prijať",
        "Súhlasím",
        "Povoliť všetko",
        "Accept all",
        "Accept",
    ]

    for label in labels:

        try:

            button = page.get_by_role(
                "button",
                name=re.compile(
                    rf"^{re.escape(label)}$",
                    re.IGNORECASE,
                ),
            )

            if button.count():

                button.first.click(
                    timeout=1500
                )

                page.wait_for_timeout(
                    250
                )

                return

        except Exception:
            pass


def load_page(
    page: Page,
    url: str
) -> None:

    page.goto(
        url,
        wait_until="domcontentloaded",
        timeout=PAGE_LOAD_TIMEOUT,
    )

    try:

        page.wait_for_load_state(
            "networkidle",
            timeout=15_000,
        )

    except PlaywrightTimeoutError:
        pass

    dismiss_cookies(page)


# ============================================================
# CHERY SCRAPER
# ============================================================

@register_scraper("chery_equipment")
def scrape_chery_equipment(
    page: Page,
    job: ScrapeJob,
) -> dict[str, Any]:

    categories = job.options.get(
        "categories",
        CHERY_CATEGORIES,
    )

    load_page(
        page,
        job.url,
    )

    # ========================================================
    # Celá CHERY logika beží priamo nad DOM stránky.
    #
    # Dôležité:
    #
    # KAŽDÝ accordion:
    #
    # 1. nájdeme,
    # 2. rozklikneme,
    # 3. počkáme,
    # 4. IHNEĎ scrapneme jeho položky,
    # 5. pokračujeme na ďalší.
    #
    # Preto vôbec nevadí, keď otvorenie ďalšieho accordionu
    # zavrie ten predchádzajúci.
    # ========================================================

    data = page.evaluate(
        """
        async ({ categories }) => {

            const sleep = ms =>
                new Promise(
                    resolve =>
                        setTimeout(resolve, ms)
                );


            // =================================================
            // TEXT HELPERS
            // =================================================

            const clean = value =>
                (value || "")
                    .replace(/\\u00a0/g, " ")
                    .replace(/\\s+/g, " ")
                    .trim();


            const norm = value =>
                clean(value)
                    .normalize("NFD")
                    .replace(
                        /[\\u0300-\\u036f]/g,
                        ""
                    )
                    .toLowerCase();


            const textOf = element =>
                clean(
                    element?.innerText ||
                    element?.textContent ||
                    ""
                );


            // =================================================
            // DOM POSITION HELPERS
            // =================================================

            const isAfter = (a, b) =>
                !!(
                    a.compareDocumentPosition(b)
                    &
                    Node.DOCUMENT_POSITION_FOLLOWING
                );


            const isBefore = (a, b) =>
                !!(
                    a.compareDocumentPosition(b)
                    &
                    Node.DOCUMENT_POSITION_FOLLOWING
                );


            // =================================================
            // HEADINGS
            // =================================================

            const headings = [
                ...document.querySelectorAll(
                    "h1,h2,h3,h4,h5,h6"
                )
            ];


            // TIGGO 7:
            //
            // "Výbava a cenník"
            //
            // ostatné:
            //
            // "Výbavy a cenník"

            const equipmentHeading =
                headings.find(element => {

                    const text =
                        norm(
                            textOf(element)
                        );

                    return (
                        text.includes(
                            "vybava a cennik"
                        )
                        ||
                        text.includes(
                            "vybavy a cennik"
                        )
                    );

                });


            if (!equipmentHeading) {

                throw new Error(
                    'Nenašla sa sekcia ' +
                    '"Výbava/Výbavy a cenník".'
                );

            }


            equipmentHeading.scrollIntoView({
                behavior: "auto",
                block: "start",
            });


            await sleep(300);


            // =================================================
            // TECHNICKÉ ŠPECIFIKÁCIE
            // =================================================

            const technicalHeading =
                headings.find(element =>

                    isAfter(
                        equipmentHeading,
                        element
                    )

                    &&

                    norm(
                        textOf(element)
                    ).includes(
                        "technicke specifikacie"
                    )

                );


            if (!technicalHeading) {

                throw new Error(
                    'Nenašla sa sekcia ' +
                    '"Technické špecifikácie".'
                );

            }


            // =================================================
            // EXTRA TRIM
            // =================================================
            //
            // TIGGO 4 má:
            //
            // Základná výbava pre Comfort
            //
            // +
            //
            // Výbava navyše pre Unique
            //
            // Extra výbavu teda musíme brať ako koniec
            // základných accordionov.
            // =================================================

            const extraTrimHeadings =
                headings.filter(element =>

                    isAfter(
                        equipmentHeading,
                        element
                    )

                    &&

                    isBefore(
                        element,
                        technicalHeading
                    )

                    &&

                    norm(
                        textOf(element)
                    ).startsWith(
                        "vybava navyse pre"
                    )

                );


            const baseEnd =
                extraTrimHeadings[0]
                ||
                technicalHeading;


            const inBaseSection =
                element =>

                    isAfter(
                        equipmentHeading,
                        element
                    )

                    &&

                    isBefore(
                        element,
                        baseEnd
                    );


            // =================================================
            // ACCORDION BUTTONS
            // =================================================

            const categoryNorms =
                categories.map(norm);


            const categoryButtons = [
                ...document.querySelectorAll(
                    'button,[role="button"]'
                )
            ]

                .filter(
                    inBaseSection
                )

                .filter(button => {

                    const text =
                        norm(
                            textOf(button)
                        );


                    return categoryNorms.some(
                        category =>

                            text === category

                            ||

                            text.startsWith(
                                category + " "
                            )
                    );

                });


            if (!categoryButtons.length) {

                throw new Error(
                    "V sekcii výbavy sa " +
                    "nenašli accordion tlačidlá."
                );

            }


            // =================================================
            // ZÁKLADNÝ TRIM
            // =================================================

            const baseTrimHeading =
                headings.find(element =>

                    isAfter(
                        equipmentHeading,
                        element
                    )

                    &&

                    isBefore(
                        element,
                        categoryButtons[0]
                    )

                    &&

                    norm(
                        textOf(element)
                    ).startsWith(
                        "zakladna vybava pre"
                    )

                );


            let baseTrim =
                "Neznáma výbava";


            if (baseTrimHeading) {

                baseTrim =
                    textOf(
                        baseTrimHeading
                    )

                    .replace(
                        /základná\\s+výbava\\s+pre\\s*/i,
                        ""
                    )

                    .trim()

                    ||

                    baseTrim;

            }


            // =================================================
            // ZÁKLADNÁ CENA
            // =================================================

            const elementsBeforeButtons = [
                ...document.querySelectorAll(
                    "body *"
                )
            ].filter(element =>

                isAfter(
                    equipmentHeading,
                    element
                )

                &&

                isBefore(
                    element,
                    categoryButtons[0]
                )

            );


            const basePriceElement =
                elementsBeforeButtons

                    .filter(element =>

                        norm(
                            textOf(element)
                        ).startsWith(
                            "akcna cena"
                        )

                    )

                    .sort(
                        (a, b) =>
                            textOf(a).length
                            -
                            textOf(b).length
                    )[0];


            const basePrice =
                basePriceElement

                    ?

                    textOf(
                        basePriceElement
                    )

                        .replace(
                            /akčná\\s+cena\\s*/i,
                            ""
                        )

                        .trim()

                    :

                    null;


            // =================================================
            // SCRAPOVANIE ACCORDIONOV
            // =================================================

            const baseSections = {};


            for (
                const category
                of categories
            ) {

                const wanted =
                    norm(category);


                // ---------------------------------------------
                // Nájdeme tlačidlo
                // ---------------------------------------------

                const button =
                    categoryButtons.find(
                        btn => {

                            const text =
                                norm(
                                    textOf(btn)
                                );


                            return (
                                text === wanted

                                ||

                                text.startsWith(
                                    wanted + " "
                                )
                            );

                        }
                    );


                if (!button) {

                    throw new Error(
                        `Nenašiel sa accordion "${category}".`
                    );

                }


                // ---------------------------------------------
                // Scroll
                // ---------------------------------------------

                button.scrollIntoView({
                    behavior: "auto",
                    block: "center",
                });


                // ---------------------------------------------
                // Rozkliknutie
                // ---------------------------------------------

                if (
                    button.getAttribute(
                        "aria-expanded"
                    )
                    !==
                    "true"
                ) {

                    button.click();

                    await sleep(450);

                }


                // ---------------------------------------------
                // Hranica kategórie
                // ---------------------------------------------

                const buttonIndex =
                    categoryButtons.indexOf(
                        button
                    );


                const nextButton =
                    categoryButtons[
                        buttonIndex + 1
                    ]
                    ||
                    baseEnd;


                // ---------------------------------------------
                // Scraping LI položiek
                // ---------------------------------------------

                let items = [
                    ...document.querySelectorAll(
                        "li"
                    )
                ]

                    .filter(li =>

                        isAfter(
                            button,
                            li
                        )

                        &&

                        isBefore(
                            li,
                            nextButton
                        )

                    )

                    .map(
                        textOf
                    )

                    .filter(Boolean);


                // ---------------------------------------------
                // FALLBACK:
                // aria-controls
                // ---------------------------------------------

                if (!items.length) {

                    const controls =
                        button.getAttribute(
                            "aria-controls"
                        );


                    const panel =
                        controls
                            ?
                            document.getElementById(
                                controls
                            )
                            :
                            null;


                    if (panel) {

                        items = [
                            ...panel.querySelectorAll(
                                "li"
                            )
                        ]

                            .map(
                                textOf
                            )

                            .filter(Boolean);

                    }

                }


                // ---------------------------------------------
                // Odstránenie duplicít
                // ---------------------------------------------

                items = [
                    ...new Set(items)
                ];


                // ---------------------------------------------
                // VALIDÁCIA
                // ---------------------------------------------

                if (!items.length) {

                    throw new Error(
                        `Accordion "${category}" ` +
                        "bol nájdený, ale neobsahuje " +
                        "žiadne extrahované položky."
                    );

                }


                // ---------------------------------------------
                // Uloženie
                // ---------------------------------------------

                baseSections[
                    category
                ] = items;

            }


            // =================================================
            // TRIMS
            // =================================================

            const trims = [

                {
                    label:
                        "ZÁKLADNÁ VÝBAVA PRE",

                    name:
                        baseTrim,

                    price:
                        basePrice,

                    sections:
                        baseSections,
                }

            ];


            // =================================================
            // EXTRA VÝBAVY
            // =================================================
            //
            // TIGGO 4:
            //
            // Comfort
            // +
            // Unique
            //
            // Unique už nie je riešené accordionom.
            // =================================================

            for (
                let i = 0;
                i < extraTrimHeadings.length;
                i++
            ) {

                const extraStart =
                    extraTrimHeadings[i];


                const extraEnd =
                    extraTrimHeadings[i + 1]
                    ||
                    technicalHeading;


                // ---------------------------------------------
                // Názov trimu
                // ---------------------------------------------

                const trimName =

                    textOf(
                        extraStart
                    )

                    .replace(
                        /výbava\\s+navyše\\s+pre\\s*/i,
                        ""
                    )

                    .trim()

                    ||

                    "Neznáma výbava";


                const inExtraSection =
                    element =>

                        isAfter(
                            extraStart,
                            element
                        )

                        &&

                        isBefore(
                            element,
                            extraEnd
                        );


                const extraElements = [
                    ...document.querySelectorAll(
                        "body *"
                    )
                ].filter(
                    inExtraSection
                );


                // ---------------------------------------------
                // Cena extra výbavy
                // ---------------------------------------------

                const priceElement =
                    extraElements

                        .filter(element =>

                            norm(
                                textOf(element)
                            ).startsWith(
                                "akcna cena"
                            )

                        )

                        .sort(
                            (a, b) =>

                                textOf(a).length
                                -
                                textOf(b).length

                        )[0];


                const price =
                    priceElement

                        ?

                        textOf(
                            priceElement
                        )

                            .replace(
                                /akčná\\s+cena\\s*/i,
                                ""
                            )

                            .trim()

                        :

                        null;


                // ---------------------------------------------
                // Názvy kategórií extra výbavy
                // ---------------------------------------------

                const labels = [];


                for (
                    const category
                    of categories
                ) {

                    const wanted =
                        norm(category);


                    const candidates =
                        extraElements.filter(
                            element => {

                                if (
                                    norm(
                                        textOf(element)
                                    )
                                    !==
                                    wanted
                                ) {

                                    return false;

                                }


                                // Vyberieme najmenší element
                                // obsahujúci názov kategórie.

                                return ![
                                    ...element.children
                                ].some(
                                    child =>

                                        norm(
                                            textOf(child)
                                        )
                                        ===
                                        wanted
                                );

                            }
                        );


                    if (
                        candidates.length
                    ) {

                        candidates.sort(
                            (a, b) => {

                                if (
                                    a === b
                                ) {
                                    return 0;
                                }


                                return isAfter(
                                    a,
                                    b
                                )
                                    ?
                                    -1
                                    :
                                    1;

                            }
                        );


                        labels.push({

                            category:
                                category,

                            element:
                                candidates[0],

                        });

                    }

                }


                // ---------------------------------------------
                // Zoradenie podľa DOM
                // ---------------------------------------------

                labels.sort(
                    (a, b) => {

                        if (
                            a.element
                            ===
                            b.element
                        ) {
                            return 0;
                        }


                        return isAfter(
                            a.element,
                            b.element
                        )
                            ?
                            -1
                            :
                            1;

                    }
                );


                // ---------------------------------------------
                // Scraping extra položiek
                // ---------------------------------------------

                const sections = {};


                for (
                    let j = 0;
                    j < labels.length;
                    j++
                ) {

                    const label =
                        labels[j];


                    const next =
                        labels[j + 1]?.element
                        ||
                        extraEnd;


                    let items = [
                        ...document.querySelectorAll(
                            "li"
                        )
                    ]

                        .filter(li =>

                            isAfter(
                                label.element,
                                li
                            )

                            &&

                            isBefore(
                                li,
                                next
                            )

                        )

                        .map(
                            textOf
                        )

                        .filter(Boolean);


                    items = [
                        ...new Set(items)
                    ];


                    if (
                        items.length
                    ) {

                        sections[
                            label.category
                        ] = items;

                    }

                }


                // ---------------------------------------------
                // Pridanie extra trimu
                // ---------------------------------------------

                if (
                    Object.keys(
                        sections
                    ).length
                ) {

                    trims.push({

                        label:
                            "VÝBAVA NAVYŠE PRE",

                        name:
                            trimName,

                        price:
                            price,

                        sections:
                            sections,

                    });

                }

            }


            // =================================================
            // RETURN
            // =================================================

            return {
                trims
            };

        }
        """,

        {
            "categories":
                categories
        },
    )


    return {

        "brand":
            job.brand,

        "model":
            job.model,

        "url":
            job.url,

        "trims":
            data["trims"],

    }


# ============================================================
# ULOŽENIE TXT
# ============================================================

def save_result(
    result: dict[str, Any],
    output_file: str,
) -> None:

    lines = [

        (
            f'{result["brand"].upper()} '
            f'{result["model"].upper()} '
            f'- VÝBAVA'
        ),

        "=" * 72,

        f'Zdroj: {result["url"]}',

        "=" * 72,

        "",

    ]


    for (
        trim_index,
        trim
    ) in enumerate(
        result["trims"]
    ):

        if trim_index:

            lines.extend([
                "=" * 72,
                "",
            ])


        lines.append(

            f'{trim["label"]} '
            f'{clean_text(trim["name"]).upper()}'

        )


        if trim.get(
            "price"
        ):

            lines.append(

                "Akčná cena: "
                +
                clean_text(
                    trim["price"]
                )

            )


        lines.append("")


        # ====================================================
        # KATEGÓRIE
        # ====================================================

        for (
            category,
            items
        ) in trim[
            "sections"
        ].items():

            lines.append(
                category.upper()
            )

            lines.append(
                "-" * len(category)
            )


            for item in items:

                lines.append(
                    f"- {clean_text(item)}"
                )


            lines.append("")


    # ========================================================
    # WRITE
    # ========================================================

    Path(
        output_file
    ).write_text(

        "\n".join(
            lines
        ).rstrip()
        +
        "\n",

        encoding="utf-8",

    )


# ============================================================
# SCRAPING JOBS
# ============================================================
#
# Ak chceš pridať ďalší CHERY model s rovnakou štruktúrou,
# jednoducho pridáš ďalší ScrapeJob.
#
# Napr.:
#
# ScrapeJob(
#     brand="CHERY",
#     model="NOVÝ MODEL",
#     url="...",
#     output_file="...",
#     scraper="chery_equipment",
# ),
#
# ============================================================

JOBS = [

    # --------------------------------------------------------
    # TIGGO 9 PHEV
    # --------------------------------------------------------

    ScrapeJob(

        brand="CHERY",

        model="TIGGO 9 PHEV",

        url=(
            "https://cheryslovakia.sk/"
            "tiggo/tiggo-9-phev#vybava"
        ),

        output_file=(
            "chery-tigo-9-phev-vybava.txt"
        ),

        scraper=(
            "chery_equipment"
        ),

    ),


    # --------------------------------------------------------
    # TIGGO 8 PHEV
    # --------------------------------------------------------

    ScrapeJob(

        brand="CHERY",

        model="TIGGO 8 PHEV",

        url=(
            "https://cheryslovakia.sk/"
            "tiggo/tiggo-8-phev#vybava"
        ),

        output_file=(
            "chery-tigo-8-phev-vybava.txt"
        ),

        scraper=(
            "chery_equipment"
        ),

    ),


    # --------------------------------------------------------
    # TIGGO 7 HEV
    # --------------------------------------------------------

    ScrapeJob(

        brand="CHERY",

        model="TIGGO 7 HEV",

        url=(
            "https://cheryslovakia.sk/"
            "tiggo/tiggo-7-hev#vybava"
        ),

        output_file=(
            "chery-tigo-7-hev-vybava.txt"
        ),

        scraper=(
            "chery_equipment"
        ),

    ),

        # --------------------------------------------------------
    # TIGGO 7 PHEV
    # --------------------------------------------------------

    ScrapeJob(

        brand="CHERY",

        model="TIGGO 7 PHEV",

        url=(
            "https://cheryslovakia.sk/"
            "tiggo/tiggo-7-phev#vybava"
        ),

        output_file=(
            "chery-tigo-7-phev-vybava.txt"
        ),

        scraper=(
            "chery_equipment"
        ),

    ),


    # --------------------------------------------------------
    # TIGGO 4 HEV
    # --------------------------------------------------------

    ScrapeJob(

        brand="CHERY",

        model="TIGGO 4 HEV",

        url=(
            "https://cheryslovakia.sk/"
            "tiggo/tiggo-4-hev#vybava"
        ),

        output_file=(
            "chery-tigo-4-hev-vybava.txt"
        ),

        scraper=(
            "chery_equipment"
        ),

    ),

]


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    with sync_playwright() as playwright:

        browser = playwright.chromium.launch(
            headless=HEADLESS
        )


        context = browser.new_context(

            viewport={
                "width": 1920,
                "height": 1080,
            },

            locale="sk-SK",

        )


        context.set_default_timeout(
            DEFAULT_TIMEOUT
        )


        successful = 0
        failed = 0


        try:

            for job in JOBS:

                print()
                print("#" * 72)

                print(
                    f"{job.brand} "
                    f"{job.model}"
                )

                print("#" * 72)


                scraper = (
                    SCRAPER_REGISTRY.get(
                        job.scraper
                    )
                )


                if not scraper:

                    print(
                        f"[CHYBA] Scraper "
                        f"'{job.scraper}' "
                        f"nie je registrovaný."
                    )

                    failed += 1

                    continue


                page = (
                    context.new_page()
                )


                try:

                    result = scraper(
                        page,
                        job,
                    )


                    # =========================================
                    # LOG
                    # =========================================

                    for trim in result[
                        "trims"
                    ]:

                        for (
                            category,
                            items
                        ) in trim[
                            "sections"
                        ].items():

                            print(

                                f'[OK] '
                                f'{trim["name"]} / '
                                f'{category}: '
                                f'{len(items)} položiek'

                            )


                    # =========================================
                    # SAVE
                    # =========================================

                    save_result(
                        result,
                        job.output_file,
                    )


                    print(
                        f"[ULOŽENÉ] "
                        f"{job.output_file}"
                    )


                    successful += 1


                except Exception as error:

                    failed += 1


                    print(
                        f"[FATÁLNA CHYBA] "
                        f"{error}"
                    )


                    print(
                        "TXT súbor sa "
                        "neprepísal."
                    )


                finally:

                    page.close()


        finally:

            browser.close()


        # ====================================================
        # SUMMARY
        # ====================================================

        print()
        print("=" * 72)

        print(
            "SÚHRN"
        )

        print("=" * 72)

        print(
            f"Úspešné: "
            f"{successful}"
        )

        print(
            f"Neúspešné: "
            f"{failed}"
        )


if __name__ == "__main__":
    main()