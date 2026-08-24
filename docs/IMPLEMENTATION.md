# Návrh implementace

Účel: popsat doporučený technický postup a hranice prvního hratelného prototypu. Herní pravidla zůstávají v `GAME_DESIGN.md`, potvrzená technická rozhodnutí v `ARCHITECTURE.md`.

## Doporučený stack

- **Vite + Vinext + React + TypeScript** — aplikace, build, komponenty rozhraní a vývojový server.
- **Three.js** — 3D scéna, ortografická kamera, výběr objektů a animace pohybu.
- **HTML + CSS** — ovládací prvky, panely zdrojů, tooltipy a mobilní rozhraní.
- **Vitest** — testy herních pravidel, hexových souřadnic a deterministické náhody.
- **localStorage** — první verzované ukládání postupu bez serveru.

Three.js je potvrzený renderer. Phaser ani vlastní Canvas renderer se pro 3D izometrický svět nehodí tak dobře. Babylon.js by poskytl více hotových systémů, ale pro malou tahovou hru by přinesl větší API a více struktury, než potřebujeme.

## Zásadní rozdělení

Herní simulace nesmí znát Three.js ani HTML. Renderer pouze zobrazuje stav a UI odesílá příkazy.

```text
vstup hráče
    ↓
náhled příkazu a ceny
    ↓
potvrzení příkazu
    ↓
čistá změna GameState
    ↓
Three.js scéna + HTML UI
```

Stejný výpočet ceny se použije pro náhled i skutečné provedení. UI tak nemůže ukázat jinou cenu, než jakou následně odečte simulace.

## Navržená struktura zdrojového kódu

```text
app/                     # aktuální stránka, Three.js scéna a UI
game/                    # budoucí čistá herní simulace
├── state/               # GameState, hráč, expedice a uložený postup
├── actions/             # náhled a provedení pohybu, sběru a kouzel
├── systems/             # voda, vyčerpání, kořist, Pramen a smrt
├── hex/                 # souřadnice, sousedé, vzdálenost a hledání cesty
└── random/              # generátor náhody se seedem
content/                 # datové definice terénů, lokací, zdrojů a kouzel
persistence/             # verzované ukládání a načítání
```

Three.js scéna a její dočasný herní stav zatím zůstávají v `app/oasis-game.tsx`. A* a hexová geometrie jsou oddělené v `game/hex/grid.ts`; společná vizuální a pravidlová maska mraků je v `game/systems/clouds.ts`. Další pravidla se budou postupně přesouvat do samostatných modulů. Není potřeba ECS, fyzikální engine ani globální stavová knihovna.

## Aktuálně implementovaný řez

- výběr cíle na skrytém hexovém rastru,
- A* trasa od aktuální pozice hráče,
- náhled kroků, Energie, vody a průměrného zastínění,
- potvrzený plynulý pohyb postavy po trase,
- odečtení vody a posun herního času,
- plynule se pohybující mraková maska sdílená obrazem i výpočtem stínu.
- dva režimy kamery: plynulé sledování hráče a volný posun,
- volná kamera ovládaná šipkami, pravým tlačítkem myši nebo dvěma prsty; gesto zároveň podporuje přiblížení,
- bezešvá mraková textura bez viditelných hran opakování a okrajů projekční plochy.
- potvrzení naplánované cesty tlačítkem nebo druhým klepnutím na stejný cíl,
- oáza se startem hráče na suchém poli vedle jezírka a poušť o poloměru 15 hexů (721 polí celkem).
- přepínatelné klasické a přírodní zobrazení nad společným herním stavem; přírodní režim používá souvislý mesh s modelovanými dunami a oválným jezírkem.
- ložiska Slunečního kamene, těžbu za Energii, nesený náklad, sklad v oáze a návrat teleportem nebo bezplatným portálem.

## Herní stav

Minimální stav má obsahovat:

```ts
interface GameState {
  phase: 'oasis' | 'expedition' | 'dead'
  player: PlayerState
  world: WorldState
  expedition: ExpeditionState | null
  rngSeed: number
  worldTime: number
  saveVersion: number
}

interface PlayerState {
  hex: HexCoord
  vitality: number
  spring: number
  energy: number
  water: number
  cargo: CargoStack[]
}
```

Anglický interní název pro Pramen je navržený jako `spring`. Pokud by to při programování působilo nejasně, lze použít explicitnější `oasisPower`; hráčské rozhraní vždy používá český název Pramen.

## Hexová mapa

