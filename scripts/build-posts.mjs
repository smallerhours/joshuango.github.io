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
    const image = block.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/);
    if (image) return { type: 'image', alt: image[1].trim(), src: image[2].trim(), caption: image[3]?.trim() || '' };
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

  if (data.status.toLowerCase() !== 'published') return { ...data, filename };
  validateImage(data.hero, filename);
  gallery.forEach((image) => validateImage(image.src, filename));
  article.filter((block) => block.type === 'image').forEach((image) => validateImage(image.src, filename));

  const type = data.type || 'article';
  if (!['article', 'page', 'project'].includes(type)) throw new Error(`${filename}: type must be article, page, or project.`);
  const topics = (data.topics || data.category).split(',').map(value => value.trim()).filter(Boolean);
  return { ...data, type, topics, overview, gallery, quote, article, filename };
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
  if (!posts.length) {
    return `      <div class="portfolio-empty-state">
        <span>Archive / 000</span>
        <p>The first story will appear here.</p>
      </div>`;
  }
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
  const starterSlides = [
    {
      src: 'images/portfolio/bar-8.jpg',
      alt: 'A softly lit bar interior with a mirrored ceiling',
      credit: 'Bar 8 / Joshua Ngo',
      creditUrl: 'personal.html',
    },
    {
      src: 'images/portfolio/museum-san.jpg',
      alt: 'Stone walls and trees seen through the tall windows of Museum SAN',
      credit: 'Museum SAN / Joshua Ngo',
      creditUrl: 'personal.html',
    },
    {
      src: 'images/portfolio/concrete-wall.jpg',
      alt: 'A concrete terrace framed by a mountain landscape',
      credit: 'Concrete Wall / Joshua Ngo',
      creditUrl: 'personal.html',
    },
    {
      src: 'images/portfolio/songdo.jpg',
      alt: 'Songdo skyline reflected in a park lake',
      credit: 'Songdo / Joshua Ngo',
      creditUrl: 'personal.html',
    },
    {
      src: 'images/portfolio/yongsan-01.jpg',
      alt: 'A colonnade opening onto a green garden in Yongsan',
      credit: 'Yongsan / Joshua Ngo',
      creditUrl: 'personal.html',
    },
    {
      src: 'images/portfolio/yongsan-02.jpg',
      alt: 'A symmetrical stone memorial passage in Yongsan',
      credit: 'Yongsan / Joshua Ngo',
      creditUrl: 'personal.html',
    },
    {
      src: 'images/portfolio/yongsan-03.jpg',
      alt: 'A solitary figure crossing a monumental stone interior',
      credit: 'Yongsan / Joshua Ngo',
      creditUrl: 'personal.html',
    },
  ];
  const slides = starterSlides;
  return `    <section class="home-slideshow" id="welcome" aria-label="Featured photography slideshow">
      <div class="home-slides" data-slideshow>
${slides.map((slide, index) => `        <figure class="home-slide${index === 0 ? ' is-active' : ''}" aria-hidden="${index === 0 ? 'false' : 'true'}">
          <img src="${escapeHtml(slide.src)}" alt="${escapeHtml(slide.alt)}"${index === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>
          <figcaption><a href="${escapeHtml(slide.creditUrl)}"${/^https?:/.test(slide.creditUrl) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(slide.credit)}</a></figcaption>
        </figure>`).join('\n')}
      </div>
      <button class="home-slide-next" id="homeSlideNext" type="button" aria-label="Show next image"></button>
      <div class="home-slide-ui" aria-hidden="true">
        <span>Joshua Ngo / Photography</span>
        <span class="home-slide-counter"><span id="homeSlideCurrent">01</span> / ${String(slides.length).padStart(2, '0')}</span>
      </div>
    </section>`;
}

