import os
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model, PeftModel
import torch
from pathlib import Path
import json

# CONFIGURATION - Using Mistral as base model
BASE_MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.2"
DATA_FILE = "data/pairs.jsonl"
BASE_OUTPUT_DIR = "outputs/tone_of_voice_lora"
MAX_LENGTH = 512

def load_and_prepare_dataset(user_id: str, account_id: str):
    """
    Loads data/pairs.jsonl with fields 'draft' and 'final'
    Filters for specific user/account and formats for Causal-Language-Model.
    """
    if not os.path.exists(DATA_FILE):
        raise FileNotFoundError(f"{DATA_FILE} not found. Collect data first with log_pair().")

    # Load all data
    all_data = []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        for line in f:
            try:
                record = json.loads(line)
                # Filter for this user/account
                if record.get("userId") == user_id and record.get("accountId") == account_id:
                    all_data.append(record)
            except:
                continue

    if len(all_data) < 10:
        raise ValueError(f"Need at least 10 examples. Found {len(all_data)} for user {user_id}, account {account_id}")

    # Create temporary JSON file for this user
    temp_file = f"data/temp_{user_id}_{account_id}.jsonl"
    with open(temp_file, "w", encoding="utf-8") as f:
        for record in all_data:
            f.write(json.dumps({"draft": record["draft"], "final": record["final"]}, ensure_ascii=False) + "\n")

    ds = load_dataset("json", data_files={"train": temp_file})

    def format_example(example):
        draft = example["draft"].strip()
        final = example["final"].strip()

        full_text = (
            "You are an email assistant. "
            "You receive a draft email reply and should rewrite it to match the user's writing style.\n"
            "IMPORTANT: Keep the exact meaning and content. Only change the style to match the user's preferences.\n\n"
            "Draft reply:\n"
            f"{draft}\n\n"
            "Revised version:\n"
            f"{final}"
        )
        return {"text": full_text}

    ds = ds.map(format_example)
    
    # Clean up temp file
    if os.path.exists(temp_file):
        os.remove(temp_file)
    
    return ds

def tokenize_dataset(dataset, tokenizer):
    def tokenize_fn(example):
        text = example["text"]
        
        # Find the position where "Revised version:" ends
        prompt_end_marker = "Revised version:\n"
        prompt_end = text.find(prompt_end_marker)
        
        if prompt_end == -1:
            # Fallback: use entire text
            encoded = tokenizer(text, max_length=MAX_LENGTH, truncation=True)
            encoded["labels"] = encoded["input_ids"].copy()
            return encoded
        
        # Split text into prompt and final
        prompt_text = text[:prompt_end + len(prompt_end_marker)]
        final_text = text[prompt_end + len(prompt_end_marker):]
        
        # Tokenize prompt and final separately
        prompt_encoded = tokenizer(prompt_text, add_special_tokens=True)
        final_encoded = tokenizer(final_text, add_special_tokens=False)
        
        # Combine (without duplicate special tokens)
        input_ids = prompt_encoded["input_ids"] + final_encoded["input_ids"]
        attention_mask = prompt_encoded["attention_mask"] + final_encoded["attention_mask"]
        
        # Truncate if too long
        if len(input_ids) > MAX_LENGTH:
            input_ids = input_ids[:MAX_LENGTH]
            attention_mask = attention_mask[:MAX_LENGTH]
        
        # Labels: -100 for prompt part (ignored in loss), real IDs for final part
        prompt_length = len(prompt_encoded["input_ids"])
        labels = [-100] * prompt_length + input_ids[prompt_length:]
        
        # Ensure labels same length as input_ids
        if len(labels) > len(input_ids):
            labels = labels[:len(input_ids)]
        elif len(labels) < len(input_ids):
            labels = labels + [-100] * (len(input_ids) - len(labels))
        
        return {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "labels": labels,
        }

    tokenized = dataset.map(
        tokenize_fn,
        batched=False,
        remove_columns=dataset["train"].column_names,
    )
    tokenized.set_format(type="torch")
    return tokenized

def create_lora_model(user_id: str, account_id: str):
    """Create or load LoRA model for specific user/account"""
    output_dir = Path(BASE_OUTPUT_DIR) / f"{user_id}_{account_id}"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load base Mistral model
    print(f"Loading base model: {BASE_MODEL_NAME}")
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else "cpu",
        low_cpu_mem_usage=True,
    )

    # If adapter already exists, load and continue training
    adapter_config_path = output_dir / "adapter_config.json"
    if adapter_config_path.exists():
        print(f"Loading existing LoRA adapter from {output_dir}...")
        model = PeftModel.from_pretrained(
            base_model,
            str(output_dir),
            is_trainable=True,
        )
        model.print_trainable_parameters()
        return model, str(output_dir)

    # Otherwise create new LoRA adapter
    print("Creating new LoRA adapter...")
    lora_config = LoraConfig(
        r=64,  # Higher rank for better quality
        lora_alpha=128,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    model = get_peft_model(base_model, lora_config)
    model.print_trainable_parameters()
    return model, str(output_dir)

def train_model(user_id: str, account_id: str):
    """Train model for specific user/account"""
    print(f"Starting training for user {user_id}, account {account_id}")
    
    dataset = load_and_prepare_dataset(user_id, account_id)

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    tokenized = tokenize_dataset(dataset, tokenizer)
    model, output_dir = create_lora_model(user_id, account_id)

    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,  # Effective batch size = 4
        learning_rate=5e-5,
        num_train_epochs=15,
        logging_steps=5,
        save_strategy="epoch",
        fp16=torch.cuda.is_available(),
        bf16=False,
        optim="adamw_torch",
        warmup_steps=30,
        save_total_limit=3,
        lr_scheduler_type="cosine",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
    )

    trainer.train()
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"Training complete. Adapter saved to {output_dir}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python train_tone_of_voice.py <user_id> <account_id>")
        sys.exit(1)
    
    train_model(sys.argv[1], sys.argv[2])

