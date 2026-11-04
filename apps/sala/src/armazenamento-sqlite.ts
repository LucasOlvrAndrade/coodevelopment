import { eventoFeed, type EventoFeed } from "@coodevelopment/protocolo";
import type { ArmazenamentoFeed, EventoNovo } from "./feed";
import { chaveDeCaixa, type Armazenamento, type Conteudo, type Registro } from "./sincronizacao";

// Armazenamento da sincronização no SQLite do Durable Object (Story 3.3,
// FR21): o estado dos arquivos sobrevive à hibernação e a nenhum PC ligado.
// Cada linha cabe nos 2 MB do SQLite do Durable Object porque o arquivo tem
// no máximo 1 MB (A14).

// Versões guardadas por arquivo como base de merge; mais antigas que isso, a
// escrita de quem ficou tão para trás vai para o histórico (sem perder nada).
const VERSOES_GUARDADAS = 20;

// Histórico guardado por jam: as entradas mais antigas saem (gate da 3.3, PERF-002).
const HISTORICO_GUARDADO = 500;

type Linha = Record<string, SqlStorageValue>;

const comoRegistro = (l: Linha): Registro => ({
  caminho: String(l.caminho),
  versao: Number(l.versao),
  hash: String(l.hash),
  conteudo: String(l.conteudo),
  binario: l.binario === 1,
  apagado: l.apagado === 1,
  autorId: String(l.autor_id),
  atualizadoEm: String(l.atualizado_em),
});

export class ArmazenamentoSqlite implements Armazenamento {
  constructor(private sql: SqlStorage) {
    sql.exec(`create table if not exists arquivo (
      caminho text primary key,
      versao integer not null,
      hash text not null,
      conteudo text not null,
      binario integer not null,
      apagado integer not null,
      autor_id text not null,
      atualizado_em text not null
    )`);
    sql.exec(`create table if not exists versao (
      caminho text not null,
      versao integer not null,
      conteudo text not null,
      binario integer not null,
      apagado integer not null,
      primary key (caminho, versao)
    )`);
    sql.exec(`create table if not exists historico (
      id integer primary key autoincrement,
      caminho text not null,
      autor_id text not null,
      motivo text not null,
      conteudo text not null,
      binario integer not null,
      apagado integer not null,
      em text not null
    )`);
    // Caminho em minúsculas, calculado no JavaScript (o lower() do SQLite só
    // conhece ASCII: "Ação.md" e "AÇÃO.md" passavam), com índice para não
    // varrer a tabela a cada arquivo novo (gate da 3.3, REL-001 e PERF-003).
    // Salas criadas antes da coluna ganham a coluna e as chaves aqui.
    const colunas = sql.exec<Linha>("pragma table_info(arquivo)").toArray().map((c) => String(c.name));
    if (!colunas.includes("chave")) sql.exec("alter table arquivo add column chave text");
    for (const l of sql.exec<Linha>("select caminho from arquivo where chave is null").toArray()) {
      sql.exec("update arquivo set chave = ? where caminho = ?", chaveDeCaixa(String(l.caminho)), String(l.caminho));
    }
    sql.exec("create index if not exists arquivo_chave on arquivo (chave)");
  }

  outroComOutraCaixa(caminho: string): string | null {
    const [l] = this.sql.exec<Linha>("select caminho from arquivo where chave = ? and caminho <> ? limit 1", chaveDeCaixa(caminho), caminho).toArray();
    return l ? String(l.caminho) : null;
  }

  ler(caminho: string): Registro | null {
    const [linha] = this.sql.exec<Linha>("select * from arquivo where caminho = ?", caminho).toArray();
    return linha ? comoRegistro(linha) : null;
  }

  gravar(r: Registro): void {
    this.sql.exec(
      `insert into arquivo (caminho, chave, versao, hash, conteudo, binario, apagado, autor_id, atualizado_em)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (caminho) do update set versao = excluded.versao, hash = excluded.hash, conteudo = excluded.conteudo,
         binario = excluded.binario, apagado = excluded.apagado, autor_id = excluded.autor_id, atualizado_em = excluded.atualizado_em`,
      r.caminho,
      chaveDeCaixa(r.caminho),
      r.versao,
      r.hash,
      r.conteudo,
      r.binario ? 1 : 0,
      r.apagado ? 1 : 0,
      r.autorId,
      r.atualizadoEm,
    );
  }

  lerVersao(caminho: string, versao: number): Conteudo | null {
    const [l] = this.sql.exec<Linha>("select conteudo, binario, apagado from versao where caminho = ? and versao = ?", caminho, versao).toArray();
    return l ? { conteudo: String(l.conteudo), binario: l.binario === 1, apagado: l.apagado === 1 } : null;
  }

  guardarVersao(caminho: string, versao: number, c: Conteudo): void {
    this.sql.exec(
      "insert or replace into versao (caminho, versao, conteudo, binario, apagado) values (?, ?, ?, ?, ?)",
      caminho,
      versao,
      c.conteudo,
      c.binario ? 1 : 0,
      c.apagado ? 1 : 0,
    );
    this.sql.exec("delete from versao where caminho = ? and versao < ?", caminho, versao - VERSOES_GUARDADAS);
  }

