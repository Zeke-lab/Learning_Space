# Supabase database trust anchor

`supabase-root-2021.crt` is the public **Supabase Root 2021 CA** certificate linked by the project's Database Settings > SSL configuration > Download certificate control. It is not a private key or password.

Downloaded on 2026-11-20 from:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

SHA-256 certificate fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

The certificate expires on 26 April 2031. `supabase-config.mjs` supplies this trust anchor while keeping certificate and hostname verification enabled. Connections are also restricted to the configured project/pooler hostname and role. Do not replace it with a certificate obtained from an unverified connection, or disable TLS validation to work around a trust failure.

For a future certificate rotation, download from the authenticated Supabase dashboard, check the issuer/fingerprint/validity, update the pinned fixture, and rerun the hosted connection checks. Supabase documents the certificate setup in its [SSL enforcement guide](https://supabase.com/docs/guides/platform/ssl-enforcement).
