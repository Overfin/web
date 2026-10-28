<!-- Profiles and devices. The owner manages every profile (names, kids
     limits, libraries and hidden tags, PINs, deleting) and every device;
     another profile only its own PIN and devices. -->
<script lang="ts">
  import type { Profile } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { confirmed } from '../lib/confirmed';
  import { confirm } from '../lib/dialog.svelte';
  import { i18n, t } from '../lib/i18n.svelte';
  import { replace } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import AccessPicker from '../components/AccessPicker.svelte';
  import AgePicker from '../components/AgePicker.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  const me = $derived(session.me?.activeProfile);
  const pinPattern = '[0-9]{4,8}';

  // Each profile's form, and its message, set up as the profiles load.
  interface Form {
    name: string; kids: boolean; age: number; pin: string; message: string;
    allCategories: boolean; categories: string[];
    allLibraries: boolean; libraries: string[]; hiddenTags: string[];
  }
  const forms = $state<Record<string, Form>>({});
  let devicesMessage = $state('');

  let reload = $state(0);
  async function load() {
    const [all, sessions, tags] = await Promise.all([
      overfin.profiles(),
      overfin.sessions(),
      me?.owner ? overfin.tags() : Promise.resolve<string[]>([]),
    ]);
    if (me?.owner) session.kidsNeedLimits = all.some((p) => p.ageNeeded);
    const profiles = me?.owner ? all : all.filter((p) => p.id === me?.id);
    for (const p of profiles) {
      forms[p.id] = {
        name: p.name, kids: p.kind === 'kids', pin: '', message: '',
        age: p.maxAge ?? 8, allCategories: !p.categories, categories: p.categories ?? [],
        allLibraries: !p.libraries, libraries: p.libraries ?? [], hiddenTags: p.blockedTags ?? [],
      };
    }
    return { profiles, sessions, tags };
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
      <Skeleton kind="list" />
    {:then { profiles, sessions, tags }}
      {#each profiles as p (p.id)}
        {@const f = forms[p.id]}
        <div class="panel">
          <div class="panel-head">
            <span class="avatar small" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <h2>{p.name}</h2>
              <div class="chips">
                {#if p.owner}<span class="chip">{t('manage.owner')}</span>{/if}
                {#if p.kind === 'kids'}
                  <span class="chip">{p.ageNeeded ? t('manage.kidsNoLimits') : t('manage.kidsLimits', { age: p.maxAge ?? 0 })}</span>
                {/if}
                {#if p.hasPin}<span class="chip">{t('manage.pin')}</span>{/if}
              </div>
            </div>
          </div>
          {#if p.ageNeeded && me.owner}<p class="error">{t('manage.limitsMissing')}</p>{/if}

          {#if me.owner}
            <section class="field">
              <h3>{t('manage.name')}</h3>
              <div class="inline">
                <input bind:value={f.name} maxlength="32" aria-label={t('manage.name')} />
                <button onclick={() => act(p, () => overfin.updateProfile(p.id, { name: f.name }))}>{t('manage.rename')}</button>
              </div>
            </section>
          {/if}

          <!-- "Contenu pour enfants": a profile's own preference (not a kids
               profile's, which always has it), changed by it or the owner. -->
          {#if p.kind !== 'kids' && (me.owner || p.id === me.id)}
            <section class="field">
              <h3>{t('manage.preferences')}</h3>
              <label>
                <input type="checkbox" checked={!!p.kidsTitles}
                  onchange={(e) => act(p, () => overfin.updateProfile(p.id, { kidsTitles: e.currentTarget.checked ? true : null }))} />
                {t('manage.childrensContent')}
              </label>
              <p class="muted">{t('manage.childrensContentHint')}</p>
            </section>
          {/if}

          <!-- Limits: kids (with an age) or standard, the
               libraries and the hidden tags. Changing them needs the owner's
               PIN, if the owner has one. -->
          {#if me.owner && !p.owner}
            <section class="field">
            <h3>{t('manage.limits')}</h3>
            <div class="toolbar">
              <label><input type="checkbox" bind:checked={f.kids} /> {t('manage.kidsProfile')}</label>
              {#if f.kids}<AgePicker bind:age={f.age} />{/if}
            </div>
            <AccessPicker libraries={session.libraries} {tags}
              bind:all={f.allLibraries} bind:chosen={f.libraries} bind:hidden={f.hiddenTags}
              categories={session.categories} bind:allCategories={f.allCategories} bind:chosenCategories={f.categories} />
            <div class="toolbar">
              <button onclick={() => act(p, (pin) => {
                const access = {
                  libraries: f.allLibraries ? null : f.libraries,
                  blockedTags: f.hiddenTags.length ? f.hiddenTags : null,
                  categories: f.allCategories ? null : f.categories,
                };
                const change = f.kids
                  ? { kind: 'kids' as const, maxAge: f.age, ...access }
                  : { kind: 'standard' as const, ...access };
                return overfin.updateProfile(p.id, pin ? { ...change, pin } : change);
              }, t('manage.ownerPin'))}>{t('manage.saveLimits')}</button>
            </div>
            </section>
          {/if}

          <!-- PIN: setting one on someone else's profile needs the owner's
               PIN; changing or removing one needs a fresh login. -->
          {#if me.owner || (p.id === me.id && p.kind === 'standard')}
            <section class="field">
            <h3>{t('manage.pin')}</h3>
            <div class="inline">
              <input bind:value={f.pin} inputmode="numeric" pattern={pinPattern} maxlength="8"
                placeholder={t('manage.pinHint')} aria-label={t('manage.newPin')} />
              <button onclick={() => act(p, (ownerPin) => overfin.setPin(p.id, f.pin, ownerPin), t('manage.ownerPin'))}>
                {p.hasPin ? t('manage.changePin') : t('manage.setPin')}
              </button>
              {#if p.hasPin}
                <button onclick={() => act(p, () => overfin.removePin(p.id))}>{t('manage.removePin')}</button>
              {/if}
            </div>
            </section>
          {/if}

          {#if me.owner && !p.owner}
            <div class="panel-foot">
              <button class="danger" onclick={async () => {
                if (await confirm(t('manage.deleteConfirm', { name: p.name }), true)) {
                  // The streams shared among profiles change with their number.
                  await act(p, () => overfin.deleteProfile(p.id));
                  session.me = await overfin.me().catch(() => session.me);
                }
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
        <ul class="list">
          {#each sessions as s (s.id)}
            <li>
              <div>
                <strong>{s.device || t('manage.unknownDevice')}</strong>
                {#if s.current}<span class="chip">{t('manage.thisOne')}</span>{/if}
                <div class="muted small">
                  {s.profileName ?? ''}{s.profileName && s.lastActiveAt ? ' · ' : ''}{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                </div>
              </div>
              {#if !s.current}
                <button onclick={async () => {
                  if (await confirmed(() => overfin.endSession(s.id), (m) => (devicesMessage = m))) reload++;
                }}>{t('manage.signOut')}</button>
              {/if}
            </li>
          {/each}
        </ul>
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
