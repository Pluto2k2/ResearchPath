import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POSES, poseSrc } from '../public/mascot.js';

const pub = (...p) => resolve(process.cwd(), 'public', ...p);
const read = (name) => readFileSync(pub(name), 'utf8');
const html = read('index.html');
const css = read('styles.css');

const ramyImgs = html.match(/<img[^>]*class="ramy-img[^"]*"[^>]*>/g) ?? [];

describe('M11 Ramy markup: accessibility and sizes', () => {
  it('has the hero button with the aria-label "Ramy, tips"', () => {
    const m = /<button[^>]*id="ramy-button"[^>]*>/.exec(html);
    expect(m).toBeTruthy();
    expect(m[0]).toContain('type="button"');
    expect(m[0]).toContain('aria-label="Ramy, tips"');
  });

  it('has the visible label text', () => {
    expect(html).toMatch(/<p[^>]*class="ramy-label"[^>]*>Ramy, your research guide buddy!<\/p>/);
  });

  it('has two Ramy images (hero and news), all decorative with width and height', () => {
    expect(ramyImgs).toHaveLength(2);
    for (const tag of ramyImgs) {
      expect(tag).toMatch(/\salt=""/);
      expect(tag).toMatch(/\swidth="\d+"/);
      expect(tag).toMatch(/\sheight="\d+"/);
    }
  });

  it('has no loading attribute on the hero image and lazy loading on the others', () => {
    const hero = ramyImgs.find((t) => t.includes('mascot-idle.png'));
    const other = ramyImgs.find((t) => t.includes('mascot-tablet.png'));
    expect(hero).not.toMatch(/loading=/);
    expect(other).toContain('loading="lazy"');
  });

  it('puts every Ramy bubble in an aria-live polite region', () => {
    const bubbles = html.match(/<p[^>]*class="ramy-bubble"[^>]*>/g) ?? [];
    expect(bubbles).toHaveLength(2);
    for (const b of bubbles) expect(b).toContain('aria-live="polite"');
  });

  it('keeps the news Ramy hidden and the retry button hidden by default', () => {
    expect(html).toMatch(/<div[^>]*id="news-ramy"[^>]*\shidden/);
    expect(html).toMatch(/<button[^>]*id="news-retry"[^>]*\shidden/);
  });

  it('gives the dynamic image the same loading and alt rules', () => {
    const src = read('mascot.js');
    expect(src).toContain("img.alt = ''");
    expect(src).toContain("img.loading = 'lazy'");
  });
});

describe('M11 Ramy CSS', () => {
  it('turns the bob and pop-in off under prefers-reduced-motion', () => {
    const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start);
    const rule = /([^{}]*\.ramy-button[^{}]*)\{([^}]*)\}/.exec(block);
    expect(rule).toBeTruthy();
    expect(rule[1]).toContain('.ramy-img');
    expect(rule[2]).toMatch(/animation:\s*none/);
  });

  it('defines the ramy-bob keyframes and uses them on the button', () => {
    expect(css).toMatch(/@keyframes ramy-bob\s*\{/);
    expect(css).toMatch(/\.ramy-button\s*\{[^}]*ramy-bob/);
  });

  it('has a phone layout below 600 px for Ramy', () => {
    const m = /@media \(max-width:\s*(599|600)px\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(m).toBeTruthy();
    expect(m[2]).toContain('.ramy');
  });

  it('uses no white or colour words in the Ramy rules', () => {
    const ramyCss = css.slice(css.indexOf('.ramy {'), css.indexOf('#milestone-error'));
    expect(ramyCss).not.toMatch(/#fff\b|#ffffff|\bwhite\b|\bpurple\b/i);
  });
});

describe('M11 mascot images exist and match their declared size', () => {
  const dir = pub('mascot');
  const png = (name) => readFileSync(resolve(dir, name));

  it('has all 19 PNG files', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
    expect(files).toHaveLength(19);
  });

  it('has every image referenced in public js and html', () => {
    const sources = [...readdirSync(pub()).filter((f) => f.endsWith('.js')), 'index.html'];
    const refs = new Set();
    for (const file of sources) {
      for (const m of read(file).matchAll(/mascot-([a-z-]+)\.png/g)) refs.add(`mascot-${m[1]}.png`);
    }
    expect(refs.size).toBeGreaterThan(0);
    for (const name of refs) expect(existsSync(resolve(dir, name)), name).toBe(true);
  });

  it('has a file for every pose in POSES, with the real size', () => {
    for (const [pose, [width, height]] of Object.entries(POSES)) {
      const file = resolve(process.cwd(), 'public', poseSrc(pose));
      expect(existsSync(file), pose).toBe(true);
      const bytes = png(`mascot-${pose}.png`);
      expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
      expect(bytes.readUInt32BE(16), `${pose} width`).toBe(width);
      expect(bytes.readUInt32BE(20), `${pose} height`).toBe(height);
    }
  });

  it('matches the sizes written in index.html', () => {
    for (const tag of ramyImgs) {
      const pose = /mascot-([a-z-]+)\.png/.exec(tag)[1];
      const [w, h] = POSES[pose];
      expect(tag).toContain(`width="${w}"`);
      expect(tag).toContain(`height="${h}"`);
    }
  });
});

