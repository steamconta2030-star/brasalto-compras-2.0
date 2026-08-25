# Integração de solicitações por e-mail — Localweb

## Objetivo

Integrar uma caixa de e-mail hospedada na **Localweb** ao Brasauto Compras 2.0 para transformar mensagens autorizadas em solicitações de compra.

## Fluxo proposto

1. Um gerente envia a solicitação para a caixa de compras definida pela Brasauto.
2. A integração consulta periodicamente a caixa postal.
3. O sistema valida o remetente, o padrão do assunto e a unidade.
4. Mensagens válidas geram uma solicitação de compra.
5. A equipe de Compras inicia as cotações.
6. O fluxo segue para comparação comercial, aprovação, pedido e recebimento.
7. A mensagem recebe um registro de processamento para impedir duplicidade.

## Regras sugeridas

- Não confiar na assinatura escrita no corpo do e-mail.
- Validar o endereço real do remetente contra usuários ativos e autorizados.
- Permitir padrões de assunto configuráveis.
- Identificar unidade, departamento, categoria, urgência e itens.
- Guardar o identificador original da mensagem para idempotência.
- Registrar assunto, remetente, data, regra aplicada e resultado do processamento na auditoria.
- Mensagens completas de gerentes autorizados podem entrar como `AGUARDANDO_COTACAO`.
- Mensagens incompletas ou não reconhecidas devem entrar como `NOVA` para conferência ou ser rejeitadas.
- Não armazenar credenciais da caixa postal no GitHub.

## Estrutura já existente

A rota abaixo já recebe uma mensagem estruturada e cria uma solicitação:

`POST /api/integrations/email/requests`

Ela já possui:

- autenticação por Bearer token;
- validação de payload com Zod;
- associação pelo e-mail do remetente;
- identificação da unidade;
- criação de itens;
- marcação da origem como e-mail;
- prevenção de duplicidade por `messageId`.

## Implementações pendentes

- Cliente IMAP compatível com a Localweb.
- Consulta periódica da caixa de entrada.
- Cadastro de regras de assunto e remetentes autorizados.
- Tela de monitoramento de mensagens processadas, ignoradas e com erro.
- Extração segura de itens do corpo do e-mail.
- Tratamento de anexos.
- Registro técnico e auditoria da integração.
- Estratégia de agendamento compatível com a hospedagem atual.

## Configuração pendente da Localweb

Antes da implementação, confirmar com a Localweb:

- endereço da caixa postal que receberá as solicitações;
- servidor de entrada IMAP;
- porta IMAP;
- uso de SSL/TLS;
- formato do usuário de autenticação;
- limites de conexão e consulta.

A senha da caixa postal deverá existir apenas nas variáveis protegidas da Vercel.

## Variáveis previstas

Os nomes finais poderão ser ajustados durante a implementação:

```env
EMAIL_IMAP_HOST=
EMAIL_IMAP_PORT=
EMAIL_IMAP_SECURE=
EMAIL_IMAP_USER=
EMAIL_IMAP_PASSWORD=
EMAIL_INGEST_SECRET=
EMAIL_INGEST_FALLBACK_USER_EMAIL=
```

## Decisão pendente

Definir a frequência desejada para leitura da caixa:

- uma vez ao dia; ou
- a cada 10/15 minutos por meio de um agendador compatível.

## Status

**Planejado — aguardando os dados técnicos da conta Localweb e a definição da caixa monitorada.**
