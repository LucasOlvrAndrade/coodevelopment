import { ARQUIVOS_POR_ITEM, TAMANHO_MAXIMO, arquivoDeDependencias, type ArquivoGrande, type ArquivoNoFeed, type EventoFeed } from "@coodevelopment/protocolo";

// Regra do feed da jam (Story 3.4, FR20). Pura como a sincronização: recebe o
// armazenamento por uma interface, para rodar no Durable Object (SQLite) e
// em Node (memória).

type SemId<T> = T extends EventoFeed ? Omit<T, "id"> : never;
export type EventoNovo = SemId<EventoFeed>;

export interface ArmazenamentoFeed {
  // Grava um item novo e devolve o id dele (crescente).
  inserir(evento: EventoNovo): number;
  atualizar(evento: EventoFeed): void;
  // Os n mais novos, do mais novo ao mais antigo.
  ultimos(n: number): EventoFeed[];
}

// Uma mudança aceita num arquivo, como a sincronização vê.
export type Mudanca = {
  autorId: string;
  caminho: string;
  mudanca: ArquivoNoFeed["mudanca"];
  binario: boolean;
  diferenca: { adicionadas: number; removidas: number } | null;
  juntado: boolean;
  // Sem aviso ativo do autor (Story 4.2, FR19).
  semAviso?: boolean;
};

// Itens que a página recebe ao abrir (AC 6).
export const ITENS_AO_CONECTAR = 100;

// Mudanças seguidas do mesmo autor entram no mesmo item enquanto a anterior
// tiver menos que isso (AC 3). Para o aviso de arquivo grande, que o conector
// manda ao ligar, a janela é a mesma.
const JANELA_DO_GRUPO_MS = 5 * 60 * 1000;

// Quantos itens olhar para trás procurando o grupo do autor.
const OLHAR_PARA_TRAS = 20;

const somar = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);

// O mesmo arquivo de novo no grupo: soma as linhas e junta o tipo da mudança
// (criado e depois alterado continua criado; apagado e depois criado volta a
// ser alterado).
function juntarArquivo(antes: ArquivoNoFeed, m: Mudanca): ArquivoNoFeed {
  const mudanca: ArquivoNoFeed["mudanca"] =
    m.mudanca === "apagado" ? "apagado" : antes.mudanca === "criado" ? "criado" : "alterado";
  const contar = mudanca !== "apagado" && !m.binario && antes.mudanca !== "apagado";
  return {
    caminho: m.caminho,
    mudanca,
    binario: m.binario,
    adicionadas: contar ? somar(antes.adicionadas, m.diferenca?.adicionadas ?? null) : null,
    removidas: contar ? somar(antes.removidas, m.diferenca?.removidas ?? null) : null,
    juntado: antes.juntado || m.juntado,
    // Alguma das mudanças do arquivo no grupo veio sem aviso.
    semAviso: Boolean(antes.semAviso || m.semAviso),
  };
}

function comoArquivo(m: Mudanca): ArquivoNoFeed {
  const contar = m.mudanca !== "apagado" && !m.binario;
  return {
    caminho: m.caminho,
    mudanca: m.mudanca,
    binario: m.binario,
    adicionadas: contar ? (m.diferenca?.adicionadas ?? null) : null,
    removidas: contar ? (m.diferenca?.removidas ?? null) : null,
    juntado: m.juntado,
    semAviso: Boolean(m.semAviso),
  };
}

export class Feed {
  constructor(
    private armazenamento: ArmazenamentoFeed,
    private agora: () => string = () => new Date().toISOString(),
  ) {}

  // Os últimos itens, do mais antigo ao mais novo, para a página que abre.
  ultimos(n = ITENS_AO_CONECTAR): EventoFeed[] {
    return this.armazenamento.ultimos(n).reverse();
  }

  // O item mais recente do autor com esse tipo, se ainda dá para agrupar:
  // ninguém mais mexeu depois e a última mudança dele é recente (AC 3).
  // Conflito e arquivo grande do próprio autor não quebram o grupo.
  private grupoAberto<T extends EventoFeed["tipo"]>(autorId: string, tipo: T, agora: string): Extract<EventoFeed, { tipo: T }> | null {
    const limite = Date.parse(agora) - JANELA_DO_GRUPO_MS;
    for (const e of this.armazenamento.ultimos(OLHAR_PARA_TRAS)) {
      if (e.autorId !== autorId) return null;
      if (e.tipo === tipo) return Date.parse(e.atualizadoEm) >= limite ? (e as Extract<EventoFeed, { tipo: T }>) : null;
    }
    return null;
  }

  // Põe o arquivo em cima da lista do grupo (juntando com o anterior de mesmo
  // caminho); passou do limite, o mais antigo vira contagem.
  private noTopo<T extends { caminho: string }>(lista: T[], outros: number, novo: T): { arquivos: T[]; outros: number } {
    const arquivos = [novo, ...lista.filter((a) => a.caminho !== novo.caminho)];
    const sobra = Math.max(0, arquivos.length - ARQUIVOS_POR_ITEM);
    return { arquivos: arquivos.slice(0, ARQUIVOS_POR_ITEM), outros: outros + sobra };
  }

