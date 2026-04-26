# Liberar Folha de Pagamento, Rescisão, Compras e remover marca d'água

Adicionar 3 módulos novos visíveis no menu admin, mantendo o padrão visual (mesmo layout das telas atuais como `FechamentoPage` e `AlmoxarifadoPage`), reaproveitando cálculos já existentes (`src/lib/calculations.ts`: INSS, IRRF, FGTS, DSR, HE) e dados já cadastrados (funcionários, lançamentos mensais, empresas). Sem refazer nada e sem quebrar telas atuais.

## 1. Folha de Pagamento

**Rota:** `/admin/folha-pagamento` — visível na barra lateral (substitui o item "Em breve" de Folha de Pagamento).

**Como funciona:**
- Filtra por **empresa + competência** (mesmo padrão do Fechamento)
- Lista todos os funcionários ativos da empresa
- Para cada funcionário, puxa **automaticamente**:
  - Salário base, insalubridade, VR/VT/VA, dependentes → da tabela `funcionarios`
  - HE 50%, HE 100%, faltas, atrasos, comissão, adicionais, descontos diversos, adiantamento → da tabela `lancamentos_mensais` (mesmos dados que o Fechamento já usa)
- Calcula em tela usando as funções **já existentes** em `src/lib/calculations.ts`:
  - `calcHE50`, `calcHE100`, `calcDSR`, `calcINSS`, `calcIRRF`, `calcFGTS`, `calcFalta`, `calcAtraso`, `calcAdiantamento`, `calcTotalFuncionario`
- Mostra coluna a coluna: Salário | Adicionais | Insalub | HE50 | HE100 | DSR | Comissão | Faltas | Desc.Falta | Adiant | Desc.Diversos | INSS | IRRF | FGTS (informativo) | **Líquido**
- **Sem desconto VT** (regra já aplicada no fechamento — VT só como benefício)
- Botões: **Imprimir Folha (PDF da empresa)** e **Holerite individual (PDF por funcionário)** usando `printDocumentInPage` (sem abrir nova aba)

**O que NÃO é criado:** nova tabela. A folha lê os mesmos `lancamentos_mensais` do Fechamento — **fonte única de verdade**, sem digitação dupla. Edições continuam sendo feitas em "Lançamentos Mensais".

**Arquivos:**
- Novo: `src/pages/FolhaPagamentoPage.tsx`
- Novo: `src/lib/folhaPdf.ts` (gera HTML do holerite e da folha consolidada)
- Editado: `src/App.tsx` (rota), `src/components/AppSidebar.tsx` (move "Folha de Pagamento" de `upcomingItems` para `menuItems`, remove o `disabled`)

## 2. Rescisão

**Rota:** `/admin/rescisoes` — visível na barra lateral (substitui o item "Em breve" de Rescisões).

**Como funciona:**
- Lista de rescisões salvas (filtro por empresa)
- Botão **"Nova Rescisão"** abre formulário com:
  - Seleção de funcionário (popula auto: empresa, cargo, admissão, salário, dependentes)
  - Data do desligamento
  - Tipo de rescisão (select): `sem_justa_causa`, `pedido_demissao`, `acordo_mutuo_484a`, `justa_causa`, `termino_contrato_experiencia`, `rescisao_indireta`
  - Aviso prévio: `trabalhado` | `indenizado` | `dispensado`
  - Saldo de FGTS depositado (input — usuário informa)
  - Observações
- Calcula automaticamente conforme tipo (utilitário novo `src/lib/rescisaoCalc.ts`):
  - **Saldo de salário**: `(salario/30) × dias_trabalhados_no_mes`
  - **Aviso prévio**: dias = 30 + 3 por ano de casa (máx 90); valor = `(salario/30) × dias`
  - **Projeção do aviso indenizado** soma na contagem para férias/13º
  - **Férias vencidas**: salário cheio + 1/3 (se houver período vencido)
  - **Férias proporcionais**: `(salario × meses/12) + 1/3`
  - **13º proporcional**: `salario × meses_trabalhados_no_ano/12`
  - **INSS** sobre saldo + 13º (separados, usando `calcINSS`)
  - **IRRF** sobre base apropriada (`calcIRRF`)
  - **FGTS do mês**: 8% sobre verbas com incidência
  - **Multa 40% FGTS** (sem justa causa) ou **20%** (acordo 484-A) — sobre saldo informado
  - Regras por tipo:
    - `pedido_demissao`: sem multa FGTS, sem aviso indenizado a receber
    - `justa_causa`: só saldo de salário e férias vencidas
    - `acordo_mutuo`: aviso e multa pela metade
