<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1n4u3YCACxIt8i22wrRVrYnhcijkyunda

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## NirogAI Provider Config

NirogAI uses an OpenAI-compatible provider proxy. Swap providers by changing environment variables only:

```env
AI_PROVIDER_URL=https://integrate.api.nvidia.com/v1
AI_API_KEY=nvapi-placeholder
AI_MODEL_SUMMARIZER=nvidia/llm-jp-3-13b-instruct
AI_MODEL_SCRIBE=deepseek-ai/deepseek-r1
AI_MODEL_DRUG_CHECKER=deepseek-ai/deepseek-r1
AI_MODEL_PATIENT_CARD=mistralai/mistral-7b-instruct-v0.3
AI_FEATURE_SUMMARIZER=true
AI_FEATURE_SCRIBE=true
AI_FEATURE_DRUG_CHECKER=true
AI_FEATURE_PATIENT_CARD=true
```

Set `AI_TRANSCRIPTION_URL` only when a Whisper-compatible endpoint is available. If it is not set, the SOAP scribe accepts typed transcripts as a fallback. AI output is stored against `front_desk_id` only; patient names, phone numbers, email addresses, and addresses must never be sent to external AI providers.
