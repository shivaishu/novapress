# Nova Press

Nova Press is a full-stack news portal based on the project synopsis. It includes reader accounts and profiles, category browsing and search, article publishing and management, likes/dislikes, comments, editor and admin roles, category management, Cloudinary cover uploads, Gemini summaries, persisted notifications, Socket.IO live updates, and optional SMTP email alerts. Cloudinary, Gemini, and SMTP features activate when their keys are configured.

## 1. Prerequisites

- Node.js 20 or newer and npm
- MongoDB Community running locally, or a MongoDB Atlas connection string

## 2. Install and configure

From the project root (`Nova_press`):

```powershell
npm install
npm install --prefix server
npm install --prefix client
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Open `server/.env` and set `MONGODB_URI`, `JWT_SECRET`, `BOOTSTRAP_ADMIN_EMAIL`, and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 14 characters. Keep `.env` private and out of version control. Add Cloudinary, Gemini, and SMTP credentials to enable those integrations. Never put secrets in `.env.example` or frontend code.

For a local MongoDB installation, use `MONGODB_URI=mongodb://127.0.0.1:27017/novapress`. In Atlas, create a database user, allow your development IP, and paste the project's connection string into `MONGODB_URI`.

## 3. Create sample stories and the editor

```powershell
npm run seed
```

The seed command inserts the default sections and four example stories when the database is empty, and creates the bootstrap administrator if it does not exist. Set its login in the private `.env` first. To reset its password after changing that value, run:

```powershell
npm --prefix server run admin:reset
```

The editor desk lets administrators create/edit/publish or delete stories, manage sections, and grant editor/admin roles. Public registration cannot assign a privileged role.

## 4. Start the app

```powershell
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Vite proxies `/api` and Socket.IO requests to the Express server at port 5000. To stop both processes, press `Ctrl+C`.

## 5. Service configuration

| Feature | Configuration |
|---|---|
| Cover image upload | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; editor accepts image files up to 8 MB. |
| Article summary | `GEMINI_API_KEY`; optional `GEMINI_MODEL` defaults to `gemini-2.5-flash`. The summary stays a draft for editor review. |
| Email alerts | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`; comment/reaction alerts go to the article author. |
| Newsletter | Subscriber addresses are stored in MongoDB; configured SMTP sends a welcome note. Admins can review subscribers in the editor desk. |
| Real-time | Socket.IO is enabled with the API; article rooms receive comments/reactions and connected readers receive notifications. |
| Google/Facebook sign-in | Set the provider client/app ID, secret, and callback URL in `server/.env`, then register the callback URLs in each provider console. |
| Sourced news sync | Set `GNEWS_API_KEY`, then sign in as an editor/admin and choose **Desk → Sync 300 latest stories**. The free GNews tier allows 10 articles per request with a 12-hour delay; stories are stored with source links in the nine requested sections. |

Instagram is shown on the sign-in page with a platform note. Meta's Instagram API login is for professional account integrations and does not provide general consumer-reader sign-in.

For production, configure HTTPS, production CORS origins, managed secret storage, backups, monitoring, and a deployment build. Rotate any database credentials that were exposed during setup.

## API outline

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a reader account |
| POST | `/api/auth/login` | Public | Sign in and receive JWT |
| GET | `/api/auth/google` | Public | Start Google OAuth sign-in |
| GET | `/api/auth/me` | Reader | Return current account |
| PATCH | `/api/auth/me` | Reader | Update profile name |
| PATCH | `/api/auth/me/password` | Reader | Change password |
| GET | `/api/articles` | Public | List/search/filter published stories |
| GET | `/api/articles/:id` | Public | Read a story |
| POST | `/api/articles` | Editor | Create an article |
| PATCH | `/api/articles/:id` | Editor | Update an article |
| DELETE | `/api/articles/:id` | Editor | Delete an article |
| POST | `/api/articles/:id/reactions` | Reader | Toggle like/dislike |
| POST | `/api/articles/:id/comments` | Reader | Add a comment |
| GET | `/api/articles/manage` | Editor | List drafts and published stories |
| POST | `/api/articles/sync/news` | Editor | Import current provider headlines into all nine sections |
| GET/POST | `/api/categories` | Public / Editor | List or create sections |
| PATCH/DELETE | `/api/categories/:id` | Editor | Manage sections |
| POST | `/api/media/image` | Editor | Upload a cover image to Cloudinary |
| POST | `/api/ai/articles/:id/summary` | Editor | Generate and save a Gemini summary |
| GET/PATCH | `/api/notifications` | Reader | Read notifications and mark them read |
| GET/PATCH | `/api/admin/users` | Admin | Manage reader/editor/admin roles |
| POST | `/api/newsletter/subscribe` | Public | Subscribe an email to the Nova Brief |

## Design direction

The interface takes visual direction from a clean, purple-accented e-newspaper: a compact masthead and section navigation, a breaking-news lead with image cards, a latest-news feed, and a discovery sidebar for categories and trending stories. `client/src/pulse.css` contains the responsive layout and color tokens; `client/src/styles.css` retains the shared article, account, and editor modal styles.

## Project structure

```text
client/                 React + Vite frontend
  src/App.jsx           Homepage, accounts, article reader, editor desk, and interactions
  src/pulse.css         Reference-inspired responsive newspaper layout
  src/admin.css         Admin desk, notifications, and profile styling
server/                 Express API
  src/models/            MongoDB User, Article, Category, and Notification models
  src/routes/            Auth, content, media, AI, categories, notifications, and admin APIs
  src/services/          Email and notification delivery
  src/middleware/        JWT, editor, and admin authorization
  src/seed.js            Local sample data
```
