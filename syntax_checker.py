
def check_balance(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        stack = []
        lines = content.split('\n')
        
        for line_idx, line in enumerate(lines):
            for char_idx, char in enumerate(line):
                if char == '{':
                    stack.append((line_idx + 1, char_idx + 1))
                elif char == '}':
                    if not stack:
                        return f"Error: Unexpected '}}' at line {line_idx + 1} col {char_idx + 1}"
                    stack.pop()
        
        if stack:
            last = stack[-1]
            return f"Error: Unclosed '{{' at line {last[0]} col {last[1]}"
        
        return "Syntax OK: Braces Balanced"
    except Exception as e:
        return f"Error reading file: {e}"

print(check_balance(r"c:\D FOLDER\Projects\Bus app\static\js\student\map.js"))
