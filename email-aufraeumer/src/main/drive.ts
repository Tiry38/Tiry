// Große Anhänge über Google Drive (wie Gmail und Outlook es auch machen):
// Datei in einen eigenen Ordner „Tiry's Mails Anhänge“ hochladen, für „jeder mit Link“ lesbar machen, Link zurückgeben.
// Scope drive.file: das Programm sieht nur Dateien, die es selbst angelegt hat – nicht dein übriges Drive.
import fs from 'node:fs';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ORDNER_NAME = "Tiry's Mails Anhänge";

export async function grosseDateiHochladen(auth: any, datei: { pfad: string; name: string; mime: string }, fortschritt?: (prozent: number) => void): Promise<{ link: string; id: string }> {
  const { google } = require('googleapis') as typeof import('googleapis');
  const drive = google.drive({ version: 'v3', auth });
  // Ordner finden oder anlegen (nur eigene Dateien sind sichtbar → findet nur den eigenen Ordner)
  const such = await drive.files.list({ q: `mimeType='application/vnd.google-apps.folder' and name='${ORDNER_NAME.replace(/'/g, "\\'")}' and trashed=false`, fields: 'files(id)', spaces: 'drive' });
  let ordnerId = such.data.files?.[0]?.id;
  if (!ordnerId) {
    const o = await drive.files.create({ requestBody: { name: ORDNER_NAME, mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
    ordnerId = o.data.id!;
  }
  const groesse = fs.statSync(datei.pfad).size;
  const r: any = await drive.files.create(
    { requestBody: { name: datei.name, parents: [ordnerId] }, media: { mimeType: datei.mime, body: fs.createReadStream(datei.pfad) }, fields: 'id,webViewLink' },
    { onUploadProgress: (e: any) => fortschritt?.(Math.min(100, Math.round((e.bytesRead / groesse) * 100))) } as any,
  );
  const id = r.data.id!;
  await drive.permissions.create({ fileId: id, requestBody: { role: 'reader', type: 'anyone' } });
  return { id, link: r.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
}
