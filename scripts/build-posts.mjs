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
        <a class="article-card-link" href="${escapeHtml(post.slug)}.html" aria-label="View ${escapeHtml(post.title)}">
          <div class="article-media">
            <img src="${escapeHtml(post.hero)}" alt="${escapeHtml(post.heroAlt)}">
          </div>
          <footer>
            <p class="article-meta"><span>${escapeHtml(post.number)}</span><span>${escapeHtml(post.category)}</span></p>
            <h2>${escapeHtml(post.title)}</h2>
          </footer>
        </a>
      </article>`).join('\n\n');
}

function renderHomeLatest(post) {
  return `    <section class="portfolio-feature" id="welcome" aria-labelledby="welcome-title">
      <a class="portfolio-feature-link reveal-visual" href="${escapeHtml(post.slug)}.html" aria-label="View ${escapeHtml(post.title)}">
        <img src="${escapeHtml(post.hero)}" alt="${escapeHtml(post.heroAlt)}">
        <span class="portfolio-feature-shade" aria-hidden="true"></span>
        <span class="portfolio-feature-label">Selected work / ${escapeHtml(post.number)}</span>
        <h1 id="welcome-title">${escapeHtml(post.title)}</h1>
        <span class="portfolio-feature-category">${escapeHtml(post.category)}</span>
      </a>
    </section>`;
}

function renderHomeArchive(posts) {
  const seen = new Set([posts[0].hero]);
  const images = [];
  posts.forEach((post) => {
    const candidates = [
      ...post.gallery,
      ...post.article.filter((block) => block.type === 'image'),
      { src: post.hero, alt: post.heroAlt },
    ];
    candidates.forEach((item) => {
      if (!seen.has(item.src)) {
        seen.add(item.src);
        images.push({ ...item, post });
      }
    });
  });
  const cards = images.map((image, index) => `        <figure class="portfolio-tile portfolio-tile-${index % 4} reveal" style="--delay: ${(index % 3) * 55}ms">
          <a href="${escapeHtml(image.post.slug)}.html" aria-label="View ${escapeHtml(image.post.title)}">
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}">
          </a>
          <figcaption><span>${escapeHtml(image.post.title)}</span><span>${String(index + 1).padStart(2, '0')}</span></figcaption>
        </figure>`).join('\n');
  return `    <section class="portfolio-index" id="recent" aria-labelledby="recent-title">
      <header class="portfolio-index-header reveal">
        <h2 id="recent-title">Selected work</h2>
        <a href="study.html">View all projects</a>
      </header>
      <div class="portfolio-grid" aria-label="Photography portfolio">
${cards}
      </div>
    </section>`;
}

function replaceHomeRegion(source, name, output) {
  const pattern = new RegExp(`(<!-- HOME_${name}_START -->)[\\s\\S]*?(<!-- HOME_${name}_END -->)`);
  if (!pattern.test(source)) throw new Error(`index.html: missing HOME_${name} build markers.`);
  return source.replace(pattern, `$1\n${output}\n    $2`);
}

function buildHome(posts) {
  const homePath = path.join(siteDir, 'index.html');
  let source = fs.readFileSync(homePath, 'utf8');
  source = replaceHomeRegion(source, 'LATEST', renderHomeLatest(posts[0]));
  source = replaceHomeRegion(source, 'ARCHIVE', renderHomeArchive(posts));
  fs.writeFileSync(homePath, source);
}

function renderGallery(post) {
  const seen = new Set([post.hero]);
  const images = [...post.gallery, ...post.article.filter((block) => block.type === 'image')]
    .filter((image) => !seen.has(image.src) && seen.add(image.src));
  if (!images.length) return '';
  return `      <div class="portfolio-sequence" aria-label="Project photographs">
${images.map((image, index) => `        <figure class="portfolio-sequence-image portfolio-sequence-image-${index % 3} article-reveal"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"></figure>`).join('\n')}
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
  const photography = post.photography
    ? `<div><dt>Photography</dt><dd>${post.photographyUrl ? `<a href="${escapeHtml(post.photographyUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.photography)}</a>` : escapeHtml(post.photography)}</dd></div>`
    : '';
  return `${brand}
          ${photography}
          <div><dt>Category</dt><dd>${escapeHtml(post.category)}</dd></div>
          <div><dt>Year</dt><dd>${post.date.slice(0, 4)}</dd></div>`;
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
buildHome(posts);

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
    OVERVIEW: post.overview.slice(0, 1).map((block) => `          <p>${renderInline(block.text)}</p>`).join('\n'),
    GALLERY: renderGallery(post),
    QUOTE: '',
    ARTICLE: '',
  };
  fs.writeFileSync(path.join(siteDir, `${post.slug}.html`), replaceTokens(articleTemplate, values));
}

console.log(`Built ${posts.length} published project${posts.length === 1 ? '' : 's'} and refreshed the homepage and Work index.`);
