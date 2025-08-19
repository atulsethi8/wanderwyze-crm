# Development Environment Setup

To run your CRM application locally for development and preview, follow these steps:

## 1. Create Environment Variables File

Create a file named `.env.local` in your project root with the following content:

```env
# Development Environment Variables
# Replace these placeholder values with your actual API keys

# Supabase Credentials (User defined prefix, e.g. VITE_)
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Google Gemini API Key (MUST be named API_KEY)
API_KEY=YOUR_GOOGLE_GEMINI_API_KEY

# Alternative Gemini API Key name (also supported)
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
```

## 2. Get Your API Keys

### Supabase Setup
1. Go to [Supabase](https://supabase.com) and create a new project
2. Once created, go to Settings > API
3. Copy your Project URL and paste it as `VITE_SUPABASE_URL`
4. Copy your anon/public key and paste it as `VITE_SUPABASE_ANON_KEY`

### Google Gemini API Setup
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and paste it as `API_KEY` (or `GEMINI_API_KEY`)

## 3. Start Development Server

After setting up your environment variables:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`

## 4. Development Workflow

1. Make changes to your code
2. The development server will automatically reload
3. Preview your changes in the browser
4. Test functionality before committing
5. When ready, commit and push to GitHub

## 5. Important Notes

- The `.env.local` file is automatically ignored by Git
- Never commit your actual API keys to version control
- For production deployment, set these environment variables in your hosting platform (Netlify, Vercel, etc.)
- The application will show an error screen if any required environment variables are missing

## 6. Troubleshooting

If you see the "Environment Variables Not Set" error:
1. Make sure your `.env.local` file exists in the project root
2. Verify all required variables are set
3. Restart the development server after making changes to environment variables
4. Check that there are no extra spaces or quotes around your API keys

