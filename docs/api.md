# API documentation

## `POST /v1/users`

Creates a user. The API Gateway forwards this request privately to User Service and returns a gateway-issued JWT.

Request body:

```json
{ "email": "ada@example.com", "password": "a-long-secure-password", "name": "Ada Lovelace" }
```

Success (`201`):

```json
{ "data": { "id": "uuid", "email": "ada@example.com", "name": "Ada Lovelace" }, "token": "jwt" }
```

Errors: `400 VALIDATION_ERROR`, `409 EMAIL_EXISTS`, or `502 UPSTREAM_UNAVAILABLE`.

## `GET /health`

Available on the gateway and each service. Returns `{"status":"ok"}`.

## Event contract: `users.created`

Persisted in the `USER_EVENTS` JetStream stream. Event envelope:

```json
{
  "id": "uuid",
  "type": "user.created",
  "occurredAt": "2026-08-10T10:00:00.000Z",
  "data": { "id": "uuid", "email": "ada@example.com", "name": "Ada Lovelace" }
}
```
