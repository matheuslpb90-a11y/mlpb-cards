# PJe-Calc automatizado (Linux, sem interface)

Ferramentas para rodar o **PJe-Calc Cidadão** em um ambiente Linux na nuvem e
montar, liquidar e exportar cálculos trabalhistas (.PJC + relatório PDF)
a partir dos documentos do processo.

> **Nunca coloque dados de clientes nesta pasta.** Este repositório é público.
> Documentos, contracheques, `caso.json`, .PJC e PDFs de clientes ficam fora do
> git (a pasta `casos/` está no `.gitignore`).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `setup/instalar_pjecalc.sh` | Instala dependências, extrai o instalador do PJe-Calc e sobe o sistema em `http://localhost:9257/pjecalc/` |
| `automacao/` | Scripts Playwright que operam a interface do PJe-Calc |
| `ferramentas/montar_pjc.py` | Monta o .PJC a partir de um modelo + `caso.json` |
| `ferramentas/anonimizar_modelo.py` | Gera um modelo sem dados pessoais a partir de um .PJC real |
| `confea/` | Extração de dados e regras específicas das execuções contra o CONFEA (piso DIEESE) |
| `modelo/modelo_confea_anonimo.PJC` | Modelo do cálculo CONFEA (PJe-Calc 2.16.0), sem dados pessoais |
| `exemplo_caso.json` | Formato do arquivo de dados de um caso (valores fictícios) |

## 1. Subir o PJe-Calc

```bash
bash pjecalc/setup/instalar_pjecalc.sh <instalador.exe | ID do arquivo no Google Drive> [pasta]
```

- O instalador (`pjecalc-2.16.0-instalador-x64.exe`, ~270 MB) não está no repositório
  (é grande e é distribuído pelos TRTs). Os sites dos TRTs bloqueiam acesso a partir de
  servidores na nuvem; por isso o caminho prático é compartilhar o arquivo no Google
  Drive como "qualquer pessoa com o link" e passar o ID do arquivo.
- O `.exe` é um ZIP autoextraível. O PJe-Calc é um Tomcat em Java 8: roda com o Java 8
  do Linux e uma tela virtual (Xvfb), porque abre uma tela de abertura.
- Usuário automático: `offline`, perfil Calculista (igual à versão desktop).

Depois de subir, **importe as tabelas do mês** (`.IDC`, baixado em
TRT1 → "Tabelas Auxiliares do PJe-Calc Cidadão"):

```bash
cd pjecalc/automacao && node idc.js /caminho/TABELAS....idc
```

## 2. Scripts de automação (`automacao/`)

Requerem Node + Playwright (Chromium). Rodar de dentro da pasta `automacao/`.

| Script | O que faz |
|---|---|
| `pj.js` | Biblioteca: abrir o sistema, navegar nos menus, importar cálculo |
| `idc.js arquivo.idc` | Importa tabelas auxiliares (Tabelas → Atualização → Via Arquivo) |
| `regen.js entrada.PJC saida.zip` | Importa, **regera as ocorrências** de todas as verbas (sobrescrevendo) e exporta |
| `liq.js entrada.PJC dd/mm/aaaa prefixo [export]` | Importa, liquida na data, gera o PDF (`prefixo.pdf`) e, com `export`, o .PJC liquidado (`prefixo.pjc.zip`) |
| `explore.js entrada.PJC "Grupo:Item,..."` | Abre telas e lista campos/botões (para descobrir a interface) |

## 3. Fluxo para montar um cálculo a partir de um modelo

1. **Dados do caso** → `caso.json` (formato em `exemplo_caso.json`).
2. `python3 ferramentas/montar_pjc.py modelo.PJC caso.json base.PJC`
   (partes, admissão, histórico salarial, férias, FGTS a partir do início do cálculo).
3. `node automacao/regen.js base.PJC regen.zip`
   — obrigatório: a liquidação recalcula o *devido* a partir do histórico, mas o *pago*,
   os períodos de férias e o 13º ficam gravados nas ocorrências e só mudam ao regerar.
4. `python3 ferramentas/montar_pjc.py regen.zip caso.json final.PJC --patch`
   (quantidades mensais de horas extras e verbas clonadas: HE 100%, adicional noturno).
   Regerar apaga quantidades digitadas — por isso este passo vem depois.
5. `node automacao/liq.js final.PJC dd/mm/aaaa saida export` → PDF + .PJC liquidado.
6. **Conferir** o demonstrativo do PDF contra a planilha própria, mês a mês.

Validação: o fluxo a partir do modelo anonimizado reproduziu ao centavo um cálculo
feito manualmente na interface (mesmo total, mesma data de liquidação).

