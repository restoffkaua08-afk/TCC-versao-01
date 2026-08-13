import requests
import base64
import sys

payload = {'metric':'operation_status','chart_type':'pie','title':'Inspecao HTML Fallback'}
resp = requests.post('http://127.0.0.1:8020/api/google-sheets/generate-chart', json=payload, timeout=30)
resp.raise_for_status()
j = resp.json()
b = j.get('fallback_html_base64')
if not b:
    print('NO_HTML')
    sys.exit(1)
fn = r'C:/Users/Kauã/Desktop/tsea_fallback_chart.html'
with open(fn,'wb') as f:
    f.write(base64.b64decode(b))
print('wrote', fn)

s = base64.b64decode(b).decode('utf-8', errors='replace')
lines = s.splitlines()
for i, l in enumerate(lines[:200]):
    print(f"{i+1:03d}: {l}")