- Použít axiální souřadnice `q, r`; třetí souřadnice je odvozená.
- Každé pole nese typ terénu, cenu Energie, průchodnost a případný obsah.
- Trasu počítá A*; pro zobrazení všech dosažitelných polí lze použít Dijkstrův algoritmus.
- Skrytý rastr je zdrojem pravdy pro pravidla, 3D postava se mezi středy hexů pouze plynule animuje.
- Terén lze zpočátku vykreslit jednoduchými hexovými díly nebo nízkopolygonálními plochami; viditelné obrysy mřížky nejsou nutné.

## Příkazy, náhled a provedení

Každá hráčská akce má datový příkaz a vypočtený náhled:

```ts
type GameCommand =
  | { type: 'move'; destination: HexCoord }
  | { type: 'gather'; targetId: string }
  | { type: 'castReturn' }
  | { type: 'usePortal'; portalId: string }

interface ActionPreview {
  allowed: boolean
  energyCost: number
  waterCost: number
  dryEnergy: number
  exhaustionRolls: number
  path?: HexCoord[]
  warnings: string[]
}
```

`previewCommand(state, command)` nic nemění. `executeCommand(state, command)` znovu použije stejný výpočet a vytvoří nový stav.

## Energie, voda a vyčerpání

Energie je jednotka ceny i samostatná zásoba hráče. Pohyb, těžba, průzkum a později boj nejprve čerpají Energii. Když nestačí, voda ji automaticky doplní v poměru 1 voda za 2 Energie.

Pro první prototyp:

1. akce vypočítá cenu Energie,
2. cena se převede na spotřebu vody,
3. část ceny, kterou už voda nepokryje, se zapíše jako suchá Energie,
4. po překročení nastavitelného prahu suché Energie proběhne hod vyčerpání.

Hod vybírá pouze z nenulových kategorií:

- ztráta Vitality,
- ztráta Pramene,
- ztráta kořisti.

Rozsahy, váhy a práh jsou data, nikoli hodnoty pevně zapsané v systému. Náhoda používá seed uložený ve stavu. Náhled trasy ukáže počet očekávaných hodů a možné rozsahy, nikoli jejich konkrétní výsledky.

## Vykreslování a ovládání

- Ortografická kamera vytváří izometrický dojem a umožní zoom a posun mapy.
- Výběr hexu a objektů používá raycasting z dotyku nebo myši.
- Po výběru cíle se zobrazí trasa, cena Energie, spotřeba vody a varování před vyčerpáním.
- Druhé potvrzení nebo samostatné tlačítko provede akci; riziková cesta se nesmí spustit omylem jediným dotykem.
- UI je responzivní DOM vrstva, nikoli text a tlačítka vykreslovaná uvnitř 3D scény.
- Plynulá animace pohybu nemění tahová pravidla a lze ji přeskočit nebo zrychlit.

## Vizuální implementace bez hotových assetů

První vizuální verze používá vlastní jednoduché low-poly tvary místo směsi nesourodých assetů:

- terén tvoří barevně odstupňované hexové plochy s mírnou změnou výšky,
- duny vzniknou deformací vrcholů a jemnou barevnou variací, ne detailní texturou,
- kameny lze vytvořit z nepravidelných nízkopolygonálních těles,
- kmeny, listy a jednoduché stavby se skládají z několika základních geometrií,
- oáza dostane samostatný vodní materiál, sytější vegetaci a chladnější ambientní světlo,
- postava a složitější objekty mohou být v prvním prototypu čitelné stylizované zástupné modely.

Materiály mají sdílet omezenou paletu a podobnou hrubost povrchu. Kvalitu dojmu mají nést hlavně kompozice, siluety, světlo a stín; vyšší geometrický detail se přidává až tam, kde zlepšuje čitelnost.

## Dynamické osvětlení a cyklus dne

- Slunce představuje jeden `DirectionalLight`, který jako jediný hlavní zdroj vrhá dynamické stíny.
- Měkké vyplňující světlo zajišťuje `HemisphereLight`; jeho barva a intenzita se mění s denní dobou.
- Východ, den, západ a noc interpolují barvu oblohy, mlhy, světla a jeho směr.
- V noci se hlavní směrové světlo přepne na slabý měsíční režim místo druhé souběžné stínové mapy.
- Stínová kamera sleduje jen viditelnou oblast kolem hráče. Rozlišení a počet objektů vrhajících stín se přizpůsobí mobilnímu výkonu.
- Herní čas se zvyšuje příkazem přibližně jako `worldTime += energyCost * minutesPerEnergy`; samotné přemýšlení hráče čas neposouvá.
- Po provedení příkazu renderer změnu osvětlení plynule animuje, ale pravidla okamžitě pracují s novým diskrétním časem.

