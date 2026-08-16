# Member Directory Security Policy

Only users with the `ADMIN` role may access administrator APIs or read the complete user directory.

Users with the `MEMBER` role may read their own profile. They must not read another user's profile or receive data from `/api/admin/*`.
