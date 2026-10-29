import type { Armazenamento, Conteudo, Registro } from "./sincronizacao";

// Armazenamento da sincronização no SQLite do Durable Object (Story 3.3,
// FR21): o estado dos arquivos sobrevive à hibernação e a nenhum PC ligado.
// Cada linha cabe nos 2 MB do SQLite do Durable Object porque o arquivo tem
// no máximo 1 MB (A14).

// Versões guardadas por arquivo como base de merge; mais antigas que isso, a
// escrita de quem ficou tão para trás vai para o histórico (sem perder nada).
const VERSOES_GUARDADAS = 50;

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
  }

  ler(caminho: string): Registro | null {
    const [linha] = this.sql.exec<Linha>("select * from arquivo where caminho = ?", caminho).toArray();
    return linha ? comoRegistro(linha) : null;
  }

  gravar(r: Registro): void {
    this.sql.exec(
      `insert into arquivo (caminho, versao, hash, conteudo, binario, apagado, autor_id, atualizado_em)
       values (?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (caminho) do update set versao = excluded.versao, hash = excluded.hash, conteudo = excluded.conteudo,
         binario = excluded.binario, apagado = excluded.apagado, autor_id = excluded.autor_id, atualizado_em = excluded.atualizado_em`,
      r.caminho,
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
  }

  todos(): Registro[] {
    return this.sql.exec<Linha>("select * from arquivo order by caminho").toArray().map(comoRegistro);
  }
}
