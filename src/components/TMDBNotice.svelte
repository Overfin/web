<!-- TMDB's attribution, which its terms require: its logo, kept less
     prominent than the site's own brand, and its notice. Small, at the very
     bottom of every page. -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
</script>

<p class="tmdb">
  <img src="/tmdb.svg" alt="TMDB" />
  <span>{t('tmdb.notice')}</span>
</p>
