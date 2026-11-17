# Deployment guide

This application needs a static frontend host, a Node.js API host, and a MongoDB database. GitHub Pages cannot host the Express API or database-backed authentication.

## Services

- **Frontend:** Vercel, project root `client/`, framework preset Vite, build command `npm run build`, output directory `dist`.
- **API:** Render using the repository's `render.yaml` Blueprint. It sets `server/` as the service root and `/api/health` as the health check.
- **Database:** MongoDB Atlas. Create a dedicated production database user with only the permissions the app needs; do not use a personal admin account.
- **Avatar storage:** Cloudinary. Add its credentials to the API host so avatar uploads work after deployment.

## Deployment order

1. Create the production MongoDB database and database user. Restrict network access to the API host where practical; do not publish the connection string.
2. Deploy the API from the repository's `render.yaml`. Set `MONGODB_URI` and a newly generated, private `JWT_SECRET` of at least 32 characters in Render's environment settings. Never reuse the example value or commit a real secret.
3. Configure `CLIENT_URL` in Render with the exact deployed Vercel origin, including `https://` and no trailing slash. If more than one trusted frontend origin is needed, separate origins with commas.
4. Keep `COOKIE_SAME_SITE=none` for Vercel-to-Render cross-site requests. Production cookies are marked Secure by the API, so both services must use HTTPS. The browser must allow third-party cookies for this cross-site setup; some browser privacy settings may block them. If so, use a same-site custom domain/proxy architecture rather than weakening cookie security.
5. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to Render to enable avatar uploads. Keep the API secret server-side only.
6. Deploy `client/` to Vercel and set `VITE_API_URL` to `https://YOUR-RENDER-SERVICE.onrender.com/api/v1`. Vite variables are public in the built client; never place secrets in `VITE_*`.
7. Verify `https://YOUR-RENDER-SERVICE.onrender.com/api/health` and `/api/ready`, then test registration, login, refresh/session restoration, logout, protected API requests, profile editing, avatar uploads, and one workflow from each feature area.

## Required API environment variables

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Private Atlas connection string |
| `JWT_SECRET` | New private random secret, at least 32 characters |
| `CLIENT_URL` | Exact deployed frontend origin, such as `https://your-app.vercel.app` |
| `COOKIE_SAME_SITE` | `none` when frontend and API are on different sites |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Private Cloudinary API secret |

Render's `render.yaml` declares these as environment settings. Add secret values through the Render dashboard; do not put real credentials in the YAML file.

## Required frontend environment variable

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR-RENDER-SERVICE.onrender.com/api/v1` |

## Before inviting real users

- Check production logs for startup errors and database connectivity.
- Confirm CORS and state-changing request origin checks allow only the intended frontend origin(s).
- In browser developer tools, confirm the authentication cookie is Secure, HttpOnly, and sent on API requests. Do not copy cookie values into tickets or chat.
- Test browser privacy settings because cross-site cookies can be blocked even when the API is configured correctly.
- Confirm Atlas backups, access controls, and network restrictions are appropriate for the data.
- Verify uploads fail clearly when Cloudinary is unavailable and that the server still enforces image type and size limits.
- Use a separate test environment/database for QA; do not expose production credentials to contributors.

Local tests and a successful build are necessary but do not certify a production deployment. Validate the real domains, cookies, database access, authorization, and upload flow before launch.
