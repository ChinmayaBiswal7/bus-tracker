
lines = []
with open('templates/driver.html', 'r', encoding='utf-8') as f:
    all_lines = f.readlines()

with open('templates/driver.html', 'w', encoding='utf-8') as f:
    # Write 1-18 (indices 0-17)
    f.writelines(all_lines[:18])
    # Insert Link
    f.write('    <link rel="stylesheet" href="/static/css/driver.css">\n')
    # Write 265-end (indices 264-end)
    # Line 265 in file is index 264.
    f.writelines(all_lines[264:])

print("Successfully replaced CSS in driver.html")
