<!-- Profiles and devices. The owner manages every profile (names, kids
     limits, libraries and hidden tags, PINs, deleting) and every device;
     another profile only its own PIN and devices. -->
<script lang="ts">
  import type { Profile, Ratings } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { confirmed } from '../lib/confirmed';
  import { confirm } from '../lib/dialog.svelte';
  import { i18n, t } from '../lib/i18n.svelte';
  import { replace } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import AccessPicker from '../components/AccessPicker.svelte';
  import CeilingPicker from '../components/CeilingPicker.svelte';
  import PageError from '../components/PageError.svelte';

  const me = $derived(session.me?.activeProfile);
  const pinPattern = '[0-9]{4,8}';

  // Each profile's form, and its message, set up as the profiles load.
  interface Form {
    name: string; kids: boolean; movie: string; series: string; pin: string; message: string;
    allLibraries: boolean; libraries: string[]; hiddenTags: string[];
  }
  const forms = $state<Record<string, Form>>({});
  let devicesMessage = $state('');

  let reload = $state(0);
  async function load() {
    const [all, ratings, sessions, tags] = await Promise.all([
      overfin.profiles(),
      me?.owner ? overfin.ratings() : Promise.resolve<Ratings>({ country: '', movie: [], series: [] }),
      overfin.sessions(),
      me?.owner ? overfin.tags() : Promise.resolve<string[]>([]),
    ]);
    if (me?.owner) session.kidsNeedLimits = all.some((p) => p.ceilingsNeeded);
    const profiles = me?.owner ? all : all.filter((p) => p.id === me?.id);
    for (const p of profiles) {
      forms[p.id] = {
        name: p.name, kids: p.kind === 'kids', pin: '', message: '',
        movie: p.movieCeiling ?? ratings.movie[0]?.name ?? '', series: p.seriesCeiling ?? ratings.series[0]?.name ?? '',
        allLibraries: !p.libraries, libraries: p.libraries ?? [], hiddenTags: p.blockedTags ?? [],
      };
    }
    return { profiles, ratings, sessions, tags };
  }
  const data = $derived.by(() => {
    void reload;
    return load();
  });

  async function act(p: Profile, action: (pin?: string) => Promise<unknown>, pinLabel?: string) {
    const f = forms[p.id];
    if (await confirmed(action, (m) => (f.message = m), pinLabel)) reload++;
  }

  $effect(() => {
    if (!me) replace('/profiles');
  });
</script>

{#if me}
  <div class="center wide">
    <h1>{me.owner ? t('manage.titleOwner') : t('manage.titleSelf')}</h1>
    {#await data}
      <p class="muted">{t('app.loading')}</p>
    {:then { profiles, ratings, sessions, tags }}
      {#each profiles as p (p.id)}
        {@const f = forms[p.id]}
        <div class="panel">
          <h2>
            {p.name}{#if p.owner}&nbsp;({t('manage.owner')}){/if}
            {#if p.kind === 'kids'}
              · {p.ceilingsNeeded ? t('manage.kidsNoLimits') : t('manage.kidsLimits', { movie: p.movieCeiling ?? '', series: p.seriesCeiling ?? '' })}
            {/if}
          </h2>
          {#if p.ceilingsNeeded && me.owner}<p class="error">{t('manage.limitsMissing')}</p>{/if}

          {#if me.owner}
            <div class="toolbar">
              <input bind:value={f.name} maxlength="32" aria-label={t('manage.name')} />
              <button onclick={() => act(p, () => overfin.updateProfile(p.id, { name: f.name }))}>{t('manage.rename')}</button>
            </div>
          {/if}

          <!-- Limits: kids or standard, the ceilings for films and series, the
               libraries and the hidden tags. Changing them needs the owner's
               PIN, if the owner has one. -->
          {#if me.owner && !p.owner}
            <div class="toolbar">
              <label><input type="checkbox" bind:checked={f.kids} /> {t('manage.kidsProfile')}</label>
              {#if f.kids}<CeilingPicker {ratings} bind:movie={f.movie} bind:series={f.series} />{/if}
            </div>
            <AccessPicker libraries={session.libraries} {tags}
              bind:all={f.allLibraries} bind:chosen={f.libraries} bind:hidden={f.hiddenTags} />
            <div class="toolbar">
              <button onclick={() => act(p, (pin) => {
                const access = {
                  libraries: f.allLibraries ? null : f.libraries,
                  blockedTags: f.hiddenTags.length ? f.hiddenTags : null,
                };
                const change = f.kids
                  ? { kind: 'kids' as const, movieCeiling: f.movie, seriesCeiling: f.series, ...access }
                  : { kind: 'standard' as const, ...access };
                return overfin.updateProfile(p.id, pin ? { ...change, pin } : change);
              }, t('manage.ownerPin'))}>{t('manage.saveLimits')}</button>
            </div>
          {/if}

          <!-- PIN: setting one on someone else's profile needs the owner's
               PIN; changing or removing one needs a fresh login. -->
          {#if me.owner || (p.id === me.id && p.kind === 'standard')}
            <div class="toolbar">
              <input bind:value={f.pin} inputmode="numeric" pattern={pinPattern} maxlength="8"
                placeholder={t('manage.pinHint')} aria-label={t('manage.newPin')} />
              <button onclick={() => act(p, (ownerPin) => overfin.setPin(p.id, f.pin, ownerPin), t('manage.ownerPin'))}>
                {p.hasPin ? t('manage.changePin') : t('manage.setPin')}
              </button>
              {#if p.hasPin}
                <button onclick={() => act(p, () => overfin.removePin(p.id))}>{t('manage.removePin')}</button>
              {/if}
            </div>
          {/if}

          {#if me.owner && !p.owner}
            <div class="toolbar">
              <button class="danger" onclick={async () => {
                if (await confirm(t('manage.deleteConfirm', { name: p.name }), true)) act(p, () => overfin.deleteProfile(p.id));
              }}>{t('manage.deleteProfile')}</button>
            </div>
          {/if}
          {#if f.message}<p class="error">{f.message}</p>{/if}
        </div>
      {/each}

      <!-- Devices signed in: the owner sees all of the account's, others
           their own. -->
      <div class="panel">
        <h2>{t('manage.devices')}</h2>
        {#each sessions as s (s.id)}
          <div class="toolbar">
            <span>{s.device || t('manage.unknownDevice')}{s.profileName ? ` · ${s.profileName}` : ''}{s.current ? ` (${t('manage.thisOne')})` : ''}</span>
            <span class="muted">{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString(i18n.locale) : ''}</span>
            {#if !s.current}
              <button onclick={async () => {
                if (await confirmed(() => overfin.endSession(s.id), (m) => (devicesMessage = m))) reload++;
              }}>{t('manage.signOut')}</button>
            {/if}
          </div>
        {/each}
        {#if me.owner && sessions.length > 1}
          <button onclick={async () => {
            if (await confirmed(() => overfin.endOtherSessions(), (m) => (devicesMessage = m))) reload++;
          }}>{t('manage.signOutOthers')}</button>
        {/if}
        {#if devicesMessage}<p class="error">{devicesMessage}</p>{/if}
      </div>
    {:catch error}
      <PageError {error} />
    {/await}
  </div>
{/if}
