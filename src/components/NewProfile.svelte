<!-- Adding a profile, for the owner: its name, and an age for a kids
     profile. On "Who's watching?" and the Profiles page. -->
<script lang="ts">
  import { explain, overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { session } from '../lib/session.svelte';
  import AgePicker from './AgePicker.svelte';

  let { created, cancel }: { created: () => void; cancel: () => void } = $props();

  let name = $state('');
  let kids = $state(false);
  let age = $state(8);
  let message = $state('');

  async function add(event: SubmitEvent) {
    event.preventDefault();
    message = '';
    try {
      await overfin.createProfile(kids ? { name, kind: 'kids', maxAge: age } : { name });
      // The streams shared among profiles change with their number.
      session.me = await overfin.me().catch(() => session.me);
      created();
    } catch (err) {
      message = explain(err);
    }
  }
</script>

<form class="stack" onsubmit={add}>
  <label>{t('manage.name')} <input bind:value={name} maxlength="32" required /></label>
  <label class="check"><input type="checkbox" bind:checked={kids} /> {t('manage.kidsProfile')}</label>
  {#if kids}<AgePicker bind:age />{/if}
  <button class="primary" type="submit">{t('common.create')}</button>
  <button type="button" onclick={cancel}>{t('common.cancel')}</button>
</form>
{#if message}<p class="error">{message}</p>{/if}
