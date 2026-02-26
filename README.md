# SWGoHBotSite

The website for [swgohbot.com](https://swgohbot.com/) — a Discord bot for Star Wars Galaxy of Heroes.

Built with Express.js, EJS templates, and TypeScript. Features a public information site plus a Discord-authenticated dashboard for viewing user and guild configurations.

## Features

- Public pages: home, about, commands, FAQs, terms of service, privacy policy
- Dynamic commands page loaded from bot data files
- Discord OAuth2 login
- User dashboard showing linked accounts and arena watch settings
- Guild config viewer for server managers (requires Manage Server permission or an admin role)

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
BOT_DATA_PATH=/path/to/bot/data
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3300/callback
MONGODB_URI=mongodb://localhost:27017
MONGODB_BOT_DB=your_bot_db_name
MONGODB_SWAPI_DB=your_swapi_db_name
SESSION_SECRET=a_random_secret_at_least_16_chars
DISCORD_BOT_TOKEN=your_bot_token
```

### Running the Application

```bash
# Install dependencies
npm install

# Development (with file watching)
npm run dev

# Production
npm start
```

### Code Quality

```bash
# Check formatting and linting
npx @biomejs/biome check .

# Fix issues automatically
npx @biomejs/biome check --write .
```

## Architecture

- **website.ts** — Main entry point; all routes and middleware
- **modules/** — Server-side logic (auth, database, bot API, command service, etc.)
- **pages/** — EJS page templates
- **partials/** — Reusable EJS components (nav, head, footer)
- **public/** — Static assets (CSS, JS, images)
- **types/** — TypeScript type declarations
