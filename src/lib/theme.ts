import * as db from "@/lib/db";

export const VALID_THEMES = ["future", "ocean", "neon", "emerald", "sunset"] as const;
export type ThemeId = (typeof VALID_THEMES)[number];

export function isValidTheme(themeId: string): themeId is ThemeId {
  return (VALID_THEMES as readonly string[]).includes(themeId);
}

/**
 * Aplica a classe do tema no document.documentElement.
 * Remove todas as classes de tema anteriores antes de aplicar a nova.
 */
export function applyThemeClass(themeId: string) {
  const root = document.documentElement;

  VALID_THEMES.forEach((t) => root.classList.remove(`theme-${t}`));

  // 'future' é o padrão (:root), então não adicionamos classe
  if (themeId !== "future" && isValidTheme(themeId)) {
    root.classList.add(`theme-${themeId}`);
  }
}

/**
 * Offline-first: IndexedDB é a fonte principal.
 * localStorage é apenas fallback e carregamento inicial rápido.
 */
export async function getTheme(): Promise<ThemeId> {
  try {
    const indexedDbTheme = await db.getSetting<string>("app_theme");
    if (indexedDbTheme && isValidTheme(indexedDbTheme)) return indexedDbTheme;
  } catch (e) {
    console.error("Erro ao carregar tema do IndexedDB:", e);
  }

  const localTheme = localStorage.getItem("app_theme");
  if (localTheme && isValidTheme(localTheme)) return localTheme;

  return "future";
}

/**
 * Salva no IndexedDB (principal) e atualiza localStorage (backup/fallback).
 */
export async function saveTheme(themeId: ThemeId): Promise<void> {
  localStorage.setItem("app_theme", themeId);

  try {
    await db.saveSetting("app_theme", themeId);
  } catch (e) {
    console.error("Erro ao salvar tema no IndexedDB:", e);
  }
}
