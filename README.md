# RepoSort

RepoSort is a full-stack repository analysis platform with a Next.js frontend and a NestJS backend. The backend manages ingestion, graph generation, planning, analysis, verification, and workflow execution. The frontend provides the user interface for browsing repositories and viewing project-level outputs.

## Index

- [Project Contents](#project-contents)
- [Installation](#installation)
- [Running the Project](#running-the-project)

## Project Contents

- `g-frontend/`
  Next.js frontend built with React, TypeScript, Tailwind CSS, React Flow, and Dagre.
- `g-backend/`
  NestJS backend built with TypeScript, Prisma, PostgreSQL, BullMQ, Redis, and Gemini-based LLM services.
- `g-backend/prisma/`
  Prisma schema and database migrations.
- `g-frontend/app/`
  App Router pages and shared frontend layout.
- `g-backend/src/`
  Backend modules for projects, ingestion, graph, analysis, planning, runs, diffs, governance, queues, storage, and agent workflows.

## Installation

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL
- Redis

### 1. Clone the repository

```bash
git clone https://github.com/channi23/RepoSort.git
cd RepoSort
```

### 2. Install frontend dependencies

```bash
cd g-frontend
npm install
```

### 3. Install backend dependencies

```bash
cd ../g-backend
npm install
```

### 4. Configure backend environment

Create `g-backend/.env`:

```env
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/reposort
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_REQUIRED=true
GEMINI_DEBUG_SOURCE=false
SANDBOX_ROOT=../sandboxes
ARTIFACTS_ROOT=../artifacts
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### 5. Configure frontend environment

Create `g-frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_DEV_SOURCE_ATTRIBUTION=false
```

### 6. Apply database migrations

```bash
cd g-backend
npx prisma migrate deploy
```

## Running the Project

### 1. Start PostgreSQL and Redis

Make sure both services are running before starting the backend.

### 2. Start the backend

```bash
cd g-backend
npm run start:dev
```

Backend runs on `http://localhost:3000`.

### 3. Start the frontend

```bash
cd g-frontend
npm run dev
```

Frontend runs on `http://localhost:3001`.

### 4. Open the application

- Frontend home: `http://localhost:3001`
- Repository explorer route: `http://localhost:3001/repos/<projectId>`
