# API Specification

Três superfícies:

1. **Server Actions** para a interface web (amigos, nova jam, fechar). Não
   são API pública; os tipos ficam junto das páginas.
2. **REST** em `/api/*` para o conector, a sala e o login.
3. **Mensagens WebSocket** da sala, definidas em `packages/protocolo`.

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Coodevelopment API
  version: 0.1.0
  description: Rotas usadas pelo conector, pela sala e pelo login. A interface web usa Server Actions.
servers:
  - url: https://coodevelopment.lucas-andrade.dev
    description: Produção
paths:
  /api/auth/{...}:
    description: Rotas do Better Auth (login GitHub, sessão, /device/code, /device/token, /device/approve).
  /api/saude:
    get:
      summary: App e banco acessíveis (Story 1.1)
      responses:
        "200": { description: '{ "app": "ok", "banco": "ok" }' }
  /api/jams/{jamId}/token-sala:
    post:
      summary: Emite o JWT de 10 minutos para entrar na sala
      description: >
        Aceita a sessão do navegador (cookie) ou a sessão do conector
        (Authorization Bearer, obtida pelo login por dispositivo). Só
        participantes da jam recebem token.
      parameters:
        - { name: jamId, in: path, required: true, schema: { type: string } }
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                via: { type: string, enum: [pagina, conector] }
      responses:
        "200":
          description: Token emitido
          content:
            application/json:
              schema:
                type: object
                properties:
                  token: { type: string }
                  salaUrl: { type: string, example: "wss://coodevelopment-sala.CONTA.workers.dev/parties/jam/k7m2-rbq9" }
                  expiraEm: { type: string, format: date-time }
        "403": { description: Não é participante }
  /api/jams/{jamId}/conector:
    get:
      summary: Dados que o conector precisa para ligar a pasta (Story 3.1)
      responses:
        "200":
          description: Repositório, branch, baseSha e URL de clone
          content:
            application/json:
              schema:
                type: object
                properties:
                  repo: { type: string, example: "lucas/projeto" }
                  branch: { type: string }
                  baseSha: { type: string }
                  cloneUrl: { type: string }
                  estado: { type: string, enum: [aberta, fechando, fechada] }
  /api/conector/clone-token:
    post:
      summary: Token de leitura de curta duração só para o git clone do repositório da jam
      description: >
        O conector nunca recebe o token do GitHub do usuário (NFR8). Para clonar
        repositório privado, o app gera um token de instalação do GitHub App
        restrito a esse repositório, com permissão só de leitura e validade de
        1 hora. [verificar na Story 3.1]
  /api/interno/sala/{jamId}:
    post:
      summary: Chamadas da sala para o app (segredo de serviço)
      description: >
        Usado pela sala para registrar presença do conector na lista de jams e
        o horário da primeira mudança sem commit (lembrete, FR24).
```

## Mensagens da sala (WebSocket)

Todas com `{ v: 1, tipo, ... }`, validadas com zod nas duas pontas. Resumo
(a definição completa vai em `packages/protocolo/src/mensagens.ts`):

| Direção | Tipo | Conteúdo |
|---|---|---|
| cliente → sala | `ola` | `via` (pagina ou conector), versão do protocolo, `soLocal` |
| sala → cliente | `estado` | participantes, presença, status, avisos ativos, últimos 100 eventos do feed, `baseSha`, manifesto (`caminho → versao, hash`) |
| conector → sala | `escrever` | `caminho`, `versaoBase`, `hash`, `conteudo` (texto ou base64), `binario`, `apagado`, `conteudoBase` (só na primeira escrita do arquivo; `null` se não existia no `baseSha`) |
| sala → autor | `aceito` | `caminho`, `versao`, `hash` da escrita que entrou como veio (Story 3.3) |
| sala → conector | `manifesto` | ao conectar: `caminho`, `versao`, `hash`, `apagado` de tudo que mudou desde o `baseSha`; os arquivos vêm em seguida com `origem: estado` (Story 3.3) |
| sala → conectores | `arquivo` | `caminho`, `versao`, `hash`, `conteudo`, `binario`, `apagado`, `autorId`, `origem` (escrita, merge ou estado) |
| sala → autor | `recusado` | `caminho`, motivo (`conflito_guardado`, `jam_fechando`, `caminho_invalido`, `proibido`, `grande_demais`); no conflito, o arquivo atual chega em seguida numa mensagem `arquivo` |
| conector → sala | `status` | `trabalhando` ou `parado` (hooks) |
| conector → sala | `anunciar` | `resumo`, `arquivos` |
| sala → todos | `presenca`, `status`, `aviso`, `evento` | atualizações incrementais |
| sala → conector | `divergencia-pedido` / conector → sala `divergencia` | lista de arquivos diferentes ao reabrir (D17) |
| página → sala | `divergencia-escolha` | `atualizar` ou `soLocal` |
| sala → todos | `fechando`, `fechada` | trava de escrita e fim (Story 5.1) |
