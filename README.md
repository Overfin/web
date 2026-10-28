# overfin-web

The web client of [Overfin](https://github.com/overfin/server), served by
Overfin by default: a single-page app in [Svelte](https://svelte.dev) and
TypeScript, on Overfin's
[JavaScript SDK](https://github.com/overfin/server/tree/main/sdk/js).

- **Account setup**: start fresh, or bring a previous account over (when the
  server offers it); the account's language is chosen there too.
- **Who's watching?**: profiles, PINs, adding a profile (a kids profile
  with an age, films and series alike).
- **Profiles and devices**: renaming, a kids profile's age, the categories,
  libraries and hidden tags per profile, "Content for children" in a
  profile's recommendations, setting, changing and removing PINs, each
  profile's look, deleting profiles, signed-in devices; the site asks for a
  PIN or a fresh login when the server wants one.
- **Account**: how one signs in, the account's language, downloading your
  data, bringing a history over, deleting your account.
- **Home**: a slideshow of featured titles, continue watching (next episodes
  included), the profile's list, recommendations for the profile (all, and
  among the newest), what's trending (when the server offers discovery),
  the latest per home category and per library.
- **Categories**: those the operator made, each in the menu with its page;
  the libraries leave the menu when the operator says so.
- **My list**: a page of the profile's list.
- **Discover**, when the server offers it: trending, popular and upcoming
  films and series the libraries don't have (to request, when the server
  takes requests).
- **Libraries**: sorting (the profile's last choice kept in the browser),
  filters (genre, decade, watched), a repeatable shuffle, infinite scroll.
- **Title pages**: films, series, seasons, episodes, cast, ratings, similar
  titles; my list, watched and favorite; requests, confirmed first, and
  where they are.
- **Search** (titles and people) and **people's pages**.
- **Requests**: the profile's, and cancelling one while it's pending.
- **Player**: Overfin picks direct play, repackaging or transcoding from what
  the browser declares; audio and subtitle choice, quality, playback info,
  previews while seeking, "Skip intro", the next episode, progress, resume,
  taking playback back from another device, and the same keys whatever has
  the focus (arrows seek and change the volume, Space plays and pauses).
- **English and French**: the account's language, the browser's until it's
  known.

Every screen has a real address (`/title/…`, `/library/…?sort=name`), so a
reload, a bookmark or a shared link comes back to it, through the login if
need be. Overfin answers those paths with the app.

## How it's built

| | |
| --- | --- |
| `src/App.svelte` | Who's here first (setup, no access, "Who's watching?"), then the screen the address names |
| `src/pages/` | One component per screen |
| `src/components/` | What screens share: cards, rows, the header, dialogs |
| `src/lib/` | The SDK client, the router, translations, the session, the site's dialogs |
| `src/lib/sdk/` | A copy of Overfin's SDK (`overfin.js`, with its types) |
| `src/locales/` | The texts, one file per language |
| `dist/` | The built site, committed: what Overfin embeds |
| `web.go` | The Go package Overfin imports: `web.Files` (dist/) and `web.SDK` |

```sh
npm ci            # install (no install scripts run: see .npmrc)
npm run check     # types
npm test          # tests
npm run build     # dist/, to commit with the sources
```

CI rebuilds the site and fails if `dist/` isn't exactly what the sources
build. Dependencies are pinned to exact versions, and Dependabot proposes
updates.

### Rules the code follows

- **Text from the server is only ever text.** Svelte escapes everything it
  shows; `{@html}` is never used.
- **Everything comes from the site itself,** under a strict
  Content-Security-Policy: no inline scripts or styles, no `eval`, nothing
  from a third party. Styles set from code go through `style:` directives,
  never `style="…"` with values.
- **Every text is translated:** `t('key')`, with the key in every file of
  `src/locales/` (the type check fails otherwise, and a test checks each
  language fills in the same values).
- **Usable with a keyboard or a TV remote:** real buttons and links, visible
  focus, the site's own dialogs instead of the browser's.
- **Never name the software underneath** to the people using the site.
- **hls.js loads only when something plays,** so the site stays light on
  phones and TVs.

## How it's served

overfin-web is its own app, on Overfin's public API like any other client.
Overfin's official build bundles it (`web.Files`, imported as
`github.com/overfin/web`), and Overfin serves it at the site's root,
to logged-in visitors only. The core never imports it; a build chooses its
site, or none. It needs the `library` and `playback` plugins.

To serve a changed copy instead, point `[site] serve` at your `dist/` in
Overfin's configuration: Overfin serves it the same way, read live.

`src/lib/sdk/overfin.js` is a copy of the SDK: Overfin's tests check that
the version it bundles (`web.SDK`) matches its own, so update both
together.

## Third-party code

[hls.js](https://github.com/video-dev/hls.js), under the Apache License 2.0,
plays HLS streams in browsers without native support. It's bundled into the
site, so browsers never contact a third party; its license is published
with it (`public/licenses/hls.js.txt`).

## License

[MIT](LICENSE).

Said plainly, as for Overfin: overfin-web is written by Claude (Anthropic's
AI), its code, tests and documentation. The maintainer gives directions
(what the site should do and look like, what to change) and uses it every
day, but doesn't write the code or review it line by line. Commits Claude
wrote carry a `Co-Authored-By: Claude` trailer. What checks the code is
what runs before every push: the type check, the tests, and a build that
must match the committed `dist/`.
