<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 今日餐食

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Peterleoo/food)

一个通过 vibecoding 持续迭代出来的每日餐食应用，支持今日餐单、自定义食谱、买菜清单、本地数据导入导出和 AI 辅助生成。

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
