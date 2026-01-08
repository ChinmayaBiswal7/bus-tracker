
import re

def check_syntax(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Stack for tracking balance
        stack = []
        
        # Helper lists
        opening_brackets = {'(': ')', '{': '}', '[': ']'}
        closing_brackets = {')', '}', ']'}
        quotes = {"'", '"', '`'}
        
        in_string = None # None, ', ", or `
        in_comment = False # // or /*
        comment_type = None # 'line' or 'block'
        
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            i = 0
            while i < len(line):
                char = line[i]
                
                # Check for comment start
                if not in_string and not in_comment:
                    if char == '/' and i + 1 < len(line):
                        if line[i+1] == '/':
                            # Line comment, ignore rest of line
                            break
                        elif line[i+1] == '*':
                            in_comment = True
                            comment_type = 'block'
                            i += 2
                            continue
                
                # Check for comment end
                if in_comment and comment_type == 'block':
                    if char == '*' and i + 1 < len(line) and line[i+1] == '/':
                        in_comment = False
                        comment_type = None
                        i += 2
                        continue
                    i += 1
                    continue
                
                # Handle Strings
                if in_string:
                    if char == '\\':
                        # Escape char, skip next
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
                
                # Handle Brackets (Outside strings/comments)
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

print(check_syntax(r"c:\D FOLDER\Projects\Bus app\static\js\student\map.js"))
