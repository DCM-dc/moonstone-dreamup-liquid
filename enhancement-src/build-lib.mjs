const marker = 'data-moonstone-enhancement';

export function injectEnhancement(html, basePath) {
  if (html.includes(marker)) return html;
  const base = basePath.replace(/\/$/, '');
  const css = `<link ${marker} rel="stylesheet" href="${base}/moonstone-metal.css">`;
  const js = `<script ${marker} type="module" src="${base}/liquid-world.js"></script>`;
  return html.replace('</head>', `${css}</head>`).replace('</body>', `${js}</body>`);
}
