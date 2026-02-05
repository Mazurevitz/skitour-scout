# SkitourScout Deployment Guide

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Node.js 18+ installed
- A Supabase account (free tier works)
- An OpenRouter API key (for LLM features)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Fill in:
   - **Name:** `skitour-scout`
   - **Database Password:** (save this somewhere safe)
   - **Region:** Choose closest to Poland (e.g., `eu-central-1`)
4. Wait for project to be created (~2 minutes)

Once created, note down:
- **Project URL:** `https://YOUR_PROJECT_ID.supabase.co`
- **Anon Key:** Found in Settings → API → `anon` `public` key

---

## Step 2: Set Up Database

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/20240101000000_initial_schema.sql`
4. Paste into the editor
5. Click **Run**

You should see "Success. No rows returned" - this means the tables and policies were created.

### Verify Tables Created

Go to **Table Editor** - you should see:
- `profiles`
- `reports`
- `rate_limits`
- `app_settings`

---

## Step 3: Configure OAuth Providers

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth client ID**
5. Select **Web application**
6. Add to **Authorized redirect URIs:**
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client Secret**

8. In Supabase Dashboard:
   - Go to **Authentication → Providers**
   - Enable **Google**
   - Paste the Client ID and Client Secret
   - Save

### Facebook OAuth (Optional)

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app → Select **Consumer**
3. Add **Facebook Login** product
4. Go to **Settings → Basic** to get App ID and App Secret
5. In **Facebook Login → Settings**, add to Valid OAuth Redirect URIs:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```

6. In Supabase Dashboard:
   - Go to **Authentication → Providers**
   - Enable **Facebook**
   - Paste App ID and App Secret
   - Save

---

## Step 4: Deploy Edge Functions

### 4.1 Link Your Project

```bash
# Login to Supabase CLI
supabase login

# Link to your project (run from project root)
cd /Volumes/external_storage/Personal/Projects/skitour-scout
supabase link --project-ref YOUR_PROJECT_ID
```

### 4.2 Set Secrets

```bash
# Set OpenRouter API key (required for LLM features)
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 4.3 Deploy Functions

```bash
# Deploy all Edge Functions at once
supabase functions deploy search-proxy
supabase functions deploy topr-proxy
supabase functions deploy llm-proxy
supabase functions deploy submit-report
```

### 4.4 Verify Deployment

Go to Supabase Dashboard → **Edge Functions**

You should see 4 functions listed:
- ✅ `search-proxy`
- ✅ `topr-proxy`
- ✅ `llm-proxy`
- ✅ `submit-report`

---

## Step 5: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example
cp .env.example .env
```

Edit `.env` with your values:

```env
# Supabase (from Step 1)
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App Settings
VITE_DEFAULT_REGION=tatry
VITE_REFRESH_INTERVAL=300000
```

---

## Step 6: Test Locally

```bash
# Install dependencies (if not done)
npm install

# Start dev server
npm run dev
```

### Test Checklist

Open http://localhost:5173 and verify:

- [ ] App loads without console errors
- [ ] Weather data appears (Open-Meteo - no auth needed)
- [ ] Click login button → OAuth modal appears
- [ ] Sign in with Google → Redirects back, shows avatar
- [ ] Submit a report → Should work (check Supabase Table Editor)
- [ ] Try submitting again within 30 min → Should show rate limit error
- [ ] Sign out → Avatar becomes login button

---

## Step 7: Build & Deploy Frontend

### Option A: Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) and import project
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_DEFAULT_REGION`
   - `VITE_REFRESH_INTERVAL`
4. Deploy

### Option B: Netlify

1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com) and import project
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables (same as above)
6. Deploy

### Option C: Manual Build

```bash
npm run build
# Upload contents of `dist/` folder to any static hosting
```

---

## Step 8: Update OAuth Redirect URLs

After deploying, update OAuth providers with your production URL:

### Google Cloud Console
Add to Authorized redirect URIs:
```
https://your-app.vercel.app
```

### Supabase Dashboard
Go to **Authentication → URL Configuration**:
- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** Add `https://your-app.vercel.app/**`

---

## Step 9: Create Admin User

1. Sign in to your app with your Google account
2. Go to Supabase Dashboard → **Table Editor → profiles**
3. Find your user row
4. Edit and set `is_admin` to `true`
5. Save

Now when you refresh the app, you'll see the Admin panel option.

---

## Troubleshooting

### "Supabase is not configured" error
- Check that `.env` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after changing `.env`

### OAuth redirect fails
- Verify redirect URL in Google/Facebook matches exactly
- Check Supabase Authentication → URL Configuration

### Edge Function errors
Check logs:
```bash
supabase functions logs search-proxy
supabase functions logs llm-proxy
```

### Rate limit not working
- Check `rate_limits` table in Supabase
- Verify `submit-report` function is deployed

### LLM features not working
- Verify `OPENROUTER_API_KEY` secret is set:
  ```bash
  supabase secrets list
  ```
- Check `llm-proxy` logs for errors

---

## Quick Reference

| Service | Dashboard URL |
|---------|---------------|
| Supabase | https://supabase.com/dashboard/project/YOUR_PROJECT_ID |
| Google OAuth | https://console.cloud.google.com/apis/credentials |
| Facebook OAuth | https://developers.facebook.com/apps |
| OpenRouter | https://openrouter.ai/keys |

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `supabase functions deploy <name>` | Deploy Edge Function |
| `supabase functions logs <name>` | View function logs |
| `supabase secrets set KEY=value` | Set secret |
