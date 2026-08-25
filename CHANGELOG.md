# Changelog — Brasauto Compras

## 10.9.2
- Prisma `relationJoins` habilitado para reduzir viagens ao PostgreSQL em consultas com relacionamentos.
- Consultas críticas de sessão, solicitações, pedidos, financeiro, estoque e auditoria de fluxo passam a priorizar joins no banco.
- Sessão autenticada recebe cache curto de 60 segundos no processo Node, evitando nova consulta remota a cada navegação.
- Logout invalida imediatamente o cache da sessão.
- Diagnóstico `[perf]` diferencia `auth:session-db` de `auth:session-cache`.
- Nenhuma regra de negócio foi alterada.

## 10.9.1
- Diagnóstico de performance ativado em desenvolvimento.
- Terminal passa a mostrar tempos individuais de sessão e consultas críticas com prefixo `[perf]`.
- Listagens principais recebem limites seguros para evitar crescimento indefinido de payload.
- Mantidas as otimizações anteriores de sessão, health check e selects reduzidos.
- Nenhuma regra de negócio foi alterada.

## 10.9.0
- Onda dedicada à performance, sem novas funcionalidades.
- Sessão do usuário deduplicada no mesmo carregamento entre Layout e páginas protegidas.
- Health check do PostgreSQL deduplica chamadas simultâneas além do cache temporal.
- Listagens de solicitações, pedidos, financeiro, estoque e movimentações buscam apenas os campos usados pela interface.
- Dashboard reduz payload dos indicadores e corrige mensagem contraditória do estoque.
- Mantidas as otimizações e feedbacks visuais da 10.8.8/10.8.9.

## 10.8.9
- Refinamento visual dos cards do Dashboard.
- KPIs ganham hierarquia visual, indicadores compactos e estados de atenção.
- Cards financeiros recebem descrições curtas e destaque semântico.
- Melhorado espaçamento, legibilidade e adaptação responsiva.
- Nenhuma regra de negócio ou consulta foi alterada nesta versão.

## 10.8.8
- Otimização de latência para PostgreSQL remoto.
- Health check do banco passa a ser reutilizado por 60 segundos, evitando `SELECT 1` antes de cada consulta.
- Leituras independentes da criação de cotação passam a rodar em paralelo.
- Cadastro de item grava item, inventário e auditoria na mesma transação.
- Reposição de estoque reduz viagens ao banco e grava solicitação/auditoria na mesma transação.
- Botões de cadastro e solicitação de reposição mostram estado imediato de processamento e bloqueiam duplo clique.
- Indicador visual de carregamento adicionado aos botões em processamento.

## 10.8.7
- Cotações ficam imutáveis assim que a solicitação sai da fase de cotação.
- Links de exclusão deixam de aparecer após envio para aprovação, aprovação, pedido, recebimento ou finalização.
- Proteção também aplicada no servidor, inclusive para propostas não selecionadas.
- A seção passa a sinalizar “Histórico protegido” após o encerramento da cotação.

## 10.8.6
- Corrigido vencimento de condições “após recebimento” quando o prazo em dias foi informado na cotação.
- “Faturado após recebimento + 30 dias” passa a vencer 30 dias depois do recebimento total.
- Condições com agenda própria (30/60, 30/60/90 etc.) continuam usando seus dias configurados.
- Adicionados testes de agenda financeira.
- Novo comando idempotente `npm run db:repair-finance` para reconciliar pedidos já recebidos com vencimento calculado pela regra antiga.

## 10.8.5
- Corrigido falso logout causado por falhas transitórias na leitura da sessão no PostgreSQL.
- Consulta de sessão agora tenta novamente antes de considerar erro de banco.
- Erro de banco no login deixa de ser mascarado como “senha inválida”.
- Sessão ausente/expirada passa a ter mensagem própria.
- Botões Aprovar/Reprovar ficam bloqueados durante processamento para evitar decisão duplicada.

## 10.8.4
- Após selecionar uma cotação, o fluxo agora redireciona diretamente para Aprovações.
- A tela de Aprovações exibe confirmação de envio e destaca a solicitação recém-encaminhada.
- O botão “Selecionar e enviar para aprovação” mostra estado de processamento e bloqueia reenvio enquanto a ação está em andamento.
- Mantidas as proteções contra duplicidade de cotação da 10.8.3.

## 10.8.3
- Bloqueio visual de duplo envio ao salvar cotações.
- Proteção no servidor contra cotações idênticas reenviadas em até 60 segundos.
- Redirecionamento explícito e revalidação da página de detalhes após salvar.
- Exclusão segura de cotação antes da etapa de aprovação.
- Mensagens de confirmação para duplicidade bloqueada e exclusão.
- Mantida a linha do tempo da compra e a auditoria técnica.

## 10.8
- Linha do tempo da compra dentro da solicitação.
- Rastreabilidade de cotação, aprovação, pedido, recebimento e pagamento.
- Auditoria técnica filtrável por solicitação.
- Atalho do pedido para a solicitação de origem.

## 10.7
- Dashboard gerencial, central de atenção e indicadores.
- Correções estruturais de rolagem, sidebar e eficiência comercial.

## 10.6
- Controle financeiro de compras com baixa e reabertura de pagamento.

## 10.5
- Emissão e acompanhamento de pedidos, recebimentos e integração com estoque.

## 10.4
- Comparativo de cotações, recomendação comercial e fluxo de aprovação.

## 10.3
- Solicitações vinculadas ao fluxo de cotações.

## 6–10.2
- Estoque/consumo, usuários, alçadas, fornecedores, autenticação, auditoria e fundações do fluxo de compras.