## Mraky a jejich stíny

Mraky se nemají vykreslovat jako skutečná geometrie vrhající stíny přes shadow mapu. To by bylo drahé a na mobilu zbytečné.

Doporučený systém:

1. ze seedu se vytvoří opakovatelná nízkofrekvenční `DataTexture` mraků,
2. maska používá doménově deformovaný vícevrstvý šum a měkký práh, aby nevypadala jako obyčejný Perlinův šum,
3. stejná textura se v shaderu promítá ve světových souřadnicích na terén a pomalu posouvá směrem větru,
4. CPU dokáže stejnou masku vzorkovat ve středu každého hexu pro herní pravidla,
5. vizuální stín a herní sleva Energie proto odpovídají stejnému poli.

Mrakový stín pouze ztmavuje a mírně ochlazuje výslednou barvu povrchu; nevytváří další skutečnou stínovou mapu.

### Vliv na tahy

Pro každý krok plánované trasy se postupuje deterministicky:

1. určí se budoucí světový čas při vstupu na hex,
2. z tohoto času a polohy se vzorkuje pokrytí mrakem,
3. vypočítá se malý modifikátor ceny Energie,
4. výsledná cena posune čas pro následující krok.

Náhled tak dokáže ukázat konečnou cenu celé trasy včetně očekávaného stínu. Doporučený první rozsah slevy je nejvýše 10–15 % pro venkovní fyzické akce. Přesná hodnota zůstává konfigurační a bude se testovat; magie ani interakce uvnitř staveb ji používat nemusí.

## První hratelný prototyp

První prototyp záměrně neobsahuje stavění ani plný boj. Má ověřit hlavní rozhodování expedice.

1. Malá hexová mapa s oázou uprostřed.
2. Ortografická kamera a výběr cíle myší i dotykem.
3. A* trasa s viditelnou cenou Energie a vody.
4. Hráč s Vitalitou, Pramenem, vodou a jednoduchým nákladem.
5. Jedna těžitelná surovina a její odnesení do oázy.
6. Teleport za Pramen a jeden bezplatný portál na mapě.
7. Pokračování bez vody a deterministické hody vyčerpání.
8. Smrt, návrat do oázy a jednoduchý meta-progress za největší dosaženou vzdálenost.
9. Uložení a načtení stavu.
10. Základní akční cyklus dne a noci a levná pohybující se maska stínů mraků.

Teprve po ověření této smyčky následují stavby, více typů lokací, užitková kouzla a boj.

### Doporučené testovací hodnoty

Tyto hodnoty slouží jen k rychlému ověření smyčky a mají být uložené v konfiguračních datech:

- mapa má poloměr 15 hexů a při založení hry se jednou vygeneruje ze seedu,
- mapa i objevený obsah zůstávají mezi expedicemi trvalé,
- hráč začíná s 20 Vitality, 10 body Pramene a 12 jednotkami vody,
- akce nejprve čerpají maximálně 10 bodů Energie; po jejich vyčerpání 1 voda automaticky doplní 2 Energie,
- každé 3 body suché Energie vyvolají jeden hod vyčerpání,
- ztráta Vitality má rozsah 2–8,
- ztráta Pramene má rozsah 1–3,
- ztráta kořisti odebere 1–3 kusy z dostupného nechráněného nákladu,
- teleport stojí 6 bodů Pramene.

Trvalá mapa je doporučená proto, aby měl průzkum hodnotu a hráč si vytvářel znalost okolí oázy. Seed umožní svět přesně reprodukovat při testování.

Meta-progress později zvyšuje konfigurovatelná základní maxima, zejména Vitalitu a Pramen. První datový model má proto oddělit základní hodnotu, trvalý bonus, bonus vybavení a výslednou hodnotu.

## Testy, které mají vzniknout současně s prototypem

- vzdálenost, sousedé a převody hexových souřadnic,
- A* vrací nejlevnější průchozí trasu,
- náhled a provedení akce mají shodnou cenu,
- voda správně rozdělí cenu na krytou a suchou Energii,
- nulový Pramen nebo prázdná kořist se vyřadí z hodu,
- stejný seed a příkazy vytvoří stejný výsledek,
- teleport a portál správně ukončí expedici,
- starší uložený stav lze odmigrovat nebo bezpečně odmítnout.

## Rozhodnutí před zahájením kódu

1. Potvrdit, nebo upravit doporučení trvalé mapy generované jednou ze seedu.
2. Potvrdit, nebo upravit doporučené testovací hodnoty.
3. Určit délku herního dne a počáteční vliv stínu na cenu Energie.
