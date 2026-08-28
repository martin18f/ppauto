import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changes = [];

function file(rel) { return path.join(root, rel); }
function read(rel) {
  const p = file(rel);
  if (!fs.existsSync(p)) throw new Error(`Chýba súbor ${rel}`);
  return fs.readFileSync(p, 'utf8');
}
function write(rel, next, prev) {
  if (next === prev) return;
  fs.writeFileSync(file(rel), next, 'utf8');
  changes.push(rel);
}
function prependImport(source, statement) {
  if (source.includes(statement)) return source;
  return `${statement}\n${source}`;
}
function replaceOne(source, pattern, replacement, label) {
  const matches = typeof pattern === 'string'
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].length;
  if (matches !== 1) throw new Error(`${label}: očakávaný 1 výskyt, nájdené ${matches}`);
  return source.replace(pattern, replacement);
}
function replaceOptional(source, pattern, replacement) {
  return source.replace(pattern, replacement);
}

function hardenApi(rel) {
  let s = read(rel);
  const before = s;
  s = prependImport(s, "import { hasAdminSession } from '../lib/admin-session.js';");

  // Krátke lokálne helpery isAdmin/getIsAdmin, ktoré iba čítajú admin=1 cookie.
  s = s.replace(
    /function\s+(isAdmin|getIsAdmin)\(req\)\s*\{[\s\S]*?admin=1[\s\S]*?\n\}/g,
    (_, name) => `function ${name}(req) {\n  return hasAdminSession(req);\n}`
  );

  // Dva historické priame varianty bez helpera.
  s = s.replace(/const isAdmin = !!req\.headers\.cookie\?\.includes\(["']admin=1["']\);/g,
    'const isAdmin = hasAdminSession(req);');
  s = s.replace(/if \(!req\.headers\.cookie\?\.includes\(["']admin=1["']\)\) \{/g,
    'if (!hasAdminSession(req)) {');

  if (/admin=1/.test(s)) {
    throw new Error(`${rel}: po migrácii stále obsahuje aktívnu kontrolu admin=1`);
  }
  write(rel, s, before);
}

for (const rel of [
  'api/cars.js',
  'api/documents.js',
  'api/options.js',
  'api/promos.js',
  'api/upload-image.js',
  'api/upload-pdf.js',
  'api/vehicle-options.js',
]) hardenApi(rel);

// Verejné debug režimy – interné repo/branch/path nesmú byť zákazníckym endpointom.
{
  const rel = 'api/cars.js';
  let s = read(rel); const before = s;
  s = replaceOne(
    s,
    /\n\s*\/\/ DEBUG režim[\s\S]*?(?=\n\s*\/\/ GET \(public\))/,
    '\n',
    'api/cars.js debug blok'
  );
  write(rel, s, before);
}
{
  const rel = 'api/promos.js';
  let s = read(rel); const before = s;
  s = replaceOne(
    s,
    /\n\s*\/\/ DEBUG: \/api\/promos\?debug=1[\s\S]*?(?=\n\s*\/\/ GET \(public\))/,
    '\n',
    'api/promos.js debug blok'
  );
  write(rel, s, before);
}

// Test-drive promo už nesmie dynamicky načítať EmailJS CDN.
{
  const rel = 'js/testdrive-promo.js';
  let s = read(rel); const before = s;
  s = s.replace(
    /\n\s*if \(!window\.emailjs\) \{\s*await loadScriptOnce\(\s*['"]https:\/\/cdn\.jsdelivr\.net\/npm\/@emailjs\/browser@4\/dist\/email\.min\.js['"],\s*['"]data-pp-emailjs['"]\s*\);\s*\}\s*/m,
    '\n'
  );
  s = s.replace(/EmailJS/gi, 'serverový formulár');
  if (/emailjs|@emailjs/i.test(s)) throw new Error(`${rel}: EmailJS loader sa nepodarilo odstrániť`);
  write(rel, s, before);
}

// Main test-drive – submit preberá /js/form-api.js, staré EmailJS odosielanie odstránime zo zdroja.
{
  const rel = 'js/testdrive.js';
  let s = read(rel); const before = s;
  s = s.replace(/\n\s*\/\/ EmailJS[^\n]*\n[\s\S]*?(?=\n\s*\/\/ \(voliteľné\) min dátum = dnes)/, '\n');
  const marker = s.indexOf('    // submit –');
  if (marker < 0) throw new Error(`${rel}: nenašiel sa submit marker`);
  const tail = s.indexOf('\n  });\n})();', marker);
  if (tail < 0) throw new Error(`${rel}: nenašiel sa koniec init callbacku`);
  s = `${s.slice(0, marker)}    // Odoslanie formulára spracúva /js/form-api.js cez vlastný backend.\n${s.slice(tail)}`;
  s = s.replace(/EmailJS/gi, 'serverový formulár');
  if (/emailjs|@emailjs/i.test(s)) throw new Error(`${rel}: zostal EmailJS kód`);
  write(rel, s, before);
}

// Financovanie – submit preberá /js/form-api.js. Kalkulačka a ostatná logika zostáva bezo zmeny.
{
  const rel = 'js/script.js';
  let s = read(rel); const before = s;
  const start = s.indexOf('  // Rýchly dopyt – odoslanie cez EmailJS');
  if (start < 0) throw new Error(`${rel}: nenašiel sa finance EmailJS marker`);
  const close = s.indexOf('\n})();', start);
  if (close < 0) throw new Error(`${rel}: nenašiel sa koniec finance IIFE`);
  s = `${s.slice(0, start)}  // Rýchly dopyt odosiela /js/form-api.js cez vlastný backend.\n${s.slice(close)}`;
  s = s.replace(/EmailJS/gi, 'serverový formulár');
  write(rel, s, before);
}

// Detail auta – odstránime starý EmailJS transport a submit handler. UI testovacej jazdy ostáva;
// jeho odoslanie preberá /js/form-api.js.
{
  const rel = 'js/auto.js';
  let s = read(rel); const before = s;

  // Konštanty + init funkcia.
  s = s.replace(
    /\n\s*\/\/ =+\n\s*\/\/ TEST DRIVE \(EmailJS\)\n\s*\/\/ =+\n[\s\S]*?(?=\n\s*function formatDateSK\()/,
    '\n'
  );

  // Starý, nepoužívaný modalový EmailJS implementačný blok.
  s = s.replace(/\n\s*function ensureTestDriveModal\(\)[\s\S]*?(?=\n\s*function slugify\()/, '\n');

  s = s.replace(/\n\s*\/\/ ===== Test drive: priprav dáta o aute \+ bind na tlačidlo =====\n\s*initEmailJsOnce\(\);/, '\n    // ===== Test drive: priprav dáta o aute + bind na tlačidlo =====');

  // Aktuálny detailový submit handler po tdSlot listeneri, pred galériou.
  const submitStart = s.indexOf("tdForm?.addEventListener('submit', async (e) => {");
  const gallery = s.indexOf('    // Gallery logic + Lightbox', submitStart);
  if (submitStart < 0 || gallery < 0) throw new Error(`${rel}: detail testdrive submit blok sa nenašiel`);
  s = `${s.slice(0, submitStart)}// Odoslanie testovacej jazdy spracúva /js/form-api.js cez vlastný backend.\n\n${s.slice(gallery)}`;

  s = s.replace(/EmailJS/gi, 'serverový formulár');
  s = s.replace(/emailjs/gi, 'backendForm');
  if (/@emailjs/i.test(s)) throw new Error(`${rel}: zostal EmailJS CDN odkaz`);
  write(rel, s, before);
}

// package.json: vlastný SMTP backend používa Nodemailer, Resend už nie.
{
  const rel = 'package.json';
  const s = read(rel); const pkg = JSON.parse(s);
  pkg.dependencies ||= {};
  delete pkg.dependencies.resend;
  pkg.dependencies.nodemailer = '^9.0.5';
  const next = `${JSON.stringify(pkg, null, 2)}\n`;
  write(rel, next, s);
}

console.log('Migrácia dokončená. Upravené súbory:');
for (const rel of changes) console.log(`  M ${rel}`);
console.log('\nDÔLEŽITÉ: teraz spusti `npm install`, aby sa aktualizoval package-lock.json.');