  // Uma mudança de arquivo: vai para o grupo do autor, ou abre outro.
  // Arquivo de dependências vai para um item destacado, com o mesmo resumo
  // (AC 2; gate da 3.4, UX-002).
  mudanca(m: Mudanca): EventoFeed {
    const agora = this.agora();
    const tipo = arquivoDeDependencias(m.caminho) ? "dependencias" : "arquivos";
    const grupo = this.grupoAberto(m.autorId, tipo, agora);
    if (!grupo) return this.inserir({ tipo, autorId: m.autorId, em: agora, atualizadoEm: agora, arquivos: [comoArquivo(m)], outros: 0 });
    const anterior = grupo.arquivos.find((a) => a.caminho === m.caminho);
    return this.atualizar({ ...grupo, ...this.noTopo(grupo.arquivos, grupo.outros, anterior ? juntarArquivo(anterior, m) : comoArquivo(m)), atualizadoEm: agora });
  }

  // Escrita que perdeu: sempre um item próprio, porque alguém tem trabalho
  // no histórico da sala (A2, gate da 3.3 REL-005).
  // O Claude do autor anunciou o que vai fazer (Story 4.2): sempre um item
  // próprio, que não entra em grupo nenhum.
  // O mesmo anúncio do mesmo autor, com o grupo dele ainda aberto, só atualiza
  // a hora do item (o Claude repete o anúncio; gate da 4.2, UX-001).
  aviso(autorId: string, resumo: string, arquivos: readonly string[]): EventoFeed {
    const agora = this.agora();
    const lista = arquivos.slice(0, ARQUIVOS_POR_ITEM);
    const anterior = this.grupoAberto(autorId, "aviso", agora);
    if (anterior && anterior.resumo === resumo && anterior.arquivos.join("\n") === lista.join("\n")) return this.atualizar({ ...anterior, atualizadoEm: agora });
    return this.inserir({ tipo: "aviso", autorId, resumo, arquivos: lista, em: agora, atualizadoEm: agora });
  }

  // O Claude do autor pediu para mexer num arquivo do aviso de outro (Story
  // 4.4). O mesmo pedido de novo, com o item dele ainda no topo e aberto, só
  // atualiza a hora.
  reserva(autorId: string, donoId: string, caminho: string, resumo: string): EventoFeed {
    const agora = this.agora();
    const anterior = this.grupoAberto(autorId, "reserva", agora);
    if (anterior && anterior.caminho === caminho && anterior.donoId === donoId && anterior.resumo === resumo) return this.atualizar({ ...anterior, atualizadoEm: agora });
    return this.inserir({ tipo: "reserva", autorId, donoId, caminho, resumo, em: agora, atualizadoEm: agora });
  }

  conflito(autorId: string, outroId: string, caminho: string, resolvido: "guardado" | "sobrescrito"): EventoFeed {
    const agora = this.agora();
    return this.inserir({ tipo: "conflito", autorId, outroId, caminho, resolvido, em: agora, atualizadoEm: agora });
  }

  // Arquivo acima do limite (A14), agrupado por autor como os outros: um
  // conector que manda muitos não enche o feed (gate da 3.4, SEC-001). O
  // conector avisa uma vez por arquivo a cada vez que liga; o mesmo arquivo e
  // tamanho já no grupo não muda nada. Tamanho dentro do limite não é aviso
  // de verdade. Devolve null quando nada mudou.
  grande(autorId: string, caminho: string, tamanho: number): EventoFeed | null {
    if (tamanho <= TAMANHO_MAXIMO) return null;
    const agora = this.agora();
    const novo: ArquivoGrande = { caminho, tamanho };
    const grupo = this.grupoAberto(autorId, "grande", agora);
    if (!grupo) return this.inserir({ tipo: "grande", autorId, em: agora, atualizadoEm: agora, arquivos: [novo], outros: 0 });
    if (grupo.arquivos.some((a) => a.caminho === caminho && a.tamanho === tamanho)) return null;
    return this.atualizar({ ...grupo, ...this.noTopo(grupo.arquivos, grupo.outros, novo), atualizadoEm: agora });
  }

  private inserir(evento: EventoNovo): EventoFeed {
    const id = this.armazenamento.inserir(evento);
    return { ...evento, id } as EventoFeed;
  }

  private atualizar(evento: EventoFeed): EventoFeed {
    this.armazenamento.atualizar(evento);
    return evento;
  }
}

export class ArmazenamentoFeedEmMemoria implements ArmazenamentoFeed {
  private itens: EventoFeed[] = [];
  private proximo = 1;

  inserir(evento: EventoNovo): number {
    const id = this.proximo++;
    this.itens.push({ ...evento, id } as EventoFeed);
    return id;
  }
  atualizar(evento: EventoFeed): void {
    this.itens = this.itens.map((e) => (e.id === evento.id ? evento : e));
  }
  ultimos(n: number): EventoFeed[] {
    return this.itens.slice(-n).reverse();
  }
}
