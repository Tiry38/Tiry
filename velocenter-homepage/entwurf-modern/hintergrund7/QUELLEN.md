# Bildquellen Vorlage „Echte Landschaften“ (hintergrund7)

Alle Fotos von Unsplash (Unsplash-Lizenz: kostenlos, auch gewerblich, ohne Namensnennung; keine Personen im Bild).

| Szene | Datei | Unsplash-Foto |
|---|---|---|
| Alpental | `img/tal-*.webp` | https://images.unsplash.com/photo-1464822759023-fed622ff2c3b |
| Wolkenmeer | `img/meer-*.webp` | https://images.unsplash.com/photo-1506905925346-21bda4d32df4 (gespiegelt) |
| Hochland 2045 | `img/pass-*.webp` | https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05 |

Tiefenkarten (`*-d.png`, `pass-h.png`) selbst berechnet mit Depth Anything V2 Small (ONNX, Apache-2.0).
`*-d.png`: R = Tiefe, G = Himmel-Maske, B = Fließ-Maske (Wolken/Nebel). `pass-h.png`: Tiefe 16 Bit (R = hoch, G = tief) für die Höhenlinien.
Bauen: `python3 inject.py <live-index.html> <ziel.html> [tal|meer|pass] [--feste-bilder]`, Bilder nach `img/hg7/` neben die Seite kopieren.
