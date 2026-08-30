import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
const contentPath = path.join(siteDir, 'content', 'inspiration.md');
const templatePath = path.join(siteDir, 'templates', 'inspiration.html');
const maxImageBytes = 950 * 1024;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function parseSections(source) {
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '');
  const sections = { portrait: [], landscape: [] };
  let current = '';
  for (const line of withoutComments.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(Portrait|Landscape)\s*$/i);
    if (heading) {
      current = heading[1].toLowerCase();
      continue;
    }
    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image && current) sections[current].push({ alt: image[1].trim(), src: image[2].trim(), format: current });
  }
  return [...sections.portrait, ...sections.landscape];
}

function validateImage(image) {
  if (!image.alt) throw new Error(`Add a useful description inside [] for ${image.src}.`);
  if (/^https?:\/\//.test(image.src)) return;
  const absolute = path.resolve(siteDir, image.src);
  if (!absolute.startsWith(siteDir + path.sep) || !fs.existsSync(absolute)) {
    throw new Error(`Inspiration image not found: ${image.src}`);
  }
  if (fs.statSync(absolute).size > maxImageBytes) {
    throw new Error(`${image.src} is over 950 KB. Put the original in images/inspiration/uploads and run npm run build:inspiration.`);
  }
}

function renderGallery(images) {
  if (!images.length) return '      <p class="inspiration-empty">An evolving image archive.</p>';
  return images.map((image, index) => `      <figure class="inspiration-item inspiration-item--${image.format} reveal" style="--delay: ${(index % 3) * 60}ms">
        <div class="inspiration-frame"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async"></div>
        <figcaption>${escapeHtml(image.alt)}</figcaption>
      </figure>`).join('\n\n');
}

const source = fs.readFileSync(contentPath, 'utf8');
const images = parseSections(source);
images.forEach(validateImage);

const template = fs.readFileSync(templatePath, 'utf8');
const output = template.replace('{{INSPIRATION_GALLERY}}', renderGallery(images));
fs.writeFileSync(path.join(siteDir, 'inspiration.html'), output);

console.log(`Built inspiration.html with ${images.length} image${images.length === 1 ? '' : 's'}.`);
