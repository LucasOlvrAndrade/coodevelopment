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
| conector → sala | `ignorado` | `caminho`, `motivo: grande_demais`, `tamanho`: arquivo acima de 1 MB que ficou no PC, uma vez por arquivo, só para o feed (Story 3.4, A14) |
| sala → páginas | `feed` | `eventos` (`EventoFeed` com `id`), `inicial`: ao abrir a página, os últimos 100 do mais antigo ao mais novo (`inicial: true`); depois, cada item novo ou atualizado (o mesmo `id` substitui). Os conectores não recebem o feed (Story 3.4) |
| conector → sala | `status` | `estado` (`trabalhando` ou `parado`) e `motivo` (o erro do `StopFailure`, ou null), vindos dos hooks pelo servidor local do conector (Story 4.1) |
| sala → páginas e conectores | `claudes` | `trabalhando`: `usuarioId` e `desde` de quem está com o Claude trabalhando, ao abrir e a cada mudança; some quando o conector cai (Story 4.1). `resumo` do aviso ativo (4.2) e `arquivos`, a união dos anunciados nas pastas da pessoa (4.3). `avisoId` e `avisos` (`id`, `resumo`, `arquivos`, `queda`): cada aviso ativo da pessoa (4.4). Depois de uma queda da conexão, os avisos continuam por 2 min só para os conectores, com `queda: true`. O conector passa os dos outros ao Claude da pasta |
| sala → páginas | `parou` | `usuarioId` e `motivo` quando o Claude parou por erro; a página mostra por 8 s (Story 4.1) |
| conector → sala | `aviso` | `id` (gerado pelo conector, não muda ao reconectar), `resumo` (até 300), `arquivos` (até 50, relativos à pasta) e `outros` (até 9, os avisos das outras sessões do Claude na pasta): o Claude anunciou pelo `anunciar` do MCP do plugin; vale até o status voltar a parado. A sala guarda no SQLite, põe um item `aviso` no feed e o resumo no `claudes` (Story 4.2 e 4.4) |
| conector → sala | `reserva` | `caminho`: o Claude da pasta pediu para mexer num arquivo que está no aviso de outro. A sala confere o dono pelos avisos ativos (o conector não diz quem é), põe um item `reserva` no feed (`autorId`, `donoId`, `caminho`, `resumo`, `avisoId`) e avisa os conectores do dono (Story 4.4) |
| sala → conectores do dono | `reserva_pedida` | `autorId`, `caminho`, `donoId`: o conector de quem anunciou mostra no terminal (Story 4.4) |
| sala → todos | `presenca`, `status`, `aviso`, `evento` | atualizações incrementais |
| sala → conector | `divergencia-pedido` / conector → sala `divergencia` | lista de arquivos diferentes ao reabrir (D17) |
| página → sala | `divergencia-escolha` | `atualizar` ou `soLocal` |
| sala → todos | `fechando`, `fechada` | trava de escrita e fim (Story 5.1) |
