# Máquina de cálculos trabalhistas (PJe-Calc)

Este ambiente ("Advocacia") é usado para cálculos trabalhistas no **PJe-Calc Cidadão**.
O usuário é advogado(a) trabalhista; responda em português do Brasil.

## O que já está pronto ao iniciar a sessão
- PJe-Calc 2.16.0 extraído em `/opt/pjecalc/pjecalc-windows64-2.16.0` (Java 8, Xvfb, 7zip, OCR por/eng instalados).
- Ferramentas e guia em `/opt/pjecalc/pjecalc/` (cópia da pasta `pjecalc/` do repositório
  `matheuslpb90-a11y/mlpb-cards`, branch `claude/brave-planck-bmo4xg`). **Leia `/opt/pjecalc/pjecalc/README.md` antes de calcular.**

## Para usar
1. Subir o sistema: `bash /opt/pjecalc/pjecalc/setup/instalar_pjecalc.sh /opt/pjecalc/x /opt/pjecalc`
   (já extraído, ele só inicia; responde em http://localhost:9257/pjecalc/).
2. Pedir ao usuário o `.IDC` do mês (TRT1 → Tabelas Auxiliares) e importar com `automacao/idc.js`.
   Os sites dos TRTs bloqueiam acesso da nuvem: arquivos sempre vêm do usuário.
3. Seguir o fluxo do README (caso.json → montar_pjc → regen → patch → liq + export),
   conferir o demonstrativo mês a mês e entregar PDF + .PJC com a lista de premissas.

## Regras
- O repositório é PÚBLICO: nunca commitar dados de clientes (documentos, CPF, caso.json, .PJC, PDFs).
  Trabalhar com dados de clientes só no scratchpad da sessão e entregar os arquivos ao usuário.
- Antes de protocolar, o .PJC precisa estar liquidado, com CPF das partes, número do processo e advogado.
- Quando o título for ambíguo, apontar as opções e o efeito em valores; quem decide é o usuário.
- Histórico do trabalho já feito: casos CONFEA (piso DIEESE) validados contra cálculos do próprio usuário;
  diferenças conhecidas entre critérios estão descritas no README (salário pago com retroativos,
  padrão efetivo × impresso, período até o último contracheque, admissão do cliente).
