
lines = []
with open('templates/driver.html', 'r', encoding='utf-8') as f:
    for i in range(589):
        line = f.readline()
        if not line: break
        lines.append(line)

with open('templates/driver.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)
    f.write('\n    <!-- Driver Logic -->\n    <script type="module" src="/static/js/driver/main.js"></script>\n</body>\n</html>')

print("Successfully truncated and appended to driver.html")
