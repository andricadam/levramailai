# Tone of Voice Fine-Tuning Service

This service fine-tunes Mistral-7B-Instruct to match user writing styles based on instant reply feedback.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run locally:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Deployment on Railway

1. Connect your GitHub repo to Railway
2. Railway will auto-detect Python and install dependencies
3. The service will be available at `your-service.railway.app`

## API Endpoints

- `POST /api/log-pair` - Log a draft/final pair for training
- `POST /api/revise` - Revise a draft using fine-tuned model
- `POST /api/trigger-fine-tuning` - Start training
- `GET /api/status/{user_id}/{account_id}` - Get training status

## Environment Variables

- `PORT` - Port to run on (Railway sets this automatically)
- `BASE_MODEL` - Base model name (default: mistralai/Mistral-7B-Instruct-v0.2)

