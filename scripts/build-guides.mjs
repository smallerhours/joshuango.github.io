import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
const guidesDir = path.join(siteDir, 'content', 'guides');
const templatesDir = path.join(siteDir, 'templates');

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const renderInline = (value = '') => escapeHtml(value).replace(
  /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
  '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
);

function parseFrontmatter(source, filename) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: missing frontmatter between --- lines.`);
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 0) throw new Error(`${filename}: invalid detail line: ${line}`);
    data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { data, body: match[2] };
}

function parseSections(body) {
  const sections = {};
  let current = '';
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()]));
}

function parseBlocks(source = '') {
  return source.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => {
    const image = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) return { type: 'image', alt: image[1].trim(), src: image[2].trim() };
    return { type: 'paragraph', text: block.replace(/\s*\n\s*/g, ' ') };
  });
}

function parseChapters(source = '') {
  const chapters = [];
  let current = null;
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      if (current) chapters.push({ ...current, blocks: parseBlocks(current.lines.join('\n')) });
      const title = heading[1].trim();
      const numbered = title.match(/^(\d+)\s*\/\s*(.+)$/);
      current = { number: numbered?.[1] || String(chapters.length + 1).padStart(2, '0'), title: numbered?.[2] || title, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) chapters.push({ ...current, blocks: parseBlocks(current.lines.join('\n')) });
  return chapters;
}

function validateImage(imagePath, filename) {
  if (!imagePath || /^https?:\/\//.test(imagePath)) return;
  const absolute = path.resolve(siteDir, imagePath);
  if (!absolute.startsWith(siteDir + path.sep) || !fs.existsSync(absolute)) {
    throw new Error(`${filename}: image not found: ${imagePath}`);
  }
}

function parseGuide(filename) {
  const source = fs.readFileSync(path.join(guidesDir, filename), 'utf8');
  const { data, body } = parseFrontmatter(source, filename);
  const required = ['title', 'slug', 'number', 'category', 'excerpt', 'hero', 'heroAlt', 'status'];
  for (const field of required) {
    if (!data[field]) throw new Error(`${filename}: missing required detail “${field}”.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw new Error(`${filename}: slug must use lowercase words joined by hyphens.`);
  const sections = parseSections(body);
  const introduction = parseBlocks(sections.introduction).filter((block) => block.type === 'paragraph');
  const chapters = parseChapters(sections.chapters);
  const closing = parseBlocks(sections.closing).filter((block) => block.type === 'paragraph');
  validateImage(data.hero, filename);
  chapters.flatMap((chapter) => chapter.blocks).filter((block) => block.type === 'image').forEach((image) => validateImage(image.src, filename));
  return { ...data, introduction, chapters, closing, filename };
}

function replaceTokens(template, values) {
  return template.replace(/{{([A-Z_]+)}}/g, (_, key) => values[key] ?? '');
}

function renderCards(guides) {
  if (!guides.length) {
    return `      <div class="guide-empty"><p>No guides published yet.</p><span>Copy content/guides/_template.md to begin.</span></div>`;
  }
  return guides.map((guide, index) => `      <article class="guide-card reveal ${index === 0 ? 'guide-card--featured' : ''}" style="--delay: ${index % 2 ? 80 : 0}ms">
        <a class="guide-card-link" href="${escapeHtml(guide.slug)}.html" aria-label="Open ${escapeHtml(guide.title)}">
          <div class="guide-card-media"><img src="${escapeHtml(guide.hero)}" alt="${escapeHtml(guide.heroAlt)}"></div>
          <footer>
            <p class="guide-card-meta"><span>${escapeHtml(guide.number)} / ${escapeHtml(guide.category)}</span><span>A Guide To:</span></p>
            <h2>${escapeHtml(guide.title)}</h2>
          </footer>
        </a>
      </article>`).join('\n\n');
}

function renderIntroduction(guide) {
  const copy = guide.introduction.map((block) => `          <p>${renderInline(block.text)}</p>`).join('\n');
  return `      <section class="guide-introduction reveal" aria-label="Guide introduction">
        <p class="guide-intro-label">A Smaller Hours guide</p>
        <div class="guide-intro-copy">\n${copy}\n        </div>
        <a class="guide-begin" href="#where-to-start">Begin the guide <span aria-hidden="true">↓</span></a>
      </section>`;
}

