import json
import sys

# Configure stdout to handle UTF-8 to prevent encoding issues with emojis
sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\clark\.gemini\antigravity-ide\brain\037341a5-2f7a-478d-b36b-138ef359be5d\.system_generated\logs\transcript.jsonl"
with open(log_path, 'r', encoding='utf-8') as f:
    for line_idx, line in enumerate(f):
        data = json.loads(line)
        content = data.get("content", "")
        if not content:
            continue
        
        content_lower = content.lower()
        if "phase 2" in content_lower or "phase 3" in content_lower or "phase 4" in content_lower:
            print(f"=== Step {data.get('step_index')} (Type: {data.get('type')}) ===")
            lines = content.split('\n')
            for i, l in enumerate(lines):
                l_l = l.lower()
                if "phase 2" in l_l or "phase 3" in l_l or "phase 4" in l_l:
                    print(f"Line {i}: {l}")
                    for j in range(1, 15):
                        if i + j < len(lines):
                            print(f"  {lines[i+j]}")
                    print("-" * 40)
