
import glob
import os

def check_syntax(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        stack = []
        opening_brackets = {'(': ')', '{': '}', '[': ']'}
        closing_brackets = {')', '}', ']'}
        quotes = {"'", '"', '`'}
        
        in_string = None
        in_comment = False
        comment_type = None
        
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            i = 0
            while i < len(line):
                char = line[i]
                
                if not in_string and not in_comment:
                    if char == '/' and i + 1 < len(line):
                        if line[i+1] == '/':
                            break
                        elif line[i+1] == '*':
                            in_comment = True
                            comment_type = 'block'
                            i += 2
                            continue
                
                if in_comment and comment_type == 'block':
                    if char == '*' and i + 1 < len(line) and line[i+1] == '/':
                        in_comment = False
                        comment_type = None
                        i += 2
                        continue
                    i += 1
                    continue
                
                if in_string:
                    if char == '\\':
                        i += 2
                        continue
                    if char == in_string:
                        in_string = None
                    i += 1
                    continue
                else:
                    if char in quotes:
                        in_string = char
                        i += 1
                        continue
                
                if char in opening_brackets:
                    stack.append((char, line_num, i))
                elif char in closing_brackets:
                    if not stack:
                        return f"Error: Unexpected '{char}' at line {line_num} col {i}"
                    last_open, last_line, last_col = stack.pop()
                    if opening_brackets[last_open] != char:
                        return f"Error: Mismatched '{char}' at line {line_num}. Expected closing for '{last_open}' from line {last_line}"
                i += 1
                
        if in_string:
            return f"Error: Unclosed string starting with {in_string}"
        if in_comment:
            return "Error: Unclosed block comment"
        if stack:
            last = stack[-1]
            return f"Error: Unclosed '{last[0]}' at line {last[1]}"
            
        return "Syntax OK"

    except Exception as e:
        return f"File Error: {e}"

# Check all JS files in student directory
files = glob.glob(r"c:\D FOLDER\Projects\Bus app\static\js\student\*.js")
print(f"Checking {len(files)} files...")
for f in files:
    print(f"{os.path.basename(f)}: {check_syntax(f)}")
