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

test('player: its keys work whatever has the focus, the wheel sets the volume', { skip }, async () => {
  const p = await page();
  await pick(p);
  // A film of the library: briefly played and paused at its start, the
  // volume put back.
  const id = await p.evaluate(async () => (await (await fetch('/api/v1/titles?kind=movie&limit=1')).json()).items?.[0]?.id);
  if (!id) return done(p);
  await p.goto(`${base}/play/${id}`);
  const video = p.locator('.player video');
  await video.waitFor({ state: 'attached' });
  const state = () => video.evaluate((v) => ({ paused: v.paused, at: v.currentTime, volume: Math.round(v.volume * 100) }));
  // A button of the player has the focus: Space still plays and pauses,
  // and doesn't press it.
  await p.locator('.player button').first().focus();
  const start = await state();
  await p.keyboard.press(' ');
  await p.waitForFunction(() => !document.querySelector('.player video').paused);
  assert.equal(path(p), `/play/${id}`, 'Space pressed the focused button');
  await p.keyboard.press(' ');
  await p.waitForFunction(() => document.querySelector('.player video').paused);
  // Right: 10 seconds on; Down and the wheel: the volume.
  await p.keyboard.press('ArrowRight');
  await p.waitForFunction((was) => document.querySelector('.player video').currentTime >= was + 9, start.at);
  await p.keyboard.press('ArrowDown');
  assert.equal((await state()).volume, Math.max(0, start.volume - 5), 'Down lowers the volume');
  await p.mouse.move(400, 300);
  await p.mouse.wheel(0, -100);
  await p.waitForFunction((want) => Math.round(document.querySelector('.player video').volume * 100) === want, start.volume);
  await done(p);
});

test('phone: no page scrolls sideways', { skip }, async () => {
  const p = await page({ width: 360, height: 740 });
  await pick(p);
  const film = await p.evaluate(async () => (await (await fetch('/api/v1/titles?kind=movie&limit=1')).json()).items?.[0]?.id);
  const pages = ['/', '/discover', '/collections', '/search', '/list', '/requests', '/manage', '/account'];
  if (film) pages.push(`/title/${film}`);
  for (const at of pages) {
    await p.goto(base + at, { waitUntil: 'networkidle' });
    const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(wide <= 0, `${at} is ${wide} px wider than the screen`);
  }
  await done(p);
});

test('account: a setting is saved only once changed', { skip }, async () => {
  const p = await page();
  await pick(p);
  await p.goto(`${base}/account`);
  await p.locator('main h1').waitFor();
  // The language: offered when the server has more than one.
  const card = p.locator('main .panel.setting', { has: p.locator('select') }).filter({ has: p.locator('button.primary') }).first();
  if (await card.count()) {
    const select = card.locator('select');
    const save = card.locator('button.primary');
    assert.ok(await save.isDisabled(), 'Save before any change');
    const was = await select.inputValue();
    const other = await select.locator('option').evaluateAll((os, was) => os.map((o) => o.value).find((v) => v !== was), was);
    await select.selectOption(other);
    assert.ok(await save.isEnabled(), 'Save once changed');
    await select.selectOption(was);
    assert.ok(await save.isDisabled(), 'Save once put back');
  }
  await done(p);
});

// api reads the API as the page's profile.
const api = (p, path) => p.evaluate(async (path) => {
  const r = await fetch(path, { credentials: 'same-origin' });
  return r.ok ? r.json() : null;
}, path);

// series finds a series with two seasons or more, as its page's address.
async function series(p) {
  const list = await api(p, '/api/v1/titles?kind=series&limit=40');
  for (const item of list?.items ?? []) {
    const t = await api(p, `/api/v1/titles/${item.id}`);
    const m = /^title_series_tmdb_(\d+)$/.exec(t?.id ?? '');
    if (m && (t.seasons ?? []).filter((s) => s.seasonNumber > 0).length >= 2) return `/title/s${m[1]}`;
  }
  return null;
}

