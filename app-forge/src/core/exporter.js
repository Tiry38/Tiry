'use strict';
/**
 * Export – macht aus einer App-Version ein Store-Paket:
 *  www/                 PWA (direkt hostbar, z. B. Firebase Hosting)
 *  capacitor.config.json + package.json  → Android-/iOS-Projekt per Capacitor
 *  STORE-LISTING.md     fertige Store-Texte (Google Play / App Store)
 *  DATENSCHUTZ.md       Vorlage Datenschutzerklärung (App speichert nur lokal)
 *  ANLEITUNG.md         Schritt-für-Schritt bis zum Store-Upload
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./library');

function packageId(meta) {
  const s = slugify(meta.name).replace(/-/g, '');
  return `de.tiry.${(/^[a-z]/.test(s) ? s : `app${s}`).slice(0, 30)}`;
}

function storeListing(meta) {
  const c = meta.concept || {};
  const title = (meta.name || '').slice(0, 30);
  return `# Store-Eintrag: ${meta.name}

## Titel (max. 30 Zeichen)
${title}

## Kurzbeschreibung (Google Play, max. 80 Zeichen)
${(c.store_short_description || meta.tagline || '').slice(0, 80)}

## Untertitel (App Store, max. 30 Zeichen)
${(meta.tagline || '').slice(0, 30)}

## Beschreibung (max. 4000 Zeichen)
${(c.store_full_description || '').slice(0, 4000)}

## Funktionen
${(c.features || []).map((f) => `- ${f}`).join('\n')}

## Keywords (App Store, max. 100 Zeichen gesamt)
${(c.keywords || []).join(',').slice(0, 100)}

## Kategorie
${meta.type === 'game' ? 'Spiele' : meta.category || ''}

## Monetarisierung (Vorschlag)
${c.monetization || ''}

## Inhaltsbewertung
Keine Gewalt, keine Nutzerinhalte, keine Datenerhebung – Fragebogen im Store entsprechend ausfüllen.

## Datenschutz-Angaben im Store
Die App erhebt und überträgt keine Daten. Alles bleibt lokal auf dem Gerät (localStorage).
`;
}

function privacyPolicy(meta) {
  return `# Datenschutzerklärung für „${meta.name}“

**Vorlage – vor Veröffentlichung prüfen und mit deinen Angaben ergänzen.**

## Verantwortlicher
[Vorname Nachname], [Straße Hausnummer], [PLZ Ort], E-Mail: [Kontakt-E-Mail]

## Welche Daten verarbeitet die App?
Die App speichert deine Eingaben ausschließlich lokal auf deinem Gerät (Browser-Speicher „localStorage“).
Es werden **keine personenbezogenen Daten an uns oder Dritte übertragen**. Die App nutzt keine Werbe-,
Tracking- oder Analyse-Dienste und lädt keine Inhalte von fremden Servern.

## Löschung
Du kannst alle Daten löschen, indem du die App deinstallierst oder die App-Daten in den Geräteeinstellungen entfernst.

## Deine Rechte
Da wir keine Daten über dich erhalten, liegen bei uns keine Daten vor. Bei Fragen erreichst du uns unter der oben genannten E-Mail-Adresse.
Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.

Stand: ${new Date().toLocaleDateString('de-DE')}
`;
}

function guide(meta) {
  const id = packageId(meta);
  return `# Von der App zum Store – ${meta.name}

## 1. Sofort testen (ohne Store)
Ordner \`www/\` auf einen Webspace/Firebase Hosting hochladen → auf dem Handy öffnen → „Zum Startbildschirm hinzufügen“.

## 2. Android (Google Play)
Voraussetzungen: Node.js, Android Studio, Google-Play-Entwicklerkonto (einmalig 25 US-$).
\`\`\`
npm install
npx cap add android
npx cap sync android
npx cap open android
\`\`\`
In Android Studio: *Build → Generate Signed App Bundle* (.aab) → in der Play Console hochladen.
Hinweis: Neue private Entwicklerkonten müssen vor dem Produktiv-Release einen geschlossenen Test mit mind. 12 Testern über 14 Tage durchführen.

## 3. iOS (App Store)
Voraussetzungen: Mac mit Xcode, Apple Developer Program (99 US-$/Jahr).
\`\`\`
npx cap add ios
npx cap sync ios
npx cap open ios
\`\`\`
In Xcode signieren → *Product → Archive* → über App Store Connect einreichen.
Achtung Richtlinie 4.2/4.3: Apple lehnt sehr ähnliche oder "dünne" Apps ab – nur ausgereifte, eigenständige Apps einreichen.

## 4. Rechtliches (Kurz-Check)
- Name vorher beim DPMA/EUIPO auf Markenkonflikte prüfen.
- Impressum und Datenschutzerklärung (siehe DATENSCHUTZ.md) öffentlich verlinken.
- Verkauf = gewerbliche Tätigkeit → Gewerbe anmelden, Einnahmen versteuern.

Paket-ID: \`${id}\`
`;
}

function exportApp({ library, meta, outRoot, extraFiles = {} }) {
  const src = library.versionDir(meta.id, meta.currentVersion);
  const dir = path.join(outRoot, `${slugify(meta.name)}-v${meta.currentVersion}`);
  const www = path.join(dir, 'www');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(www, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    if (f === 'screenshot.png') continue;
    fs.copyFileSync(path.join(src, f), path.join(www, f));
  }
  if (fs.existsSync(path.join(src, 'screenshot.png'))) fs.copyFileSync(path.join(src, 'screenshot.png'), path.join(dir, 'screenshot.png'));
  const id = packageId(meta);
  const files = {
    'capacitor.config.json': JSON.stringify({ appId: id, appName: meta.name, webDir: 'www', bundledWebRuntime: false }, null, 2),
    'package.json': JSON.stringify({
      name: slugify(meta.name),
      version: `1.0.${meta.currentVersion}`,
      private: true,
      scripts: { 'cap:android': 'cap add android && cap sync android', 'cap:ios': 'cap add ios && cap sync ios', sync: 'cap sync' },
      dependencies: { '@capacitor/core': '^7.0.0', '@capacitor/android': '^7.0.0', '@capacitor/ios': '^7.0.0' },
      devDependencies: { '@capacitor/cli': '^7.0.0' }
    }, null, 2),
    'STORE-LISTING.md': storeListing(meta),
    'DATENSCHUTZ.md': privacyPolicy(meta),
    'ANLEITUNG.md': guide(meta),
    ...extraFiles
  };
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return { dir, packageId: id };
}

module.exports = { exportApp, storeListing, privacyPolicy, packageId };
