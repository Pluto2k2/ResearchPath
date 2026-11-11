import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp } from './helpers.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const read = (name) => fs.readFileSync(path.join(publicDir, name), 'utf8');
const jsFiles = fs.readdirSync(publicDir).filter((f) => f.endsWith('.js'));
const sources = {
  'styles.css': read('styles.css'),
  'index.html': read('index.html'),
  ...Object.fromEntries(jsFiles.map((f) => [f, read(f)])),
};

describe('AC2 - palette limited to navy, grey-blue and coral', () => {
  // Navy, grey-blue, coral, plus one explicit card tint (hex only).
  const allowedHex = new Set(['102542', 'cdd7d6', 'f87060', 'e6ebea']);
  const allowedRgb = new Set(['16,37,66', '205,215,214', '248,112,96']);

  it.each(Object.keys(sources))('%s keeps none of the old palette colours', (name) => {
    const text = sources[name];
    for (const hex of ['f6f7eb', 'e94f37', '393e41']) {
      expect(text, `${name}: #${hex}`).not.toMatch(new RegExp(`#${hex}(?![\\w-])`, 'i'));
    }
    for (const [r, g, b] of [[246, 247, 235], [233, 79, 55], [57, 62, 65]]) {
      expect(text, `${name}: rgb(${r},${g},${b})`).not.toMatch(
        new RegExp(`rgba?\\(\\s*${r}\\s*[, ]\\s*${g}\\s*[, ]\\s*${b}(?!\\d)`, 'i'),
      );
    }
  });

  it('scans the css, html and every js file', () => {
    expect(jsFiles.length).toBeGreaterThanOrEqual(4);
  });

  it.each(Object.keys(sources))('%s uses only palette hex colours', (name) => {
    const found = [...sources[name].matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})(?![\w-])/gi)].map((m) => m[1].toLowerCase());
    for (const hex of found) expect(allowedHex.has(hex), `${name}: #${hex}`).toBe(true);
  });

  it.each(Object.keys(sources))('%s uses only palette rgb()/rgba() colours', (name) => {
    const found = [...sources[name].matchAll(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/gi)].map((m) => `${m[1]},${m[2]},${m[3]}`);
    for (const triple of found) expect(allowedRgb.has(triple), `${name}: rgb(${triple})`).toBe(true);
  });

  it.each(Object.keys(sources))('%s has no white or hue keywords', (name) => {
    const text = sources[name];
    expect(text).not.toMatch(/#fff(fff)?(?![\w-])/i);
    expect(text).not.toMatch(/:\s*white\b/i);
    expect(text).not.toMatch(/\b(?:color|background|border|fill|stroke)[\w-]*\s*:[^;{}]*\b(white|purple|blue|violet|green|red|orange|yellow|pink|indigo|teal|cyan|magenta|gray|grey|black)\b/i);
  });
});

