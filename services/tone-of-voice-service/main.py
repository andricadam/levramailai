from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from pathlib import Path
from datetime import datetime
import os
import asyncio
from train_tone_of_voice import train_model
from revise_response import rewrite_draft, load_model_and_tokenizer

app = FastAPI()

# CORS middleware to allow Next.js to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data storage
DATA_PATH = Path("data/pairs.jsonl")
DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR = "outputs/tone_of_voice_lora"
OUTPUT_DIR_PATH = Path(OUTPUT_DIR)
OUTPUT_DIR_PATH.mkdir(parents=True, exist_ok=True)

# Model cache per user
_model_cache = {}  # {f"{user_id}_{account_id}": (model, tokenizer)}

class DraftFinalPair(BaseModel):
    draft: str
    final: str
    userId: str
    accountId: str

class RevisionRequest(BaseModel):
    draft_text: str
    userId: str
    accountId: str

class TrainingStatus(BaseModel):
    userId: str
    accountId: str

@app.get("/")
async def root():
    return {
        "status": "Tone of Voice Service is running",
        "service": "instant-reply-fine-tuning",
        "base_model": "mistralai/Mistral-7B-Instruct-v0.2"
    }

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.post("/api/log-pair")
async def log_pair(pair: DraftFinalPair):
    """Store a draft/final pair for training"""
    try:
        record = {
            "draft": pair.draft,
            "final": pair.final,
            "userId": pair.userId,
            "accountId": pair.accountId,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        with DATA_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        
        count = count_pairs()
        return {
            "status": "logged",
            "count": count,
            "message": f"Pair logged successfully. Total pairs: {count}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log pair: {str(e)}")

@app.post("/api/revise")
async def revise_draft(request: RevisionRequest):
    """Revise a draft using the fine-tuned Mistral model"""
    cache_key = f"{request.userId}_{request.accountId}"
    
    try:
        # Check if model exists for this user
        user_output_dir = OUTPUT_DIR_PATH / f"{request.userId}_{request.accountId}"
        
        if not user_output_dir.exists() or not (user_output_dir / "adapter_config.json").exists():
            # No fine-tuned model yet, return original
            return {
                "revised": request.draft_text,
                "model_used": "none",
                "message": "No fine-tuned model available yet. Training will start when enough data is collected."
            }
        
        # Load model from cache or disk
        if cache_key not in _model_cache:
            print(f"Loading model for user {request.userId}, account {request.accountId}")
            model, tokenizer = load_model_and_tokenizer(str(user_output_dir))
            _model_cache[cache_key] = (model, tokenizer)
        
        model, tokenizer = _model_cache[cache_key]
        
        # Revise the draft
        revised = rewrite_draft(request.draft_text, model, tokenizer)
        
        return {
            "revised": revised,
            "model_used": "mistral-fine-tuned",
            "original_length": len(request.draft_text),
            "revised_length": len(revised)
        }
    except Exception as e:
        print(f"Error revising draft: {e}")
        # Fallback to original if revision fails
        return {
            "revised": request.draft_text,
            "model_used": "fallback",
            "error": str(e)
        }

@app.post("/api/trigger-fine-tuning")
async def trigger_fine_tuning(status: TrainingStatus):
    """Trigger fine-tuning for a specific user/account"""
    try:
        count = count_pairs_for_user(status.userId, status.accountId)
        
        if count < 10:  # Minimum examples needed
            return {
                "status": "insufficient_data",
                "count": count,
                "message": f"Need at least 10 examples. Currently have {count}."
            }
        
        # Run training in background
        asyncio.create_task(train_for_user(status.userId, status.accountId))
        
        return {
            "status": "started",
            "count": count,
            "message": f"Fine-tuning started with {count} examples. This may take several minutes."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger fine-tuning: {str(e)}")

@app.get("/api/status/{user_id}/{account_id}")
async def get_status(user_id: str, account_id: str):
    """Get training status for a user/account"""
    try:
        count = count_pairs_for_user(user_id, account_id)
        user_output_dir = OUTPUT_DIR_PATH / f"{user_id}_{account_id}"
        model_exists = user_output_dir.exists() and (user_output_dir / "adapter_config.json").exists()
        
        return {
            "pairs_count": count,
            "model_exists": model_exists,
            "model_loaded": f"{user_id}_{account_id}" in _model_cache,
            "ready_for_training": count >= 10
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")

async def train_for_user(user_id: str, account_id: str):
    """Background task to train model for a user"""
    try:
        print(f"Starting training for user {user_id}, account {account_id}")
        train_model(user_id, account_id)
        
        # Clear cache to force reload
        cache_key = f"{user_id}_{account_id}"
        if cache_key in _model_cache:
            del _model_cache[cache_key]
        
        print(f"Training completed for user {user_id}, account {account_id}")
    except Exception as e:
        print(f"Training failed for user {user_id}, account {account_id}: {e}")

def count_pairs():
    """Count total pairs in data file"""
    if not DATA_PATH.exists():
        return 0
    try:
        with DATA_PATH.open("r", encoding="utf-8") as f:
            return sum(1 for _ in f)
    except:
        return 0

def count_pairs_for_user(user_id: str, account_id: str):
    """Count pairs for a specific user/account"""
    if not DATA_PATH.exists():
        return 0
    try:
        count = 0
        with DATA_PATH.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    record = json.loads(line)
                    if record.get("userId") == user_id and record.get("accountId") == account_id:
                        count += 1
                except:
                    continue
        return count
    except:
        return 0

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

