<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Peterleoo/food)

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/900a6a4c-ac15-493e-97c1-9aecb7bc9d09

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Netlify

Click the **Deploy to Netlify** button above, or import this repository in Netlify manually.

Netlify uses [`netlify.toml`](netlify.toml):

- Build command: `npm run build`
- Publish directory: `dist`
- SPA fallback: all routes redirect to `index.html`

Optional environment variables:

- `VITE_GEMINI_API_KEY`: default Gemini key used by the frontend if the user has not configured an API key in settings.