describe('M11 Ramy sits above the roadmap, not in the hero', () => {
  const hero = /<section class="hero">([\s\S]*?)<\/section>/.exec(html)[1];
  const view = /<div id="view-roadmap"[^>]*>([\s\S]*?)<section class="roadmap-band"/.exec(html);

  it('keeps only the h1 and the subtitle in the hero', () => {
    expect(hero).not.toMatch(/ramy/);
    expect(hero).not.toMatch(/hero-inner/);
    expect(hero.match(/<(h1|p)[\s>]/g)).toEqual(['<h1>', '<p ']);
    expect(html).not.toContain('hero-inner');
  });

  it('puts #ramy inside #view-roadmap, before the roadmap section', () => {
    expect(view).toBeTruthy();
    expect(view[1]).toContain('id="ramy"');
    expect(html.indexOf('id="ramy"')).toBeLessThan(html.indexOf('id="roadmap-section"'));
    expect(html.indexOf('id="ramy"')).toBeGreaterThan(html.indexOf('</section>'));
  });

  it('keeps the button, image, label and bubble attributes', () => {
    expect(html).toContain('id="ramy-button" class="ramy-button" aria-label="Ramy, tips"');
    const img = ramyImgs.find((t) => t.includes('mascot-idle.png'));
    expect(img).toMatch(/\salt=""/);
    expect(img).not.toMatch(/loading=/);
    expect(html).toContain('Ramy, your research guide buddy!');
    expect(html).toMatch(/id="ramy-bubble"[^>]*aria-live="polite"/);
  });
});

describe('M11 floating speech bubble CSS', () => {

  it('defines ramy-float and applies it to the main bubble', () => {
    expect(css).toMatch(/@keyframes ramy-float\s*\{/);
    expect(css).toMatch(/(#ramy|#view-roadmap > \.ramy-hero|\.ramy-hero)\s+\.ramy-bubble\s*\{[^}]*ramy-float/);
  });

  it('turns ramy-float off under reduced motion together with the button and image', () => {
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const rule = /([^{}]*\.ramy-button[^{}]*)\{([^}]*)\}/.exec(rm);
    expect(rule[1]).toContain('.ramy-bubble');
    expect(rule[1]).toContain('.ramy-img');
    expect(rule[2]).toMatch(/animation:\s*none/);
  });

  it('has a tail made of ::before and ::after', () => {
    expect(css).toMatch(/\.ramy-bubble::before/);
    expect(css).toMatch(/\.ramy-bubble::after/);
  });

  it('uses the card tint and navy text, no white', () => {
    const rule = [...css.matchAll(/(?:^|\n)\.ramy-bubble\s*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
    expect(rule).toMatch(/background:\s*(var\(--surface\)|#e6ebea)/i);
    expect(rule).toMatch(/color:\s*(var\(--navy\)|#102542)/i);
    expect(rule).not.toMatch(/#fff\b|#ffffff|\bwhite\b/i);
  });

  it('shrinks Ramy to 96px under 600px and no longer mentions hero-inner', () => {
    const m = /@media \(max-width:\s*(599|600)px\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(m[2]).toMatch(/\.ramy-img\s*\{[^}]*height:\s*96px/);
    expect(css).not.toContain('hero-inner');
  });
});
