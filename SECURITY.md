# Security Policy

`create-brass` is a project scaffolder published to npm. The stable 1.2.x line,
published under the `latest` tag, is the one that receives fixes. Betas
published under the `next` tag are experimental.

## Supported versions

| `create-brass` version | Status |
| --- | --- |
| Stable 1.2.x (`latest` tag) | Supported for fixes and reports |
| Betas on the `next` tag (none published yet) | Experimental: reports welcome, no fix guarantee |
| Versions before 1.2.x | Not supported |

Security fixes ship on the current stable line. If you use an older version,
upgrade to the latest 1.2.x.

## Dependency gates

Every pull request and every push to `main` runs the `Dependency Security`
workflow, which installs from the lockfile with
`npm ci --include=optional --ignore-scripts`, audits the dependencies, and runs
`npm run test:templates`. The same workflow runs every Monday at 10:23 UTC and
can be started by hand. High or critical npm advisories fail the check.

Run the same audits locally:

```bash
npm run audit:dependencies
npm run audit:prod
```

- `npm run audit:dependencies` audits every dependency with
  `npm audit --audit-level=high`.
- `npm run audit:prod` audits production dependencies only with
  `npm audit --omit=dev --audit-level=high`.

## Reporting vulnerabilities

Please do **not** put secrets, API keys, tokens, private repository contents, or
exploit details in a public issue.

Report vulnerabilities privately through this repository's GitHub security
advisories:
<https://github.com/BaldrVivaldelli/create-brass/security/advisories/new>

Include:

- the affected `create-brass` version and npm tag (`latest` or `next`),
- the template or command involved,
- reproduction steps,
- the expected impact,
- relevant logs, with secrets redacted.

## Secrets

`create-brass` needs no keys or tokens to generate a project. Before sharing
logs, generator output, or generated projects, review them and remove any
credential.
