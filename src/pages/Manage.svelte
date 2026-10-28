<!-- Profiles and devices. The owner manages every profile (names, kids
     limits, libraries and hidden tags, PINs, deleting, adding one) and
     every device; another profile only its own preference, PIN and
     devices. The profiles are a list; each one's form opens in a window. -->
<script lang="ts">
  import type { Profile, Session } from '../lib/sdk/overfin.js';
  import { overfin } from '../lib/client';
  import { confirmed } from '../lib/confirmed';
  import { confirm } from '../lib/dialog.svelte';
  import { homeChanged } from '../lib/homecache';
  import { i18n, t, tn } from '../lib/i18n.svelte';
  import { replace } from '../lib/router.svelte';
  import { loadCategories, mayAddProfile, session } from '../lib/session.svelte';
  import AccessPicker from '../components/AccessPicker.svelte';
  import AgePicker from '../components/AgePicker.svelte';
  import Modal from '../components/Modal.svelte';
  import NewProfile from '../components/NewProfile.svelte';
  import PageError from '../components/PageError.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  const me = $derived(session.me?.activeProfile);
  const pinPattern = '[0-9]{4,8}';

  // A profile's form, in its window, set up as it opens.
  interface Form {
    name: string; kidsTitles: boolean; kids: boolean; age: number; pin: string; message: string;
    allCategories: boolean; categories: string[];
    allLibraries: boolean; libraries: string[]; hiddenTags: string[];
  }
  let editing = $state<Profile | null>(null);
  let form = $state<Form | null>(null);
  let adding = $state(false);
  let listMessage = $state('');
  let devicesMessage = $state('');
  // The devices shown before "Show N more".
  const fewDevices = 5;
  let allDevices = $state(false);

  let loaded = $state<{ profiles: Profile[]; sessions: Session[]; tags: string[] } | null>(null);
  let error = $state<unknown>();
  async function load() {
    try {
      const [all, sessions, tags] = await Promise.all([
        overfin.profiles(),
        overfin.sessions(),
        me?.owner ? overfin.tags() : Promise.resolve<string[]>([]),
      ]);
      if (me?.owner) session.kidsNeedLimits = all.some((p) => p.ageNeeded);
      loaded = { profiles: me?.owner ? all : all.filter((p) => p.id === me?.id), sessions, tags };
    } catch (err) {
      error = err;
    }
  }
  load();

  function edit(p: Profile) {
    editing = p;
    form = {
      name: p.name, kidsTitles: !!p.kidsTitles, kids: p.kind === 'kids', pin: '', message: '',
      age: p.maxAge ?? 8, allCategories: !p.categories, categories: [...(p.categories ?? [])],
      allLibraries: !p.libraries, libraries: [...(p.libraries ?? [])], hiddenTags: [...(p.blockedTags ?? [])],
    };
  }

  // A profile changed: what its pages kept in this tab is read again (its
  // limits and preferences change what they show).
  async function act(p: Profile, action: (pin?: string) => Promise<unknown>, fail: (m: string) => void): Promise<boolean> {
    if (!(await confirmed(action, fail, t('manage.ownerPin')))) return false;
    homeChanged();
    // The menu's categories, when this profile's own changed.
    if (p.id === session.me?.activeProfile?.id) loadCategories();
    await load();
    return true;
  }

  // A profile's limits, as the server takes them, from its form or as
  // they are.
  const limitsOf = (f: Form) => {
    const access = {
      libraries: f.allLibraries ? null : [...f.libraries].sort(),
      blockedTags: f.hiddenTags.length ? [...f.hiddenTags].sort() : null,
      categories: f.allCategories ? null : [...f.categories].sort(),
    };
    return f.kids ? { kind: 'kids' as const, maxAge: f.age, ...access } : { kind: 'standard' as const, ...access };
  };
  const limitsNow = (p: Profile) => {
    const access = {
      libraries: p.libraries ? [...p.libraries].sort() : null,
      blockedTags: p.blockedTags?.length ? [...p.blockedTags].sort() : null,
      categories: p.categories ? [...p.categories].sort() : null,
    };
    return p.kind === 'kids' ? { kind: 'kids' as const, maxAge: p.maxAge ?? 8, ...access } : { kind: 'standard' as const, ...access };
  };

  // Saving: the name, "Contenu pour enfants" and the limits, what changed
  // of them, at once; the limits need the owner's PIN, if the owner has one.
  async function save(event: SubmitEvent) {
    event.preventDefault();
    const p = editing, f = form;
    if (!p || !f || !me) return;
    const change: Parameters<typeof overfin.updateProfile>[1] = {};
    if (me.owner && f.name.trim() !== p.name) change.name = f.name.trim();
    if (p.kind !== 'kids' && (me.owner || p.id === me.id) && f.kidsTitles !== !!p.kidsTitles) change.kidsTitles = f.kidsTitles ? true : null;
    if (me.owner && !p.owner && JSON.stringify(limitsOf(f)) !== JSON.stringify(limitsNow(p))) Object.assign(change, limitsOf(f));
    if (!Object.keys(change).length) {
      editing = null;
      return;
    }
    if (await act(p, (pin) => overfin.updateProfile(p.id, pin ? { ...change, pin } : change), (m) => (f.message = m))) editing = null;
  }

  // The PIN, on its own: setting one on someone else's profile needs the
  // owner's PIN; changing or removing one needs a fresh login.
  async function pinAction(action: (ownerPin?: string) => Promise<unknown>) {
    const p = editing, f = form;
    if (!p || !f) return;
    if (await act(p, action, (m) => (f.message = m))) editing = null;
  }

  async function remove(p: Profile) {
    if (!(await confirm(t('manage.deleteConfirm', { name: p.name }), true))) return;
    if (await act(p, () => overfin.deleteProfile(p.id), (m) => (listMessage = m))) {
      // The streams shared among profiles change with their number.
      session.me = await overfin.me().catch(() => session.me);
    }
  }

  $effect(() => {
    if (!me) replace('/profiles');
  });
