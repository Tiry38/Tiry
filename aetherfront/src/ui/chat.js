// Chat im Spiel (Online): Enter öffnet die Eingabe, Enter sendet, Esc schließt. „/t “ am Anfang = nur Team.
// Neue Nachrichten erscheinen kurz im Protokoll und verblassen, solange die Eingabe geschlossen ist.
import { escapeHtml } from './hud.js';

const $ = (id) => document.getElementById(id);

export class NetChat {
  constructor({ audio, send }) {
    this.audio = audio;
    this.send = send;           // send({ text, team })
    this.box = $('chat');
    this.log = $('chat-log');
    this.input = $('chat-input');
    this.enabled = false;
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const raw = this.input.value.trim();
        if (raw) {
          const team = /^\/t\s/i.test(raw);
          const text = team ? raw.replace(/^\/t\s+/i, '') : raw;
          if (text) this.send({ text, team });
        }
        this.close();
      } else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
  }
  /** Chat für eine Partie aktivieren (nur online) */
  reset(enabled) {
    this.enabled = enabled;
    this.log.innerHTML = '';
    this.close();
    this.box.classList.toggle('on', enabled);
  }
  get isOpen() { return this.box.classList.contains('open'); }
  open() {
    if (!this.enabled) return;
    this.box.classList.add('open');
    this.input.value = '';
    this.input.focus();
  }
  close() {
    this.box.classList.remove('open');
    this.input.blur();
  }
  add({ from, text, team = false, system = false }) {
    if (!this.enabled) return;
    const line = document.createElement('div');
    line.className = `cl${system ? ' sys' : ''}${team ? ' team' : ''}`;
    line.innerHTML = system ? `<span>${escapeHtml(text)}</span>` : `<b>${team ? '[Team] ' : ''}${escapeHtml(from)}:</b> <span>${escapeHtml(text)}</span>`;
    this.log.appendChild(line);
    while (this.log.children.length > 30) this.log.firstChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
    setTimeout(() => line.classList.add('old'), 9000);
    if (!system) this.audio.ui('hover');
  }
}
