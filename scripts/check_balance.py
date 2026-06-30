from pathlib import Path
text = Path('app/programs/ProgramApplyClient.tsx').read_text(encoding='utf-8')
lines = text.splitlines()
print('Total lines', len(lines))
for name, chars in [('paren', ('(', ')')), ('brace', ('{', '}')), ('angle', ('<', '>')), ('backtick', ('`', '`'))]:
    balance = 0
    for idx, line in enumerate(lines, start=1):
        for ch in line:
            if ch == chars[0]:
                balance += 1
            elif ch == chars[1]:
                balance -= 1
                if balance < 0:
                    print(f'negative {name} at line', idx, line)
                    raise SystemExit(1)
    print(name, 'final balance', balance)

for i in range(260, 340):
    print(f'{i+1}: {lines[i]}')
