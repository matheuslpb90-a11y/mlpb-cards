"""Monta um .PJC a partir do modelo + dados do caso (caso.json).

Etapa 1 (base):   python3 montar_pjc.py modelo.PJC caso.json saida_base.PJC
   -> partes, admissão, período do FGTS, histórico salarial e férias.
   Depois importe no PJe-Calc e REGERE as ocorrências das verbas
   (automacao/regen.js), exportando o resultado.
Etapa 2 (patch):  python3 montar_pjc.py exportado_regerado.PJC caso.json saida_final.PJC --patch
   -> quantidades de horas extras/adicional noturno por mês e cria as verbas
      de HE 100% e adicional noturno (clonadas da HE 50%).
   Depois importe, liquide e exporte (automacao/liq.js ... export).

Formato do caso.json: ver exemplo_caso.json.
"""
import sys, json, copy, zipfile, datetime as dt
import xml.etree.ElementTree as ET
from decimal import Decimal as D

TZ = dt.timezone(dt.timedelta(hours=-3))  # o PJe-Calc grava datas à meia-noite de Brasília, em ms

def ms(s):  # 'dd/mm/aaaa'
    d, m, y = map(int, s.split('/'))
    return str(int(dt.datetime(y, m, d, tzinfo=TZ).timestamp() * 1000))

def ref_of(t):
    d = dt.datetime.fromtimestamp(int(t) / 1000, TZ)
    return f'{d.month:02d}/{d.year}'

def load(p):
    if zipfile.is_zipfile(p):
        z = zipfile.ZipFile(p)
        return ET.fromstring(z.read(z.namelist()[0]))
    return ET.parse(p).getroot()

src, caso_path, out = sys.argv[1:4]
patch = '--patch' in sys.argv
caso = json.load(open(caso_path, encoding='utf8'))
meses = {m['ref']: m for m in caso['meses']}
r = load(src)

if not patch:
    # partes
    p = caso['partes']
    for e in r.iter('nomeBeneficiario'): e.text = p['nome']
    for e in r.iter('documentoFiscalBeneficiario'): e.text = p['cpf_formatado']
    rec = r.find('.//reclamante/Reclamante')
    rec.find('nome').text = p['nome']
    rec.find('numeroDocumentoFiscal').text = p['cpf']
    if p.get('pis'):
        rec.find('tipoDocumentoPrevidenciario').text = 'PIS'
        rec.find('numeroDocumentoPrevidenciario').text = p['pis']
    # parâmetros
    r.find('dataAdmissao').text = ms(caso['admissao'])
    # FGTS a partir do início do cálculo
    fg = r.find('fgts/Fgts')
    ini = int(r.find('dataInicioCalculo').text)
    fg.find('periodoInicial').text = str(ini)
    lst = fg.find('ocorrencias/Set')
    for o in [o for o in lst if int(o.find('ocorrencia').text) < ini]:
        lst.remove(o)
    # histórico salarial: as bases do modelo são mapeadas pelo nome
    mapa = caso['bases_historico']  # {"NOME DA BASE NO PJE-CALC": "campo do mes"}
    for h in r.find('historicosSalariais/Set'):
        campo = mapa[h.find('nome').text]
        for o in h.iter('OcorrenciaDoHistoricoSalarial'):
            ref = ref_of(o.find('dataOcorrencia').text)
            if ref not in meses:
                raise SystemExit(f'mês {ref} do histórico sem dados no caso.json')
            o.find('valor').text = f"{D(str(meses[ref][campo])):.2f}"
    # férias
    fset = r.find('listaDeFerias/Set')
    tplF = copy.deepcopy(fset[0])
    for f in list(fset): fset.remove(f)
    for i, fe in enumerate(caso['ferias']):
        f = copy.deepcopy(tplF)
        f.find('id').text = str(990000 + i)
        f.find('versao').text = '0'
        f.find('relativa').text = fe['relativa']
        for k in ('dataInicialDoPeriodoAquisitivo', 'dataFinalDoPeriodoAquisitivo',
                  'dataInicialDoPeriodoConcessivo', 'dataFinalDoPeriodoConcessivo'):
            f.find(k).text = ms(fe[k])
        f.find('prazo').text = str(fe.get('prazo', 30))
        f.find('situacao').text = fe['situacao']
        for k in (1, 2, 3):
            f.find(f'dataInicialDoPeriodoDeGozo{k}').text = 'null'
            f.find(f'dataFinalDoPeriodoDeGozo{k}').text = 'null'
            f.find(f'dobraDoPeriodoDeGozo{k}').text = 'false'
        for k, (a, b) in enumerate(fe.get('gozos', []), 1):
            f.find(f'dataInicialDoPeriodoDeGozo{k}').text = ms(a)
            f.find(f'dataFinalDoPeriodoDeGozo{k}').text = ms(b)
        f.find('abono').text = 'true' if fe.get('abono') else 'false'
        f.find('quantidadeDiasAbono').text = str(fe.get('dias_abono', 10))
        fset.append(f)
    print('histórico e férias aplicados:', len(caso['ferias']), 'períodos de férias')
else:
    def verba(prefixo):
        for v in r.find('verbas/Set'):
            n = v.find('nome')
            if n is not None and n.text.startswith(prefixo):
                return v
    def set_qtd(v, campo):
        n = 0
        for o in v.iter('OcorrenciaDeVerba'):
            if o.find('dataInicial') is None: continue
            q = D(str(meses.get(ref_of(o.find('dataInicial').text), {}).get(campo, 0)))
            o.find('quantidade').text = f'{q:.25f}'
            if o.find('quantidadeIntegral') is not None:
                o.find('quantidadeIntegral').text = f'{q:.4f}'
            n += 1
        return n
    def clone(v, nome, desc, mult, ordem, off):
        c = copy.deepcopy(v)
        ids = {e.text for e in c.iter('id')}
        for e in c.iter('id'): e.text = str(int(e.text) + off)
        for e in c.iter('internalRef'):
            if e.text in ids: e.text = str(int(e.text) + off)
        c.find('nome').text = nome
        c.find('descricao').text = desc
        c.find('ordem').text = str(ordem)
        c.find('formula/FormulaReflexo/multiplicador/Multiplicador/outroValor').text = mult
        for o in c.iter('OcorrenciaDeVerba'):
            if o.find('multiplicador') is not None:
                o.find('multiplicador').text = mult[:10]
        return c
    he50 = verba('HORAS EXTRAS 50%')
    vs = r.find('verbas/Set')
    extras = caso.get('verbas_clonadas_da_he50', [])
    for i, ex in enumerate(extras):
        if verba(ex['nome'][:20]) is None:
            c = clone(he50, ex['nome'], ex['descricao'], ex['multiplicador'], 50 + i, 3000000 + 1000000 * i)
            vs.append(c)
    print('HE 50%:', set_qtd(he50, 'he50'))
    for ex in extras:
        print(ex['nome'], set_qtd(verba(ex['nome'][:20]), ex['campo']))

xml = ET.tostring(r, encoding='ISO-8859-1', xml_declaration=True)
xml = xml.replace(b"<?xml version='1.0' encoding='ISO-8859-1'?>\n", b'<?xml version="1.0" encoding="ISO-8859-1"?>')
z = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
z.writestr('CALCULO.PJC', xml)
z.close()
print('gerado', out)
