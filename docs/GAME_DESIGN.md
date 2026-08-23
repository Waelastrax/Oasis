# Oasis — herní design

Účel: zdroj pravdy pro potvrzené herní principy. Návrhy a neuzavřené volby jsou výslovně označené.

## Vize

Oasis je malá tahová 3D izometrická fantasy survival hra. Uprostřed mapy leží magická oáza, ve které hráč začíná, buduje zázemí a připravuje výpravy. Do okolní pouště vyráží pro suroviny, poklady, nové lokace a střety s nepřáteli.

Lepší zázemí a vybavení umožňují dojít dál od oázy, přijmout větší riziko a získat hodnotnější odměny. Jádrem hry není cesta zpět, ale rozhodnutí, jak dlouho pokračovat směrem ven a kolik zdrojů při tom riskovat.

## Základní herní smyčka

**Příprava a stavba v oáze → plánování expedice → pohyb, průzkum, sběr a boj → rozhodnutí pokračovat, nebo se teleportovat → návrat a zpracování kořisti → rozvoj oázy**

## Pilíře

1. **Čitelné plánování** — hráč předem vidí cenu pohybu a interakcí.
2. **Dobrovolné riskování** — pokračování za hranici vody je možné a může se vyplatit.
3. **Trvalý rozvoj oázy** — zázemí rozšiřuje dosah a možnosti dalších expedic.
4. **Užitková magie** — magie podporuje průzkum, práci s pouští a návrat, není zaměřená jen na boj.
5. **Pokrok i po neúspěchu** — smrt je hlavně zpočátku očekávanou součástí hry a vždy přináší alespoň určitý meta-progress.

## Svět a oáza

- Oáza leží uprostřed mapy a je bezpečným výchozím bodem.
- Je zdrojem vody, magie, skladování, výroby a budování.
- Magie pochází z oázy; rozvoj oázy může později ovlivňovat její množství nebo možnosti použití.
- Vzdálenější části pouště nabízejí lepší odměny a vyšší riziko.
- Přesná podoba světa a míra procedurálního generování zatím nejsou rozhodnuté.

## Tahy a energie

Hra nepostupuje čistě v reálném čase. Herní stav se mění provedením akcí, takže hráč může bez postihu plánovat trasu, prohlížet mapu nebo pracovat s inventářem.

Každá významná akce má cenu v **Energii**:

- pohyb po mapě,
- interakce s předmětem nebo lokací,
- sběr a těžba,
- boj,
- další fyzicky nebo časově náročné činnosti.

Cena je před potvrzením akce viditelná. Energie zároveň určuje spotřebu vody. Přesný převod energie na vodu a případné modifikátory vybavením, terénem či počasím budou určeny při prototypování.

### Plánování pohybu

- Pohyb se plánuje podobně jako v sérii Heroes of Might and Magic.
- Hráč zvolí cíl a hra zobrazí trasu a její cenu.
- Pod vizuálně souvislým 3D světem bude skrytý rastr.
- Pohyb používá hexový rastr se šesti rovnocennými směry.

## Voda a pokračování bez vody

Voda určuje bezpečný rozsah expedice, ale její vyčerpání výpravu automaticky neukončí.

Po vyčerpání vody může hráč pokračovat. Další spotřeba Energie vyvolává v intervalech hod vyčerpání. Losuje se pouze mezi zdroji, které hráč ještě má:

1. ztráta části Vitality,
2. ztráta části Esence,
3. ztráta části nesené kořisti.

Jednotlivé ztráty mají malý náhodný rozsah. Příklad pro budoucí balancování: ztráta 2–8 bodů z počátečních 20 bodů Vitality.

### Pravidla hodu vyčerpání

- Hráč zná možné výsledky a jejich rozsahy, ale neví, který nastane.
- Pokud Esence klesne na nulu, přestane se tato kategorie losovat.
- Pokud hráč nemá žádnou kořist, přestane se losovat ztráta kořisti.
- Pokud jsou Esence i kořist vyčerpané, každý další hod zasáhne Vitalitu.
- Při poklesu Vitality na nulu hráč umírá a expedice končí.
- Přesný interval hodů a jejich pravděpodobnosti se určí prototypováním.

Tento systém vytváří stupňující se riziko: čím více rezerv hráč vyčerpá, tím větší je pravděpodobnost, že další postup skončí smrtí.

## Magie

