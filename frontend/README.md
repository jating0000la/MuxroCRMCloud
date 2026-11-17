# Frontend build

This frontend uses Tailwind CSS **3.4.19** with the `tailwindcss` PostCSS plugin,
`tailwind.config.js`, and the `@tailwind` directives in `src/index.css`.
The dependency is pinned in both `package.json` and `package-lock.json`.

Use Node.js 20.19+ or 22.12+ as required by Vite 8. From this directory:

```bash
npm ci --include=dev
npm run build
```

Build dependencies are needed even on a production server. `npm ci` replaces
the installed dependency tree with the versions in the committed lockfile.

If PostCSS says its Tailwind plugin has moved to `@tailwindcss/postcss`, the
installed dependency tree contains Tailwind 4. After updating the checkout,
run the clean install above. This project's Tailwind 3 configuration does not
require `@tailwindcss/postcss`.

If a local dependency edit prevents pulling the updated checkout, repair the
version in that checkout without discarding other edits:

```bash
npm install --save-dev --save-exact tailwindcss@3.4.19
npm run build
```

Do not upgrade Tailwind to version 4 as an isolated package change. That
upgrade also requires migrating the stylesheet, PostCSS integration, theme,
and dark-mode configuration together.
