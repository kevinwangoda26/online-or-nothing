# ONLINE OR NOTHING

Online application form. Each submission is emailed, with attached documents, to the admin.

- `index.html`: the form
- `api/apply.js`: Vercel serverless function that sends the email through Resend

Environment variables (set in Vercel, never commit them): `RESEND_API_KEY`, `ADMIN_EMAIL`, optional `FROM_EMAIL`.
