<!-- Collections: TMDB's series of films the profile has films of, by
     name, each with how many of its films are here. Shown at once from the
     menu's list, then read again. -->
<script lang="ts">
  import { overfin } from '../lib/client';
  import { sizes, srcset } from '../lib/images';
  import { loaded } from '../lib/loaded';
  import { collectionPath } from '../lib/paths';
  import { t } from '../lib/i18n.svelte';
  import { session } from '../lib/session.svelte';

  overfin.collections().then((all) => (session.collections = all), () => {});
</script>

<h1>{t('collections.title')}</h1>
{#if !session.collections.length}
  <p class="muted">{t('collections.empty')}</p>
{:else}
  <div class="grid">
    {#each session.collections as c (c.id)}
      <a class="card" href={collectionPath(c.id, c.name)}>
        <div class="poster">
          {#if c.images?.primary}
            <img src={overfin.imageUrl(c.images.primary, 'small')} srcset={srcset(c.images.primary, 'poster')} sizes={sizes.card} alt="" loading="lazy" use:loaded />
          {:else}
            <div class="fallback">{c.name}</div>
          {/if}
        </div>
        <div class="title">{c.name}</div>
        <div class="sub">{t('collections.count', { have: c.inLibrary, films: c.films })}</div>
      </a>
    {/each}
  </div>
{/if}
