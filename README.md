# Brasauto Compras · Onda 6

Sistema interno de gestão de compras da Brasauto, evoluído em ondas.

## Fluxo atual

Solicitação → Cotação → Comparação comercial → Envio para aprovação → Aprovação/Reprovação → Pedido de compra → Recebimento parcial/total → Financeiro previsto.

## Onda 4 · Segurança e governança

Esta onda ativa a estrutura de usuários/perfis que já existia no domínio e acrescenta:

- login individual com sessão HTTP-only;
- senha armazenada com `scrypt` + salt;
- expiração de sessão e encerramento de sessões ao desativar um usuário;
- perfis e permissões por ação;
- menu filtrado conforme o perfil;
- proteção também nas Server Actions (não apenas na interface);
- fila de aprovações pendentes;
- alçadas configuráveis por valor, unidade e divergência da recomendação;
- justificativa obrigatória para escolha diferente da recomendação comercial;
- pedido liberado apenas após aprovação;
- cadastro/ativação/desativação de usuários;
- trilha de auditoria para solicitações, fornecedores, cotações, decisões, pedidos, recebimentos, usuários e alçadas.

### Perfis criados pelo seed

- `SOLICITANTE`
- `COMPRAS`
- `APROVADOR`
- `RECEBIMENTO`
- `FINANCEIRO`
- `ADMIN`

### Permissões

`REQUEST_CREATE`, `QUOTATION_MANAGE`, `SUPPLIER_MANAGE`, `APPROVAL_DECIDE`, `PURCHASE_ORDER_CREATE`, `RECEIPT_REGISTER`, `FINANCE_VIEW`, `INVENTORY_MANAGE`, `AUDIT_VIEW`, `USER_MANAGE` e `ADMIN_ALL`.

## Alçadas iniciais

O seed inclui regras demonstrativas e editáveis pelo banco/interface:

- até R$ 5.000;
- acima de R$ 5.000;
- regra prioritária quando a escolha diverge da recomendação do sistema.

Os valores são apenas uma configuração inicial de desenvolvimento e devem ser ajustados antes da homologação conforme a política real da Brasauto.

## Banco e ativação

1. Copie `.env.example` para `.env`.
2. Configure `DATABASE_URL` para PostgreSQL.
3. Defina senhas de seed seguras.
4. Execute `npm ci`.
5. Execute `npm run db:deploy` (ou `npm run db:migrate` em desenvolvimento).
6. Execute `npm run db:seed`.
7. Inicie com `npm run dev`.

Em desenvolvimento, se nenhuma senha for informada por variável de ambiente, o seed possui credenciais-padrão somente para facilitar teste local. **Troque todas antes de qualquer homologação compartilhada ou produção.**

## Migração adicionada

`prisma/migrations/0002_security_governance/migration.sql`

Cria tabelas de sessão e alçadas e amplia aprovações com referência à regra e data de criação.

## Validação desta entrega

- Foi realizada transpiração sintática de todos os arquivos TS/TSX com TypeScript 5.8.3 e não foram encontrados erros de sintaxe.
- `tsc --noEmit` não pôde concluir porque `node_modules` não está presente e, portanto, `vitest/globals` não está disponível.
- `npm ci` não concluiu no ambiente de execução atual. Por isso, Prisma Validate, testes unitários e `next build` **não são marcados como aprovados** nesta onda.

Antes de produção, a onda de estabilização deverá executar obrigatoriamente: `npm ci`, `npm run db:validate`, `npm test`, `npm run typecheck` e `npm run build` em ambiente com dependências instaladas e PostgreSQL de homologação.


## Onda 5 — Inteligência gerencial

A Onda 5 adiciona o painel de indicadores, desempenho de fornecedores e histórico de preços. Como foi incluído o campo `issuedAt` em pedidos, execute `npx prisma generate` e `npx prisma db push` ao atualizar a versão. Consulte `ONDA5.md`.


## Onda 6 — Estoque e uso/consumo

A Onda 6 adiciona inventário por unidade, movimentações de estoque, consumo médio, cobertura em dias, ponto de reposição, previsão de recompra, quantidade sugerida e geração de solicitação de compra a partir do alerta. Consulte `ONDA6.md`.

Ao atualizar da Onda 5, copie o mesmo `.env` para a nova pasta e execute `npm ci`, `npx prisma generate`, `npx prisma db push`, `npx prisma db seed`, `npm run typecheck`, `npm run test` e `npm run build`.


## Onda 7 — Materiais recorrentes
- Base inicial de Copa/Limpeza e Escritório.
- Criticidade por item: Normal, Importante ou Crítico.
- Método de reposição: consumo médio ou estoque mínimo.
- Fornecedor principal opcional.
- Catálogo de referência em `/estoque/catalogo` e sugestões no cadastro.
- Após atualizar: `npx prisma generate` e `npx prisma db push`.

## Onda 8 — Operação diária
- Cadastro em massa por unidade.
- Lista consolidada de reposição.
- Atalhos operacionais no módulo de estoque.

## Onda 9 — UX operacional do estoque
- Pesquisa instantânea por item, categoria e fornecedor.
- Filtros por status, criticidade e unidade.
- Tabela de estoque compacta e responsiva.
- Prioridades de compra com destaque visual.
- Movimentações recentes mais compactas.

## Onda 10 — inteligência de consumo e ciclo fechado
- Ajustes de inventário não contaminam consumo médio.
- Histórico consolidado assume previsão apenas com base suficiente.
- Solicitações de reposição ficam vinculadas ao item de estoque.
- Recebimento de pedido originado pelo estoque gera entrada automática.
