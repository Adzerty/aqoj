// Pied de page global — discret, dans l'esprit épuré du site.
export function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-4 text-center text-sm text-muted sm:px-6">
        <p>aqoj — à quoi on joue · fait pour jouer entre potes</p>
        <a
          href="https://buymeacoffee.com/adevzerty"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <span>☕</span>
          Offrir un café
        </a>
      </div>
    </footer>
  );
}
