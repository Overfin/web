<!-- The profile's wishlist: titles not here yet, in its own order (moved
     up and down, or taken off), each with what became of it; what arrived
     since it was last told, at the top, until it's acknowledged. -->
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
  // A season shows its series' name first.
  const nameOf = (w: Wish) => w.title.kind === 'season' && w.title.series ? `${w.title.series.name} · ${w.title.name}` : w.title.name;

  // Moving one: shown at once, kept by the server, put back if it refuses.
  async function move(i: number, by: number) {
    if (!list) return;
    const before = list.items;
    const items = [...before];
    const [w] = items.splice(i, 1);
    items.splice(i + by, 0, w);
    list.items = items;
    try {
      await overfin.orderWishlist(items.map((x) => x.title.id));
    } catch (err) {
      list.items = before;
      await notice(explain(err));
    }
  }
  async function remove(w: Wish) {
    if (!list) return;
    try {
      await overfin.removeFromWishlist(w.title.id);
      list.items = list.items.filter((x) => x.title.id !== w.title.id);
      delete wishes.ids[w.title.id];
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
        {#each list.items as w, i (w.title.id)}
          <li>
            <a class="thumb" href={titlePathOf(w.title)}>
              {#if w.title.images?.primary}
                <img src={overfin.imageUrl(w.title.images.primary, 'small')} srcset={srcset(w.title.images.primary, 'poster')} sizes={sizes.card} alt="" loading="lazy" use:loaded />
              {/if}
            </a>
            <div class="what">
              <a href={titlePathOf(w.title)}><strong>{nameOf(w)}</strong></a>
              {#if w.title.year}<span class="muted"> ({w.title.year})</span>{/if}
              <div class="muted small">{stateText(w)}</div>
            </div>
            <div class="order">
              <button type="button" class="icon-button" disabled={i === 0} aria-label={t('wish.up', { name: nameOf(w) })} title={t('wish.up', { name: nameOf(w) })} onclick={() => move(i, -1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 15.4L12 10.8l4.6 4.6L18 14l-6-6-6 6z" /></svg>
              </button>
              <button type="button" class="icon-button" disabled={i === list.items.length - 1} aria-label={t('wish.down', { name: nameOf(w) })} title={t('wish.down', { name: nameOf(w) })} onclick={() => move(i, 1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 8.6L12 13.2l4.6-4.6L18 10l-6 6-6-6z" /></svg>
              </button>
              <button type="button" class="icon-button" aria-label={t('wish.remove', { name: nameOf(w) })} title={t('wish.remove', { name: nameOf(w) })} onclick={() => remove(w)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" /></svg>
              </button>
            </div>
          </li>
        {/each}
      </ol>
    {/if}
  {/if}
</div>
