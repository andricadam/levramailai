import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from pathlib import Path

BASE_MODEL_NAME = "mistralai/Mistral-7B-Instruct-v0.2"

def load_model_and_tokenizer(adapter_path: str):
    """
    Loads:
    - Base Mistral model
    - LoRA adapter from adapter_path
    - Tokenizer
    """
    print(f"Loading model from {adapter_path}")
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(adapter_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load base Mistral model
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else "cpu",
        low_cpu_mem_usage=True,
    )

    # Load LoRA adapter
    model = PeftModel.from_pretrained(
        base_model,
        adapter_path,
        is_trainable=False,  # Only inference
    )

    model.eval()
    return model, tokenizer

def rewrite_draft(draft_text: str, model, tokenizer) -> str:
    """
    Takes a draft reply and returns a revised version
    in the learned style.
    """
    prompt = (
        "You are an email assistant. "
        "You receive a draft email reply and should rewrite it to match the user's writing style.\n"
        "IMPORTANT: Keep the exact meaning and content. Only change the style to match the user's preferences.\n\n"
        "Draft reply:\n"
        f"{draft_text}\n\n"
        "Revised version:\n"
    )

    inputs = tokenizer(prompt, return_tensors="pt")
    
    # Move inputs to correct device
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}

    # EOS token for stopping
    eos_token_id = tokenizer.eos_token_id
    if eos_token_id is None:
        eos_token_id = tokenizer.pad_token_id
    
    # Stop strings to prevent hallucinations
    stop_strings = ["\n\nDraft reply:", "\n\nOriginal:", "Assistant:", "Best regards"]

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=300,
            min_length=30,
            do_sample=True,
            temperature=0.3,  # Low temperature for consistency
            top_p=0.75,
            top_k=25,
            repetition_penalty=1.35,  # Higher to prevent repetition
            pad_token_id=eos_token_id,
            eos_token_id=eos_token_id,
            no_repeat_ngram_size=3,
        )

    full_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract only the part after "Revised version:"
    if "Revised version:" in full_text:
        result = full_text.split("Revised version:")[-1].strip()
    else:
        # Fallback: remove prompt
        result = full_text[len(prompt):].strip()
    
    # Clean up result
    lines = result.split('\n')
    cleaned_lines = []
    
    # Common email closing phrases
    closing_phrases = [
        "Freundliche Grüße", "Freundliche Grüsse",
        "Mit freundlichen Grüßen", "Mit freundlichen Grüssen",
        "Beste Grüße", "Beste Grüsse",
        "Viele Grüße", "Viele Grüsse",
        "Herzliche Grüße", "Herzliche Grüsse",
        "Best regards", "Kind regards", "Regards"
    ]
    
    # Error phrases that indicate hallucinations
    error_phrases = [
        "Original:", "Draft reply:", "Assistant:",
        "Ursprünglicher Text:", "Erweiterte Übersetzung:"
    ]
    
    found_closing = False
    
    for i, line in enumerate(lines):
        line = line.strip()
        
        # Stop at error phrases
        if any(error_phrase in line for error_phrase in error_phrases):
            break
        
        # Check if this is a closing phrase
        is_closing = any(closing in line for closing in closing_phrases)
        
        if is_closing:
            cleaned_lines.append(line)
            found_closing = True
            
            # Next 1-2 lines might be name/signature
            for j in range(i + 1, min(i + 3, len(lines))):
                next_line = lines[j].strip()
                if not next_line:
                    break
                # Short line after closing = probably name/email
                if len(next_line) < 50 and not any(bad in next_line for bad in error_phrases):
                    cleaned_lines.append(next_line)
                else:
                    break
            break
        
        # If we have enough content and empty line, might be end
        if not line and len(cleaned_lines) > 5:
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if any(error_phrase in next_line for error_phrase in error_phrases):
                    break
            continue
        
        if line:  # Only add non-empty lines
            cleaned_lines.append(line)
    
    result_text = '\n'.join(cleaned_lines).strip()
    
    # Remove hallucinations after signature
    if found_closing:
        for closing in closing_phrases:
            if closing in result_text:
                closing_index = result_text.rfind(closing)
                potential_end = result_text.find("\n", closing_index)
                if potential_end != -1:
                    after_closing = result_text[potential_end:].strip()
                    lines_after = after_closing.split('\n')
                    if len(lines_after) > 2:  # More than name + email = probably error
                        for _ in range(2):
                            next_newline = result_text.find("\n", potential_end + 1)
                            if next_newline != -1:
                                potential_end = next_newline
                            else:
                                break
                        result_text = result_text[:potential_end].strip()
                break
    
    return result_text

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python revise_response.py <adapter_path>")
        sys.exit(1)
    
    model, tokenizer = load_model_and_tokenizer(sys.argv[1])
    
    draft = "Thanks for your email. I'll look into this."
    styled = rewrite_draft(draft, model, tokenizer)
    
    print("Draft:\n")
    print(draft)
    print("\nRevised (with learned style):\n")
    print(styled)

