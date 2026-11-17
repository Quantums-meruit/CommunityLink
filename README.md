# CommunityLink

CommunityLink is a multi-community web platform for discovering communities, publishing posts and comments, organizing events, finding businesses and opportunities, and managing reports.

## Technology
- Frontend: React 19, Vite, React Router, Axios and responsive CSS
- Backend: Node.js, Express, Mongoose
- Database: MongoDB / MongoDB Atlas
- Authentication: bcryptjs, JWT in HTTP-only cookies
- Hosting target: Vercel (frontend), Render (API), MongoDB Atlas (database)

## Project structure
```text
CommunityLink/
├── client/       # React application
├── server/       # Express REST API
├── docs/         # Project and team documentation
├── package.json  # npm workspace commands
└── README.md
```
The repository keeps its existing `client/` and `server/` directory names to avoid disrupting the team's current branches and file ownership. These correspond to the `frontend/` and `backend/` names used in the project specification.

## Requirements
- Node.js 20 LTS or newer
- npm 10 or newer
- MongoDB Atlas connection string or local MongoDB

## Setup
1. Install dependencies from the repository root: `npm install`. This regenerates a fresh `package-lock.json`; the uploaded lockfile was omitted because its workspace metadata did not match the root package manifest.
2. Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env`.
3. Set `MONGODB_URI`, a randomly generated `JWT_SECRET` of at least 32 characters, and `CLIENT_URL`. Never commit `.env` files.
4. Start the API and frontend in separate terminals:
   - `npm run dev:server`
   - `npm run dev:client`

Frontend: http://localhost:5173  
API health: http://localhost:5000/api/health  
API base: http://localhost:5000/api/v1

## Commands
| Command | Purpose |
|---|---|
| `npm install` | Install workspace dependencies |
| `npm run dev:client` | Start Vite |
| `npm run dev:server` | Start Express with nodemon |
| `npm run build` | Build the frontend |
| `npm test` | Run backend tests |
| `npm start` | Start the backend in production |
| `npm run promote-admin -- user@example.com` from `server/` | Promote an existing account to platform admin |

Register the intended administrator first, then run `npm run promote-admin -- admin@example.com` from `server/`. This requires a working `server/.env` and MongoDB connection.

## API overview
All application endpoints are under `/api/v1`; legacy `/api` remains available for compatibility. Health checks are `/api/health` and `/api/ready`. Core resources include auth, profiles, communities/memberships, posts/comments, events/registrations, businesses, opportunities/applications, reports, notifications and administration.

## Authentication and security
- Passwords are hashed with bcryptjs.
- JWTs are stored in HTTP-only cookies; tokens are not stored in localStorage.
- The API validates request origins for state-changing requests and uses credentialed CORS.
- In production, use HTTPS and configure `COOKIE_SAME_SITE=none` when Vercel and Render are cross-site; cookies are then Secure. Verify browser cookie behavior on deployed domains.
- Use a strong `JWT_SECRET`, exact `CLIENT_URL`, and restricted MongoDB network access.
- The API enforces resource ownership and server-side role checks.

## Testing
Run `npm test` for backend tests and `npm run build` for the frontend production build. Test end-to-end workflows with a configured MongoDB database before deployment. Local checks do not replace production cookie, CORS, database and authorization checks.

## Deployment
Deploy `client/` to Vercel and `server/` to Render; use MongoDB Atlas and Cloudinary for avatars. Follow the [deployment guide](./docs/13-deployment-guide.md) for service settings, environment variables, cookies, and production verification. Never commit real secrets or put them in `VITE_*` variables.

## Team ownership
The nine-member allocation and shared-file ownership rules remain in the project specification. The central API router provides a consistent integration surface; module owners should review and take ownership of their assigned modules before merging feature branches.

## Project status
This is an implementation baseline, not a claim of production certification. A live MongoDB instance, configured secrets, real user testing, deployment settings, and the team's review of module ownership are still required before final submission.
