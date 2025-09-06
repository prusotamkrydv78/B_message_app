# Messaging Backend (Auth Base)

Express + MongoDB starter for a WhatsApp-like messaging app. This provides a stable, well-structured authentication base with phone-number-based registration and JWT access/refresh tokens.

## Endpoints

- POST `/api/v1/auth/register` — Register with `phoneNumber`, `password`, optional `name`, `countryCode`.
- POST `/api/v1/auth/login` — Login with `phoneNumber` and `password`.
- POST `/api/v1/auth/refresh` — Refresh access token using refresh token (cookie or body).
- POST `/api/v1/auth/logout` — Logout and revoke refresh token.
- GET `/api/v1/auth/me` — Get current user (requires Bearer access token).
- GET `/health` — Health check.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT (access + refresh)
- Joi validation, centralized error handling, CORS, Helmet, cookies

## Setup

1. Copy `.env.example` to `.env` and fill the secrets.
2. Install dependencies:

```bash
npm install
```

3. Start in dev:

```bash
npm run dev
```

Server runs on `http://localhost:4000` by default.

## Notes

- Refresh tokens are stored per-user (last 5 kept). They are also set as HttpOnly cookies.
- Access tokens should be sent as `Authorization: Bearer <token>`.
- Validation is enforced using Joi; update schemas in `src/validators/` as needed.
