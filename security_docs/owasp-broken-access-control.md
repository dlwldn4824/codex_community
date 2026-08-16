# OWASP A01: Broken Access Control

Access control must be enforced in trusted server-side code. A user must not be able to access functions or data outside their intended permissions by modifying a URL, API path, or identifier.

For administrator endpoints, deny access by default and verify the authenticated role on every request. A successful response containing protected data for an unauthorized role is evidence of broken access control.
