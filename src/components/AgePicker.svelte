<!-- A kids profile's age: it sees titles for that age at most, films and
     series alike, from their ratings in any country. -->
<script lang="ts">
  import { t } from '../lib/i18n.svelte';

  let { age = $bindable() }: { age: number } = $props();
  const ages = [3, 6, 8, 10, 12, 14, 16];
</script>

<label>
  {t('ages.upTo')}
  <select bind:value={age}>
    {#each ages as a (a)}<option value={a}>{t('ages.years', { age: a })}</option>{/each}
  </select>
</label>
