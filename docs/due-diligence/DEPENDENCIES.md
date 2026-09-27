# SchoolZone — Dependencies and Vendors

## Package authority

- `package.json`
- `package-lock.json`
- deterministic install: `npm ci`

Direct package areas include:
- React/Vite/TypeScript application stack;
- Fastify server;
- Anthropic SDK for AI/tutor capability;
- Nodemailer for email;
- test/build tooling.

The package root currently declares ISC. Third-party dependencies retain their own licences.

## Material providers

- GitHub — source/change history.
- Render — production server and persistent disk.
- Netlify — preview/deployment surface where used.
- AI provider through configured SDK/API.
- email provider/SMTP through runtime configuration.

## Buyer closeout

Generate and review an SBOM/licence report before final transaction close. Dependency-graph SBOM was not available through GitHub during this readiness closeout.
