"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INSTITUTIONS = [
  "Baobab CI",
  "UNACOOPEC",
  "REMUCI",
  "Advans CI",
  "NSIA",
  "Ecobank",
  "Atlantique Assurances",
  "AXA",
  "Wakama Demo",
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [institution, setInstitution] = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
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
        institutionId?:   string;
        institutionName?: string;
        institutionType?: string;
        modules?:         string[];
      };

      console.log("[login] response:", JSON.stringify(data));

      localStorage.setItem("wakama_token",      data.token);
      localStorage.setItem("wakama_fmi_token",  data.token);
      localStorage.setItem(
        "wakama_user",
        JSON.stringify({ email: data.email, role: data.role })
      );
      localStorage.setItem("wakama_fmi_institution_id",   data.institutionId ?? "");
      localStorage.setItem("wakama_fmi_institution_name", data.institutionName ?? institution);
      localStorage.setItem("wakama_fmi_institution_type", data.institutionType ?? "");
      localStorage.setItem("wakama_fmi_modules",          JSON.stringify(data.modules ?? []));
      localStorage.setItem("wakama_fmi_institution",      institution);

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
    <div
      style={{
        minHeight: "100vh",
        background: "#080d18",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#0d1423",
          borderRadius: 12,
          padding: "32px 28px",
          /* Gradient border via outline trick */
          position: "relative",
          border: "1px solid rgba(16,185,129,0.2)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 48px rgba(0,0,0,0.4)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 28 }}>
          <img src="/wakama-logo.png" alt="Wakama" style={{ height: 28, width: "auto" }} />
          <p style={{ fontSize: 11, color: "#5a6a85", letterSpacing: "0.04em" }}>
            MFI DASHBOARD
          </p>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#e8edf5", lineHeight: 1, marginBottom: 6 }}>
            Connexion
          </h1>
          <p style={{ fontSize: 12, color: "#5a6a85" }}>
            Accédez à votre espace partenaire MFI
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Institution */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label
              htmlFor="institution"
              style={{ fontSize: 11, fontWeight: 500, color: "#5a6a85", letterSpacing: "0.04em" }}
            >
              VOTRE INSTITUTION
            </label>
            <select
              id="institution"
              required
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              style={{
                width: "100%",
                height: 34,
                padding: "0 10px",
                background: "#0a1020",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: institution ? "#e8edf5" : "#3a4a60",
                fontSize: 12,
                outline: "none",
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
              }}
              onFocus={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = "#10b981";
                (e.target as HTMLSelectElement).style.boxShadow = "0 0 0 2px rgba(16,185,129,0.1)";
              }}
              onBlur={(e) => {
                (e.target as HTMLSelectElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.target as HTMLSelectElement).style.boxShadow = "none";
              }}
            >
              <option value="" disabled style={{ color: "#3a4a60" }}>
                Sélectionner…
              </option>
              {INSTITUTIONS.map((inst) => (
                <option key={inst} value={inst} style={{ background: "#0d1423", color: "#e8edf5" }}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label
              htmlFor="email"
              style={{ fontSize: 11, fontWeight: 500, color: "#5a6a85", letterSpacing: "0.04em" }}
            >
              ADRESSE EMAIL
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@mfi.ci"
              style={{
                width: "100%",
                height: 34,
                padding: "0 10px",
                background: "#0a1020",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#e8edf5",
                fontSize: 12,
                outline: "none",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#10b981";
                (e.target as HTMLInputElement).style.boxShadow = "0 0 0 2px rgba(16,185,129,0.1)";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.target as HTMLInputElement).style.boxShadow = "none";
              }}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label
              htmlFor="password"
              style={{ fontSize: 11, fontWeight: 500, color: "#5a6a85", letterSpacing: "0.04em" }}
            >
              MOT DE PASSE
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                height: 34,
                padding: "0 10px",
                background: "#0a1020",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#e8edf5",
                fontSize: 12,
                outline: "none",
              }}
              onFocus={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "#10b981";
                (e.target as HTMLInputElement).style.boxShadow = "0 0 0 2px rgba(16,185,129,0.1)";
              }}
              onBlur={(e) => {
                (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.target as HTMLInputElement).style.boxShadow = "none";
              }}
            />
          </div>

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 14, color: "#ef4444", fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20', flexShrink: 0 }}
              >
                error
              </span>
              <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 36,
              marginTop: 6,
              background: loading ? "rgba(16,185,129,0.6)" : "#10b981",
              color: "#000",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "opacity 150ms",
            }}
            onMouseEnter={(e) => {
              if (!loading)
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "1";
            }}
          >
            {loading ? (
              <>
                <span
                  className="material-symbols-outlined animate-spin"
                  style={{ fontSize: 15 }}
                >
                  progress_activity
                </span>
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#3a4a60",
            marginTop: 20,
          }}
        >
          Accès réservé aux partenaires MFI agréés Wakama
        </p>
      </div>

      <p style={{ fontSize: 10, color: "#3a4a60", marginTop: 24 }}>
        © 2026 Wakama Edge Ventures Inc. — Abidjan, Côte d&apos;Ivoire
      </p>
    </div>
  );
}
