import json
import os
import pathlib
import urllib.error
import urllib.request

if not os.environ.get('GOOGLE_GEMINI_API_KEY'):
    env_path = pathlib.Path(__file__).resolve().parent / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.strip().startswith('GOOGLE_GEMINI_API_KEY='):
                value = line.split('=', 1)[1].strip()
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                os.environ['GOOGLE_GEMINI_API_KEY'] = value
                break

key = os.environ.get('GOOGLE_GEMINI_API_KEY')
if not key:
    raise SystemExit('Missing GOOGLE_GEMINI_API_KEY environment variable')

text = 'hello world'
for modelName in ['gemini-embedding-001', 'gemini-embedding-2']:
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{modelName}:embedContent?key={key}'
    payload = json.dumps({'model': f'models/{modelName}', 'content': {'parts': [{'text': text}]}}).encode('utf-8')
    print('=== EMBED', modelName)
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            print('OK', r.status)
            print(r.read().decode()[:1000])
    except urllib.error.HTTPError as e:
        print('ERR', e.code)
        print(e.read().decode()[:1000])

print('\n=== GENERATE ===')
for modelName in [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-flash-lite-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
]:
    print('\n--- MODEL', modelName)
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent?key={key}'
    body = {
        'model': f'models/{modelName}',
        'contents': [{'role': 'user', 'parts': [{'text': 'Say hi.'}]}],
        'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 50},
    }
    payload = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            resp_text = r.read().decode('utf-8')
            print('OK', r.status)
            try:
                print(json.dumps(json.loads(resp_text), indent=2)[:3200])
            except Exception:
                print(resp_text[:3200])
    except urllib.error.HTTPError as e:
        print('ERR', e.code)
        print(e.read().decode('utf-8')[:3200])

print('\n=== LIST MODELS ===')
url = f'https://generativelanguage.googleapis.com/v1beta/models?key={key}'
req = urllib.request.Request(url, method='GET')
try:
    with urllib.request.urlopen(req) as r:
        print('OK', r.status)
        text = r.read().decode('utf-8')
        print(text[:8000])
except urllib.error.HTTPError as e:
    print('ERR', e.code)
    print(e.read().decode('utf-8')[:8000])
