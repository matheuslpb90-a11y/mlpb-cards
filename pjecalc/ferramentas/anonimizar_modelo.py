"""Remove dados pessoais e valores de um .PJC para usá-lo como modelo.

Uso: python3 anonimizar_modelo.py entrada.PJC saida.PJC

Troca nomes/CPF/PIS por marcadores e zera todos os valores monetários
(histórico salarial, ocorrências, resultados). Mantém a estrutura do cálculo
(verbas, fórmulas, parâmetros de correção/juros, INSS, IR, FGTS, custas).
"""
import sys, zipfile, re
import xml.etree.ElementTree as ET

MONET_EXATOS = {
    'pago', 'pagoIntegral', 'devido', 'devidoIntegral', 'base', 'baseIntegral', 'baseVerba',
    'baseVerbaSemAvisoPrevio', 'baseHistorico', 'liquidoExequente', 'inssBeneficiario', 'inssExecutado',
    'impostoRenda', 'depositoFgts', 'custasJudiciais', 'custasReclamado', 'custasReclamante',
    'fgtsDepositoContaVinculada', 'inssReclamado', 'inssReclamante', 'valorPrincipal', 'baseHonorario',
    'depositado', 'contribuicaoSocialNormal', 'contribuicaoSocialDecimoTerceiro', 'previdenciaPrivada',
}
MANTER = {'valorCargaHorariaPadrao', 'valorInicialFaixa', 'valorFinalFaixa', 'valorInformado', 'valorDeducao',
          'valorDescontoSimplificado', 'outroValor'}
NUM = re.compile(r'^-?\d+(\.\d+)?(E-?\d+)?$')

def load(p):
    if zipfile.is_zipfile(p):
        z = zipfile.ZipFile(p)
        return ET.fromstring(z.read(z.namelist()[0]))
    return ET.parse(p).getroot()

r = load(sys.argv[1])
zerados = 0
for e in r.iter():
    if len(e) or not e.text:
        continue
    t = e.tag
    if t in ('nome', 'nomeBeneficiario') and e.text.strip() and not e.text.isupper() is False:
        pass
    if (t in MONET_EXATOS or (t.startswith('valor') and t not in MANTER)) and NUM.match(e.text.strip()):
        e.text = '0'; zerados += 1
for rec in r.iter('Reclamante'):
    rec.find('nome').text = 'RECLAMANTE MODELO'
    rec.find('numeroDocumentoFiscal').text = '00000000000'
    rec.find('numeroDocumentoPrevidenciario').text = 'null'
    rec.find('tipoDocumentoPrevidenciario').text = 'null'
for e in r.iter('nomeBeneficiario'): e.text = 'RECLAMANTE MODELO'
for e in r.iter('documentoFiscalBeneficiario'): e.text = '000.000.000-00'
for e in r.iter('comentarios'): e.text = ''
xml = ET.tostring(r, encoding='ISO-8859-1', xml_declaration=True)
xml = xml.replace(b"<?xml version='1.0' encoding='ISO-8859-1'?>\n", b'<?xml version="1.0" encoding="ISO-8859-1"?>')
z = zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED)
z.writestr('MODELO.PJC', xml)
z.close()
print('valores zerados:', zerados)
