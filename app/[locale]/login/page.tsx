"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("https://api.wakama.farm/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? "Identifiants incorrects");
      }

      const data = (await res.json()) as {
        token: string;
        role: string;
        email: string;
      };

      localStorage.setItem("wakama_token", data.token);
      localStorage.setItem(
        "wakama_user",
        JSON.stringify({ email: data.email, role: data.role })
      );

      // Derive locale from URL
      const localeMatch = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/);
      const locale = localeMatch ? localeMatch[1] : "fr";
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-bg-secondary border-r border-gray-800 p-12">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>
              agriculture
            </span>
          </div>
          <div>
            <p className="text-base font-bold text-text-primary leading-none">Wakama</p>
            <p className="text-xs text-text-muted">MFI Dashboard</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
            <span className="material-symbols-outlined text-accent" style={{ fontSize: 16 }}>
              verified
            </span>
            <span className="text-xs font-medium text-accent">Score Wakama en 30 secondes</span>
          </div>
          <h2 className="text-4xl font-bold text-text-primary leading-tight">
            Financez l&apos;agriculture
            <br />
            <span className="text-accent">avec confiance</span>
          </h2>
          <p className="text-text-secondary text-base leading-relaxed max-w-md">
            Accédez aux données certifiées de vos agriculteurs — NDVI satellite,
            IoT terrain, score 4C — pour prendre des décisions de crédit éclairées.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { value: "3 000+", label: "Agriculteurs scorés" },
              { value: "97%", label: "Taux de remboursement" },
              { value: "30s", label: "Score en temps réel" },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl bg-bg-tertiary border border-gray-800">
                <p className="text-2xl font-bold text-accent font-mono">{stat.value}</p>
                <p className="text-xs text-text-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-text-muted">
          © 2026 Wakama Edge Ventures Inc. — Abidjan, Côte d&apos;Ivoire
        </p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center p-8 bg-bg-primary">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent">
              <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>
                agriculture
              </span>
            </div>
            <p className="text-base font-bold text-text-primary">Wakama MFI</p>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-text-primary">Connexion</h1>
            <p className="text-sm text-text-secondary mt-1">
              Accédez à votre espace MFI
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-secondary"
              >
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@mfi.ci"
                className="w-full px-4 py-2.5 rounded-lg bg-bg-tertiary border border-gray-700 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-secondary"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg bg-bg-tertiary border border-gray-700 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-alert-critical/10 border border-alert-critical/30">
                <span className="material-symbols-outlined text-alert-critical shrink-0" style={{ fontSize: 16 }}>
                  error
                </span>
                <p className="text-sm text-alert-critical">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
                    progress_activity
                  </span>
                  Connexion…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <p className="text-xs text-center text-text-muted">
            Accès réservé aux partenaires MFI agréés Wakama
          </p>
        </div>
      </div>
    </div>
  );
}
