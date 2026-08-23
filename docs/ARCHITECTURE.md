# Architektura

Účel: zdroj pravdy pro technická rozhodnutí a strukturu projektu.

## Aktuální stav

Zatím existuje pouze dokumentační základ. Perspektiva, tahový model, skrytý hexový rastr a Three.js jsou potvrzené.

## Předběžný technický směr

- Webová aplikace optimalizovaná i pro mobilní zařízení.
- Základ: Vite + TypeScript, Vinext a React pro obal aplikace.
- 3D izometrický svět používá pro pohyb a výpočet tras skrytý hexový rastr.
- Renderer: Three.js s ortografickou kamerou.
- Herní pravidla zůstávají v čistém TypeScriptu a nesmí záviset na Three.js.
- Rozhraní je běžná HTML/CSS vrstva nad 3D scénou.
- Produkční build musí být staticky nasaditelný na běžný webový hosting.

## Zamýšlená struktura

```text
Oasis/
├── app/            # Stránka, herní klient a UI
├── docs/           # Návrh, architektura a plán práce
├── public/         # Statické soubory
├── build/          # Integrace produkčního sestavení
├── scripts/        # Ověřené instalační a build skripty
├── worker/         # Produkční serverový vstup
├── AGENTS.md       # Krátké instrukce pro práci na projektu
├── README.md       # Veřejný přehled projektu
└── package.json    # Skripty a závislosti
```

## Pravidla pro budoucí kód

- Herní pravidla oddělovat od vykreslování a uživatelského rozhraní.
- Herní obsah ukládat datově, pokud se má často rozšiřovat nebo balancovat.
- Nepřidávat knihovnu bez konkrétní potřeby.
- Preferovat malé moduly s jasnou odpovědností.
- Technické rozhodnutí, které ovlivní více částí projektu, stručně zapsat sem.
- Náhoda v herních pravidlech musí používat uložený seed, aby šlo chyby reprodukovat.
- Herní čas se posouvá příkazy, ne reálným časem stráveným v plánování.
- Vizuální a herní mrakové pole musí vycházet ze stejných deterministických dat.

## Otevřená technická rozhodnutí

- Ukládání postupu: pouze lokální, nebo později serverové.
- Přesný model hexové mapy, tahů a simulace zásob.
- Cílový hosting.
