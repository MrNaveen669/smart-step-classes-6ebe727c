# Examly

Examly is a TanStack Start and Supabase application for managing question banks, creating tests, and running anonymous student attempts.

## Local development

Install dependencies, configure the required Supabase and OpenRouter environment variables, then run:

```sh
npm install
npm run dev
```

Useful commands:

```sh
npm run typecheck
npm run build
npm run start
```

The health-check endpoint is available at `/health`.

## Deployment

The application builds with TanStack Start and Nitro's `node-server` preset. Provide the required environment variables in the deployment environment before starting the server.
