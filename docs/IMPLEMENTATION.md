# Návrh implementace

Účel: popsat doporučený technický postup a hranice prvního hratelného prototypu. Herní pravidla zůstávají v `GAME_DESIGN.md`, potvrzená technická rozhodnutí v `ARCHITECTURE.md`.

## Doporučený stack

- **Vite + TypeScript** — aplikace, build a vývojový server.
- **Three.js** — 3D scéna, ortografická kamera, výběr objektů a animace pohybu.
- **HTML + CSS** — ovládací prvky, panely zdrojů, tooltipy a mobilní rozhraní.
- **Vitest** — testy herních pravidel, hexových souřadnic a deterministické náhody.
- **localStorage** — první verzované ukládání postupu bez serveru.

Three.js je doporučení, ne dosud potvrzené rozhodnutí. Phaser ani vlastní Canvas renderer se pro 3D izometrický svět nehodí tak dobře. Babylon.js by poskytl více hotových systémů, ale pro malou tahovou hru by přinesl větší API a více struktury, než zatím potřebujeme.

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
src/
├── app/                 # spuštění aplikace a propojení vrstev
├── game/
│   ├── state/           # GameState, hráč, expedice a uložený postup
│   ├── actions/         # náhled a provedení pohybu, sběru a kouzel
│   ├── systems/         # voda, vyčerpání, kořist, Pramen a smrt
│   ├── hex/             # souřadnice, sousedé, vzdálenost a hledání cesty
│   └── random/          # generátor náhody se seedem
├── content/             # datové definice terénů, lokací, zdrojů a kouzel
├── render/              # Three.js scéna, kamera, modely a animace
├── ui/                  # DOM panely, tooltipy a ovládání
├── persistence/         # verzované ukládání a načítání
└── main.ts
```

Pro první prototyp není potřeba ECS, fyzikální engine ani globální stavová knihovna.

## Herní stav

Minimální stav má obsahovat:

```ts
interface GameState {
  phase: 'oasis' | 'expedition' | 'dead'
  player: PlayerState
  world: WorldState
  expedition: ExpeditionState | null
  rngSeed: number
  saveVersion: number
}

interface PlayerState {
  hex: HexCoord
  vitality: number
  spring: number
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

Energie je jednotka ceny, nikoli další ukazatel, který musí hráč samostatně doplňovat. Pohyb, těžba, průzkum a později boj mají cenu v Energii.

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

Teprve po ověření této smyčky následují stavby, více typů lokací, užitková kouzla a boj.

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

1. Potvrdit Three.js jako renderer.
2. Určit, zda je mapa mezi expedicemi trvalá, nebo se částečně znovu generuje.
3. Stanovit první pracovní hodnoty převodu Energie na vodu a prahu vyčerpání.
