# Deployment Details (for coding agents)

## Platform

**Cloudflare Workers** with static assets. This is NOT Cloudflare Pages — it's a Workers project that serves a static Vite-built SPA.

The project was initially auto-configured by Cloudflare's git integration (commit `f96ec7a`), which added the `@cloudflare/vite-plugin` and created `wrangler.jsonc`.

## Configuration files

### wrangler.jsonc

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "chess-calculations",
  "compatibility_date": "2026-05-02",
  "observability": { "enabled": true },
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  },
  "compatibility_flags": ["nodejs_compat"]
}
```

- `assets.directory`: MUST be `"./dist"`. Without it, `wrangler deploy` fails with "missing the required directory property".
- `not_found_handling`: SPA mode — unknown paths serve `index.html`.
- `compatibility_date`: pinned to the initial deployment date.

### vite.config.ts

```ts
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare()],
  base: '/',
  // ...
});
```

- The `cloudflare()` plugin was added by auto-config. It's required for the git-integration build system but not for manual `wrangler deploy`.
- `base: '/'` — the app uses a subdomain (`chess-calc.aysaac.net`), so assets are at root. DO NOT change this to a subpath like `/chess-calc/`.
- `plugins` array must exist (even if empty) — wrangler auto-config requires a valid plugins array to inject its own plugin.

### package.json scripts

```json
{
  "build": "tsc && vite build",
  "deploy": "npm run build && wrangler deploy"
}
```

- `build` is used by the git-integration build step.
- `deploy` is the command set in the Cloudflare dashboard deploy field.

## DNS & Routing

- **Domain**: `aysaac.net` — serves an Obsidian Publish blog (CNAME → `publish-main.obsidian.md`). DO NOT touch this.
- **Subdomain**: `chess-calc.aysaac.net` — A record → `104.21.41.101` (proxied through Cloudflare).
- **Worker route**: `chess-calc.aysaac.net/*` → script `chess-calculations`.

The subdomain isolates the app from the blog at the root domain. No path prefix stripping needed.

## Cloudflare Dashboard settings

Workers & Pages → chess-calculations → Settings → Build & Deploy:

| Field | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Build output directory | *(emptya
| Root directory | *(empty)* |

## Git auto-deploy

- Connected via Cloudflare's git integration (Worker Builds).
- Every push to the production branch triggers a build.
- The build system uses a token for authentication. If it breaks with "build token has been deleted or rolled", regenerate the token at Workers & Pages → Settings → Builds → Regenerate.

## Manual deploy

```bash
export $(grep -v '^#' .env | xargs)
npm run build && npx wrangler deploy
```

Requires `.env` with:
```
CLOUDFLARE_API_TOKEN=<token with Workers:Edit permission>
CLOUDFLARE_ACCOUNT_ID=<account id>
```

## Pitfalls / known issues

1. **DO NOT use `base: '/chess-calc/'`** in vite config. The app uses a subdomain, not a subpath. Setting a base prefix breaks asset loading.

2. **The `assets.directory` field** is NOT present in the auto-generated wrangler.jsonc (commit `ef473b1`). The auto-config's `cloudflare()` plugin supplies it at build time. Manual `wrangler deploy` requires it explicitly. Keep it.

3. **Token permissions**: The API token needs `Workers:Edit` for `wrangler deploy`. DNS management needs separate `DNS:Edit` permission.

4. **`wrangler pages deploy` vs `wrangler deploy`**: This is a Workers project, NOT Pages. Using `wrangler pages deploy` will fail with authentication errors because the Pages API is a different endpoint.

5. **The `cloudflare()` vite plugin** must be in `plugins` array. Removing it was a mistake that broke the git-integration build.
