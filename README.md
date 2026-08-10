# User & Notification Microservices

A small production-minded Node.js microservices system built around NATS JetStream.

## Services

| Component | Responsibility | Port |
| --- | --- | --- |
| API Gateway | Public API, rate limiting, validation boundary, JWT issuance | 3000 |
| User Service | Creates users and atomically records `users.created` outbox events | private |
| Notification Service | Durable asynchronous event consumer and notification persistence | private |
| NATS JetStream | Authenticated, persistent message broker | 4222 |

See [architecture](docs/architecture.md) and [API documentation](docs/api.md).

## Run locally with Docker

1. Copy the configuration: `cp .env.example .env`
2. Change `JWT_SECRET` and `NATS_PASSWORD` in `.env`. Keep the NATS password in sync with `docker-compose.yml` for this development setup.
3. Start the stack: `docker compose up --build`
4. Create a user:

```sh
curl -i http://localhost:3000/v1/users \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","password":"a-long-secure-password","name":"Ada Lovelace"}'
```

NATS monitoring is available at `http://localhost:8222` during local development. Stop with `docker compose down`; add `-v` only when you intentionally want to remove all local broker/database data.

## Development without containers

Start PostgreSQL and NATS first, then set `USER_DATABASE_URL`, `NOTIFICATION_DATABASE_URL`, and `NATS_URL` to `localhost`. Run `npm ci` in this directory, followed by `npm run dev:user`, `npm run dev:notification`, and `npm run dev:gateway` in separate terminals.

## Reliability and operations

- The transactional outbox means a committed user always has a recoverable event awaiting publication.
- JetStream persists messages for seven days and confirms publication before outbox records are marked sent.
- The Notification Service uses a durable explicit-ACK consumer and idempotent database writes, allowing safe retries after crashes.
- Structured JSON logs and `/health` endpoints are included. Production deployments should add readiness checks, metrics/tracing, a dead-letter workflow for exhausted deliveries, and external email delivery.

## Production configuration

Use a unique `JWT_SECRET` with at least 32 characters, a managed PostgreSQL service with TLS, and NATS TLS plus account-scoped credentials. Set `NATS_CREDS_FILE` (and, when required, `NATS_TLS_CA`) instead of basic NATS user/password authentication. Put these values in your secret manager or mounted container secrets; do not commit `.env` files.
