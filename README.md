# View your wrestling statistics and history

FloStats is a React and TypeScript SPA for searching FloWrestling athletes, viewing
match history and placements, comparing wrestlers, and calculating MIAA seeding
criteria. It reads public FloWrestling APIs directly; no backend is required.

Use pnpm to install and run the app:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Validation:

```sh
pnpm check                          # TypeScript, ESLint, unit tests, production build
pnpm exec playwright install chromium
pnpm test:e2e                       # Desktop and mobile browser regression tests
python3 -m unittest discover -s seeding -p 'test_*.py'
```

Browser tests run against the production build on port 4173 and use API fixtures
so failures are reproducible without relying on external services. Run
`pnpm build` before running them independently. Preview a build with `pnpm preview`.

Profile merges are saved in browser local storage. Built-in identity groups always
apply; user groups can be removed in search results. Comparisons and seeding lookups
use all aliases, and duplicate event registrations and bouts are counted once.

The offline seeding tools live in `seeding/`. Rebuild all indexes with
`python3 seeding/build_index.py`, or one year with `--year 2026`. Rebuilding one
year preserves the other published years in `public/seeding/manifest.json`.

Compatibility note: the existing `mantine-react-table@2.0.0-beta.7` declares
Mantine 7 peers while this project uses Mantine 8. Its current table flows are
covered by browser tests; package installation still reports that peer mismatch.
