<!-- Asks the account owner to confirm their address, when it still needs
     it: they chose their password from a link an admin copied, so nothing
     proved the address yet. The button emails the link that does. Asked
     once per visit; anything else (another sign-in, the server's own
     errors) shows nothing. -->
<script lang="ts">
  import { explain, overfin } from '../lib/client';
  import { t } from '../lib/i18n.svelte';
  import { session } from '../lib/session.svelte';

  let address = $state('');
  let sent = $state(false);
  let problem = $state('');

  $effect(() => {
    if (!session.me?.activeProfile?.owner) return;
    overfin.addressInfo().then((a) => (address = a.unconfirmed ? a.email : ''), () => {});
  });

  async function send() {
    problem = '';
    try {
      sent = (await overfin.confirmAddress()).sent;
    } catch (err) {
      problem = explain(err);
    }
  }
</script>

{#if address && session.me?.activeProfile?.owner}
  <div class="notice arrived" role="status">
    {#if sent}
      <p>{t('address.sent').replace('{email}', address)}</p>
    {:else}
      <p>{t('address.confirm').replace('{email}', address)}{#if problem}{' '}{problem}{/if}</p>
      <button onclick={send}>{t('address.send')}</button>
    {/if}
  </div>
{/if}
