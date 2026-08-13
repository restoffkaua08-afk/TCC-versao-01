import requests, base64, os

url='http://127.0.0.1:8020/api/google-sheets/generate-chart'
metrics = [
    ("operations_by_day","bar"),
    ("operation_status","pie"),
    ("vacuum_ramp","line"),
    ("cycle_time","bar"),
]
for metric, chart_type in metrics:
    payload={"metric":metric,"chart_type":chart_type,"period":"month","title":f"Teste {metric}"}
    try:
        r=requests.post(url,json=payload,timeout=20)
        print(metric, 'status', r.status_code)
        if r.status_code==200:
            data=r.json()
            if data.get('fallback_xlsx_base64'):
                b=base64.b64decode(data['fallback_xlsx_base64'])
                path=os.path.expanduser(f'~\\Desktop\\tsea_fallback_{metric}.xlsx')
                open(path,'wb').write(b)
                print('wrote',path)
            else:
                print('no xlsx in response', data.keys())
        else:
            print('error', r.text[:200])
    except Exception as e:
        print('error',e)
