"""Extrai a tabela 'piso SMN/DIEESE' (mês, padrão, valor) do PDF juntado aos autos.
Uso: pdftotext -layout tabela.pdf tabela.txt && python3 extrair_dieese.py tabela.txt > dieese_tab.json
"""
import re, sys, json
t = open(sys.argv[1], encoding='utf8').read()
d = {}
for m, p, v in re.findall(r'^\s*(\d\d/\d{4})\s+(\d{1,3})\s+([\d\.]+,\d\d)\s*$', t, re.M):
    d.setdefault(m, {})[p] = v
json.dump(d, sys.stdout)
