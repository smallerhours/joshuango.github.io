import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
const postsDir = path.join(siteDir, 'content', 'posts');
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

function validateImage(imagePath, filename) {
  if (!imagePath) return;
  if (/^https?:\/\//.test(imagePath)) return;
  const absolute = path.resolve(siteDir, imagePath);
  if (!absolute.startsWith(siteDir + path.sep) || !fs.existsSync(absolute)) {
    throw new Error(`${filename}: image not found: ${imagePath}`);
  }
}

function parsePost(filename) {
  const source = fs.readFileSync(path.join(postsDir, filename), 'utf8');
  const { data, body } = parseFrontmatter(source, filename);
  const required = ['title', 'slug', 'number', 'date', 'category', 'excerpt', 'hero', 'heroAlt', 'status'];
  for (const field of required) {
    if (!data[field]) throw new Error(`${filename}: missing required detail “${field}”.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error(`${filename}: date must use YYYY-MM-DD.`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw new Error(`${filename}: slug must use lowercase words joined by hyphens.`);

  const sections = parseSections(body);
  const overview = parseBlocks(sections.overview).filter((block) => block.type === 'paragraph');
  const gallery = parseBlocks(sections.gallery).filter((block) => block.type === 'image');
  const quote = parseBlocks(sections.quote).find((block) => block.type === 'paragraph')?.text || '';
  const article = parseBlocks(sections.article);

  validateImage(data.hero, filename);
  gallery.forEach((image) => validateImage(image.src, filename));
  article.filter((block) => block.type === 'image').forEach((image) => validateImage(image.src, filename));

  return { ...data, overview, gallery, quote, article, filename };
}

function formatDate(date, style = 'long') {
  const [year, month, day] = date.split('-').map(Number);
  if (style === 'short') return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(-2)}`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function replaceTokens(template, values) {
  return template.replace(/{{([A-Z_]+)}}/g, (_, key) => values[key] ?? '');
}

function renderCards(posts) {
  return posts.map((post, index) => `      <article class="article-card reveal" style="--delay: ${index % 2 ? 80 : 0}ms">
        <a class="article-card-link" href="${escapeHtml(post.slug)}.html" aria-label="Read ${escapeHtml(post.title)}">
          <div class="article-media">
            <img src="${escapeHtml(post.hero)}" alt="${escapeHtml(post.heroAlt)}">
          </div>
          <footer>
            <p class="article-meta"><span>${escapeHtml(post.number)} / ${escapeHtml(post.category)}</span><time datetime="${escapeHtml(post.date)}">${formatDate(post.date, 'short')}</time></p>
            <h2>${escapeHtml(post.title)}</h2>
          </footer>
        </a>
      </article>`).join('\n\n');
}

function renderGallery(post) {
  if (!post.gallery.length) return '';
  return `      <div class="article-detail-grid" aria-label="Article images">
${post.gallery.map((image, index) => `        <figure class="article-detail ${index % 2 ? 'article-detail-close' : 'article-detail-tall'} article-reveal"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"></figure>`).join('\n')}
      </div>`;
}

function renderArticleBlocks(post) {
  const output = [];
  let paragraphs = [];
  const flush = () => {
    while (paragraphs.length) {
      const pair = paragraphs.splice(0, 2);
      output.push(`      <section class="article-story article-story-offset reveal">\n${pair.map((block) => `        <p>${renderInline(block.text)}</p>`).join('\n')}\n      </section>`);
    }
  };
  for (const block of post.article) {
    if (block.type === 'paragraph') paragraphs.push(block);
    else {
      flush();
      output.push(`      <figure class="article-body-image article-reveal"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}"></figure>`);
    }
  }
  flush();
  return output.join('\n\n');
}

function renderFacts(post) {
  const brand = post.brand
    ? `<div><dt>Brand</dt><dd>${post.brandUrl ? `<a href="${escapeHtml(post.brandUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.brand)}</a>` : escapeHtml(post.brand)}</dd></div>`
    : '';
  return `${brand}
          <div><dt>Category</dt><dd>${escapeHtml(post.category)}</dd></div>
          <div><dt>Published</dt><dd>${formatDate(post.date)}</dd></div>`;
}

const postFiles = fs.readdirSync(postsDir)
  .filter((filename) => filename.endsWith('.md') && !filename.startsWith('_'));
const posts = postFiles.map(parsePost)
  .filter((post) => post.status.toLowerCase() === 'published')
  .sort((a, b) => b.date.localeCompare(a.date));

if (!posts.length) throw new Error('No published posts found.');
const duplicateSlug = posts.find((post, index) => posts.findIndex((candidate) => candidate.slug === post.slug) !== index);
if (duplicateSlug) throw new Error(`Duplicate post slug: ${duplicateSlug.slug}`);

const studyTemplate = fs.readFileSync(path.join(templatesDir, 'study.html'), 'utf8');
fs.writeFileSync(path.join(siteDir, 'study.html'), replaceTokens(studyTemplate, { POST_CARDS: renderCards(posts) }));

const articleTemplate = fs.readFileSync(path.join(templatesDir, 'article.html'), 'utf8');
for (const post of posts) {
  const values = {
    TITLE: escapeHtml(post.title),
    SLUG: escapeHtml(post.slug),
    NUMBER: escapeHtml(post.number),
    DATE_ISO: escapeHtml(post.date),
    DATE_SHORT: formatDate(post.date, 'short'),
    CATEGORY: escapeHtml(post.category),
    EXCERPT: escapeHtml(post.excerpt),
    HERO: escapeHtml(post.hero),
    HERO_ALT: escapeHtml(post.heroAlt),
    HERO_CAPTION_LEFT: escapeHtml(post.heroCaptionLeft || post.brand || post.category),
    HERO_CAPTION_RIGHT: escapeHtml(post.heroCaptionRight || `Study ${post.number}`),
    FACTS: renderFacts(post),
    OVERVIEW: post.overview.map((block) => `          <p>${renderInline(block.text)}</p>`).join('\n'),
    GALLERY: renderGallery(post),
    QUOTE: post.quote ? `      <blockquote class="article-quote reveal">${renderInline(post.quote)}</blockquote>` : '',
    ARTICLE: renderArticleBlocks(post),
  };
  fs.writeFileSync(path.join(siteDir, `${post.slug}.html`), replaceTokens(articleTemplate, values));
}

console.log(`Built ${posts.length} published post${posts.length === 1 ? '' : 's'} and refreshed study.html.`);
