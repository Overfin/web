<!-- The profile's wishlist: films and series not here yet, in its own
     order (moved up and down, or taken off), each with what became of it;
     a series with its seasons, by number, each taken off on its own. What
     arrived since it was last told, at the top, until it's acknowledged. -->
<script lang="ts">
  import type { Wish, Wishlist } from '../lib/sdk/overfin.js';
  import { sizes, srcset } from '../lib/images';
  import { explain, overfin } from '../lib/client';
  import { notice } from '../lib/dialog.svelte';
  import { t } from '../lib/i18n.svelte';
  import { loaded } from '../lib/loaded';
  import { titlePathOf } from '../lib/paths';
  import { wishes } from '../lib/wishlist.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let list = $state<Wishlist | null>(null);
  let error = $state<unknown>();
  overfin.wishlist().then((w) => (list = w), (err) => (error = err));

  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  function stateText(w: Wish): string {
    switch (w.state) {
      case 'unreleased':
        return w.releaseDate ? t('wish.state.unreleasedOn', { date: day(w.releaseDate) }) : t('wish.state.unreleased');
      case 'notFound':
        return w.nextTry ? t('wish.state.notFoundUntil', { date: day(w.nextTry) }) : t('wish.state.notFound');
      case 'downloading':
        return t('wish.state.downloading');
    }
    return t('wish.state.waiting');
  }
  // The list's elements: a film, or a series with its seasons (the
  // server keeps them together, by number).
  interface Group { key: string; name: string; first: Wish; items: Wish[]; series?: string }
  const groups = $derived.by(() => {
    const out: Group[] = [];
    for (const w of list?.items ?? []) {
      const series = w.title.kind === 'season' ? w.title.series : undefined;
      const key = series ? 'series:' + series.id : w.title.id;
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(w);
      else out.push({ key, name: series?.name ?? w.title.name, first: w, items: [w], series: series?.id });
    }
    return out;
  });

  // Moving one: shown at once, kept by the server, put back if it refuses.
  async function move(i: number, by: number) {
    if (!list) return;
    const before = list.items;
    const order = [...groups];
    const [g] = order.splice(i, 1);
    order.splice(i + by, 0, g);
    list.items = order.flatMap((x) => x.items);
    try {
      await overfin.orderWishlist(list.items.map((x) => x.title.id));
    } catch (err) {
      list.items = before;
      await notice(explain(err));
    }
  }
  // Taking off a film, a season, or a series (all its seasons).
  async function remove(id: string, gone: (w: Wish) => boolean) {
    if (!list) return;
    try {
      await overfin.removeFromWishlist(id);
      for (const w of list.items.filter(gone)) delete wishes.ids[w.title.id];
      list.items = list.items.filter((w) => !gone(w));
    } catch (err) {
      await notice(explain(err));
    }
  }
  async function seen() {
    if (!list) return;
    list.arrived = [];
    await overfin.wishesSeen().catch(() => {});
  }
</script>

<div class="center wide">
  <h1>{t('wish.title')}</h1>
  {#if error}
    <PageError {error} />
  {:else if !list}
    <Skeleton kind="list" />
  {:else}
    {#if list.arrived.length}
      <div class="notice arrived" role="status">
        <p>{t('wish.arrived')}
          {#each list.arrived as a, i (a.id)}{#if i}, {/if}<a href={titlePathOf(a)}>{a.name}</a>{/each}
        </p>
        <button onclick={seen}>{t('common.ok')}</button>
      </div>
    {/if}
    {#if !list.on}<p class="notice">{t('wish.off')}</p>{/if}
    <p class="muted">{t('wish.intro')}</p>
    {#if !list.items.length}
      <p class="muted">{t('wish.none')}</p>
    {:else}
      <ol class="list wishes">
        {#each groups as g, i (g.key)}
          <li>
            <a class="thumb" href={titlePathOf(g.first.title)}>
              {#if g.first.title.images?.primary}
                <img src={overfin.imageUrl(g.first.title.images.primary, 'small')} srcset={srcset(g.first.title.images.primary, 'poster')} sizes={sizes.card} alt="" loading="lazy" use:loaded />
              {/if}
            </a>
            <div class="what">
              {#if g.series}
                <strong>{g.name}</strong>
                <ul class="seasons">
                  {#each g.items as w (w.title.id)}
                    <li>
                      <a href={titlePathOf(w.title)}>{w.title.name}</a>
                      <span class="muted small">{stateText(w)}</span>
                      <button type="button" class="icon-button small" aria-label={t('wish.remove', { name: `${g.name} · ${w.title.name}` })} title={t('wish.remove', { name: `${g.name} · ${w.title.name}` })}
                        onclick={() => remove(w.title.id, (x) => x.title.id === w.title.id)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" /></svg>
                      </button>
                    </li>
                  {/each}
                </ul>
              {:else}
                <a href={titlePathOf(g.first.title)}><strong>{g.name}</strong></a>
                {#if g.first.title.year}<span class="muted"> ({g.first.title.year})</span>{/if}
                <div class="muted small">{stateText(g.first)}</div>
              {/if}
            </div>
            <div class="order">
              <button type="button" class="icon-button" disabled={i === 0} aria-label={t('wish.up', { name: g.name })} title={t('wish.up', { name: g.name })} onclick={() => move(i, -1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 15.4L12 10.8l4.6 4.6L18 14l-6-6-6 6z" /></svg>
              </button>
              <button type="button" class="icon-button" disabled={i === groups.length - 1} aria-label={t('wish.down', { name: g.name })} title={t('wish.down', { name: g.name })} onclick={() => move(i, 1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 8.6L12 13.2l4.6-4.6L18 10l-6 6-6-6z" /></svg>
              </button>
              <button type="button" class="icon-button" aria-label={t('wish.remove', { name: g.name })} title={t('wish.remove', { name: g.name })}
                onclick={() => g.series ? remove(g.series, (x) => x.title.series?.id === g.series) : remove(g.first.title.id, (x) => x.title.id === g.first.title.id)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" /></svg>
              </button>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</div>
