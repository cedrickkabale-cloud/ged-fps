export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-slate-200/70 bg-white/80 backdrop-blur-sm py-3 px-4 md:px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
      <span className="font-semibold text-slate-700">DIRSIC / Fonds de Promotion de la Santé</span>
      <span className="hidden sm:inline text-slate-300">·</span>
      <span>© {year} — Tous droits réservés</span>
    </footer>
  );
}