</script>

{#if me}
  <div class="center wide">
    <div class="page-head">
      <h1>{me.owner ? t('manage.titleOwner') : t('manage.titleSelf')}</h1>
      {#if loaded && mayAddProfile(loaded.profiles.length)}
        <button type="button" class="primary" onclick={() => (adding = true)}>{t('profiles.add')}</button>
      {/if}
    </div>
    {#if error}
      <PageError {error} />
    {:else if !loaded}
      <Skeleton kind="list" />
    {:else}
      {@const { profiles, sessions } = loaded}
      <!-- The profiles: what each is, its Edit button (and Delete, for the
           owner's others); its form opens in a window. -->
      <ul class="list profiles-list">
        {#each profiles as p (p.id)}
          <li>
            <span class="avatar small" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
            <div class="grow">
              <strong>{p.name}</strong>
              <div class="chips">
                {#if p.owner}<span class="chip">{t('manage.owner')}</span>{/if}
                {#if p.kind === 'kids'}
                  <span class="chip">{p.ageNeeded ? t('manage.kidsNoLimits') : t('manage.kidsLimits', { age: p.maxAge ?? 0 })}</span>
                {/if}
                {#if p.hasPin}<span class="chip">{t('manage.pin')}</span>{/if}
              </div>
              {#if p.ageNeeded && me.owner}<p class="error small">{t('manage.limitsMissing')}</p>{/if}
            </div>
            <div class="row-actions">
              <button type="button" onclick={() => edit(p)}>{t('manage.edit')}</button>
              {#if me.owner && !p.owner}
                <button type="button" class="danger" onclick={() => remove(p)}>{t('manage.deleteProfile')}</button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
      {#if listMessage}<p class="error">{listMessage}</p>{/if}
      <!-- Devices signed in: the owner sees all of the account's, others
           their own; the first few, then the rest on demand. -->
      <div class="panel">
        <h2>{t('manage.devices')}</h2>
        <ul class="list">
          {#each allDevices ? sessions : sessions.slice(0, fewDevices) as s (s.id)}
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
                  if (await confirmed(() => overfin.endSession(s.id), (m) => (devicesMessage = m))) load();
                }}>{t('manage.signOut')}</button>
              {/if}
            </li>
          {/each}
        </ul>
        <div class="inline">
          {#if !allDevices && sessions.length > fewDevices}
            <button type="button" onclick={() => (allDevices = true)}>{tn('manage.moreDevices', sessions.length - fewDevices)}</button>
          {/if}
          {#if me.owner && sessions.length > 1}
            <button onclick={async () => {
              if (await confirmed(() => overfin.endOtherSessions(), (m) => (devicesMessage = m))) load();
            }}>{t('manage.signOutOthers')}</button>
          {/if}
        </div>
        {#if devicesMessage}<p class="error">{devicesMessage}</p>{/if}
      </div>
    {/if}
  </div>

  {#if editing && form}
    {@const p = editing}
    {@const f = form}
    <Modal title={t('manage.editTitle', { name: p.name })} close={() => (editing = null)} wide={me.owner && !p.owner}>
      <form class="stack" onsubmit={save}>
        {#if me.owner}
          <label class="field">
            <span>{t('manage.name')}</span>
            <input bind:value={f.name} maxlength="32" required />
          </label>
        {/if}
        <!-- "Contenu pour enfants": a profile's own preference (not a kids
             profile's, which always has it), changed by it or the owner. -->
        {#if p.kind !== 'kids' && (me.owner || p.id === me.id)}
          <div class="field">
            <label class="check"><input type="checkbox" bind:checked={f.kidsTitles} /> {t('manage.childrensContent')}</label>
            <p class="muted small">{t('manage.childrensContentHint')}</p>
          </div>
        {/if}
        <!-- Limits: kids (with an age) or standard, the categories,
             libraries and hidden tags. -->
        {#if me.owner && !p.owner}
          <div class="field">
            <h3>{t('manage.limits')}</h3>
            <div class="toolbar">
              <label class="check"><input type="checkbox" bind:checked={f.kids} /> {t('manage.kidsProfile')}</label>
              {#if f.kids}<AgePicker bind:age={f.age} />{/if}
            </div>
            <AccessPicker libraries={session.libraries} tags={loaded?.tags ?? []}
              bind:all={f.allLibraries} bind:chosen={f.libraries} bind:hidden={f.hiddenTags}
              categories={session.categories} bind:allCategories={f.allCategories} bind:chosenCategories={f.categories} />
          </div>
        {/if}
        {#if f.message}<p class="error">{f.message}</p>{/if}
        <div class="actions">
          <button type="button" onclick={() => (editing = null)}>{t('common.cancel')}</button>
          <button type="submit" class="primary">{t('manage.save')}</button>
        </div>
      </form>
      <!-- The PIN, on its own: its own checks. -->
      {#if me.owner || (p.id === me.id && p.kind === 'standard')}
        <div class="field pin-part">
          <h3>{t('manage.pin')}</h3>
          <div class="inline">
            <input bind:value={f.pin} inputmode="numeric" pattern={pinPattern} maxlength="8"
              placeholder={t('manage.pinHint')} aria-label={t('manage.newPin')} />
            <button type="button" onclick={() => pinAction((ownerPin) => overfin.setPin(p.id, f.pin, ownerPin))}>
              {p.hasPin ? t('manage.changePin') : t('manage.setPin')}
            </button>
            {#if p.hasPin}
              <button type="button" onclick={() => pinAction(() => overfin.removePin(p.id))}>{t('manage.removePin')}</button>
            {/if}
          </div>
        </div>
      {/if}
    </Modal>
  {/if}

  <!-- Adding a profile, for the owner, while the account may have more
       (as on "Who's watching?"). -->
  {#if adding}
    <Modal title={t('profiles.new')} close={() => (adding = false)}>
      <NewProfile created={() => { adding = false; load(); }} cancel={() => (adding = false)} />
    </Modal>
  {/if}
{/if}
