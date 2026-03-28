import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-bg-primary px-4">
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-bg-secondary border border-gray-800">
        <span
          className="material-symbols-outlined text-text-muted"
          style={{
            fontSize: 40,
            fontVariationSettings: '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 48',
          }}
        >
          search_off
        </span>
      </div>

      <div className="text-center space-y-2">
        <p className="text-5xl font-bold text-text-primary font-mono">404</p>
        <h1 className="text-xl font-semibold text-text-primary">Page introuvable</h1>
        <p className="text-sm text-text-secondary max-w-sm">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
        Retour au dashboard
      </Link>
    </div>
  );
}
