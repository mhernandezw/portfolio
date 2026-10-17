import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? 'https://mhwrona.es/').replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    { loc: `${base}/`, lang: 'es' },
    { loc: `${base}/en/`, lang: 'en' },
  ];
  const alternates = pages
    .map((p) => `    <xhtml:link rel="alternate" hreflang="${p.lang}" href="${p.loc}"/>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages
  .map(
    (p) => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
${alternates}
  </url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
