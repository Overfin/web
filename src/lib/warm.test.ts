import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each step the warming takes, in order.
const steps: string[] = [];
let sort = 'addedAt';
const keptLists = new Set<string>();
let homeKept = false;
let slidesKept = false;
// Called once a step is taken: a test may start a video, or switch profile.
let after: (step: string) => void = () => {};
const took = (step: string) => {
  steps.push(step);
  after(step);
};

vi.mock('./client', () => ({
  overfin: {
    discover: async (list: string, kind: string, o: { availability: string }) => {
      took(`discover ${list} ${kind} ${o.availability}`);
      return [];
    },
    pages: (q: { category?: string; library?: string }) => {
      took(`list ${q.category ?? q.library}`);
      return (async function* () {
        yield { items: [], totalCount: 0 };
      })();
    },
  },
}));
vi.mock('./tv', () => ({ onTV: false }));
vi.mock('./homecache', () => ({
  keptHome: () => (homeKept ? { data: { rows: [] } } : undefined),
  keepHome: () => {
    homeKept = true;
  },
  keptSlides: () => (slidesKept ? { titles: [] } : undefined),
  keepSlides: () => {
    slidesKept = true;
  },
}));
vi.mock('./homeload', () => ({
  loadHome: async () => {
    took('home');
    return { rows: [] };
  },
}));
vi.mock('./lastlibrary', () => ({
  lastLibraryId: (libs: { id: string }[]) => libs[libs.length - 1]?.id,
  lastSort: () => sort,
}));
vi.mock('./lists', () => ({
  listSort: (s: string) => s,
  listKey: (profile: string, base: string, _p: URLSearchParams, s: string) => `${profile}|${base}|${s}`,
  listQuery: (id: string, category: boolean) => (category ? { category: id } : { library: id }),
}));
vi.mock('./paths', () => ({ categoryPath: (c: { id: string }) => `/c/${c.id}` }));
vi.mock('./pagecache', () => ({
  cached: (_key: string, fn: () => Promise<unknown>) => fn(),
  keptList: (key: string) => keptLists.has(key),
  keepList: (key: string) => {
    keptLists.add(key);
  },
}));
const router = { route: { parts: [''] as string[] } };
vi.mock('./router.svelte', () => ({ router }));
const session = {
  me: { activeProfile: { id: 'p1' } } as { activeProfile?: { id: string } } | null,
  discovery: true,
  categories: [{ id: 'k1' }, { id: 'k2' }],
  libraries: [{ id: 'lib_a', kind: 'movies' }, { id: 'lib_b', kind: 'tvshows' }],
  librariesShown: true,
};
vi.mock('./session.svelte', () => ({ session }));
vi.mock('./slides', () => ({
  slideSources: () => [],
  pickSlides: async () => {
    took('slides picked');
    return [];
  },
  preloadSlides: async () => {
    took('slides loaded');
  },
}));

const discovered = ['trending', 'popular', 'upcoming'].flatMap((l) => [`discover ${l} movie missing`, `discover ${l} series missing`]);

// Each test has its own module, its "once per profile" fresh.
async function fresh() {
  vi.resetModules();
  return import('./warm');
}

describe('the main pages read ahead', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    steps.length = 0;
    keptLists.clear();
    homeKept = slidesKept = false;
    sort = 'addedAt';
    after = () => {};
    router.route.parts = [''];
    session.me = { activeProfile: { id: 'p1' } };
    session.discovery = true;
    session.librariesShown = true;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("in the menu's order, home first, then the slideshow; once per profile", async () => {
    const { landed } = await fresh();
    landed();
    await vi.advanceTimersByTimeAsync(299);
    expect(steps).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await vi.runAllTimersAsync();
    expect(steps).toEqual(['home', ...discovered, 'list k1', 'list k2', 'list lib_b', 'slides picked', 'slides loaded']);
    steps.length = 0;
    landed();
    await vi.runAllTimersAsync();
    expect(steps).toEqual([]);
    // Another profile: its own.
    session.me = { activeProfile: { id: 'p2' } };
    homeKept = false;
    landed();
    await vi.runAllTimersAsync();
    expect(steps[0]).toBe('home');
  });

  it('without discovery nor libraries shown, a shuffled list or one kept: those left out', async () => {
    session.discovery = false;
    session.librariesShown = false;
    keptLists.add('p1|/c/k2|addedAt');
    const { landed } = await fresh();
    landed();
    await vi.runAllTimersAsync();
    expect(steps).toEqual(['home', 'list k1', 'slides picked', 'slides loaded']);

    steps.length = 0;
    sort = 'random';
    session.me = { activeProfile: { id: 'p3' } };
    homeKept = slidesKept = false;
    landed();
    await vi.runAllTimersAsync();
    expect(steps).toEqual(['home', 'slides picked', 'slides loaded']);
  });

  it('a video started stops it; it starts over once the video is over', async () => {
    after = (step) => {
      if (step === 'discover trending series missing') router.route.parts = ['play', 'x'];
    };
    const { landed } = await fresh();
    landed();
    await vi.runAllTimersAsync();
    expect(steps).toEqual(['home', 'discover trending movie missing', 'discover trending series missing']);
    after = () => {};
    steps.length = 0;
    router.route.parts = ['title', 'x'];
    homeKept = true; // kept on the way: not read again
    landed();
    await vi.runAllTimersAsync();
    expect(steps[0]).toBe('discover trending movie missing');
    expect(steps.at(-1)).toBe('slides loaded');
  });

  it('another profile chosen meanwhile: the rest waits', async () => {
    after = (step) => {
      if (step === 'home') session.me = { activeProfile: { id: 'p9' } };
    };
    const { landed } = await fresh();
    landed();
    await vi.runAllTimersAsync();
    expect(steps).toEqual(['home']);
  });

  it('not on the profile picker, nor in a video, nor signed out, nor saving data', async () => {
    const { landed, warmLater } = await fresh();
    for (const where of ['profiles', 'play']) {
      router.route.parts = [where];
      landed();
      await vi.runAllTimersAsync();
    }
    router.route.parts = [''];
    session.me = null;
    warmLater();
    await vi.runAllTimersAsync();
    session.me = { activeProfile: { id: 'p1' } };
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    landed();
    await vi.runAllTimersAsync();
    expect(steps).toEqual([]);
    Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
    // warmLater waits three seconds; a page landing meanwhile, 300 ms.
    warmLater();
    await vi.advanceTimersByTimeAsync(2999);
    expect(steps).toEqual([]);
    landed();
    await vi.advanceTimersByTimeAsync(300);
    expect(steps[0]).toBe('home');
  });
});
