# Deployment

ResearchPath runs as a Docker image on Render (free plan). Merging to `main` publishes the
image to GitHub Container Registry and asks Render to deploy `main`. A version tag `v*` publishes
a versioned image and does not deploy.

> **Warning: the free plan does not keep data.** Render's free plan has no persistent disk.
> The SQLite file is lost on every redeploy, every restart and every spin-down after inactivity.
> Every merge to `main` redeploys, so data added to the live app can disappear at any time.
> Treat the live app as a **demo**: do not keep real data in it. A paid persistent disk, or a
> hosted database with accounts (v0.3, US-07), fixes this.

Live app: https://researchpath.onrender.com (Render free plan: it spins down when idle, so the first request can take a while).

## Production settings

| Variable | In production | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Set in the `prod` stage of the `Dockerfile`. Do not change it on Render. |
| `PORT` | Set by Render | Do **not** set it on Render: Render chooses the port and the image reads it. Locally the default is `3000`. |
| `DB_PATH` | Not set: `/app/data/researchpath.db` | The default. It stays on the container filesystem, so it is not persistent on the free plan (see the warning above). |
| `OPENALEX_MAILTO` | Empty (optional) | Optional, empty by default. It can be set on Render to use the OpenAlex polite pool. |

The variables and their defaults are listed in `.env.example`. Nothing loads that file automatically
(no dotenv, no `--env-file`, no `env_file` in `docker-compose.yml`): set the variables in the shell.
They are read only in `src/config.js`.

## How CD works

The workflow is [`.github/workflows/cd.yml`](../.github/workflows/cd.yml), named `CD`.

- **Triggers:** a push to `main`, and a push of a tag matching `v*`.
- **Permissions:** `contents: read` and `packages: write`. No secret or token is written in any file.
- **Concurrency:** one run per branch or tag at a time; a running deploy is never cancelled.

**Job `publish`** (timeout 15 minutes)

1. Builds the `prod` target of the `Dockerfile`.
2. Pushes it to `ghcr.io/pluto2k2/researchpath` (the owner name in lowercase, as GHCR requires).
3. Tags the image:

| Trigger | Tags |
|---|---|
| Every run | the full commit SHA |
| Push to `main` | `latest` |
| Tag `v0.1.0` | `0.1.0` (no `v` prefix) |

**Job `deploy`** (timeout 20 minutes; runs only after `publish`, and only on `main`, never on a tag)

1. Sends a POST to the Render deploy hook stored in the secret `RENDER_DEPLOY_HOOK_URL`.
   Render builds the repository itself (branch `main`, Docker). The hook only starts that build:
   the GHCR image is a versioned artifact, not what Render runs.
2. Waits 30 seconds, then calls `GET $APP_URL/api/health` every 10 seconds for up to 15 minutes.
   `APP_URL` is the repository variable with the service URL. The job fails if the health check
   does not return `200` in that time. Render builds from source and can cold start, which is why
   the wait is 15 minutes.

**Missing settings are a warning, not a failure.** If `RENDER_DEPLOY_HOOK_URL` or `APP_URL` is
not set, the workflow prints a warning and stays green, and the step is skipped. Check the
warnings in the run summary after setting up.

## Set up the hosting (one time)

### a. Render

1. In Render, choose **New > Web Service** and select the GitHub repository.
2. Runtime: **Docker**. Branch: **main**. Dockerfile: the repository's `Dockerfile`. The last
   stage is `prod`, which Render builds by default.
3. Instance type: **Free**.
4. Health Check Path: `/api/health`.
5. Do **not** set the `PORT` variable.
6. Turn **Auto-Deploy OFF**. Otherwise each merge builds twice: once by Render's auto-deploy and
   once by the CD hook.
7. Copy the **Deploy Hook URL** (Settings > Deploy Hook) and the **service URL** (for example
   `https://<name>.onrender.com`).

### b. GitHub

1. **Settings > Secrets and variables > Actions**
   - Secret `RENDER_DEPLOY_HOOK_URL`: the Deploy Hook URL from Render.
   - Variable `APP_URL`: the service URL, for example `https://<name>.onrender.com`.
2. **Settings > Actions > General > Workflow permissions**: check that write access is allowed
   (**Read and write permissions**), so that the `publish` job can push to GHCR.
3. After the first publish, the package `researchpath` appears under the account's Packages. A new
   package is private. If you want anyone to pull the image, change its visibility to public in the
   package settings. This is optional: Render does not pull the image.

## Release v0.1.0

1. **Release pull request:** open a pull request from `develop` to `main`. Wait for the CI checks
   to be green, then merge it. CD publishes the image (`latest` and the SHA) and deploys.
2. **Check the deploy:** open `$APP_URL/api/health` in a browser or with `curl`. It must return
   `{"status":"ok"}`. Open the app itself and check that the roadmap loads.
3. **Tag the release** on the merge commit on `main`:

   ```bash
   git switch main
   git pull
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

   The tag run publishes the image tagged `0.1.0`. It does **not** deploy.
4. **Create the GitHub release** from the tag `v0.1.0`: on GitHub, **Releases > Draft a new release**,
   choose the tag `v0.1.0`, or run `gh release create v0.1.0 --generate-notes`.

**Rule: tag only commits on `main`.** A tag must point to a commit that is already merged into
`main` through the release pull request. Never tag a branch or a commit from `develop`.

## Release v0.2.0

v0.2.0 followed the same release steps: release pull request [#14](https://github.com/Pluto2k2/ResearchPath/pull/14), then the tag `v0.2.0` on the merge commit on `main`.

## Known limitations

- **The health check can pass on the old instance.** Render keeps the old instance serving during a
  deploy. The wait in CD can therefore succeed before the new release is live, so a green `deploy`
  job does not prove that the new code runs. Check the version yourself after a deploy, or see the
  backlog item in [`docs/missions/README.md`](missions/README.md) (the health endpoint returns the
  commit SHA, or Render's API is polled for the deploy status).
- **CD does not run lint or tests.** CI does that on pull requests. This is why the tag rule above
  matters.
- **Free-plan data loss** (see the warning at the top): each redeploy, restart or spin-down erases
  the SQLite data.
- **Warnings:** the start scripts and the production image hide all Node experimental warnings
  (`--disable-warning=ExperimentalWarning`), because Node gives the `node:sqlite` warning no code of
  its own. Other warnings, such as deprecations, are still shown.
