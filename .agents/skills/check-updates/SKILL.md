---
name: check-updates
description: Check for npm dependencies and Node.js updates, and update stable versions across package.json and README badges
---

1. Run `python3 .agents/skills/check-updates/scripts/check_updates.py`. This script queries the npm registry for all project dependencies (`package.json`), checks the Node.js runtime (`.nvmrc`, local `node -v`, nodejs.org releases), and scans any GitHub Actions (`.github/workflows/*.yml`), outputting formatted summary tables.
2. Review the output tables. Look for rows where the status is `Update Avail (Patch)`, `Update Avail (Minor)`, or `Update Avail (Major)`.
3. Determine which dependencies have new **stable** versions available. Do not update to pre-release, alpha, beta, canary, or dev versions (such as `alpha`, `beta`, `rc`, `next`) unless explicitly requested.
4. For each stable update available, update the corresponding version strings:
   - **Automated update**: Run `python3 .agents/skills/check-updates/scripts/check_updates.py --update` (pass `--no-major` if only patch and minor bumps are desired).
   - **Manual update**: Edit the version string in `package.json` under `dependencies` or `devDependencies`.
   - **Node.js runtime**: When bumping the Node.js version, update `.nvmrc`, `package.json` (`engines.node`), and the Node.js badge in `README.md`.
   - **GitHub Actions**: If present, update action version tags (e.g. `uses: actions/checkout@v5`) across all workflow files in `.github/workflows/`.
5. Install and verify the build:
   - Run `npm install` to sync `package-lock.json` with the updated dependencies.
   - Run `npm run build` (`tsc -b && vite build`) to verify that TypeScript compilation and Vite bundling pass without error.
   - Run `npm run lint` (`oxlint`) to verify code quality.
6. Finally, update `README.md`:
   - If core stack technologies are updated (Node.js, LangGraph, React, TypeScript, Vite), update their shields.io version badges in `README.md`.
7. Commit the changes with a clear commit message (e.g. `build(deps): update dependencies to latest stable`).
