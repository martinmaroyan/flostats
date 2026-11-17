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

## Interactive demo and live service status

The homepage explains FloWrestling's restriction of previously public historical
results and links to **Explore Interactive Demo**. Live HTTP 401 responses show a
clear explanation and a demo link; failed live requests never silently substitute
synthetic records. The About dialog also describes the current data status.

Enter at `/demo` (production URL: `https://flostats.com/demo`), or add `?demo=1`
to an existing profile, search, or comparison URL. Demo URLs have their own router
basename, so ordinary navigation, opponent links, new tabs, and refreshes stay in
the same mode. **Demo home** returns to the suggestions and **Exit demo** returns
to live mode. The persistent disclosure labels every demo page as fictional.
Demo pages are marked `noindex`; synthetic profile metadata uses demo URLs.

### Architecture and synthetic data

This is the existing React/Vite frontend; there is no database or server to run.
`src/api/FloAPI.ts` chooses the lazy demo provider at its shared request boundary.
The provider returns the existing search, node, paginated registration, bout, and
relationship shapes. It rejects unsupported requests and unknown identities
without falling through to FloWrestling. Live requests retain the existing XHR
implementation. Demo and live recent searches and user-created identity merges
use separate local-storage keys.

`src/demo/generator.ts` generates a closed league with seed **20261116**:

- 384 fictional athletes, 32 fictional schools, 440 events, and 15,264 bouts.
- Four seasons (2022–23 through 2025–26), with two-, three-, and four-season
  careers according to graduation cohort.
- Weekly round-robin team dual schedules and six tournament dates each season.
  Sectional top-four finishers qualify for the final state-style tournament.
- Classification brackets determine every tournament place from actual bouts,
  including consolation results. Each athlete's history references the same
  single stored bout; event-specific registrations connect identities to teams,
  weights, grades, and placements.
- A seeded skill model, career improvement, and weighted outcomes produce strong,
  average, and developing wrestlers, with falls, decisions, major decisions,
  technical falls, and forfeits. Weight classes progress over seasons; scores,
  margins, times, and dates are generated consistently.
- MIAA-shaped placement indexes are derived from those same bracket placements
  using the existing `pointsForPlacement` function. `calculateCriteria` is
  unchanged, including the sectional cap and loss multipliers. These are
  fictional demonstrations of the rules, not actual MIAA results.

The generator runs once per page session and is cached. Its code is loaded only
in demo mode (about 6 KB gzipped for the provider/generator chunk); normalized
indexes and small relationship closures avoid returning the whole league per
profile. Responses are cloned so existing alias merging cannot mutate the cached
league. No network data, real athlete records, current time, or `Math.random`
enters generation. The fixed seed and algorithm reproduce identities and results
on refresh. Developers can call `generateDataset(seed, teamCount)` to vary the
league; team counts are multiples of eight from 16 to 48. The public UI uses one
stable dataset, rather than changing seeds while users follow shared links.

Profiles reuse existing season/career analysis, match tables, sorting, date and
match-type filters, placements, radar/monthly charts, comparisons, and MIAA
criteria. The existing zoomable weight chart was present but disconnected from
the profile; it is now available under **See More → Weight progression** in each
summary. Match-table weight filters remain available under **Show/Hide filters**.
Fictional event links lead to local event-result pages with weight filtering and
links back to wrestler profiles. The demo landing page provides a strong
four-season athlete, a recurring rival, a developing athlete, and a one-click
comparison. Search supports all fictional identities; broad search also matches
school names (try `Alderhaven`).

Limitations: demo mode does not restore live FloWrestling access, provide video,
or mirror external FloArena pages. The synthetic event pages provide local
results instead. Schools, athletes, registrations, and tournament results are
invented; birth dates are intentionally omitted. The existing team route is still
an athlete-page alias, not a separate team analytics feature, and no new team
ranking system is claimed.

### Verification

```sh
pnpm check                    # TypeScript, ESLint, unit/integrity tests, build
pnpm test:e2e --workers=2      # Existing regressions + desktop/mobile demo flows
```

Integrity tests validate reproducibility, reciprocal histories, conservation of
wins/losses, score margins, dates, weights, bracket placements, derived seeding
indexes, career/season aggregation, and the existing common-opponent/head-to-head
algorithms. Provider tests exercise existing paginated athlete loading with
network APIs replaced by throwing stubs and verify response-mutation isolation.
Browser tests cover the homepage notice, entry/exit, disclosure, themes,
search/pagination, direct profiles, refreshes, actual displayed totals, filters,
charts, placements, comparisons, expandable opponent details, local event results,
and live HTTP 401 handling. Demo browser tests fail on any FloWrestling request.

### Implementation files

Created:

- `src/demo/generator.ts`, `src/demo/provider.ts`, `src/demo/mode.ts`
- `src/demo/DemoExplorer.tsx`, `src/demo/DemoEvent.tsx`, `src/demo/eventLink.ts`
- `src/demo/generator.test.ts`, `src/demo/provider.test.ts`
- `src/components/ServiceNotice.tsx`, `src/components/DataError.tsx`
- `e2e/demo.spec.ts`

Updated:

- `src/App.tsx`, `src/Athletes.tsx`, `src/index.css`
- `src/api/FloAPI.ts`, `src/api/FloAPI.test.ts`
- `src/components/HomePage.tsx`, `src/components/Layout.tsx`, `src/components/InfoButton.tsx`
- `src/components/SearchResults.tsx`, `src/components/MatchesTable.tsx`
- `src/components/TimeframeSummary.tsx`, `src/components/HighlightAndZoomLineChart.tsx`
- `src/components/compare/CompareAthletes.tsx`, `src/components/compare/InlineAthleteSearch.tsx`
- `src/components/compare/HeadToHeadDisplay.tsx`, `src/components/compare/CommonOpponentsTable.tsx`
- `src/utils/aliases.ts`, `src/utils/placementIndex.ts`
- `tsconfig.e2e.json`, `README.md`

The pre-existing uncommitted Wrangler dependency changes in `package.json`,
`pnpm-lock.yaml`, and `pnpm-workspace.yaml` are preserved. This implementation
adds no dependencies.

### Browser session prototype

Run `pnpm dev` and open `/connection-test` (normally
`http://localhost:5173/connection-test`). Open the FloWrestling login link in the
same browser profile, sign in, return, and click **Test with browser cookies**.
Use **Compare without cookies** as a control. Each click sends at most two direct
API requests, requesting one registration and one bout, spaced two seconds apart;
there is no pagination or automatic retry. Results remain in page memory.

This diagnostic uses actual browser fetches with `credentials: "include"` or
`"omit"`; it neither imports HAR cookies nor uses a proxy. The ordinary profile
API client is unchanged. A readable 200 with credentials and 401 without them
supports this approach. Browser-hidden failures cannot reliably distinguish CORS,
network errors, and cookie restrictions; inspect DevTools. Localhost and preview
origins can behave differently from `https://flostats.com`, so testing the deployed
origin is still necessary. The prototype does not automatically detect login or
refresh sessions and does not collect login credentials.

Browser regression test (mocked APIs):
`pnpm build && pnpm exec playwright test e2e/connection.spec.ts --workers=2`.
