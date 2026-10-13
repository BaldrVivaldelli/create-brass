# Contributing

Thanks for helping improve `create-brass`. This repository publishes the
`create-brass` scaffolding CLI (`dist/`) and its project `templates/`.

Node 20 or newer is required (`engines.node` is `>=20`). CI runs on Node 22, so
prefer Node 22 locally to reproduce its results.

## Before opening a pull request

Run the same checks as the `Quality` workflow:

```bash
npm ci --include=optional
npm run audit:dependencies
npm run audit:prod
npm run validate:release-policy
npm run validate:evidence
npm run test:evidence
npm run build
npm run test:templates
npm run test:templates:rollback
```

Use the smallest matching lane while iterating. For example, after changing
anything under `templates/` or `scripts/validate-templates.mjs`, run
`npm run build` and then `npm run test:templates`.

## Beta lanes

The v2 beta and v1 bridge template lanes need a `brass-runtime` v2 beta
tarball, passed with `--runtime-tarball`. The `Publish Beta` workflow downloads
it with `npm pack`; locally you can do the same:

```bash
mkdir -p artifacts/runtime
npm pack brass-runtime@2.0.0-beta.0 --pack-destination artifacts/runtime
npm run test:templates:v2-beta -- --runtime-tarball artifacts/runtime/brass-runtime-2.0.0-beta.0.tgz
npm run test:templates:v1-bridge -- --runtime-tarball artifacts/runtime/brass-runtime-2.0.0-beta.0.tgz
```

Both lanes fail without `--runtime-tarball`. They are not part of the
`Quality` workflow; run them when you change the beta or v1 facade templates.

## Commits and releases

Use [Conventional Commits](https://www.conventionalcommits.org/). Releases are
computed by semantic-release from the commit messages, so the type matters:
`feat` and `chore` release a minor version, `fix`, `docs`, `refactor` and
`perf` release a patch, and a breaking change (`!` or a `BREAKING CHANGE:`
footer) releases a major.

`main` only takes pull requests; do not push to it directly. Stable releases
and betas are published by maintainers through the `Release` and
`Publish Beta` workflows, so do not bump `version` by hand.

## Dependencies

`npm run audit:dependencies` and `npm run audit:prod` fail on advisories of
high severity or above. If you change dependencies, update `package-lock.json`
with npm and make sure both audits still pass.

## Bug reports

Include a minimal reproduction, your Node and npm versions, the exact
`create-brass` command and answers you used, and the template you selected.
Never post secrets, proprietary code, or private traces. For security issues,
follow `SECURITY.md` instead of opening a public issue.
