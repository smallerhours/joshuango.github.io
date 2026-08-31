import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '..');
let building = false;
let queued = false;

function build() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  const child = spawn(process.execPath, [path.join(scriptDir, 'build-posts.mjs')], {
    cwd: siteDir,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    building = false;
    if (code !== 0) console.error('\nThe Study pages were not updated. Fix the message above and save again.');
    if (queued) {
      queued = false;
      build();
    }
  });
}

function sourceFiles() {
  return [
    ...fs.readdirSync(path.join(siteDir, 'content', 'posts')).filter((name) => name.endsWith('.md')).map((name) => path.join(siteDir, 'content', 'posts', name)),
    path.join(siteDir, 'templates', 'study.html'),
    path.join(siteDir, 'templates', 'article.html'),
    path.join(siteDir, 'scripts', 'build-posts.mjs'),
  ];
}

function fingerprint() {
  return sourceFiles().map((filename) => `${filename}:${fs.statSync(filename).mtimeMs}:${fs.statSync(filename).size}`).join('|');
}

console.log('Watching Study Markdown. Save a post to refresh the homepage, Study index, and article page.');
build();
let previousFingerprint = fingerprint();
setInterval(() => {
  const nextFingerprint = fingerprint();
  if (nextFingerprint !== previousFingerprint) {
    previousFingerprint = nextFingerprint;
    build();
  }
}, 500);
