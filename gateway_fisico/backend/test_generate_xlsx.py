import requests, base64, os
url='http://127.0.0.1:8020/api/google-sheets/generate-chart'
payload={"metric":"operations_by_day","chart_type":"bar","period":"month","title":"Teste Xlsx"}
try:
    r=requests.post(url,json=payload,timeout=20)
    print('status',r.status_code)
    data=r.json()
    print(list(data.keys()))
    if data.get('fallback_xlsx_base64'):
        b=base64.b64decode(data['fallback_xlsx_base64'])
        path=os.path.expanduser('~\\Desktop\\tsea_fallback_chart.xlsx')
        open(path,'wb').write(b)
        print('wrote',path)
    else:
        print('no xlsx in response', data)
except Exception as e:
    print('error',e)
