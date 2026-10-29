// The site's main paths, in a real browser, against a running Overfin:
//
//   OVERFIN_URL=http://… OVERFIN_EMAIL=… OVERFIN_PASSWORD=… npm run e2e
//
// The account signs in with Overfin's own sign-in and owns its account. With
// OVERFIN_ADMIN=1, the control panel is checked too (the account is an
// admin). CHROMIUM is the browser to use (else playwright-core's own, if
// installed). Every test only looks, or puts back what it changed; a page
// error or a browser dialog (window.confirm…) fails it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = (process.env.OVERFIN_URL || '').replace(/\/$/, '');
const email = process.env.OVERFIN_EMAIL || '';
const password = process.env.OVERFIN_PASSWORD || '';
const skip = !base || !email || !password ? 'OVERFIN_URL, OVERFIN_EMAIL and OVERFIN_PASSWORD are needed' : false;

let browser;
let state; // the signed-in session, shared by the tests

// page opens a page at a size, signed in, watching for errors and dialogs.
async function page(viewport = { width: 1280, height: 860 }) {
  const context = await browser.newContext({ storageState: state, viewport });
  const p = await context.newPage();
  p.problems = [];
  p.on('pageerror', (e) => p.problems.push(`page error: ${e.message}`));
  p.on('dialog', (d) => { p.problems.push(`browser dialog: ${d.message()}`); d.dismiss(); });
  return p;
}

// done closes a page, failing on what it saw go wrong.
async function done(p) {
  const problems = p.problems;
  await p.context().close();
  assert.deepEqual(problems, []);
}

// pick chooses the first profile, as "Who's watching?" asks.
async function pick(p) {
  await p.goto(`${base}/profiles`);
  await p.locator('main button.profile').first().click();
  await p.locator('header nav').first().waitFor({ state: 'attached' });
}

const path = (p) => new URL(p.url()).pathname;

before(async () => {
  if (skip) return;
  browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const context = await browser.newContext();
  const p = await context.newPage();
  await p.goto(`${base}/`);
  await p.locator('input[type=email]').fill(email);
  await p.locator('input[type=password]').fill(password);
  await p.locator('form button[type=submit]').first().click();
  await p.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 30000 });
  state = await context.storageState();
  await context.close();
});

after(async () => {
  await browser?.close();
});

test('home: slideshow and rows', { skip }, async () => {
  const p = await page();
  await pick(p);
  await p.locator('.slides .slide.current').waitFor();
  assert.ok(await p.locator('main h2').count() > 0, 'rows');
  await done(p);
});

test('menu: readable addresses, a category lists its titles', { skip }, async () => {
  const p = await page();
  await pick(p);
  const links = await p.$$eval('header nav a', (as) => as.map((a) => a.getAttribute('href')));
  for (const href of links.filter((h) => h.startsWith('/category/'))) {
    assert.doesNotMatch(href, /cat_/, `a category by its name: ${href}`);
  }
  const category = links.find((h) => h.startsWith('/category/'));
  if (category) {
    await p.locator(`header nav a[href="${category}"]`).click();
    await p.locator('main a.card').first().waitFor();
  }
  await done(p);
});

test('phone: two columns load their titles; the sections open from a button', { skip }, async () => {
  const p = await page({ width: 340, height: 700 });
  await pick(p);
  await p.getByRole('button', { name: /Rubriques|Sections/ }).click();
  const link = p.locator('header nav.open a[href^="/category/"]').first();
  if (await link.count()) {
    await link.click();
    assert.equal(await p.locator('header nav.open').count(), 0, 'the list closes');
    // Without scrolling: the first page of titles comes by itself.
    await p.locator('main a.card').first().waitFor({ timeout: 10000 });
  }
  await done(p);
});

test('a title: its address, its backdrop, back to the list', { skip }, async () => {
  const p = await page();
  await pick(p);
  const category = await p.$$eval('header nav a', (as) => as.map((a) => a.getAttribute('href')).find((h) => h.startsWith('/category/')));
  if (!category) return done(p);
  await p.goto(base + category);
  const card = p.locator('main a.card').first();
  await card.waitFor();
  const href = await card.getAttribute('href');
  assert.match(href, /^\/title\/[ms]\d+(\/|$)/, `a readable address: ${href}`);
  await card.click();
  await p.locator('.hero').waitFor();
  assert.equal(path(p), href);
  // The old address, and a wrong name, end on the same one.
  const [, , code] = href.split('/');
  const id = `title_${code[0] === 'm' ? 'movie' : 'series'}_tmdb_${code.slice(1)}`;
  for (const other of [`/title/${id}`, `/title/${code}/not-its-name`]) {
    await p.goto(base + other);
    await p.locator('.hero').waitFor();
    await p.waitForFunction((want) => location.pathname === want, href);
  }
  // Back on the list: no backdrop left behind.
  await p.goto(base + category);
  await p.locator('main a.card').first().waitFor();
  assert.equal(await p.locator('.page-backdrop').count(), 0, 'no backdrop on the list');
  await done(p);
});

test('profiles: a list, each one edited in a window', { skip }, async () => {
  const p = await page();
  await pick(p);
  await p.goto(`${base}/manage`);
  const edit = p.locator('.profiles-list li').first().getByRole('button').first();
  await edit.click();
  const dialog = p.locator('dialog[open]');
  await dialog.waitFor();
  assert.ok(await dialog.locator('form').count() > 0, 'its form, in a window');
  await p.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await p.locator('main form').count(), 0, 'nothing edited in place');
  await done(p);
});

test('collections and search', { skip }, async () => {
  const p = await page();
  await pick(p);
  await p.goto(`${base}/collections`);
  await p.locator('main h1').waitFor();
  await p.goto(`${base}/search`);
  const box = p.locator('main input[type=search]');
  await box.fill('the');
  await box.press('Enter');
  await p.locator('main a.card').first().waitFor({ timeout: 15000 });
  await done(p);
});

test('control panel: lists, forms in windows, its own confirmations', { skip: skip || (process.env.OVERFIN_ADMIN ? false : 'OVERFIN_ADMIN not set') }, async () => {
  const p = await page();
  await pick(p);
  await p.goto(`${base}/admin/#/templates`);
  await p.getByRole('button', { name: 'New template' }).click();
  const dialog = p.locator('dialog[open]');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await dialog.waitFor({ state: 'detached' });
  for (const view of ['libraries', 'categories', 'apps', 'people']) {
    await p.goto(`${base}/admin/#/${view}`);
    await p.locator('main h1').waitFor();
    assert.equal(await p.locator('main form').count(), 0, `${view}: nothing edited in place`);
  }
  await done(p);
});
