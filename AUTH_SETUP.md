# Google account sign-in setup

Status: first-stage implementation on `feat/google-sign-in`. Local policy/session/HTTP checks are available; real Google sign-in is not verified or activated in production yet.

## Scope of this first stage

- Google OpenID Connect on OAuth 2.0, using the authorization code flow with PKCE, state, and nonce checks.
- NextAuth.js 4.24.15 (stable release compatible with this project's Next.js/React versions).
- Only `openid email profile` scopes; no Gmail, Drive, or offline access requested.
- Verified Google emails and stable Google subject IDs; email addresses are not account IDs.
- Encrypted, HTTP-only session cookies and a server-protected account page/API.
- Separate guest and signed-in browser workspaces; existing guest books are not silently moved or deleted.

There is no database adapter in this stage. Account identity/profile lives in the encrypted app session, and books still live in this browser. Persistent user rows, private book/PDF storage, ownership-checked file endpoints, and multi-device sync are the next stage. Browser storage separation is not a replacement for server-side authorization.

## Create the Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/), and select the project you want to use for Learning Space.
2. In Google Auth Platform, configure the app's branding and audience. Use the correct External/Internal audience for your Google account type. If the app is in testing, add the intended test users.
3. Create an OAuth client of type **Web application**.
4. Register the exact authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://learning-space-delta.vercel.app/api/auth/callback/google
```

If using a different local port, register that port's callback too and match `NEXTAUTH_URL`. Use a fixed production domain; do not use wildcard callback URLs.

5. Keep the client secret private. Put credentials in the environment, not source code, screenshots, or chat messages.

## Local configuration

The ignored `.env.local` needs these server-only values:

```dotenv
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Use a cryptographically random session secret of at least 32 characters. A local secret was generated into the ignored `.env.local` during implementation; its value was not printed. Keep the existing Gemini configuration as well. Do not overwrite an existing environment file when following the example.

Restart `npm run dev` after changing environment variables. Open `/signin` and select **Continue with Google**. Without complete credentials the sign-in page explains that sign-in is unavailable; it does not expose environment diagnostics to visitors. Guest Book Studio remains usable.

## Production configuration

Before merging/activating the feature, configure these in the Vercel project's Production environment:

- `NEXTAUTH_URL`: `https://learning-space-delta.vercel.app`
- `NEXTAUTH_SECRET`: a separately generated production secret, kept stable between deployments.
- `GOOGLE_CLIENT_ID`: the Google Web application client ID.
- `GOOGLE_CLIENT_SECRET`: its client secret.

Keep `GOOGLE_GENERATIVE_AI_API_KEY` configured. Do not prefix auth secrets with `NEXT_PUBLIC_`. Never commit `.env` or `.env.local`. Changing the session secret invalidates existing sessions.

Google's real authorization, consent, callback, and sign-out flow must be tested with the owner's registered client. Synthetic session/policy checks cannot prove that the Google client or Vercel environment is correctly configured.

## Account endpoint contract

`GET /api/account` returns HTTP 401 with a generic sign-in message when unauthenticated. An authenticated response contains only the session user's `id`, `name`, and `email`, plus `bookStorage: "this-browser"`. Responses use `Cache-Control: private, no-store`. No Google access token, refresh token, ID token, or app session secret is returned.

The auth library handles `/api/auth/*`, including CSRF, sign-in, callback, session, and sign-out routes. When credentials are incomplete, those routes return a generic HTTP 503 response. Production cookies use HTTPS-only secure cookies; local HTTP is permitted only for loopback development origins.

## Activation checklist

Run `npm test`, `npm run lint`, and `npm run build`, followed by `npm run test:auth`. The HTTP smoke test starts isolated local production servers with test-only credentials and synthetic encrypted app sessions. It verifies account access, session tampering/expiry, immutable identity on session update, CSRF-protected sign-out, workspace key selection, and safe behavior when configuration is missing. It does not log into Google or call its token endpoint.

Local verification for this branch: 18 unit tests and 11 HTTP auth checks passed, along with lint, TypeScript checking, and production build. Three Postman assertions also passed for anonymous account denial, non-cacheable responses, and absence of user data. Browser visual checks could not run because browser access was unavailable in this chat. The real Google flow and production activation remain pending below.

- [ ] Google client/branding/audience and test users configured.
- [ ] Local and production environment values set privately.
- [ ] Real Google sign-in completes and shows the correct name/email.
- [ ] An unauthenticated visitor cannot access `/account` or account data.
- [ ] Account A, account B, and guest browser workspaces stay separate.
- [ ] Guest books remain available after returning to guest mode.
- [ ] Sign-out returns to guest mode; reload does not restore the signed-in session.
- [ ] Test the deployed callback and secure-cookie behavior on the production domain.
- [ ] Add durable user records and private book/PDF storage in the next stage.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [NextAuth Google provider](https://next-auth.js.org/providers/google), and [NextAuth server sessions](https://next-auth.js.org/configuration/nextjs).
