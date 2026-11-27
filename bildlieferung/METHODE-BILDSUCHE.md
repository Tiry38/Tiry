# Methode: Velo-de-Ville-Bilder fuer Lagerraeder finden und freistellen

Ziel je Lagerrad: ein sauberes Seitenbild (Antriebsseite, Fahrtrichtung rechts), freigestellt (PNG mit Alpha),
exakt Modell + Rahmenform + Farbe. VdV baut custom (30+ Farben) -> Werksbilder gibt es nur fuer manche Kombis.

## Begriffe
- VdV "Wave" = Tiefeinsteiger, "Trapez" = Trapez, "Diamant" = Herren. Modelljahr-Generationen unterscheiden sich im Rahmen!
- Farbnamen VdV: pure white, deep black, stone basalt, night blue, british green, ocean blue, ice blue,
  wine red, scarlet red, mocca brown, sahara brown, emerald green, crystal pearl, eco grey, melon yellow ... (+ _gl glanz / _ma matt)

## Quellen in dieser Reihenfolge
1. ebike-dresden.com – hat OFFIZIELLE VdV-Werksbilder, oft schon freigestellt (PNG/WebP mit Alpha).
   Dateinamen wie `885716-VELODEVILLE_AEB400_Allround_wine_red_glanz.png`, `12370-VELO_DE_VILLE_AEB490_Allround_625_Wh_sahara_brown_matt.png`.
   Produktseiten laden: `curl -sL -A "Mozilla/5.0" <url> | grep -oE 'https://www\.ebike-dresden\.com/media/[^"'"'"' ]+\.(png|webp|jpg)'`
   Suche: firecrawl_search / tavily "Velo de Ville <Modell> <Farbe> ebike-dresden".
2. Internet-Archiv der alten VdV-Seite (2022-2024, Drupal): Modellseiten unter
   https://web.archive.org/web/2023/https://www.velo-de-ville.com/de/e-bikes/allround  bzw. /suv  (Unterseiten /allround/aeb-490 ...).
   Werksbilder heissen `pim_images/my23_<modell>_<farbe>_<gl|ma>-N.png`. web.archive.org ist per curl hier blockiert -> nur ueber firecrawl_scrape.
3. Gebraucht-/Refurbished-Haendler mit Studiofotos auf weissem Grund: refurbed.de, rebike.com, upway.*, cleverbikes.de, bike2future.de, e-bike-only.de,
   99spokes.com / 2bx.bike (je Modellvariante ein Werksbild, URL d2yn9m4p3q9iyv.cloudfront.net/velodeville/<jahr>/<variante>/thumbs/1000/<id>.webp).
   Bilder per curl laden (Shopify: `?width=1600`), ansehen (Read-Tool), Farbe/Rahmen/Modell pruefen.
4. Lagerverkauf-Shops mit Werksrendern je Farbe: ebike-24.com, fahrradlagerverkauf.com, pedelec.de, zweitrad.de, e-bikes.de.

## Pruefen (Pflicht, jedes Bild ansehen)
Modell (z. B. AEB490 nicht AEB890), Generation/Rahmenform (Wave/Trapez/Diamant, Akku integriert/teilintegriert), Farbe, Antriebsseite.
Abweichungen (Schaltung, Sattelstuetze, Akku) notieren.

## Freistellen
- Schon transparentes PNG -> nur `im.crop(im.getbbox())`.
- Sonst: `pip install "rembg[cpu]"`, Modell `birefnet-general` (am besten bei weissem Rahmen auf weissem Grund):
  `from rembg import remove,new_session; remove(img, session=new_session('birefnet-general'))`
  danach Kanten entsaeumen: Farbe = (Quelle - (1-a)*Hintergrund)/a fuer halbtransparente Pixel.
- Kontrolle: auf hellem (240,232,215) und dunklem (40,40,48) Grund ansehen.

## Notloesung Farbe
Gibt es das exakt gleiche Modell nur in anderer Farbe als Werksbild: Rahmenpixel im HSV verschieben (Farbton/Saettigung/Helligkeit)
auf Referenzwerte, gemessen an einem echten Foto der Zielfarbe. Immer als "umgefaerbt" kennzeichnen. Nie KI-generieren.

## Ausgabe je Rad
`<FID>.png` + Quelle (URL), Art (Werksbild / Haendlerfoto / umgefaerbt), Abweichungen.
