# Deployment Guide for Tone of Voice Service

## What's Been Set Up

✅ Python service with FastAPI
✅ Mistral-7B-Instruct as base model
✅ LoRA fine-tuning for user-specific style
✅ Integration with instant reply system
✅ Automatic feedback loop

## Files Created

1. **main.py** - FastAPI service with endpoints
2. **train_tone_of_voice.py** - Training script with Mistral
3. **revise_response.py** - Model loading and revision
4. **requirements.txt** - Python dependencies
5. **Procfile** - Railway deployment config
6. **runtime.txt** - Python version

## Next Steps

### 1. Push to GitHub

All files are ready! You can now:
```bash
git add .
git commit -m "Add tone of voice fine-tuning service"
git push
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Sign up/login
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect the Python service in `services/tone-of-voice-service/`
6. Set the root directory to `services/tone-of-voice-service/` in Railway settings
7. Railway will automatically:
   - Install dependencies from `requirements.txt`
   - Run the service using `Procfile`
   - Give you a URL like `your-service.railway.app`

### 3. Update Environment Variables

In your Next.js app (Vercel), add:
```
NEXT_PUBLIC_TONE_OF_VOICE_SERVICE_URL=https://your-service.railway.app
```

Or in `.env.local`:
```
TONE_OF_VOICE_SERVICE_URL=https://your-service.railway.app
```

### 4. Run Database Migration

After pushing, run:
```bash
npx prisma migrate dev --name add_instant_reply_feedback
```

This creates the `InstantReplyFeedback` table.

## How It Works

1. **User clicks "Instant Reply"**
   - GPT-4 generates initial reply
   - Fine-tuned Mistral revises it (if model exists)
   - Generated reply stored in database

2. **User edits and sends email**
   - System compares generated vs final
   - Logs draft/final pair to Python service
   - Triggers fine-tuning when enough data (10+ pairs)

3. **Fine-tuning happens**
   - Python service trains Mistral LoRA adapter
   - Model learns user's writing style
   - Next replies get better automatically

## Testing Locally (Optional)

Before deploying, you can test locally:

```bash
cd services/tone-of-voice-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then update `.env.local`:
```
TONE_OF_VOICE_SERVICE_URL=http://localhost:8000
```

## Important Notes

- **First training**: Needs at least 10 draft/final pairs
- **Training time**: Can take 10-30 minutes depending on data size
- **Model storage**: Adapters stored per user/account in `outputs/` directory
- **Railway storage**: Consider adding persistent storage for model files

## Troubleshooting

If Railway deployment fails:
1. Check logs in Railway dashboard
2. Ensure `Procfile` is in `services/tone-of-voice-service/`
3. Verify Python version in `runtime.txt` (3.10)
4. Check that all dependencies are in `requirements.txt`

