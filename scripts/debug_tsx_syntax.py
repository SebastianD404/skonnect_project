from pathlib import Path
import re
path = Path('app/programs/ProgramApplyClient.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
print('Total lines', len(lines))
for start, end in [(240, 340), (340, 430), (430, 490)]:
    print(f'--- lines {start}-{end} ---')
    for i in range(start-1, min(end, len(lines))):
        print(f'{i+1}: {lines[i]}')

counts = {
    'backticks': text.count('`'),
    'openParen': text.count('('),
    'closeParen': text.count(')'),
    'openBrace': text.count('{'),
    'closeBrace': text.count('}'),
    'openAngle': text.count('<'),
    'closeAngle': text.count('>'),
}
print('counts', counts)
# find unbalanced rates within the file
balance = {'(':0, '{':0, '<':0}
closers = {')':'(', '}':'{', '>':'<'}
for i, line in enumerate(lines, start=1):
    for ch in line:
        if ch in balance:
            balance[ch] += 1
        elif ch in closers:
            balance[closers[ch]] -= 1
            if balance[closers[ch]] < 0:
                print('negative balance', closers[ch], 'at', i, 'line:', line)
                raise SystemExit(0)
print('final balance', balance)
