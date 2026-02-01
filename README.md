<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1bGZkKmC6jmBliIBVHwLokUswJthGW5dr

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Cloud Run

Deploy the app to Google Cloud Run:

```bash
gcloud run deploy technoir-transmission-engine \
  --source . \
  --region us-west1 \
  --platform managed \
  --allow-unauthenticated
```

Live at: https://technoir-transmission-engine-gnr2sr6nsa-uw.a.run.app
