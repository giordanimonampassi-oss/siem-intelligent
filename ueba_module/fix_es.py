content = open('pipeline/es_extractor.py', encoding='utf-8').read()
old = '''        # HTTP simple : desactive SSL explicitement
        if host.startswith("http://"):
            kwargs["use_ssl"]          = False
            kwargs["verify_certs"]     = False
            kwargs["ssl_show_warn"]    = False'''
new = '''        # HTTP simple : pas de SSL (ES v8 gere ca via le scheme http://)
        if host.startswith("http://"):
            kwargs["verify_certs"] = False'''
content = content.replace(old, new)
open('pipeline/es_extractor.py', 'w', encoding='utf-8').write(content)
print('OK' if old in open('pipeline/es_extractor.py').read() == False else 'PATCHED')
