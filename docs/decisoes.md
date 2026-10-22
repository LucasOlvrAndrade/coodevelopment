# Coodevelopment: decisões e arquitetura inicial

Sistema para até três pessoas desenvolverem juntas com o Claude, direto no
navegador. Cada usuário entra com a própria conta, adiciona amigos e cria uma
jam a partir de um repositório do GitHub. A feature principal é o contexto
atualizado em tempo real, com preview do projeto ao vivo. O codesenvolvimento
tem que ser polido e responsivo.

Nome: **Coodevelopment**, em `coodevelopment.lucas-andrade.dev`.

## Decisões do Lucas (2026-10-22)

| # | Decisão | Escolha |
|---|---|---|
| ~~D1~~ | ~~Onde o Claude Code roda~~ | ~~Sandbox na nuvem por jam~~. **Substituída pela D8** no mesmo dia: o Lucas achou que a máquina na nuvem não é necessária |
| D2 | Sessões | Uma sessão do Claude por pessoa, nos mesmos arquivos. A cada prompt, o Claude avisa que vai trabalhar em mudanças e dá um resumo curto do que é |
| D3 | Quem paga o Claude | Uma chave só, do Lucas |
| D4 | Repositório | Na conta de quem cria a jam, com duas opções: importar um repo que ele já tem ou criar um novo. Os outros entram como colaboradores |
| D5 | Commit | Ao fechar a jam, para não haver risco de perder trabalho. Se a jam fechar sozinha (todos saíram, ociosa, navegador fechado), o commit e o push acontecem do mesmo jeito |
| D6 | Tamanho da jam | No máximo 3 pessoas por enquanto |
| D7 | Limites de uso | Nenhum por enquanto; no começo o uso é só do Lucas e do pai dele |
| D8 | Onde o projeto e o Claude rodam | **No navegador.** O projeto e o dev server do preview rodam no navegador de cada participante (WebContainers). O Claude é chamado pela API com a chave do Lucas e edita os arquivos por ferramentas do próprio app. Não é o Claude Code (CLI); é o Claude com ferramentas nossas. Sem máquina na nuvem |

## Arquitetura proposta

```
                      app Next.js (Vercel)
                      ├ login GitHub, amigos, jams (Neon)
                      ├ proxy do Claude (chave do Lucas)
                      └ commit/push via GitHub API ao fechar
                               ▲
Navegador A                    │                    Navegador B
├ WebContainer: projeto ◄──────┼── serviço de ────► ├ WebContainer: projeto
│ + dev server → preview       │   tempo real       │ + dev server → preview
├ chat com o seu Claude        │   (arquivos,       ├ chat com o seu Claude
└ feed ao vivo                 │   avisos, quem     └ feed ao vivo
                               │   está online)
```

- **Login:** GitHub OAuth (Auth.js). Já dá a identidade e o token para criar
  repo e convidar colaborador. O convite é aceito automaticamente com o token
  do amigo (`PATCH /user/repository_invitations/{id}`).
- **Amigos:** pedido de amizade por @ do GitHub; só amigos podem ser chamados
  para uma jam.
- **Projeto no navegador:** ao entrar na jam, o navegador baixa os arquivos,
  monta o WebContainer, instala as dependências e sobe o dev server. Cada
  participante tem o seu container, todos com os mesmos arquivos.
- **Arquivos compartilhados:** a fonte da verdade dos arquivos da jam é um
  documento compartilhado no serviço de tempo real, guardado no servidor. Toda
  edição (de qualquer Claude) vai para ele e é aplicada no container de cada
  participante. Por estar no servidor, o commit não depende de nenhum
  navegador estar aberto (D5).
- **Claude:** o laço do agente roda no navegador de quem fez o pedido; cada
  chamada passa pelo proxy do app, que guarda a chave. Ferramentas do app:
  `anunciar`, ler arquivo, escrever arquivo, listar, buscar e rodar comando no
  container de quem pediu.
- **Contexto ao vivo (a feature principal):**
  1. Antes de mexer em qualquer arquivo, o Claude chama
     `anunciar(resumo, arquivos)`; o aviso aparece na tela dos outros.
  2. O aviso entra também no contexto dos outros Claudes, então cada Claude
     sabe o que os outros estão fazendo.
  3. Cada edição é transmitida (arquivo, autor, diff curto).
  4. Se o arquivo está reservado pelo aviso de outro Claude, a ferramenta de
     escrita avisa antes de editar, e a pessoa vê o conflito na tela.
- **Preview:** o dev server de cada container num iframe; o HMR atualiza
  sozinho quando os arquivos mudam.
- **Commit:** feito pelo app via GitHub API a partir dos arquivos guardados no
  servidor, ao fechar a jam ou quando ela fica sem ninguém.
- **Serviço de tempo real:** a Vercel não segura conexão aberta, então precisa
  de um serviço externo (Liveblocks, PartyKit, Ably ou similar). Escolha do
  @architect.

## Riscos conhecidos

- **Licença do WebContainers:** uso pessoal é permitido; uso comercial em
  produção exige licença da StackBlitz. Hoje o uso é só pessoal (D7). Confirmar
  os termos atuais antes de abrir para mais gente.
- **Navegadores e celular:** WebContainers funciona melhor em Chrome/Edge no
  computador; Safari e Firefox têm suporte limitado e o celular pode não
  aguentar rodar o projeto. No celular a jam pode ficar só com chat e feed, sem
  preview. Confirmar o suporte atual.
- **Só projetos Node:** o container roda Node, não Python, banco local etc.
- **Instalação pesada:** cada navegador instala as dependências do projeto; em
  projetos grandes isso demora e consome memória.
- **Sessões nos mesmos arquivos:** o aviso e a reserva de arquivo reduzem
  conflito, mas não eliminam; precisa de teste com uso real.
- **Custo:** só tokens do Claude e o plano do serviço de tempo real; não há
  mais máquina ligada.

## Em aberto

- Serviço de tempo real (para o @architect).
- Confirmar licença e suporte de navegador do WebContainers (pesquisa do
  @analyst).
