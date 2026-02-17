# Local Development & Testing Guide

This guide covers the steps to set up, run, and verify the EdenNote AI project on your local machine.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

1.  **Node.js** (v18 or higher)
2.  **pnpm** (v8 or higher)
3.  **Redis** (Used for BullMQ job processing)
    - Mac: `brew install redis && brew services start redis`
4.  **Supabase Project**
    - Create a new project at [supabase.com](https://supabase.com).
    - Run the migrations found in `packages/supabase/migrations/` in the Supabase SQL Editor.

## ⚙️ Setup Instructions

### 1. Environment Variables

You must create `.env` files for each application. Copy the examples:

```bash
# Web App
cp apps/web/.env.example apps/web/.env

# API Server
cp apps/api/.env.example apps/api/.env

# Worker Service
cp apps/worker/.env.example apps/worker/.env
```

**Fill in the following keys:**

- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASSEMBLYAI_API_KEY` (Get from [assemblyai.com](https://www.assemblyai.com/))
- `LLM_API_KEY` (OpenAI or compatible provider)

### 2. Install Dependencies

Run the following in the root directory:

```bash
pnpm install
```

## 🚀 Running the Project

To start all services (Web, API, Worker) in dev mode:

```bash
pnpm dev
```

- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:3001](http://localhost:3001)

## 🧪 Testing Workflow

To verify the core AI functionality, follow these steps:

1.  **Sign Up / Login**: Go to [localhost:3000/login](http://localhost:3000/login) and create an account.
2.  **Dashboard**: You will be redirected to the dashboard after login.
3.  **Upload a Meeting**:
    - Click **"Upload Recording"**.
    - Select an MP3 or WAV file.
    - Click **"Process Recording"**.
4.  **Real-time Tracking**:
    - You will be redirected to the Meeting Detail page.
    - You should see the **Status Stepper** moving through: `Uploaded` → `Transcribing` → `Summarizing` → `Ready`.
5.  **Review Insights**:
    - Once `Ready`, verify the **Transcript**, **Executive Summary**, and **Action Items** are visible.
    - Try editing a line in the transcript to test real-time synchronization.
6.  **Test Exports**:
    - Click the **"Export"** button.
    - Select **PDF** or **DOCX**.
    - Verify the export appears in the **"Recent Exports"** list and is downloadable.

---

> [!TIP]
> **Debugging Webhooks**: For local transcription webhooks, use a tool like **ngrok** to expose your local API port (3001) and set the `BASE_WEBHOOK_URL` in your `.env` to the ngrok URL.
