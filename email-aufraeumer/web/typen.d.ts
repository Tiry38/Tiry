// Typen für Dateien, die Vite selbst auflöst
declare module 'sql.js' { const initSqlJs: (o?: { locateFile?: (f: string) => string }) => Promise<any>; export default initSqlJs; }
declare module '*?url' { const url: string; export default url; }
