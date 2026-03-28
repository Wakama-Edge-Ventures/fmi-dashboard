export type Theme = "dark" | "light";

const LS_KEY = "wakama_theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(LS_KEY) as Theme) ?? "dark";
}

export function setTheme(t: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, t);
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(t);
}

/** Apply saved theme on first load (call from layout script or useEffect). */
export function initTheme(): void {
  if (typeof window === "undefined") return;
  const saved = (localStorage.getItem(LS_KEY) as Theme) ?? "dark";
  document.documentElement.classList.remove("dark", "light");
  document.documentElement.classList.add(saved);
}