function renderHomeArchive(posts) {
  if (!posts.length) return '';
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
        <h2 id="recent-title">Projects</h2>
        <a href="study.html">Index <span aria-hidden="true">↘</span></a>
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

const topicSlug = (topic) => Buffer.from(topic.trim().toLowerCase()).toString('hex');
const topicHref = (topic) => `topic-${topicSlug(topic)}.html`;
function renderTopicLinks(post) {
  return post.topics.map(topic => `<a href="${topicHref(topic)}">${escapeHtml(topic)}</a>`).join('');
}
function editorialImage(image, credit = '') {
  return `<figure class="editorial-image"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy"><figcaption>${escapeHtml(image.caption || credit)}</figcaption></figure>`;
}
function renderEditorialGallery(post) {
  const images = post.gallery.filter(image => image.src !== post.hero);
  return images.length ? `<section class="editorial-gallery" aria-label="Photo essay">${images.map(image => editorialImage(image, post.photography ? `Photography: ${post.photography}` : '')).join('')}</section>` : '';
}
function renderEditorialBody(post) {
  return `<div class="editorial-body">${post.article.map(block => block.type === 'image'
    ? editorialImage(block, post.photography ? `Photography: ${post.photography}` : '')
    : `<div class="editorial-text"><p>${renderInline(block.text)}</p></div>`).join('')}</div>`;
}
function renderRelated(post, posts) {
  const related = posts.filter(item => item.slug !== post.slug && item.type !== 'page' && item.topics.some(topic => post.topics.some(own => own.toLowerCase() === topic.toLowerCase()))).slice(0, 3);
  return related.length ? `<section class="editorial-related"><h2>Continue exploring</h2><div class="article-grid">${renderCards(related)}</div></section>` : '';
}
function buildTopics(posts) {
  const groups = new Map();
  for (const post of posts.filter(post => post.type !== 'page')) {
    for (const topic of post.topics) {
      const key = topic.toLowerCase();
      if (!groups.has(key)) groups.set(key, { name: topic, posts: [] });
      groups.get(key).posts.push(post);
    }
  }
  const template = fs.readFileSync(path.join(templatesDir, 'topic.html'), 'utf8');
  for (const {name, posts: items} of groups.values()) {
    fs.writeFileSync(path.join(siteDir, topicHref(name)), replaceTokens(template, { TITLE: escapeHtml(name), TOPIC_LINKS: '', POST_CARDS: renderCards(items) }));
  }
  const links = [...groups.values()].map(({name, posts: items}) => `<a href="${topicHref(name)}">${escapeHtml(name)} <span>${items.length}</span></a>`).join('');
  fs.writeFileSync(path.join(siteDir, 'topics.html'), replaceTokens(template, { TITLE: 'Topics', TOPIC_LINKS: links || '<p>New stories and collections will appear here.</p>', POST_CARDS: '' }));
}

const postFiles = fs.readdirSync(postsDir)
  .filter((filename) => filename.endsWith('.md') && !filename.startsWith('_'));
const posts = postFiles.map(parsePost)
  .filter((post) => post.status.toLowerCase() === 'published')
  .sort((a, b) => b.date.localeCompare(a.date));

const reservedSlugs = new Set(['index', 'study', 'personal', 'about', 'topics']);
for (const post of posts) {
  if (reservedSlugs.has(post.slug) || post.slug.startsWith('topic-')) throw new Error(`Reserved post slug: ${post.slug}`);
}
const duplicateSlug = posts.find((post, index) => posts.findIndex((candidate) => candidate.slug === post.slug) !== index);
if (duplicateSlug) throw new Error(`Duplicate post slug: ${duplicateSlug.slug}`);

const studyTemplate = fs.readFileSync(path.join(templatesDir, 'study.html'), 'utf8');
fs.writeFileSync(path.join(siteDir, 'study.html'), replaceTokens(studyTemplate, { POST_CARDS: renderCards(posts.filter(post => post.type !== 'page')) }));
// The homepage is curated separately; publishing must not rewrite it.

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
    GALLERY: post.type === 'project' ? renderGallery(post) : renderEditorialGallery(post),
    QUOTE: post.quote ? `<blockquote class="editorial-quote">${renderInline(post.quote)}</blockquote>` : '',
    ARTICLE: renderEditorialBody(post),
    AUTHOR: escapeHtml(post.author || 'Joshua Ngo'),
    DATE_LONG: formatDate(post.date),
    TYPE: escapeHtml(post.type || 'article'),
    TOPICS: renderTopicLinks(post),
    RELATED: renderRelated(post, posts),
  };
  fs.writeFileSync(path.join(siteDir, `${post.slug}.html`), replaceTokens(articleTemplate, values));
}

buildTopics(posts);

console.log(`Built ${posts.length} published project${posts.length === 1 ? '' : 's'} and refreshed the Work and topic indexes; homepage unchanged.`);