  guardarNoHistorico(e: { caminho: string; autorId: string; motivo: "conflito" | "sobrescrito"; em: string } & Conteudo): void {
    this.sql.exec(
      "insert into historico (caminho, autor_id, motivo, conteudo, binario, apagado, em) values (?, ?, ?, ?, ?, ?, ?)",
      e.caminho,
      e.autorId,
      e.motivo,
      e.conteudo,
      e.binario ? 1 : 0,
      e.apagado ? 1 : 0,
      e.em,
    );
    this.sql.exec("delete from historico where id <= (select max(id) from historico) - ?", HISTORICO_GUARDADO);
  }

  todos(): Registro[] {
    return this.sql.exec<Linha>("select * from arquivo order by caminho").toArray().map(comoRegistro);
  }
}

export type AvisoGuardado = {
  // O socket que mandou (o `soquete` do estado da conexão).
  conexao: string;
  usuarioId: string;
  id: string;
  resumo: string;
  arquivos: string[];
  // Desde quando o Claude trabalha, gravado quando a conexão cai.
  desde: string | null;
  // Quando a conexão de quem anunciou caiu; null com ela de pé.
  caiuEm: number | null;
};

// Os avisos ativos ficam no SQLite, não no estado da conexão: esse estado tem
// teto de 16 KB, e um aviso de 50 caminhos longos não caberia (gate da 4.4,
// REL-008). Na ordem de usuário e, dentro dele, na ordem em que chegaram: o
// primeiro de cada conexão é o mais recente dela.
export class ArmazenamentoAvisosSqlite {
  constructor(private sql: SqlStorage) {
    sql.exec(`create table if not exists aviso_ativo (
      usuario_id text not null,
      id text not null,
      conexao text not null,
      resumo text not null,
      arquivos text not null,
      desde text,
      caiu_em integer,
      primary key (usuario_id, id)
    )`);
  }

  // Tudo o que está ativo nesta conexão passa a ser esta lista. O mesmo id de
  // uma conexão que caiu volta a valer aqui, sem a marca da queda.
  trocar(conexao: string, usuarioId: string, avisos: readonly { id: string; resumo: string; arquivos: readonly string[] }[]): void {
    this.limpar(conexao);
    for (const a of avisos) {
      this.sql.exec(
        "insert or replace into aviso_ativo (usuario_id, id, conexao, resumo, arquivos, desde, caiu_em) values (?, ?, ?, ?, ?, null, null)",
        usuarioId,
        a.id,
        conexao,
        a.resumo,
        JSON.stringify(a.arquivos),
      );
    }
  }

  limpar(conexao: string): void {
    this.sql.exec("delete from aviso_ativo where conexao = ?", conexao);
  }

  todos(): AvisoGuardado[] {
    return this.sql
      .exec<Linha>("select * from aviso_ativo order by usuario_id, rowid")
      .toArray()
      .map((l) => ({
        conexao: String(l.conexao),
        usuarioId: String(l.usuario_id),
        id: String(l.id),
        resumo: String(l.resumo),
        arquivos: JSON.parse(String(l.arquivos)) as string[],
        desde: l.desde === null ? null : String(l.desde),
        caiuEm: l.caiu_em === null ? null : Number(l.caiu_em),
      }));
  }

  caiu(conexao: string, desde: string, em: number): void {
    this.sql.exec("update aviso_ativo set desde = ?, caiu_em = ? where conexao = ?", desde, em, conexao);
  }

  // A sala reiniciou sem o fechamento de alguma conexão: conta como queda.
  soltarOrfaos(vivas: ReadonlySet<string>, em: number): void {
    for (const a of this.todos()) {
      if (a.caiuEm === null && !vivas.has(a.conexao)) this.caiu(a.conexao, a.desde ?? new Date(em).toISOString(), em);
    }
  }

  vencer(limite: number): void {
    this.sql.exec("delete from aviso_ativo where caiu_em is not null and caiu_em <= ?", limite);
  }

  primeiraQueda(): number | null {
    const [l] = this.sql.exec<Linha>("select min(caiu_em) as em from aviso_ativo").toArray();
    return l?.em === null || l?.em === undefined ? null : Number(l.em);
  }
}

// Itens do feed guardados por jam: os mais antigos saem. A página recebe os
// últimos 100 ao abrir (Story 3.4); a retenção ligada ao commit fica para o
// Epic 5.
const FEED_GUARDADO = 200;

// Feed no SQLite do Durable Object (Story 3.4). Cada item é um JSON validado
// pelo protocolo na leitura: linha que não passa (versão antiga) fica de fora.
export class ArmazenamentoFeedSqlite implements ArmazenamentoFeed {
  constructor(private sql: SqlStorage) {
    sql.exec(`create table if not exists feed (
      id integer primary key autoincrement,
      dados text not null
    )`);
  }

  inserir(evento: EventoNovo): number {
    const [l] = this.sql.exec<Linha>("insert into feed (dados) values (?) returning id", JSON.stringify(evento)).toArray();
    const id = Number(l!.id);
    this.sql.exec("delete from feed where id <= ?", id - FEED_GUARDADO);
    return id;
  }

  atualizar(evento: EventoFeed): void {
    const { id, ...dados } = evento;
    this.sql.exec("update feed set dados = ? where id = ?", JSON.stringify(dados), id);
  }

  ultimos(n: number): EventoFeed[] {
    return this.sql
      .exec<Linha>("select id, dados from feed order by id desc limit ?", n)
      .toArray()
      .flatMap((l) => {
        let dados: unknown;
        try {
          dados = JSON.parse(String(l.dados));
        } catch {
          return [];
        }
        const lido = eventoFeed.safeParse({ ...(dados as object), id: Number(l.id) });
        return lido.success ? [lido.data] : [];
      });
  }
}
