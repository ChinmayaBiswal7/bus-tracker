
import re

with open('templates/signup.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Style
content = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="/static/css/auth.css">', content, flags=re.DOTALL)

# Replace Body Tag
content = re.sub(r'<body class="([^"]+)">', r'<body class="\1" data-role="{{ role }}">', content)

# Replace Script
content = re.sub(r'<script type="module">.*?</script>', '<script type="module" src="/static/js/auth/signup.js"></script>', content, flags=re.DOTALL)

with open('templates/signup.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactored signup.html")
