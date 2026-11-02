# Toda contributor guidance

- Treat the Markdown files in `docs/` as the functional specification; keep them current when
  behaviour changes. `README.md` stays short: how the app works belongs in `docs/`.
- Every workspace package names its dependencies as `catalog:`; versions live only in
  `pnpm-workspace.yaml`. Only releases at least three days old are installed; a younger one goes
  in `minimumReleaseAgeExclude` with its exact version and a dated reason.
- Convex validators come from the schema (`v` exported by `apps/backend/convex/schema.ts`), never
  from `convex/values`. Every public function declares `args` and `returns`; writes that only the
  server performs stay internal. The app imports the API from `@toda/backend/convex` and shared
  types and limits from `@toda/backend/model`, which must stay free of server code.
- Rows are identified by `clientId` everywhere, references included; never key anything on a
  Convex `_id` in the app. `sync.apply` must stay idempotent and all-or-nothing: inserts upsert,
  updates of deleted rows do nothing, relationships are checked after the whole batch.
- Changing a synced row's shape needs both sides: the schema and validators, `taskFields` or
  `listFields` in `apps/mobile/src/data/operations.ts`, and `SCHEMA_VERSION` in `db.ts`.
- Queries the app mirrors throw while signed out; an empty answer would wipe the phone's copy.
- Anchor ignore patterns to their folder (`/data/`): an unanchored one once hid
  `apps/mobile/src/data` from git and from lint.
- Parse every external response at its boundary with zod.
- Never put admin or deploy credentials in an `EXPO_PUBLIC_*` variable or the app config; they
  ship to every client. Never build a Convex deployment into a preview or production app, or
  name one in the repository: the phone asks for its server, and only development builds take
  one from the checkout (`apps/mobile/config/backend.ts`).
- The backend is deployed by hand (`vp run backend:deploy`); no workflow holds a deploy key.
- Do not edit generated files by hand: `convex/_generated`, compiled Lingui catalogs and the
  native `android/` folder.
- Use `vp run lint` (which runs `vp lint --fix`); always include `--fix` when invoking lint
  directly. Run `vp run check` and `vp run mobile:export` before considering work complete.
  Report native build and device verification separately; static checks do not establish UI
  behaviour.
- Workflows use only actions pinned to a full commit SHA with the version in a comment. Keep the
  release asset names (`toda-<name>-<abi>.apk`, `update.json`) in step with
  `apps/mobile/src/updates`.
- Mobile work also follows [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md).
