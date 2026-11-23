import re, sys, json, collections
txt = open(sys.argv[1], encoding='utf8').read()
docs = txt.split('Demonstrativo de Pagamento Mensal')[1:]
rows = []
for d in docs:
    ref = re.search(r'\n\s*\d{11}\s+\d{11}\s+\S+\s+(\d{1,2})\s*/(\d{4})', d)
    pad = re.search(r'Padr.o Salarial:\s*(\d+)', d)
    sb = re.search(r'Sal.rio Base.*?\n\s*([\d\.]+,\d\d)', d, re.S)
    evs = re.findall(r'\d{2}/\d{2}/\d{4}\s+(\d{1,2})/\s*(\d{4})\s+(\d{4})\s+(.+?)\s{2,}([\d\.,]+)\s+([\d\.]+,\d\d)', d)
    pg = re.search(r'\n(\d{2}/\d{2}/\d{4})\s', d)
    rows.append(dict(ref=f"{ref.group(1).zfill(2)}/{ref.group(2)}" if ref else None,
                     padrao=int(pad.group(1)) if pad else None,
                     salario_base_cad=sb.group(1) if sb else None,
                     data_pgto=pg.group(1) if pg else None,
                     eventos=[(e[2], e[3].strip(), e[4], e[5]) for e in evs]))
json.dump(rows, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(rows), 'demonstrativos')
cnt = collections.Counter((e[0], e[1]) for r in rows for e in r['eventos'])
for k, v in sorted(cnt.items()):
    print(v, k)
