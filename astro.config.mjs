// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

// La URL pública se toma de content.yaml para tener una única fuente de verdad.
const content = parse(readFileSync(join(process.cwd(), 'content.yaml'), 'utf8'));

export default defineConfig({
  site: content?.site?.url ?? 'https://mhwrona.es',
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    format: 'directory',
    // CSS siempre en ficheros externos: permite una Content-Security-Policy estricta.
    inlineStylesheets: 'never',
  },
  devToolbar: { enabled: false },
});
