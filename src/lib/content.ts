import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export type Lang = 'es' | 'en';
export const LANGS: Lang[] = ['es', 'en'];

const ROOT = process.cwd();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const content: any = parse(readFileSync(join(ROOT, 'content.yaml'), 'utf8'));

/** Devuelve el texto en el idioma pedido. Acepta strings, arrays u objetos {es, en}. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tr(value: any, lang: Lang): any {
  if (value == null) return '';
  if (typeof value === 'object' && !Array.isArray(value) && ('es' in value || 'en' in value)) {
    return value[lang] ?? value.es ?? value.en ?? '';
  }
  return value;
}

const MONTHS: Record<Lang, string[]> = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const MONTHS_SHORT: Record<Lang, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function parseYm(ym: string | null | undefined): [number, number] | null {
  if (!ym) return null;
  const [y, m] = String(ym).split('-').map(Number);
  if (!y) return null;
  return [y, m || 1];
}

/** "2020-08" -> "Agosto 2020" / "August 2020" */
export function formatMonth(ym: string | null | undefined, lang: Lang): string {
  const p = parseYm(ym);
  if (!p) return '';
  return `${MONTHS[lang][p[1] - 1]} ${p[0]}`;
}

/** Fecha ISO -> "17 oct 2026" / "Oct 17, 2026" */
export function formatDate(iso: string | Date | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = MONTHS_SHORT[lang][d.getUTCMonth()];
  return lang === 'es' ? `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}` : `${m} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Fecha ISO -> "ago 2026" / "Aug 2026" */
export function formatMonthShort(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS_SHORT[lang][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Duración entre dos "AAAA-MM" (end null = hoy), ambos meses incluidos. */
export function duration(start: string, end: string | null | undefined, lang: Lang): string {
  const s = parseYm(start);
  if (!s) return '';
  const now = new Date();
  const e = parseYm(end) ?? [now.getFullYear(), now.getMonth() + 1];
  let months = (e[0] - s[0]) * 12 + (e[1] - s[1]);
  if (!end) months += 1;
  if (months < 1) months = 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (lang === 'es') {
    if (y) parts.push(`${y} ${y === 1 ? 'año' : 'años'}`);
    if (m) parts.push(`${m} ${m === 1 ? 'mes' : 'meses'}`);
  } else {
    if (y) parts.push(`${y} ${y === 1 ? 'yr' : 'yrs'}`);
    if (m) parts.push(`${m} ${m === 1 ? 'mo' : 'mos'}`);
  }
  return parts.join(' ');
}

export function yearsSince(year: number | undefined): number {
  if (!year) return 0;
  return Math.max(0, new Date().getFullYear() - Number(year));
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapa HTML y convierte **negrita** en <strong>. */
export function inlineMd(str: string): string {
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// ---------------------------------------------------------------------------
//  GitHub
// ---------------------------------------------------------------------------
export interface GithubRepo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  created_at: string;
  pushed_at: string;
}

export interface GithubData {
  fetchedAt: string | null;
  user: { login: string; html_url: string; avatar_url: string } | null;
  avatar: string | null;
  repos: GithubRepo[];
}

export interface Project {
  name: string;
  description: string;
  url: string;
  homepage: string | null;
  tags: string[];
  stars: number;
  pushedAt: string;
  featured: boolean;
  archived: boolean;
}

let cachedGithub: GithubData | null = null;

export function loadGithub(): GithubData {
  if (cachedGithub) return cachedGithub;
  const empty: GithubData = { fetchedAt: null, user: null, avatar: null, repos: [] };
  const file = join(ROOT, 'src', 'data', 'github.json');
  if (!existsSync(file)) return (cachedGithub = empty);
  try {
    cachedGithub = { ...empty, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {
    cachedGithub = empty;
  }
  return cachedGithub!;
}

export function getProjects(lang: Lang): Project[] {
  const gh = loadGithub();
  const cfg = content.github ?? {};
  const overrides: Record<string, any> = {};
  for (const [k, v] of Object.entries(cfg.overrides ?? {})) overrides[k.toLowerCase()] = v;
  const exclude = new Set<string>((cfg.exclude ?? []).map((s: string) => String(s).toLowerCase()));

  return gh.repos
    .filter((r) => !(cfg.exclude_forks !== false && r.fork))
    .filter((r) => !(cfg.exclude_archived && r.archived))
    .filter((r) => !exclude.has(r.name.toLowerCase()))
    .map((r) => {
      const o = overrides[r.name.toLowerCase()] ?? {};
      const tags: string[] = o.tags ?? (r.topics?.length ? r.topics : r.language ? [r.language] : []);
      return {
        name: r.name,
        description: o.description ? tr(o.description, lang) : (r.description ?? ''),
        url: r.html_url,
        homepage: o.homepage ?? r.homepage ?? null,
        tags,
        stars: r.stargazers_count ?? 0,
        pushedAt: r.pushed_at,
        featured: Boolean(o.featured),
        archived: r.archived,
      };
    })
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        Date.parse(b.pushedAt ?? '') - Date.parse(a.pushedAt ?? ''),
    );
}

/** Ruta pública del avatar descargado, o null si no existe. */
export function avatarPath(): string | null {
  const gh = loadGithub();
  if (gh.avatar && existsSync(join(ROOT, 'public', gh.avatar))) return `/${gh.avatar}`;
  return null;
}
