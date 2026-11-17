# Deployment guide

Deploy `client/` to Vercel and `server/` to Render. Use MongoDB Atlas. Configure `VITE_API_URL` on Vercel and `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, cookie settings and `NODE_ENV=production` on Render. Use HTTPS, restrict origins and verify health, readiness, authentication, cookies and protected workflows.
