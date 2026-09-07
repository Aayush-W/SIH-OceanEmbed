# OceanEmbed SIH

OceanEmbed SIH is organized as a two-part application:

```text
OceanEmbed SIH/
├── client/                 # Frontend application
│   ├── public/              # Static assets
│   └── src/
│       ├── assets/          # Images, fonts, and other assets
│       ├── components/      # Reusable UI components
│       ├── pages/            # Page-level views
│       ├── services/         # API and external-service clients
│       └── styles/           # Global and shared styles
├── server/                 # Backend application
│   ├── src/
│   │   ├── config/           # Environment and application configuration
│   │   ├── controllers/      # Request handlers
│   │   ├── middleware/       # Authentication, validation, and errors
│   │   ├── models/           # Database models and schemas
│   │   ├── routes/           # API route definitions
│   │   ├── services/         # Business logic and integrations
│   │   └── utils/            # Shared backend utilities
│   └── tests/                # Backend tests
├── .env.example              # Environment variable template
└── README.md
```

## Prerequisites

- Git
- Node.js 18 or newer
- npm 9 or newer

```bash
node --version
npm --version
```

## Installation

```bash
cd client
npm install
cd ../server
npm install
```

Create local environment files when the templates are added:

```bash
copy client/.env.example client/.env
copy server/.env.example server/.env
```

On macOS/Linux, use `cp` instead of `copy`.

## Running the project

Run the frontend in one terminal:

```bash
cd client
npm run dev
```

Run the backend in a second terminal:

```bash
cd server
npm run dev
```

## Production

```bash
cd client
npm run build
cd ../server
npm start
```

## Testing and linting

```bash
cd client
npm test
npm run lint
cd ../server
npm test
npm run lint
```

If a script is not present in a package's `package.json`, add it before running the command.

## Environment variables

Never commit `.env` files. Add required keys to `.env.example`, then create a local `.env` for development. Typical values include the backend port, frontend API base URL, database connection string, and authentication secrets.

## Git workflow

```bash
git status
git add .
git commit -m "Set up client and server architecture"
```

