# Klaro (vendored)

- Package: `klaro@0.7.21` (BSD-3-Clause, see `LICENSE`)
- File: `dist/klaro-no-translations.js`, unmodified (bundles Preact and Klaro's CSS; our text is in the consent config)
- sha256: `66550a52de9b16a22536997b966064d6416b2a91ed4d9a48009dd83d0c84ce0f`

Vendored for SUR-620 instead of an npm dependency: the npm package declares its
build tools (`@babel/eslint-parser`, `sass`, `webpack-merge`) as runtime
dependencies, which would add ESLint, Babel, Sass and an install script to this
repo for a file we only copy. Keep this file byte-identical with the copy in the
other repo (surfc / surfc-web). To upgrade: `npm pack klaro@<v>`, copy the same
dist file and LICENSE, update the version and sha256 here, in both repos.
