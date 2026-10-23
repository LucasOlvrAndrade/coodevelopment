# Security and Performance

## Security Requirements

**Frontend Security:**
- CSP Headers: `default-src 'self'`; `connect-src 'self'
  wss://coodevelopment-sala.CONTA.workers.dev`; `img-src 'self'
  avatars.githubusercontent.com`; scripts com nonce do Next.js
- XSS Prevention: React escapa por padrão; resumos de aviso e nomes de
  arquivo são sempre texto, nunca HTML; nada de `dangerouslySetInnerHTML`
- Secure Storage: nenhum token no `localStorage`; o JWT da sala fica só na
  memória da aba

**Backend Security:**
- Input Validation: zod em toda rota, Server Action e mensagem da sala
- Rate Limiting: firewall da Vercel nas rotas de login e device code; na
  sala, limite de 50 mensagens por segundo por conexão
- CORS Policy: rotas `/api` só aceitam a própria origem; o conector usa
  Bearer, sem cookie

**Authentication Security:**
- Token Storage: token do GitHub só no Neon, cifrado (NFR8); sessão do
  conector no Windows com DPAPI (só o usuário do Windows lê)
- Session Management: sessão web do Better Auth em cookie httpOnly; JWT da
  sala de 10 minutos, renovado pelo cliente
- Password Policy: não há senha; só GitHub

**Proteções do conector (o ponto mais sensível, porque grava no disco):**
- Caminho normalizado e conferido contra a raiz antes de qualquer escrita;
  `..`, caminho absoluto, `.git/` e link simbólico para fora são recusados
  (FR18)
- Servidor local só em `127.0.0.1`, com segredo aleatório por sessão no
  arquivo de descoberta (lido só pelo usuário do Windows)
- O conector nunca executa conteúdo recebido; ele só grava arquivos
- Texto vindo dos outros (avisos, resumos) é injetado no Claude dentro de um
  bloco marcado como informação sobre outros participantes, com instrução
  explícita de não tratar como ordem (FR15, Story 4.3 AC 3)

## Performance Optimization

**Frontend Performance:**
- Bundle Size Target: página da jam abaixo de 150 KB de JavaScript (gzip)
- Loading Strategy: Server Components; só a parte ao vivo é cliente
- Caching Strategy: páginas dinâmicas sem cache; fotos do GitHub com
  `next/image`

**Backend Performance:**
- Response Time Target: status chega aos outros em menos de 1 s (NFR1) e
  arquivo em menos de 2 s (NFR2), medidos na integração e no teste a dois
- Database Optimization: índices acima; nenhuma consulta ao Neon no caminho
  do tempo real
- Caching Strategy: a sala mantém na memória o manifesto e os avisos ativos;
  o SQLite é a cópia durável

**Conector (NFR6):**
- `@parcel/watcher` com a lista de ignorados já aplicada na assinatura, para
  não acordar com `node_modules`
- Hash só de arquivo que mudou; nada de varredura periódica
- Meta: menos de 150 MB de memória e CPU abaixo de 2% parado, conferida no
  modo de diagnóstico