describe('AC2 - contrast rules in styles.css', () => {
  const css = sources['styles.css'];
  const body = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const all = [...css.matchAll(new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
    return all.length ? all.map((m) => m[1]).join('\n') : '';
  };

  it('defines the palette variables on :root', () => {
    const root = body(':root');
    expect(root).toMatch(/--navy:\s*#102542\s*;/i);
    expect(root).toMatch(/--bg:\s*#cdd7d6\s*;/i);
    expect(root).toMatch(/--accent:\s*#f87060\s*;/i);
    expect(root).toMatch(/--surface:\s*#e6ebea\s*;/i);
  });

  it('gives the hero a navy background', () => {
    expect(body('.hero')).toMatch(/background(?:-color)?:\s*(?:var\(--navy\)|#102542)\s*;/i);
  });

  it('colours the hero accent text coral', () => {
    expect(body('.hero-accent')).toMatch(/(?:^|[\s;])color:\s*(?:var\(--accent\)|#f87060)\s*;/i);
  });

  it('gives button.primary navy text on a coral background', () => {
    const rule = body('button.primary');
    expect(rule).toMatch(/(?:^|[\s;])color:\s*(?:var\(--navy\)|#102542)\s*;/i);
    expect(rule).toMatch(/background(?:-color)?:\s*(?:var\(--accent\)|#f87060)\s*;/i);
  });
});

describe('AC3 - self-hosted pixel font', () => {
  it.each(['400', '600', '700'])('serves the %s weight as woff2', async (weight) => {
    const res = await request(createTestApp()).get(`/fonts/pixelify-sans-latin-${weight}-normal.woff2`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/font\/woff2/);
  });

  it('ships the OFL licence text', () => {
    expect(fs.existsSync(path.join(publicDir, 'fonts', 'OFL-PixelifySans.txt'))).toBe(true);
  });

  it('declares @font-face for Pixelify Sans and keeps a system-ui fallback', () => {
    expect(sources['styles.css']).toMatch(/@font-face/);
    expect(sources['styles.css']).toMatch(/Pixelify Sans/);
    expect(sources['styles.css']).toMatch(/system-ui/);
  });

  it('loads nothing from a CDN or any external URL in css and html', () => {
    for (const name of ['styles.css', 'index.html']) {
      expect(sources[name]).not.toMatch(/googleapis/i);
      expect(sources[name]).not.toMatch(/https?:\/\//i);
    }
  });
});

describe('AC4 - cards and top bar', () => {
  it('defines a .card with 2px solid border, 10px radius and a hard 4px shadow', () => {
    const rule = sources['styles.css'].match(/(?:^|[\s,}])\.card\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/border:\s*2px\s+solid\s+\S+/);
    expect(rule[1]).toMatch(/border-radius:\s*10px/);
    expect(rule[1]).toMatch(/box-shadow:\s*4px\s+4px\s+0\s+\S+/);
  });

  const ruleBody = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // A selector can have several rules; join their bodies.
    const all = [...sources['styles.css'].matchAll(new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
    return all.length ? all.map((m) => m[1]).join('\n') : null;
  };

  describe('sticky nav bar', () => {
    let header;
    beforeAll(async () => {
      const res = await request(createTestApp()).get('/');
      header = res.text.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
    });

    it('has the app name and no svg logo', () => {
      expect(header).toContain('ResearchPath');
      expect(header).not.toMatch(/<svg/);
    });

    it('has a nav with an aria-label and a Roadmap link to #roadmap-section', () => {
      expect(header).toMatch(/<nav[^>]*aria-label="[^"]+"/);
      expect(header).toMatch(/<a[^>]*href="#roadmap-section"[^>]*>\s*Roadmap\s*<\/a>/);
    });

    it('has a "+ Milestone" button with id header-add', () => {
      expect(header).toMatch(/<button[^>]*id="header-add"[^>]*>\s*\+ Milestone\s*<\/button>/);
    });

    it('links to #progress-section and to #upcoming-section', () => {
      expect(header).toMatch(/<a[^>]*href="#progress-section"[^>]*>\s*Progress\s*<\/a>/);
      expect(header).toMatch(/<a[^>]*href="#upcoming-section"[^>]*>\s*Upcoming\s*<\/a>/);
    });

    it('styles the header as sticky with a 2px solid bottom border', () => {
      const rule = ruleBody('.site-header') ?? '';
      expect(rule).toMatch(/position:\s*sticky/);
      expect(rule).toMatch(/border-bottom:\s*2px\s+solid\s+\S+/);
    });

    it('scrolls smoothly and lets the nav scroll horizontally', () => {
      expect(ruleBody('html')).toMatch(/scroll-behavior:\s*smooth/);
      expect(ruleBody('.site-nav')).toMatch(/overflow-x:\s*auto/);
    });
  });

  describe('hero', () => {
    let html;
    beforeAll(async () => {
      html = (await request(createTestApp()).get('/')).text;
    });

    it('has exactly one h1 with the headline and an accent span', () => {
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
      const h1 = html.match(/<h1[\s\S]*?<\/h1>/)[0];
      expect(h1).toContain('Your PhD roadmap,');
      expect(h1).toMatch(/<span[^>]*>\s*and every deadline on the way\.\s*<\/span>/);
    });

    it('shows the subtitle', () => {
      expect(html).toContain('Plan your milestones, track your progress, never miss a conference or funding date.');
    });

    it('uses a fluid heading size', () => {
      expect(sources['styles.css']).toContain('clamp(2.2rem, 6vw, 4.5rem)');
    });
  });

  describe('layout', () => {
    it('puts #roadmap inside a full-bleed #roadmap-section that is not a card', async () => {
      const html = (await request(createTestApp()).get('/')).text;
      const section = html.match(/<section[^>]*id="roadmap-section"[^>]*>[\s\S]*?<\/section>/);
      expect(section).not.toBeNull();
      expect(section[0]).toContain('id="roadmap"');
      const openTag = section[0].match(/^<section[^>]*>/)[0];
      expect(openTag).not.toMatch(/class="[^"]*\bcard\b/);
    });

    it('draws 2px solid top and bottom borders on .roadmap-band', () => {
      const rule = ruleBody('.roadmap-band') ?? '';
      expect(rule).toMatch(/border-top:\s*2px\s+solid\s+\S+/);
      expect(rule).toMatch(/border-bottom:\s*2px\s+solid\s+\S+/);
    });

    it('caps .content at 1280px', () => {
      expect(ruleBody('.content')).toMatch(/max-width:\s*1280px/);
    });
  });
});

describe('AC6 - add form lives in a popover', () => {
  it('puts the form and its fields after the popover opening tag', async () => {
    const html = (await request(createTestApp()).get('/')).text;
    const popover = html.indexOf('id="add-popover"');
    expect(popover).toBeGreaterThan(-1);
    for (const id of ['milestone-form', 'milestone-title', 'milestone-date', 'milestone-notes']) {
      const at = html.indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(popover);
    }
  });

  it('keeps the error area at the top, outside the popover', async () => {
    const html = (await request(createTestApp()).get('/')).text;
    const error = html.indexOf('id="milestone-error"');
    expect(error).toBeGreaterThan(-1);
    expect(error).toBeLessThan(html.indexOf('id="add-popover"'));
  });
});

describe('AC10 - empty state', () => {
  it('invites the user to "Start your path" in roadmap.js', () => {
    expect(sources['roadmap.js']).toContain('Start your path');
  });
});

describe('AC11 - motion and accessibility', () => {
  it('respects reduced motion and shows keyboard focus', () => {
    expect(sources['styles.css']).toContain('prefers-reduced-motion');
    expect(sources['styles.css']).toContain(':focus-visible');
  });

  it('renders nodes as real buttons with an aria-label', () => {
    expect(sources['roadmap.js']).toMatch(/(createElement|\bel)\(\s*'button'/);
    expect(sources['roadmap.js']).toContain('aria-label');
  });
});

describe('US-02 - status shapes in styles.css', () => {
  it('draws the done check as a real check mark, not corrupted bytes', () => {
    const css = sources['styles.css'];
    const rule = [...css.matchAll(/\.node-shape\.status-done::after[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join('\n');
    expect(rule).toMatch(/content:\s*"(?:\\2713|✓)"/);
    expect(css).not.toMatch(/�|â\u009c|âœ/);
  });
});
