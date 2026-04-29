## Plano de correção

Vou corrigir somente a validação dos links do App Operacional, sem mexer em login, menus, layout geral, permissões existentes ou rotas já aprovadas.

### O que já confirmei no projeto
- O app dos técnicos abre pela rota `/m/:token`.
- A validação real hoje acontece na função backend `tecnico-app`, usando o `access_token` salvo em `tecnicos_campo`.
- Hoje não existe expiração automática por data nessa validação.
- A função atual só bloqueia o acesso quando:
  - o token não existe,
  - ou `link_bloqueado = true`.
- O banco já tem 8 técnicos com token salvo e nenhum está bloqueado no momento.
- Um teste direto do token existente retornou sucesso no backend, então o problema não é uma expiração real do link, e sim a camada de tratamento/estado dos links e a mensagem genérica mostrada no cliente.

## Implementação proposta

### 1. Consolidar o modelo de link permanente
Vou transformar o controle atual em um modelo explícito de status do link, sem qualquer noção de validade por data.

Mudanças previstas:
- manter `access_token` como identificador permanente do link;
- adicionar status real do link com os estados:
  - `ativo`
  - `bloqueado`
  - `revogado`
- registrar também campos de auditoria, como:
  - `ultimo_acesso_em`
  - `revogado_em`
  - `revogado_por` / equivalente de auditoria
- preservar o histórico já existente em `tecnicos_link_historico`.

Regra final de acesso:
- abre normalmente se o token existir e o status for `ativo`;
- mostra erro apenas se:
  - token inexistente,
  - status `bloqueado`,
  - status `revogado`,
  - técnico excluído.

### 2. Ajustar a função backend do app do técnico
Vou atualizar a função `tecnico-app` para:
- resolver o técnico pelo token permanente salvo no banco;
- parar de usar resposta genérica única para todos os casos;
- devolver motivo claro de falha, por exemplo:
  - `invalid_token`
  - `blocked_link`
  - `revoked_link`
  - `deleted_or_missing_technician`
- atualizar `ultimo_acesso_em` quando o link válido for usado;
- manter o app funcionando sem login tradicional.

Também vou revisar a busca do técnico para garantir estabilidade após publicação de novas versões, já que a validação continuará 100% baseada no token salvo no banco.

### 3. Corrigir a mensagem no app móvel
Vou ajustar `TecnicoAppContext` para:
- remover totalmente a palavra “expirado”; 
- trocar a mensagem padrão para:
  - `Link inválido ou bloqueado. Verifique com o administrador.`
- diferenciar a exibição conforme o motivo retornado pela função;
- evitar falso negativo quando a função responder com sucesso.

### 4. Ajustar a tela admin “Links dos Aplicativos”
Vou completar a aba já existente em `AppOperacionalPage` para exibir e operar os campos pedidos:
- nome do técnico
- empresa/filial
- CPF
- veículo vinculado
- link
- status do link
- último acesso
- copiar link
- abrir link
- regenerar link
- bloquear link
- reativar link

Também vou:
- mostrar `Revogado` quando aplicável;
- garantir que “bloquear” e “reativar” usem o status real;
- manter “regenerar” invalidando apenas o token anterior e deixando o novo como `ativo`;
- atualizar o histórico de auditoria a cada ação.

### 5. Corrigir e regularizar os links já existentes
Vou fazer um saneamento dos vínculos já cadastrados para os técnicos citados:
- Diego
- Tiago Toledo
- Tiago Moreira
- Leandro
- Rafael
- Jerri
- Naciel
- Vitor Praia Grande

Ação planejada:
- localizar cada técnico já existente;
- garantir que todos tenham `access_token` salvo;
- se houver token quebrado, ausente ou inconsistente, gerar novo token;
- salvar como `ativo`;
- refletir imediatamente na tela de links.

Isso inclui corrigir os links antigos sem apagar técnicos válidos.

### 6. Implantar o link único permanente de Goiânia por CPF
Como esse fluxo ainda não aparece implementado no código atual, vou completar essa parte.

Implementação prevista:
- criar um link único permanente para Goiânia;
- abrir uma tela simples de acesso por CPF;
- localizar o funcionário/técnico pelo CPF informado;
- redirecionar para o app correto, sem misturar dados entre usuários;
- permitir uso simultâneo por mais de um CPF;
- sem expiração automática.

Esse fluxo será isolado do restante e não vai alterar as rotas já aprovadas do portal principal.

### 7. Garantir persistência real em banco
Vou garantir que tudo fique salvo no banco:
- token atual
- status do link
- último acesso
- bloqueio/reativação
- revogação
- histórico de regeneração/ações

### 8. Testes finais obrigatórios
Depois da implementação, vou validar este roteiro:
- abrir link do Tiago no celular
- abrir link do Diego no celular
- abrir link do Vitor Praia Grande
- copiar link na tela admin
- colar em navegador anônimo
- confirmar abertura normal do app
- bloquear um link e confirmar bloqueio
- reativar o link e confirmar volta do acesso
- abrir o link único de Goiânia
- informar CPF
- confirmar abertura do app correto
- atualizar página e confirmar persistência

## Detalhes técnicos
- Banco: migração para adicionar status real do link e campos de auditoria em `tecnicos_campo`.
- Backend: ajuste da função `supabase/functions/tecnico-app/index.ts` para retornar motivos específicos e registrar último acesso.
- Frontend móvel: ajuste em `src/context/TecnicoAppContext.tsx` para tratar mensagens corretas.
- Admin: ajuste em `src/pages/admin/AppOperacionalPage.tsx` para refletir status, ações e último acesso.
- Goiânia: criação do fluxo permanente por CPF, reaproveitando a mesma base de técnicos sem alterar login tradicional.

## Resultado esperado
Ao final:
- os links dos técnicos serão permanentes;
- não haverá mais mensagem de “expirado” para link ativo;
- o admin terá controle real de status e histórico;
- os links antigos quebrados serão regularizados;
- o fluxo único de Goiânia por CPF ficará permanente e isolado.