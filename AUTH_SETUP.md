# Google account sign-in setup

Status: merged into `main` through PR #1 (`e6290c7`) and deployed. Real Google sign-in, account profile, reload persistence, and sign-out/protected-page denial passed both locally and on `https://learning-space-delta.vercel.app`. Release notes reviewed on 2026-11-20.

Google Cloud project: **Learning Space** (`mystic-tempo-515211-r3`). The **Learning Space Web** OAuth client has exact localhost/production callbacks registered. Branding/contact policy setup is saved, the app is in External/Testing mode, and the owner is registered as a test user. Credentials are stored privately in the ignored local environment file and Vercel Production secrets. A separate random production session secret is configured. Preview deployments have not been configured for Google login.

Google's app remains in **Testing** mode, so this release is ready for the registered owner to test. Public availability for other accounts and Google's publication/branding requirements remain a separate step; do not describe it as an unrestricted public sign-in launch.

## Scope of this first stage

- Google OpenID Connect on OAuth 2.0, using the authorization code flow with PKCE, state, and nonce checks.
- NextAuth.js 4.24.15 (stable release compatible with this project's Next.js/React versions).
- Only `openid email profile` scopes; no Gmail, Drive, or offline access requested.
- Verified Google emails and stable Google subject IDs; email addresses are not account IDs.
- Encrypted, HTTP-only session cookies and a server-protected account page/API.
- Separate guest and signed-in browser workspaces; existing guest books are not silently moved or deleted.

There is no database adapter in this stage. Account identity/profile lives in the encrypted app session, and books still live in this browser. Persistent user rows, private book/PDF storage, ownership-checked file endpoints, and multi-device sync are the next stage. Browser storage separation is not a replacement for server-side authorization.

The database design now includes permanent UUID accounts, separate Google identities and private optional password/verification/reset tables through migration `002_account_identities.sql`; see [db/README.md](db/README.md). It is not applied to a hosted database or wired into this auth handler. Existing live sessions still use `google:<sub>` and remain unchanged. The future database integration must resolve that verified identity to a UUID before setting any database ownership context; self-service registration is not available yet.

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

## Test Google sign-in on your laptop

You do **not** need a database to test the current Google sign-in/session feature. Database design is in [db/README.md](db/README.md); saving account books to a database is a separate, pending integration.

1. In VS Code, open the `Learning_Space` project folder. The sign-in implementation is merged into `main`; use an up-to-date checkout after preserving unrelated local changes.
2. Complete the Google OAuth Web application setup above, including the local authorized redirect URI `http://localhost:3000/api/auth/callback/google`. Add your Google email under Audience/Test users if the app's testing configuration requires it.
3. Open the ignored `.env.local` locally and fill `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Keep the existing random `NEXTAUTH_SECRET` and set `NEXTAUTH_URL=http://localhost:3000`. Never paste secret values in chat. Keep the Gemini key if you also want to generate chapters.
4. Run `npm ci`, then `npm run dev` in that folder. If port 3000 is occupied, stop the existing server or register the exact replacement port in both Google and `NEXTAUTH_URL`; do not silently use a different origin.
5. On **that laptop**, open `http://localhost:3000/signin`, click **Continue with Google**, select your test Google account, and complete consent if shown. The expected result is a return to Book Studio with **Your account** available. Visit `/account` and verify your name/email. Refresh and confirm the session remains signed in.
6. Optionally open `http://localhost:3000/api/account` in the same browser: it should show your `id`, `name`, `email`, and `bookStorage: "this-browser"`. It must not return Google tokens.
7. Sign out from `/account`. Open `/account` again: it should redirect to `/signin`. `/api/account` should return 401. In a separate private browser window, these protected routes should also deny access before login.
8. Test a second account and the guest workspace. Create distinctive sample content in each; sign out/in and verify the current workspace changes correctly. Guest content should return when signed out. This is browser workspace separation, not cloud sync; the same books will not appear on your phone yet.

If using Codespaces, forward the app port and use its exact HTTPS origin in `NEXTAUTH_URL` and its exact `/api/auth/callback/google` URL in Google's authorized redirect URIs; restart the server afterward. The laptop's `localhost` only works if the port is forwarded to that laptop. A phone's `localhost` points to the phone. Use the deployed domain for phone testing after the auth feature is deployed and its production credentials are configured.

Common failures:

- **Sign-in unavailable:** check the four local auth variables are filled and restart the server. Local Google ID/secret were configured on 2026-11-19; other environments need their own configuration.
- **`redirect_uri_mismatch`:** compare the complete scheme, hostname, port and callback path with Google's registered value and `NEXTAUTH_URL`.
- **Access denied/testing restriction:** check the selected Google account is allowed by the configured audience/test-user list. Workspace administrators may also restrict consent.
- **Callback/session failure:** use one consistent origin, allow cookies, and inspect the server's safe error code. Never publish cookies, OAuth codes or tokens in screenshots/logs.

Record real-flow success only after these steps complete. `npm run test:auth` uses synthetic sessions and cannot substitute for the Google redirect/consent/callback test. The deployed production site includes account sign-in; the real callback and session/sign-out flow were verified with the registered owner.

## Production configuration

The following are configured as secrets in the Vercel project's Production environment. Retain these settings for future deployments:

- `NEXTAUTH_URL`: `https://learning-space-delta.vercel.app`
- `NEXTAUTH_SECRET`: a separately generated production secret, kept stable between deployments.
- `GOOGLE_CLIENT_ID`: the Google Web application client ID.
- `GOOGLE_CLIENT_SECRET`: its client secret.

Keep `GOOGLE_GENERATIVE_AI_API_KEY` configured. Do not prefix auth secrets with `NEXT_PUBLIC_`. Never commit `.env` or `.env.local`. Changing the session secret invalidates existing sessions.

Google's real authorization, consent, callback, and sign-out flow must be tested with the owner's registered client in each environment. Local and Vercel Production flows passed. Synthetic session/policy checks alone cannot prove that the Google client or Vercel environment is correctly configured.

## Account endpoint contract

`GET /api/account` returns HTTP 401 with a generic sign-in message when unauthenticated. An authenticated response contains only the session user's `id`, `name`, and `email`, plus `bookStorage: "this-browser"`. Responses use `Cache-Control: private, no-store`. No Google access token, refresh token, ID token, or app session secret is returned.

The auth library handles `/api/auth/*`, including CSRF, sign-in, callback, session, and sign-out routes. When credentials are incomplete, those routes return a generic HTTP 503 response. Production cookies use HTTPS-only secure cookies; local HTTP is permitted only for loopback development origins.

## Activation checklist

Run `npm test`, `npm run lint`, and `npm run build`, followed by `npm run test:auth`. The HTTP smoke test starts isolated local production servers with test-only credentials and synthetic encrypted app sessions. It verifies account access, session tampering/expiry, immutable identity on session update, CSRF-protected sign-out, workspace key selection, and safe behavior when configuration is missing. It does not log into Google or call its token endpoint.

Verification: 18 unit tests, 12 isolated PostgreSQL schema checks, and 11 HTTP auth checks passed, along with lint, TypeScript checking, and production build. Three earlier Postman assertions also passed for anonymous account denial, non-cacheable responses, and absence of user data. Real Google login returned to Book Studio locally and on the production domain; the account page showed the correct profile after reload, and sign-out denied subsequent protected-page access in both environments. Production deployment and main CI checks passed for `e6290c7`. A second real account remains untested. Browser cookie stores were not inspected; secure/HTTP-only cookie flags are covered by configuration and synthetic HTTP checks rather than a production cookie inspection.

- [x] Google client/branding/audience and owner test user configured (External/Testing).
- [x] Local and production environment values set privately; distinct local/production session secrets.
- [x] Real Google sign-in completes locally and shows the correct name/email; reload preserves the session.
- [x] Local/production `/account` redirects after sign-out; synthetic HTTP checks reject anonymous account data.
- [ ] Account A, account B, and guest browser workspaces stay separate.
- [ ] Guest books remain available after returning to guest mode.
- [x] Local sign-out returns to guest mode and subsequent `/account` access redirects to sign-in.
- [x] Real deployed Google callback, profile/reload persistence, and sign-out/protected-page denial passed over HTTPS.
- [ ] Independently audit production cookie flags (not inspected through browser storage).
- [ ] Complete Google publishing/branding requirements and verify access beyond the owner test account before public launch.
- [ ] Add durable user records and private book/PDF storage in the next stage.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [NextAuth Google provider](https://next-auth.js.org/providers/google), and [NextAuth server sessions](https://next-auth.js.org/configuration/nextjs).
