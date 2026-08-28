# SWGoHBotSite

The website for [swgohbot.com](https://swgohbot.com/) — a Discord bot for Star Wars Galaxy of Heroes.

Built with Express.js, EJS templates, and TypeScript. Features a public information site plus a Discord-authenticated dashboard for viewing user and guild configurations.

## Features

- Public pages: home, about, commands, FAQs, terms of service, privacy policy
- Dynamic commands page loaded from bot data files
- Discord OAuth2 login
- User dashboard showing linked accounts and arena watch settings
- Guild config viewer and editor for server managers (requires Manage Server permission or an admin role)
- Guild events CRUD — admins can add, edit, and delete scheduled events

## Setup

### Prerequisites

- Node.js 25.2+ (native TypeScript support — no build step required)
- MongoDB instance (shared with the bot)
- A Discord application with OAuth2 configured

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3300
NODE_ENV=development
BOT_DATA_PATH=/path/to/bot/data/help.json
BOT_SCHEMAS_PATH=/path/to/bot/schemas
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3300/callback
DISCORD_BOT_TOKEN=your_bot_token
MONGODB_URI=mongodb://localhost:27017
MONGODB_BOT_DB=your_bot_db_name
MONGODB_SWAPI_DB=your_swapi_db_name
SESSION_SECRET=a_random_secret_at_least_16_chars
ADMIN_DISCORD_ID=your_discord_user_id
EXTRAS_PATHS=/absolute/path/to/plugin
```

`BOT_DATA_PATH` is a path to the bot's `help.json` file, not to the directory containing it.
`BOT_SCHEMAS_PATH` is a directory, and must be the bot's real `schemas/` directory inside its
checkout: `schemas/index.ts` re-exports from `../data/constants/` and resolves `discord.js` and
`zod` from the bot's own `node_modules`, so a copy of the schema files alone will not load.

`EXTRAS_PATHS` is optional (comma-separated absolute paths). Plugins listed there supply their own
environment variables in addition to the above.

### Running the Application

```bash
# Install dependencies
npm install

# Development (with file watching)
npm run dev

# Production
npm start

# Run integration tests
npm test
```

### Running with Docker

Production runs in a container. MongoDB stays on the host, so **both** Mongo connection strings
must point at `host.docker.internal` rather than `localhost` — `MONGODB_URI` for the site, and
`MOVIE_MONGODB_URI` for the MovieChecker plugin, which opens its own connection.

```bash
docker compose up -d                            # start
docker compose logs -f                          # follow logs
docker compose up -d --build                    # rebuild from local sources
docker compose pull && docker compose up -d     # deploy a published image
```

`BOT_SCHEMAS_PATH`, `BOT_DATA_PATH` and `EXTRAS_PATHS` are set by `docker-compose.yml` to their
in-container paths and override whatever `.env` holds, so one `.env` works both in Docker and
under a local `npm start`.

To run a second instance alongside an existing one, set `HOST_PORT` — it moves only the published
port, leaving the app bound to `PORT` inside the container:

```bash
HOST_PORT=3301 docker compose up -d
```

### Code Quality

```bash
# Check formatting and linting
npx @biomejs/biome check .

# Fix issues automatically
npx @biomejs/biome check --write .
```

## Architecture

- **server.ts** — Entry point; starts HTTP server, handles graceful shutdown
- **app.ts** — `createApp()` factory; assembles middleware and mounts routes
- **middleware/** — Rate limiting, Helmet/CSP security, session setup
- **routes/** — Route handlers split by feature area (public, auth, userConfig, guildSelect, guildConfig, guildEvents)
- **modules/** — Server-side logic (auth, database, bot API, command service, form schemas, etc.)
- **pages/** — EJS page templates
- **partials/** — Reusable EJS components (nav, head, footer, flash)
- **public/** — Static assets (CSS, JS, images)
- **types/** — TypeScript type declarations
- **test/** — Integration tests (Node.js built-in test runner + Testcontainers)
