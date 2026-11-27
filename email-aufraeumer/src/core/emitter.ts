// Kleiner Ereignis-Verteiler ohne Node – damit der Aufräumer auch im Browser (Handy-App) läuft.
type Hoerer = (...args: any[]) => void;

export class Ereignisse {
  private hoerer = new Map<string, Set<Hoerer>>();
  on(name: string, f: Hoerer): this { if (!this.hoerer.has(name)) this.hoerer.set(name, new Set()); this.hoerer.get(name)!.add(f); return this; }
  off(name: string, f: Hoerer): this { this.hoerer.get(name)?.delete(f); return this; }
  emit(name: string, ...args: any[]): boolean {
    const h = this.hoerer.get(name);
    if (!h?.size) return false;
    for (const f of [...h]) { try { f(...args); } catch { /* ein Hörer darf die anderen nicht stören */ } }
    return true;
  }
}