## 4. Formato .PJC (o que se sabe)

- ZIP com um único XML (ISO-8859-1), raiz `<Calculo>`. Datas em milissegundos
  (meia-noite de Brasília, UTC-3).
- Referências entre objetos por `<internalRef>ID</internalRef>` (ID da entidade).
  Ao clonar uma verba, renumerar todos os `<id>` internos e os `internalRef` que
  apontam para eles.
- `hashLiquidacao`: o PJe-Calc controla se o cálculo mudou depois da liquidação.
  O arquivo para o PJe deve sempre sair do próprio sistema, **liquidado**.
- O PJe recusa .PJC não liquidado ou sem CPF/CNPJ das partes (e dos advogados, se
  houver honorários). Informar número do processo antes de exportar.
- Pendências "Erro" impedem liquidar; "Alerta" não (ex.: "parâmetro Quantidade
  alterado após a geração das ocorrências" é esperado quando há HE por mês).

## 5. Execuções CONFEA — piso DIEESE (ACC 0001378-36.2023.5.10.0016, 16ª VT/DF)

**Título (sentença + acórdão TRT10 + ED):**
- Padrão 01 da tabela ≥ salário mínimo necessário do DIEESE de **fevereiro** de cada ano;
  demais padrões com interstício de **2,66%** (PCCS 2012, item 9.2).
- Diferenças entre o salário básico recebido e o padrão adequado, **desde 02/2019**
  (prescrição quinquenal acolhida nos ED do acórdão; ajuizamento 19/12/2023).
- Reflexos: 13º, férias + 1/3, abono pecuniário, FGTS, horas extras e adicional noturno
  pagos em contracheque; aviso/multa de 40% só para desligados. **Sem DSR.**
- Honorários 10% do crédito; INSS (Súm. 368; sem cota do empregado quando recolhido
  pelo teto; sem terceiros); IR sem incidir sobre juros de mora; correção e juros
  ADC 58 (no modelo: IPCA-E até 18/12/2023, SELIC até 29/08/2024, IPCA + Taxa Legal).

**Dados (scripts em `confea/`):**
- `extrair_contracheques.py` (texto do PDF de contracheques → padrão impresso, eventos,
  horas extras 0064/0092, adicional noturno 0063).
- `extrair_dieese.py` (tabela "piso SMN/DIEESE" juntada aos autos → devido por mês/padrão).
- `tabelas_confea.json` — tabelas salariais do CONFEA (vigência sempre 01/05), padrões 43–53.
  Para outros padrões, ler as tabelas juntadas aos autos e acrescentar.
- `preparar_caso.py` → `meses` do `caso.json`.

**Critérios adotados (e por quê):**
- **Salário pago** = tabela do CONFEA vigente no mês, no padrão efetivo, **com os
  reajustes pagos de forma retroativa** (eventos "DIF. SALARIAL" — os valores fecham
  exatamente com meses × diferença de tabela). Usar só o salário do contracheque do mês
  infla a diferença com valores que o CONFEA já pagou depois.
- **Padrão efetivo**: o padrão impresso no contracheque às vezes fica 1 nível abaixo do
  salário pago (ex.: 2020–2023). As progressões costumam ocorrer em abril (confirmar
  com os retroativos). `config.json` → `"niveis"`; `"usar_padrao_impresso": true`
  gera a variante pelo padrão impresso.
- **Período**: até o último contracheque. Se a tabela DIEESE juntada terminar antes,
  repetir o valor do último mês do mesmo ano (o piso é fixado em fevereiro).
- **Férias**: períodos reais de gozo pelos contracheques (FÉRIAS NO MÊS / PRÓXIMO MÊS e
  dias de salário-base); aquisitivos contados da **admissão do próprio cliente**.
  A verba principal exclui férias gozadas; o reflexo de férias + 1/3 cobre o período
  (com abono quando houver).
- **Horas extras**: quantidade do mês de referência do contracheque; divisor 220;
  HE 50% (×1,5), HE 100% (×2,0), adicional noturno (×0,25). Banco de horas e DSR
  sobre HE ficam fora (DSR indeferido no título).

**Checklist de conferência:** admissão do cliente (não a do modelo!), período, padrão
por mês, retroativos, férias, HE 50% e 100%, CPF/PIS, número do processo, advogado.

## 6. O que pedir ao cliente/advogado para cada caso

Sentença/acórdão (ou título paradigma), contracheques e ficha financeira do período,
histórico funcional, tabelas juntadas, CPF/PIS, número do processo, dados do advogado
(nome, CPF, OAB), data de liquidação desejada e o `.IDC` do mês.