function renderChapterPreview(guide) {
  const cards = guide.chapters.map((chapter) => {
    const image = chapter.blocks.find((block) => block.type === 'image');
    if (!image) return '';
    return `          <a class="guide-start-card reveal" href="#chapter-${escapeHtml(chapter.number)}">
            <span class="guide-start-media"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"></span>
            <span class="guide-start-caption"><small>${escapeHtml(chapter.number)}</small>${escapeHtml(chapter.title)}</span>
          </a>`;
  }).filter(Boolean).join('\n');
  if (!cards) return '';
  return `      <section class="guide-start" id="where-to-start" aria-labelledby="guide-start-title">
        <header class="guide-start-heading reveal"><p>In this guide</p><h2 id="guide-start-title">Where to start?</h2></header>
        <div class="guide-start-grid">\n${cards}\n        </div>
      </section>`;
}

function renderChapters(guide) {
  return guide.chapters.map((chapter, index) => {
    const copy = chapter.blocks.filter((block) => block.type === 'paragraph').map((block) => `            <p>${renderInline(block.text)}</p>`).join('\n');
    const images = chapter.blocks.filter((block) => block.type === 'image').map((block) => `          <figure class="guide-chapter-image article-reveal"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}"></figure>`).join('\n');
    return `      <section class="guide-chapter ${index % 2 ? 'guide-chapter--reverse' : ''}" id="chapter-${escapeHtml(chapter.number)}">
        <header class="guide-chapter-heading reveal"><span>Step ${escapeHtml(chapter.number)}</span><h2><b>${escapeHtml(chapter.number)}.</b> ${escapeHtml(chapter.title)}</h2></header>
        <div class="guide-chapter-copy reveal">\n${copy}\n        </div>
${images}
      </section>`;
  }).join('\n\n');
}

function renderClosing(guide) {
  if (!guide.closing.length) return '';
  return `      <section class="guide-closing reveal">${guide.closing.map((block) => `<p>${renderInline(block.text)}</p>`).join('')}</section>`;
}

const guideFiles = fs.readdirSync(guidesDir).filter((filename) => filename.endsWith('.md') && !filename.startsWith('_'));
const guides = guideFiles.map(parseGuide)
  .filter((guide) => guide.status.toLowerCase() === 'published')
  .sort((a, b) => Number(b.number) - Number(a.number));

const duplicateSlug = guides.find((guide, index) => guides.findIndex((candidate) => candidate.slug === guide.slug) !== index);
if (duplicateSlug) throw new Error(`Duplicate guide slug: ${duplicateSlug.slug}`);

const archiveTemplate = fs.readFileSync(path.join(templatesDir, 'guides.html'), 'utf8');
const archiveLead = guides[0] || {};
fs.writeFileSync(path.join(siteDir, 'guides.html'), replaceTokens(archiveTemplate, {
  GUIDE_CARDS: renderCards(guides),
  ARCHIVE_HERO: escapeHtml(archiveLead.hero || ''),
  ARCHIVE_HERO_ALT: escapeHtml(archiveLead.heroAlt || 'Smaller Hours guide'),
}));

const guideTemplate = fs.readFileSync(path.join(templatesDir, 'guide.html'), 'utf8');
for (const guide of guides) {
  fs.writeFileSync(path.join(siteDir, `${guide.slug}.html`), replaceTokens(guideTemplate, {
    TITLE: escapeHtml(guide.title),
    NUMBER: escapeHtml(guide.number),
    CATEGORY: escapeHtml(guide.category),
    EXCERPT: escapeHtml(guide.excerpt),
    HERO: escapeHtml(guide.hero),
    HERO_ALT: escapeHtml(guide.heroAlt),
    INTRODUCTION: renderIntroduction(guide),
    CHAPTER_PREVIEW: renderChapterPreview(guide),
    CHAPTERS: renderChapters(guide),
    CLOSING: renderClosing(guide),
  }));
}

console.log(`Built ${guides.length} published guide${guides.length === 1 ? '' : 's'} and refreshed guides.html.`);
