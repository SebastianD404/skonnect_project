# Supabase database CA

`supabase-prod-ca-2021.crt` is Supabase's public Root 2021 CA certificate,
obtained from the official Supabase downloads endpoint. Its SHA-256 fingerprint
is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The local PostgreSQL URLs use this certificate with `sslmode=verify-full` to
verify both the certificate authority and server hostname. Keep the certificate
available anywhere the application runs, and verify the replacement fingerprint
against Supabase's dashboard before rotating it.