// The relative luminance of a CSS color, 0 (black) to 1 (white).
function luminance(css) {
  const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('a series: seasons as posters, centered while they fit; choosing one shows its episodes', { skip }, async (t) => {
  const p = await page();
  await pick(p);
  const at = await series(p);
  if (!at) return t.skip('no series with two seasons'), done(p);
  await p.goto(base + at);
  const row = p.locator('.seasons');
  await row.waitFor();
  const buttons = row.locator('button[role=tab]');
  assert.ok(await buttons.count() >= 2, 'a button per season');
  assert.equal(await row.locator('button .season-poster').count(), await buttons.count(), 'each with its poster');
  const fit = await row.evaluate((r) => {
    const first = r.querySelector('button').getBoundingClientRect();
    const last = [...r.querySelectorAll('button')].at(-1).getBoundingClientRect();
    const box = r.getBoundingClientRect();
    return { fits: r.scrollWidth <= r.clientWidth, left: first.left - box.left, right: box.right - last.right };
  });
  if (fit.fits) assert.ok(Math.abs(fit.left - fit.right) < 4, `centered: ${fit.left} left, ${fit.right} right`);
  const second = buttons.nth(1);
  await second.click();
  assert.equal(await second.getAttribute('aria-selected'), 'true');
  assert.match(new URL(p.url()).search, /season=\d+/);
  const head = p.locator('.season-head');
  await head.waitFor();
  await p.waitForFunction(() => {
    const h = document.querySelector('.season-head');
    return h && Math.abs(h.getBoundingClientRect().top - document.querySelector('header').getBoundingClientRect().bottom) < 40;
  }, null, { timeout: 5000 });
  assert.ok(await p.locator('ol.episodes li').count() > 0, 'its episodes');
  await done(p);
});

test('long texts fold, with Read more only when they do', { skip }, async (t) => {
  const p = await page();
  await pick(p);
  const at = await series(p);
  if (!at) return t.skip('no series with two seasons'), done(p);
  await p.goto(base + at);
  const overview = p.locator('.hero .overview');
  if (!(await overview.count())) return t.skip('no overview'), done(p);
  assert.ok(await overview.evaluate((o) => o.classList.contains('folded')), 'folded at first');
  const long = await overview.evaluate((o) => o.scrollHeight > o.clientHeight + 1);
  const toggle = p.locator('.hero .about-toggle');
  assert.equal(await toggle.count(), long ? 1 : 0, 'Read more only when the text is cut');
  if (long) {
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await overview.evaluate((o) => o.classList.contains('folded')), false, 'unfolded');
  }
  await done(p);
});

test('light theme: the header and a picture with its text stay as on dark pages', { skip }, async () => {
  const p = await page();
  await pick(p);
  const at = await series(p);
  await p.goto(base + (at ?? '/'));
  await p.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  const top = at ? '.hero.art[data-theme]' : '.slides';
  await p.locator(top).waitFor();
  const colors = await p.evaluate((top) => ({
    page: getComputedStyle(document.body).backgroundColor,
    header: getComputedStyle(document.querySelector('header')).color,
    picture: getComputedStyle(document.querySelector(top)).color,
  }), top);
  assert.ok(luminance(colors.page) > 0.6, `a light page: ${colors.page}`);
  assert.ok(luminance(colors.header) > 0.6, `the header's text light, on dark: ${colors.header}`);
  assert.ok(luminance(colors.picture) > 0.6, `the text over the picture light, on dark: ${colors.picture}`);
  await done(p);
});

test("phone: a title's Play and round buttons side by side", { skip }, async (t) => {
  const p = await page({ width: 390, height: 844 });
  await pick(p);
  const at = await series(p);
  if (!at) return t.skip('no series with two seasons'), done(p);
  await p.goto(base + at);
  const play = p.locator('.hero .actions button.primary, .hero .actions a.button.primary').first();
  const round = p.locator('.hero .actions .toggle').first();
  await p.locator('.hero .actions').first().waitFor();
  if (!(await play.count()) || !(await round.count())) return t.skip('no Play or round button'), done(p);
  const [a, b] = [await play.boundingBox(), await round.boundingBox()];
  assert.ok(a.width < 390 * 0.6, `Play isn't full width: ${a.width}px`);
  assert.ok(Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) < 6, 'on one line');
  await done(p);
});

test('what you like: genres named, joint ones under their film genres', { skip }, async (t) => {
  const p = await page();
  await pick(p);
  const tastes = await api(p, '/api/v1/me/tastes');
  if (!tastes) return t.skip("the server doesn't ask"), done(p);
  const ids = tastes.choices.map((c) => c.id);
  for (const [joint, films] of [[10759, [28, 12]], [10765, [878, 14]], [10768, [10752]]]) {
    if (films.some((f) => ids.includes(f))) assert.ok(!ids.includes(joint), `${joint} gives way to ${films}`);
  }
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