Magie je primárně užitková a tematicky vychází z oázy. Potvrzené nebo zamýšlené příklady:

- stopování,
- hledání pokladů v poušti,
- obnova vytěžené flóry v oáze,
- teleport zpět do oázy.

Teleport je spolehlivý návrat, ale stojí Esenci. V poušti lze také najít portál vedoucí zpět do oázy; jeho použití Esenci nestojí. Hráč proto může Esenci utratit za jiná kouzla a riskovat, že bude muset portál najít dříve, než zemře.

Obnova nebo kapacita Esence bude navázaná na hydrataci hráče. Přesná podoba vazby zatím není rozhodnutá.

## Návrat a konec expedice

- Hráč se nemusí fyzicky vracet přes již překonanou poušť.
- Běžný jistý návrat zajišťuje kouzlo teleportace za cenu Esence.
- Nalezený portál umožní návrat bez spotřeby Esence.
- Pokud hráč zemře, výprava končí ztrátou alespoň části okamžitého zisku.
- Přesná pravidla zachování vybavení a kořisti po smrti zatím nejsou uzavřená.

## Smrt a meta-progress

Smrt může být hlavně v začátcích hry častá a očekávaná. Nemá však znamenat výpravu zcela bez výsledku.

- Každá expedice může přispět k trvalému meta-progressu.
- Množství a forma meta-progressu se mohou odvíjet od dosažené vzdálenosti, objevů, střetů nebo dalších úspěchů výpravy.
- Konkrétní meta-progrese a přesná ztráta kořisti při smrti zatím nejsou rozhodnuté.

## Boj

- Hráč v poušti potkává nepřátele, které může přemoci.
- Boj je tahový nebo je alespoň zapojený do tahové ekonomiky expedice.
- Boj spotřebovává Energii a tím může zkrátit bezpečný dosah výpravy.
- Konkrétní bojový systém, prostor boje a způsob výpočtu jeho ceny zatím nejsou rozhodnuté.

## Pracovní názvy zdrojů

| Funkce | Pracovní název | Alternativy |
| --- | --- | --- |
| cena akcí | **Energie** | Výdrž, Námaha, Úsilí, Tempo, Akční body |
| magie | **Esence** | Moc, Pramen, Síla oázy, Pramenná síla, Éter, Záře |
| zdraví | **Vitalita** | Život, Odolnost, Kondice, Tělesná síla |

Názvy jsou zatím pracovní. Energie a Esence se nemají používat současně jako finální dvojice, protože jsou si příliš podobné v textu i rozhraní.

## Skrytý rastr: čtverce versus hexy

### Čtvercový rastr

Výhody:

- jednodušší implementace souřadnic, cest a obsahu,
- dobře se váže na pravoúhlé stavby a místnosti,
- snadné rozmísťování a editace mapy,
- známé a předvídatelné ovládání.

Nevýhody:

- diagonální pohyb vyžaduje zvláštní pravidlo ceny,
- vzdálenosti a kruhové dosahy působí hranatě,
- čtyři směry jsou omezující, osm směrů vytváří rozdíl mezi rovným a diagonálním krokem.

### Hexový rastr

Výhody:

- šest rovnocenných sousedů bez problematických diagonál,
- přirozenější vzdálenosti, dosahy a postup do všech směrů od centrální oázy,
- trasy po poušti méně připomínají pohyb po šachovnici,
- dobře odpovídá radiální struktuře světa.

Nevýhody:

- složitější souřadnice, nástroje a umísťování obsahu,
- pravoúhlé stavby se na něj vážou hůře,
- některé vizuální trasy mohou při skrytém rastru působit mírně klikatě.

### Rozhodnutí

Expedice používají **hexový rastr**, protože hlavním prostorovým motivem je postup od oázy směrem ven. Budování nemusí používat stejný rastr; může mít vlastní jemnější čtvercovou mřížku, volné umísťování nebo kotevní body.

## Otevřená rozhodnutí

- Určit podobu a rozsah budování v oáze.
- Navrhnout konkrétní tahový bojový systém.
- Určit převod Energie na vodu a interval hodů vyčerpání.
- Rozhodnout přesnou vazbu hydratace na Esenci.
- Stanovit následky smrti, zachování vybavení a podobu meta-progressu.
- Rozhodnout podobu mapy a procedurálního generování.
- Potvrdit finální názvy zdrojů pro cenu akcí, magii a zdraví.