- **Líquido** = proventos − descontos
- Salva em nova tabela `rescisoes` (snapshot dos cálculos)
- Botão **"Gerar PDF da Rescisão"** via `printDocumentInPage`

**Arquivos:**
- Novo: `src/pages/RescisaoPage.tsx`
- Novo: `src/lib/rescisaoCalc.ts`
- Novo: `src/lib/rescisaoPdf.ts`
- Migration: tabela `rescisoes` (campos espelhando os listados no pedido + JSON com snapshot dos cálculos, RLS por empresa via `get_user_empresas()`)
- Editado: `src/App.tsx`, `src/components/AppSidebar.tsx`

## 3. Compras (estrutura base)

**Rota:** `/admin/compras` — visível na barra lateral, novo grupo (ou ao lado de Almoxarifado).

**Como funciona (versão inicial entregável):**
- Tela com aba única "Solicitações de Compra"
- Botão **"Nova Solicitação"** abre formulário:
  - Empresa, Solicitante (auto do usuário logado), Data, Centro de Custo, Fornecedor (texto livre), Item, Quantidade, Valor estimado, Observação
  - Status (select): `solicitado`, `em_cotacao`, `aprovado`, `comprado`, `entregue`, `cancelado`
- Tabela lista solicitações com filtros por empresa/status
- Cada linha permite mudar o status (botões discretos como já feito no Almoxarifado)
- Histórico = audit trail simples: cada mudança grava linha em `compras_historico` (status anterior, novo, usuário, data)

**Arquivos:**
- Novo: `src/pages/ComprasPage.tsx`
- Migration: tabelas `compras` e `compras_historico` (RLS por empresa)
- Editado: `src/App.tsx`, `src/components/AppSidebar.tsx`

Pronto para receber regras detalhadas depois — estrutura, listagem, status e histórico já operam.

## 4. Remover marca / menção institucional

Removo todas as ocorrências de "ImplantaRH ConsultoriaPRO" / "Sistema desenvolvido por…" da interface:
- `src/pages/ConfiguracoesPage.tsx` (3 ocorrências)
- `src/pages/LoginPage.tsx` (subtítulo)
- `src/context/AppContextValue.ts` (`mensagemInstitucional` vira string vazia)
- `index.html` (meta description e author — apenas mantém "Topac RH")
- Faço varredura final por `rg` em PDFs e impressões (`pdfGenerator.ts`, `printInPage.ts`, `divergenciasReport.ts`, `RelatorioImpressaoPage.tsx` etc.) e removo qualquer rodapé/cabeçalho com a marca.

Não há marca d'água sobreposta nas telas de preview hoje (verifiquei — nenhum CSS `watermark` no projeto). Se aparecer alguma menção residual nos PDFs, é removida na mesma passagem.

## Padrão visual

Todas as 3 telas novas usam exatamente o mesmo estilo já aprovado:
- `Card`, `Table`, `Button`, `Select`, `Input` do shadcn
- Mesmo cabeçalho, mesmos toasts (`sonner`), mesmo `formatCurrency`
- Sem nova paleta, sem novos componentes visuais

## O que NÃO muda

- Nenhuma tela existente é refeita
- Nenhum cálculo do Fechamento é alterado
- Layout, cores, sidebar, login, permissões, rotas atuais permanecem intactos
- Itens "Em breve" (Folha/Rescisões) deixam de existir e são substituídos pelas telas reais

## Risco em dados

**Nenhum** — só inserimos 3 tabelas novas (`rescisoes`, `compras`, `compras_historico`). Folha de Pagamento não cria tabela, lê dos `lancamentos_mensais` já existentes.
