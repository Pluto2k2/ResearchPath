import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const html = read('public/index.html');
const header = /<header[\s\S]*?<\/header>/.exec(html)[0];

describe('US-04 static page structure', () => {
  it('has Roadmap and Research news tabs in a nav labelled Tabs, inside the header', () => {
    expect(header).toMatch(/<nav aria-label="Tabs"/);
    expect(header).toMatch(/<a href="#\/roadmap"[^>]*>\s*Roadmap\s*<\/a>/);
    expect(header).toMatch(/<a href="#\/news"[^>]*>\s*Research news\s*<\/a>/);
  });

  it('keeps the section links and the add button in the header', () => {
    expect(header).toContain('<a href="#roadmap-section">Roadmap</a>');
    expect(header).toContain('<button type="button" id="header-add"');
  });

  it('still contains no http:// or https:// text', () => {
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('still has exactly one h1', () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it('has the news view ids', () => {
    for (const id of [
      'view-roadmap',
      'view-news',
      'news-error',
      'category-chips',
      'keyword-form',
      'keyword-input',
      'keyword-list',
      'news-empty',
      'news-loading',
      'papers-section',
      'papers-list',
      'topics-section',
      'topics-list',
    ]) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });

  it('labels the keyword input and limits it to 50 characters', () => {
    expect(html).toContain('<label for="keyword-input">');
    expect(/<input[^>]*id="keyword-input"[^>]*>/.exec(html)[0]).toContain('maxlength="50"');
  });

  it('has the Latest papers and Hot topics headings as h2', () => {
    expect(html).toMatch(/<h2[^>]*>Latest papers<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>Hot topics<\/h2>/);
  });

  it('starts with the news view hidden', () => {
    expect(/<div id="view-news"[^>]*>/.exec(html)[0]).toMatch(/\bhidden\b/);
  });
});

describe('US-04 release', () => {
  it('package.json version is 0.2.0', () => {
    expect(JSON.parse(read('package.json')).version).toBe('0.2.0');
  });

  it('declares fast-xml-parser as a dependency', () => {
    expect(JSON.parse(read('package.json')).dependencies).toHaveProperty('fast-xml-parser');
  });
});
