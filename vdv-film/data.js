// Alle Fakten live aus konfigurator.velo-de-ville.com (AEB PRO MY27, 24.11.2026)
window.VDV = {
  motors: [
    { model: 'AEB 490 PRO', motor: 'Active Line Plus', nm: 60, price: 'ab 3.549 €', use: 'Leise Kraft für Stadt und Tour' },
    { model: 'AEB 890 PRO', motor: 'Performance Line', nm: 75, price: 'ab 3.699 €', use: 'Harmonischer Schub für jeden Tag' },
    { model: 'AEB 990PX PRO', motor: 'Performance Line PX', nm: 90, price: 'ab 3.849 €', use: 'Sportlich kräftig für Hügel und Pendelwege' },
    { model: 'AEB 990CX PRO', motor: 'Performance Line CX', nm: 120, price: 'ab 4.049 €', use: 'Maximale Kraft für Berge und Gepäck' }
  ],
  overview: [
    { n: 'AEB PRO', s: ['ab 3.549 €', 'bis zu 120 Nm', 'bis zu 1050 Wh', 'S - XXL'] },
    { n: 'AEB PURE', s: ['ab 2.649 €', 'bis zu 120 Nm', 'bis zu 600 Wh', 'S - XXL'] },
    { n: 'AEB CLASSIC', s: ['ab 2.449 €', 'bis zu 120 Nm', 'bis zu 800 Wh', 'S - XL'] },
    { n: 'AEB CLASSIC XS', s: ['ab 2.449 €', 'bis zu 120 Nm', 'bis zu 800 Wh', 'XS'] },
    { n: 'AEB PRO MY26', s: ['ab 3.699 €', 'bis zu 120 Nm', 'bis zu 875 Wh', 'M - XXL'] }
  ],
  // Reiter in Konfigurator-Reihenfolge. q = Optionsgruppen mit den Optionen, wie sie nach den vorigen Klicks angezeigt werden.
  tabs: [
    { id: 'BASIS', head: 'Das Fundament.', was: 'Akku · Display · Schaltung · Antrieb · Rahmenform · Größe',
      warum: 'Hier entscheidest du, wie weit, wie entspannt und wie wartungsarm du fährst.',
      q: [
        { n: 'AKKU', o: [['Bosch PowerTube 540 Wh', 'inkl.', 'g'], ['Bosch PowerTube 600 Wh', '169 €', 'g'], ['Bosch PowerTube 800 Wh', '479 €', 'g'], ['Bosch PowerMore 250 Wh Range Extender', '499 €', 'g']], a: 0 },
        { n: 'DISPLAY', o: [['Bosch Intuvia 200', 'inkl.', 'y'], ['Bosch Purion 200', '9 €', 'g'], ['Bosch Smartphone Grip', '69 €', 'g'], ['Bosch Kiox 300', '79 €', 'g'], ['Bosch Kiox 500', '119 €', 'g']], a: 0 },
        { n: 'SCHALTUNG', o: [['5 Gang Shimano Nexus Freilauf', '50 €', 'g'], ['Enviolo TR', '400 €', 'g'], ['14 Gang Rohloff', '1.900 €', 'g'], ['9 Gang Shimano CUES U4000', 'inkl.', 'g'], ['10 Gang Shimano CUES U6000', '50 €', 'g'], ['11 Gang Shimano CUES U8000', '150 €', 'y'], ['5 Gang Shimano Nexus Di2 Freilauf', '400 €', 'y'], ['11 Gang Shimano CUES Di2', '600 €', 'g'], ['Enviolo TR AUTOMATiQ', '750 €', 'g'], ['14 Gang Rohloff E14', '2.350 €', 'g']], a: 3 },
        { n: 'ANTRIEB', o: [['Kette', 'inkl.', 'g'], ['Gates CDX Riemenantrieb', '299 €', 'g']], a: 0, appear: 'SCHALTUNG' },
        { n: 'RAHMEN', o: [['Low · S (45 cm) · (1,55-1,70 m)', 'inkl.', 'g'], ['Low · M (48 cm) · (1,60-1,80 m)', 'inkl.', 'g'], ['Low · L (53 cm) · (1,70-1,85 m)', 'inkl.', 'g'], ['Low · XL (58 cm) · (1,80-1,95 m)', 'inkl.', 'g'], ['Low · XXL (63 cm) · (1,90-2,05 m)', 'inkl.', 'y'], ['High · M (48 cm) · (1,60-1,75 m)', 'inkl.', 'g'], ['High · L (53 cm) · (1,70-1,85 m)', 'inkl.', 'y'], ['High · XL (58 cm) · (1,80-1,95 m)', 'inkl.', 'y'], ['High · XXL (63 cm) · (1,90-2,05 m)', 'inkl.', 'g'], ['Mid · M (48 cm) · (1,60-1,75 m)', 'inkl.', 'g'], ['Mid · L (53 cm) · (1,70-1,85 m)', 'inkl.', 'g'], ['Mid · XL (58 cm) · (1,80-1,95 m)', 'inkl.', 'g']], a: 2 }
      ],
      clicks: [
        { q: 'AKKU', o: 2, img: 1, price: 4528, cam: [0.56, 0.47, 2.0], cap: 'Größter integrierter Akku', capS: 'Bosch PowerTube 800 Wh',
          note: ['OPTIONAL · RANGE EXTENDER', 'Bosch PowerMore 250 Wh in Trinkflaschengröße. Mit 800 Wh zusammen bis 1.050 Wh für lange Touren.'] },
        { q: 'DISPLAY', o: 4, img: 2, price: 4647, cam: [0.64, 0.14, 2.7], cap: '2,8-Zoll-Farbdisplay mit Navigation', capS: 'Bosch Kiox 500 · Smart System' },
        { q: 'SCHALTUNG', o: 8, img: 3, price: 5397, cam: [0.215, 0.70, 2.5], cap: 'Schaltet automatisch und stufenlos', capS: 'Enviolo TR AUTOMATiQ · Bosch eShift' },
        { q: 'ANTRIEB', o: 1, img: 4, price: 5696, cam: [0.32, 0.76, 2.4], cap: 'Riemen statt Kette. Ohne Öl.', capS: 'Gates CDX Riemenantrieb' },
        { q: 'RAHMEN', o: 10, img: 5, price: 5696, cam: [0.5, 0.52, 1.05], cap: 'Drei Rahmenformen, S bis XXL', capS: 'Mid · L (53 cm) · 1,70–1,85 m' }
      ] },
    { id: 'STYLE', head: 'Farbe als Haltung.', was: 'Rahmenfarbe · Oberfläche glanz oder matt · Dekor',
      warum: '18 Farbtöne, glanz oder matt. Dein Rad erkennst du unter hunderten.',
      q: [
        { n: 'RAHMENFARBE', o: [['Deep Black glanz', 'inkl.', 'g'], ['Deep Black matt', '50 €', 'g'], ['Night Blue glanz', 'inkl.', 'g'], ['Night Blue matt', '50 €', 'g'], ['Poppy Red glanz', 'inkl.', 'g'], ['Poppy Red matt', 'inkl.', 'g'], ['Ice Blue glanz', 'inkl.', 'g'], ['Ice Blue matt', '50 €', 'g'], ['Stone Basalt glanz', 'inkl.', 'g'], ['Stone Basalt matt', '50 €', 'g'], ['Scarlet Red glanz', 'inkl.', 'g'], ['Scarlet Red matt', '50 €', 'g'], ['French Lavender glanz', '50 €', 'g'], ['French Lavender matt', '50 €', 'g'], ['Olive Green glanz', '50 €', 'g'], ['Olive Green matt', '50 €', 'g'], ['Emerald Green glanz', '50 €', 'g'], ['Emerald Green matt', '50 €', 'g'], ['Crystal Pearl glanz', '50 €', 'g'], ['Crystal Pearl matt', '50 €', 'g'], ['Petrol Blue glanz', '50 €', 'g'], ['Petrol Blue matt', '50 €', 'g'], ['Pure White glanz', '50 €', 'g'], ['Pure White matt', '50 €', 'g'], ['Eucalyptus Green glanz', '50 €', 'g'], ['Eucalyptus Green matt', '50 €', 'g'], ['Ocean Blue glanz', '50 €', 'g'], ['Ocean Blue matt', '50 €', 'g'], ['Lime Green glanz', '50 €', 'g'], ['Lime Green matt', '50 €', 'g'], ['Ruby Red glanz', '50 €', 'g'], ['Ruby Red matt', '50 €', 'g'], ['Melon Yellow glanz', '50 €', 'g'], ['Melon Yellow matt', '50 €', 'g'], ['ECO Grey', 'inkl.', 'g']], a: 0 },
        { n: 'DEKOR', o: [['VDV Schwarz', 'inkl.', 'g'], ['VDV Weiß', 'inkl.', 'g']], a: 0, appear: 'RAHMENFARBE' }
      ],
      clicks: [
        { q: 'RAHMENFARBE', o: 32, img: 6, price: 5746, cam: [0.5, 0.52, 1.0], cap: 'Eine Farbe, die man sieht', capS: 'Melon Yellow glanz', event: 'color' }
      ] },
    { id: 'AUSSTATTUNGSPAKETE', short: 'PAKETE', head: 'Gebündelt gedacht.', was: 'Komfort · Sicherheit · Gewicht · Belastbarkeit · Look',
      warum: 'Ein Paket tauscht mehrere Teile auf einmal. Wir wählen hier jedes Teil einzeln.',
      q: [
        { n: 'PREMIUM', pk: '649 €', d: 'Hochwertigere Teile rundum, von Gabel bis Ladegerät' },
        { n: 'STYLE', pk: '59 €', d: 'Braune Akzente für den Vintage-Look' },
        { n: 'HAPPY SIZE 160', pk: '329 €', d: 'Belastbar bis 160 kg Gesamtgewicht' },
        { n: 'LIGHTWEIGHT', pk: '99 €', d: 'Spürbar leichter und agiler' },
        { n: 'ABS', pk: '689 €', d: 'Bosch ABS, 4-Kolben-Bremse, stabile Steckachsgabel' },
        { n: 'COMFORT', pk: '149 €', d: 'Aufrechtere, bequemere Sitzposition' }
      ],
      clicks: [] },
    { id: 'ERGONOMIE', head: 'Auf dich gebaut.', was: 'Vorbau · Lenker · Sattel',
      warum: 'Die richtige Haltung entlastet Hände, Rücken und Gesäß auf jeder Strecke.',
      q: [
        { n: 'VORBAU', o: [['Ergotec Octopus 50 Ahead', 'inkl.', 'g'], ['Ergotec Barracuda 90 Ahead', '9 €', 'g'], ['by.Schulz Speedlifter Twist Pro SDS', '159 €', 'g'], ['Ergotec Sepia 130 Ahead', '19 €', 'g']], a: 0 },
        { n: 'LENKER', o: [['Ergotec Trekking (620 mm)', 'inkl.', 'g'], ['Ergotec Riser (660 mm)', '9 €', 'g'], ['Ergotec Comfort (635 mm)', '9 €', 'g'], ['Ergotec Stuttgarter (600 mm)', '9 €', 'g']], a: 0 },
        { n: 'SATTEL', o: [['Selle Royal Explora Relaxed', 'inkl.', 'y'], ['Selle Royal Explora Moderate', 'inkl.', 'g'], ['Selle Royal Explora Moderate Wide', 'inkl.', 'g']], a: 0 }
      ],
      clicks: [
        { q: 'LENKER', o: 1, img: 7, price: 5755, cam: [0.64, 0.13, 2.6], cap: 'Breiter, leicht erhöhter Griff', capS: 'Ergotec Riser · 660 mm' },
        { q: 'SATTEL', o: 1, img: 8, price: 5755, cam: [0.37, 0.27, 2.7], cap: 'Für die aufrechte Tourenhaltung', capS: 'Selle Royal Explora Moderate' }
      ] },
    { id: 'KOMFORT', head: 'Jeder Meter weicher.', was: 'Sattelstütze · Gabel · Bereifung',
      warum: 'Federung und Reifen schlucken Kanten, bevor du sie spürst.',
      q: [
        { n: 'SATTELSTÜTZE', o: [['Patent, gefedert', 'inkl.', 'g'], ['by.Schulz G.2 ST Parallelogramm', '179 €', 'g'], ['SR Suntour NCX, 30,9x350', '79 €', 'g'], ['Koryak DSP 70 Dropperpost (absenkbar)', '189 €', 'y']], a: 0 },
        { n: 'GABEL', o: [['SR Suntour NCX32, 80mm, Lockout, QR', 'inkl.', 'g'], ['Alu Big Disc in Rahmenfarbe', '9 €', 'y'], ['SR Suntour NRX32 Air, 75mm, Lockout, QR', '69 €', 'g']], a: 0 },
        { n: 'BEREIFUNG', o: [['Schwalbe Green Marathon 50-622 (28")', 'inkl.', 'g'], ['Schwalbe Marathon E Plus 50-622 (28")', '29 €', 'g'], ['Schwalbe Motion Big Apple 50-622 (28")', '9 €', 'g'], ['Schwalbe Marathon Plus Tour 60-584 (27,5")', '49 €', 'g']], a: 0 }
      ],
      clicks: [
        { q: 'SATTELSTÜTZE', o: 1, img: 9, price: 5934, cam: [0.375, 0.32, 2.6], cap: 'Parallelogramm-Federung', capS: 'by.Schulz G.2 ST' },
        { q: 'GABEL', o: 2, img: 10, price: 6003, cam: [0.70, 0.55, 2.2], cap: 'Luftfederung mit Lockout', capS: 'SR Suntour NRX32 Air · 75 mm' },
        { q: 'BEREIFUNG', o: 1, img: 11, price: 6032, cam: [0.80, 0.84, 2.1], cap: 'Für E-Bikes entwickelt', capS: 'Schwalbe Marathon E Plus 50-622' }
      ] },
    { id: 'SICHERHEIT', head: 'Sehen. Bremsen. Schützen.', was: 'Bremsen · Scheinwerfer · Rahmenschloss · GPS-Tracking',
      warum: 'Mehr Bremskraft, mehr Licht und ein Rad, das sich wiederfinden lässt.',
      q: [
        { n: 'BREMSEN', o: [['Shimano Disc MT200', 'inkl.', 'g'], ['Shimano MT420, 4-Kolben / 2-Kolben', '129 €', 'g']], a: 0 },
        { n: 'SCHEINWERFER', o: [['Busch&Müller Briq-S (60 Lux)', 'inkl.', 'g'], ['Supernova Mini 3 Daylight (125 Lux)', '69 €', 'g'], ['Supernova M99 Pro 2 (130/450 Lux Fernlicht)', '339 €', 'g'], ['Busch&Müller Turntec Blinker', '279 €', 'g']], a: 0 },
        { n: 'RAHMENSCHLOSS', o: [['ohne', 'inkl.', 'g'], ['ABUS 4750 XL, Schlüssel abziehbar (gleichschließend)', '39 €', 'g'], ['ABUS 4750 XL, Schlüssel nicht abziehbar (gleichschließend)', '39 €', 'g']], a: 0 },
        { n: 'GPS TRACKING', o: [['VELOMATE (1 Jahr)', '109 €', 'g'], ['ohne', 'inkl.', 'g']], a: 1 }
      ],
      clicks: [
        { q: 'BREMSEN', o: 1, img: 12, price: 6161, cam: [0.765, 0.69, 2.7], cap: 'Mehr Kolben, mehr Biss', capS: 'Shimano MT420 · 4-Kolben / 2-Kolben' },
        { q: 'SCHEINWERFER', o: 2, img: 13, price: 6500, cam: [0.725, 0.37, 2.8], cap: '130 Lux, Fernlicht 450 Lux', capS: 'Supernova M99 Pro 2', event: 'beam' },
        { q: 'RAHMENSCHLOSS', o: 1, img: 14, price: 6539, cam: [0.25, 0.62, 2.4], cap: 'Schnell abgeschlossen, Schlüssel abziehbar', capS: 'ABUS 4750 XL' },
        { q: 'GPS TRACKING', o: 0, img: 15, price: 6648, cam: [0.5, 0.52, 1.0], cap: 'GPS-Ortung bei Diebstahl', capS: 'VELOMATE · 1 Jahr' }
      ] },
    { id: 'ZUBEHÖR', head: 'Bereit für mehr.', was: 'Frontzubehör · Ladegerät',
      warum: 'Korb oder Frontträger für den Einkauf. Ein stärkeres Ladegerät für kurze Pausen.',
      q: [
        { n: 'FRONTZUBEHÖR', o: [['ohne', 'inkl.', 'g'], ['VELO DE VILLE Front Korb Pro, 40 x 30 cm', '119 €', 'g'], ['Vorderradgepäckträger (MIK Deck)', '49 €', 'g'], ['Vorderradgepäckträger (Snap-It 2.0 Deck)', '49 €', 'g'], ['Frontmount Adapter', '19 €', 'g']], a: 0, info: true },
        { n: 'LADEGERÄT', o: [['Bosch 2A', 'inkl.', 'g'], ['Bosch 4A', '29 €', 'g'], ['Bosch 12A', '219 €', 'y']], a: 0 }
      ],
      clicks: [
        { q: 'LADEGERÄT', o: 1, img: 16, price: 6677, cam: [0.5, 0.52, 1.0], cap: 'Doppelter Ladestrom gegenüber 2 A', capS: 'Bosch 4A' }
      ],
      infoNote: ['OPTIONAL · FRONTZUBEHÖR', 'Front-Korb, Frontträger oder Adapter: vorne mehr Platz für Einkauf und Gepäck.'] }
  ],
  summary: ['120 Nm', '800 Wh', 'Automatik + Riemen', 'Kiox 500', '450 Lux Fernlicht', 'Melon Yellow'],
  finalPrice: 6677,
  finalKg: '31,2 kg'
};
