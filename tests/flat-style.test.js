import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const cssPath = new URL('../enhancement-src/styles/moonstone-metal.css', import.meta.url);

describe('restrained 2D MoonStone styling', () => {
  it('uses the original hero with the flat 2D ready state', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toContain('.moonstone-2d-ready .hero-image');
    expect(css).not.toContain('#moonstone-liquid-world');
  });

  it('does not place the original negative-z hero behind a main stacking context', async () => {
    const css = await readFile(cssPath, 'utf8');
    const mainRule = css.match(
      /\.moonstone-enhanced main,\s*\.moonstone-enhanced footer\s*\{([^}]*)\}/
    )?.[1] ?? '';

    expect(mainRule).not.toContain('z-index');
  });

  it('keeps the original hero image above its isolated section background', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.moonstone-enhanced \.hero-image,[^{]*\{[^}]*z-index:\s*0/s);
    expect(css).toMatch(/\.moonstone-enhanced \.hero-shade\s*\{[^}]*z-index:\s*1/s);
  });

  it('references the generated 2D moonstone family across the sections', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toContain('moonstone-hero-silver-sprout.webp');
    expect(css).toContain('moonstone-liquid-hero.webp');
    expect(css).toContain('moonstone-liquid-fragments.webp');
    expect(css).toContain('moonstone-silver-vein.webp');
    expect(css).toContain('moonstone-who-slices.webp');
    expect(css).toContain('moonstone-proof-link.webp');
    expect(css).toContain('moonstone-faq-pebbles.webp');
    expect(css).toContain('moonstone-join-arc.webp');
    expect(css).toContain('moonstone-meteor-trail.webp');
  });

  it('fills the restrained empty zones with one related meteor family', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.moonstone-enhanced \.hero::after\s*\{[^}]*moonstone-meteor-trail\.webp/s);
    expect(css).toMatch(/\.moonstone-enhanced \.format::before\s*\{[^}]*moonstone-meteor-trail\.webp/s);
    expect(css).toMatch(/\.moonstone-enhanced \.outcomes::after\s*\{[^}]*moonstone-meteor-trail\.webp/s);
  });

  it('centers the join copy without letting decorative layers consume flex space', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.moonstone-enhanced \.join-copy\s*\{[^}]*margin-inline:\s*auto[^}]*text-align:\s*center/s);
    expect(css).toMatch(/\.moonstone-enhanced \.join-moon,\s*\.moonstone-enhanced \.join-ink\s*\{[^}]*position:\s*absolute/s);
  });

  it('restores the large outcomes meteor as the dominant section visual', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.moonstone-enhanced \.outcomes-meteor\s*\{[^}]*visibility:\s*visible[^}]*opacity:\s*0\.[4-8]/s);
    expect(css).toMatch(/\.moonstone-enhanced \.join-moon\s*\{[^}]*visibility:\s*hidden/s);
  });

  it('keeps keyboard focus legible on the light registration drawer', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.moonstone-enhanced \.register-drawer :where\([^}]+focus-visible\s*\{[^}]*outline:\s*3px solid var\(--ms-indigo\)/s);
  });

  it('removes scroll-driven parallax when reduced motion is requested', async () => {
    const css = await readFile(cssPath, 'utf8');
    const reducedMotion = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\}\s*$/)?.[1] ?? '';

    expect(reducedMotion).toContain('.moonstone-enhanced .manifesto-meteor');
    expect(reducedMotion).toContain('.moonstone-enhanced .format::after');
    expect(reducedMotion).toContain('transform: none !important');
  });

  it('removes the glass frame around the outcomes copy', async () => {
    const css = await readFile(cssPath, 'utf8');

    expect(css).toMatch(/\.moonstone-enhanced \.outcome-grid\s*\{[^}]*background:\s*transparent[^}]*border:\s*0[^}]*backdrop-filter:\s*none/s);
    expect(css).toMatch(/\.moonstone-enhanced \.outcome-card\s*\{[^}]*border:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/s);
  });

  it('keeps glass blur at ten pixels or less', async () => {
    const css = await readFile(cssPath, 'utf8');
    const blurValues = [...css.matchAll(/backdrop-filter:\s*blur\((\d+)px\)/g)]
      .map((match) => Number(match[1]));

    expect(blurValues.length).toBeGreaterThan(0);
    expect(Math.max(...blurValues)).toBeLessThanOrEqual(10);
  });
});
