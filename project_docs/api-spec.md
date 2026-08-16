# Administrator User API

`GET /api/admin/users` returns the complete member directory for administrator workflows.

Required role: `ADMIN`

Unauthorized authenticated roles must receive `403 Forbidden`. The response must not contain user names, email addresses, or profile records.
