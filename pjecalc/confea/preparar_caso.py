"""Gera os meses do caso.json para cálculos CONFEA (piso DIEESE - ACC 0001378-36.2023.5.10.0016).

Uso: python3 preparar_caso.py contracheques.json dieese_tab.json config.json > meses.json

- contracheques.json: saída de extrair_contracheques.py (padrão impresso e horas extras por mês)
- dieese_tab.json:    saída de extrair_dieese.py (tabela "piso SMN/DIEESE" juntada aos autos)
- config.json: {"inicio": "02/2019", "fim": "08/2026",
                "niveis": [["02/2019", 43], ["03/2019", 44], ["04/2019", 45], ...],   # padrão efetivo
                "usar_padrao_impresso": false}

Salário pago = tabela salarial do CONFEA vigente no mês (vigência sempre a partir de 01/05),
no padrão efetivamente pago, considerando os reajustes pagos de forma retroativa (DIF. SALARIAL).
Salário devido = tabela piso DIEESE no padrão do mês.
"""
import sys, json
from decimal import Decimal as D
import os
TAB = json.load(open(os.path.join(os.path.dirname(__file__), 'tabelas_confea.json')))

def num(s): return D(s.replace('.', '').replace(',', '.')) if isinstance(s, str) and ',' in s else D(str(s))

cc = json.load(open(sys.argv[1]))
dieese = json.load(open(sys.argv[2]))
cfg = json.load(open(sys.argv[3]))

def seq(a, b):
    m, y = map(int, a.split('/')); m2, y2 = map(int, b.split('/'))
    while (y, m) <= (y2, m2):
        yield f'{m:02d}/{y}'
        m += 1
        if m == 13: m, y = 1, y + 1

niveis = sorted(((int(r.split('/')[1]), int(r.split('/')[0]), n) for r, n in cfg['niveis']))
def nivel(ref):
    m, y = map(int, ref.split('/'))
    atual = None
    for yy, mm, n in niveis:
        if (yy, mm) <= (y, m): atual = n
    return atual

impresso, horas = {}, {}
for x in cc:
    if x['ref'] and x['padrao'] and any(e[0] == '0002' for e in x['eventos']):
        impresso.setdefault(x['ref'], x['padrao'])
    for e in x['eventos']:
        if e[0] in ('0064', '0092', '0063'):
            k = {'0064': 'he50', '0092': 'he100', '0063': 'an'}[e[0]]
            horas.setdefault(x['ref'], {}).setdefault(k, D(0))
            horas[x['ref']][k] += num(e[2])

out = []
ultimo_dieese = None
for ref in seq(cfg['inicio'], cfg['fim']):
    m, y = map(int, ref.split('/'))
    L = nivel(ref)
    P = impresso.get(ref, L) if cfg.get('usar_padrao_impresso') else L
    vig = str(y if m >= 5 else y - 1)
    tab_mes = dieese.get(ref)
    if tab_mes is None:  # piso DIEESE é fixado em fevereiro: repete o último mês disponível do mesmo ano
        tab_mes = ultimo_dieese
    ultimo_dieese = tab_mes
    h = horas.get(ref, {})
    out.append(dict(ref=ref, padrao=P, devido=str(num(tab_mes[str(P)])), pago=TAB[vig][str(L)],
                    he50=str(h.get('he50', 0)), he100=str(h.get('he100', 0)), an=str(h.get('an', 0))))
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
