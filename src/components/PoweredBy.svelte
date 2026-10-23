<!-- "Powered by Overfin", once the site shows the operator's own brand. -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';
  import OverfinBanner from './OverfinBanner.svelte';
</script>

<p class="powered">
  {t('app.poweredBy')}
  <a href="https://github.com/overfin/server" target="_blank" rel="noopener"><OverfinBanner /></a>
</p>
