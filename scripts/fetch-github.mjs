// ---------------------------------------------------------------------------
//  Descarga en tiempo de build los repos públicos y el avatar de GitHub.
//  Se ejecuta automáticamente antes de `npm run build` (script "prebuild").
//
//  - Si existe la variable GITHUB_TOKEN se usa para evitar el rate limit.
//  - Si la API falla, NO rompe el build: se conserva src/data/github.json.
// ---------------------------------------------------------------------------
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'src', 'data');
const DATA_FILE = join(DATA_DIR, 'github.json');
const PUBLIC_DIR = join(ROOT, 'public');
const TIMEOUT = 15_000;

const content = parse(await readFile(join(ROOT, 'content.yaml'), 'utf8'));
const user = content?.site?.github_user;

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'mhwrona-portfolio-build',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText} (${path})`);
  return res.json();
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function downloadAvatar(avatarUrl) {
  if (!avatarUrl) return null;
  const url = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}s=400`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`avatar ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg';
  const file = `avatar.${ext}`;
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(join(PUBLIC_DIR, file), Buffer.from(await res.arrayBuffer()));
  return file;
}

async function main() {
  if (!user) {
    console.warn('[github] site.github_user no está definido en content.yaml; se omite.');
    return;
  }

  const previous = await readPrevious();
  const profile = await gh(`/users/${encodeURIComponent(user)}`);

  const repos = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh(
      `/users/${encodeURIComponent(user)}/repos?per_page=100&page=${page}&type=owner&sort=pushed`,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  let avatar = null;
  try {
    avatar = await downloadAvatar(profile.avatar_url);
  } catch (err) {
    console.warn(`[github] No se pudo descargar el avatar (${err.message}).`);
    avatar = previous?.avatar ?? null;
  }

  const data = {
    fetchedAt: new Date().toISOString(),
    user: {
      login: profile.login,
      html_url: profile.html_url,
      avatar_url: profile.avatar_url,
    },
    avatar,
    repos: repos.map((r) => ({
      name: r.name,
      description: r.description,
      html_url: r.html_url,
      homepage: r.homepage || null,
      language: r.language,
      topics: r.topics ?? [],
      stargazers_count: r.stargazers_count ?? 0,
      fork: Boolean(r.fork),
      archived: Boolean(r.archived),
      created_at: r.created_at,
      pushed_at: r.pushed_at,
    })),
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`[github] ${data.repos.length} repos de ${user} sincronizados${avatar ? ' + avatar' : ''}.`);
}

try {
  await main();
} catch (err) {
  console.warn(`[github] No se pudo actualizar desde la API (${err.message}). Se usará la copia existente.`);
  if (!existsSync(DATA_FILE)) {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, `${JSON.stringify({ fetchedAt: null, user: null, avatar: null, repos: [] }, null, 2)}\n`);
  }
}
