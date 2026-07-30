# Legacy migration baseline

Both source repositories were clean when copied and remained unmodified:

- Frontend commit: `6d6b7598cffdbea9dc2816ca8db839f7e642fa96`
- Backend commit: `0391be047c7103ea7d6dcec9436d2f71ad49621a`

## Frontend

- React 18, React Router 6, TypeScript 4.9, webpack 5, Babel, LESS, and generated
  CSS-module declarations.
- One entry selected browser or hash routing from an application-target build
  constant.
- Routes: `/`, `/login`, `/app`, `/app/snoozed`, `/app/profile`, and
  `/privacy-policy`.
- Manifest V3 popup `index.html`; module service worker `js/background.js`;
  tabs, clipboard, alarms, storage, and notifications permissions.
- Legacy outputs: `dist`, `dist_extension`, CRX, and ZIP artifacts. None were
  copied into the workspace.

## Backend

- Express 4, GraphQL Yoga 3, GraphQL 16, Mongoose 6, CommonJS TypeScript output,
  `tsc-watch`, MongoDB session adapter, legacy unique validator, and
  `random-hash`.
- Route ordering: static assets, `/api`, Google OAuth/logout, SPA routes,
  shortlink redirects, and `/rest/ping`.
- GraphQL query fields: `getShortlinkByHash`, `getShortlinkByDescription`,
  `getLoggedInUser`, `getUserShortlinks`, and `getPredefinedTimers`.
- GraphQL mutation fields: shortlink creation/edit/deletion, descriptive links,
  user profile updates, and snooze timer creation/deletion.
- Custom scalars: `Mixed` and `Long`.

The public field names, operation names, route paths, and extension capabilities
above are migration invariants covered by strict compilation, builds, and the
GraphQL/scalar/utility acceptance tests.
