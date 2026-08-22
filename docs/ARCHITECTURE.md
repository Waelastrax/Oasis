# Architektura

Účel: zdroj pravdy pro technická rozhodnutí a strukturu projektu.

## Aktuální stav

Zatím existuje pouze dokumentační základ. Framework, renderer a přesná struktura zdrojového kódu ještě nejsou potvrzené.

## Předběžný technický směr

- Webová aplikace optimalizovaná i pro mobilní zařízení.
- Vhodný výchozí bod: Vite + TypeScript.
- Herní framework nebo vlastní Canvas renderer se zvolí podle potvrzené perspektivy a rozsahu simulace.
- Produkční build musí být staticky nasaditelný na běžný webový hosting.

## Zamýšlená struktura

```text
Oasis/
├── docs/           # Návrh, architektura a plán práce
├── public/         # Statické soubory kopírované beze změny
├── src/            # Zdrojový kód aplikace (po založení)
├── AGENTS.md       # Krátké instrukce pro práci na projektu
├── README.md       # Veřejný přehled projektu
└── package.json    # Skripty a závislosti (po založení aplikace)
```

## Pravidla pro budoucí kód

- Herní pravidla oddělovat od vykreslování a uživatelského rozhraní.
- Herní obsah ukládat datově, pokud se má často rozšiřovat nebo balancovat.
- Nepřidávat knihovnu bez konkrétní potřeby.
- Preferovat malé moduly s jasnou odpovědností.
- Technické rozhodnutí, které ovlivní více částí projektu, stručně zapsat sem.

## Otevřená technická rozhodnutí

- Herní framework: Phaser, nebo vlastní Canvas.
- Ukládání postupu: pouze lokální, nebo později serverové.
- Přesný model světa, času a simulace zásob.
- Cílový hosting.

