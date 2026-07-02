import requests, json

logs = [
    ('SUSPECT SSH bruteforce', {'log_type':'auth','severity':'error','source_ip':'203.0.113.45','is_suspicious':True,'raw_message':'Failed password for root from 203.0.113.45 port 22 ssh2'}),
    ('NORMAL  dashboard',      {'log_type':'application','severity':'info','source_ip':'192.168.6.10','is_suspicious':False,'raw_message':'GET /api/v1/dashboard HTTP/1.1 200 1024'}),
    ('SUSPECT admin access',   {'log_type':'application','severity':'warning','source_ip':'192.168.1.100','is_suspicious':False,'raw_message':'User john.doe accessed /admin/database at 03:21'}),
    ('SUSPECT sqlmap',         {'log_type':'application','severity':'warning','source_ip':'185.220.101.32','is_suspicious':True,'raw_message':'GET /config HTTP/1.1 403 sqlmap/1.7'}),
]

for label, log in logs:
    r = requests.post('http://localhost:8000/score', json=log)
    d = r.json()
    print(label.ljust(30), '| level='+d['level'].ljust(8), '| anomaly='+str(d['is_anomaly']).ljust(5), '| score='+str(d['anomaly_score']))
