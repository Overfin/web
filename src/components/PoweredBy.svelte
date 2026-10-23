<!-- "Powered by Overfin", under every page but the player, once the site
     shows the operator's own brand. -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import OverfinBanner from './OverfinBanner.svelte';
</script>

<footer class="powered">
  {t('app.poweredBy')}
  <a href="https://github.com/overfin/server" target="_blank" rel="noopener"><OverfinBanner /></a>
</footer>
