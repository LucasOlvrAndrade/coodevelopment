import { ARQUIVOS_POR_ITEM, arquivoDeDependencias, type ArquivoNoFeed, type EventoFeed } from "@coodevelopment/protocolo";

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
};

// Itens que a página recebe ao abrir (AC 6).
export const ITENS_AO_CONECTAR = 100;

// Mudanças seguidas do mesmo autor entram no mesmo item enquanto a anterior
// tiver menos que isso (AC 3).
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

  // Uma mudança de arquivo: vai para o grupo do autor, ou abre outro.
  // Arquivo de dependências vai para um item destacado (AC 2).
  mudanca(m: Mudanca): EventoFeed {
    const agora = this.agora();
    if (arquivoDeDependencias(m.caminho)) {
      const grupo = this.grupoAberto(m.autorId, "dependencias", agora);
      if (grupo) {
        const caminhos = [m.caminho, ...grupo.caminhos.filter((c) => c !== m.caminho)].slice(0, ARQUIVOS_POR_ITEM);
        return this.atualizar({ ...grupo, caminhos, atualizadoEm: agora });
      }
      return this.inserir({ tipo: "dependencias", autorId: m.autorId, em: agora, atualizadoEm: agora, caminhos: [m.caminho] });
    }

    const grupo = this.grupoAberto(m.autorId, "arquivos", agora);
    if (!grupo) {
      return this.inserir({ tipo: "arquivos", autorId: m.autorId, em: agora, atualizadoEm: agora, arquivos: [comoArquivo(m)], outros: 0 });
    }
    const anterior = grupo.arquivos.find((a) => a.caminho === m.caminho);
    const resto = grupo.arquivos.filter((a) => a.caminho !== m.caminho);
    // O mais recente fica em cima; passou do limite, o mais antigo vira contagem.
    const arquivos = [anterior ? juntarArquivo(anterior, m) : comoArquivo(m), ...resto];
    const sobra = arquivos.length - ARQUIVOS_POR_ITEM;
    return this.atualizar({
      ...grupo,
      arquivos: sobra > 0 ? arquivos.slice(0, ARQUIVOS_POR_ITEM) : arquivos,
      outros: grupo.outros + Math.max(0, sobra),
      atualizadoEm: agora,
    });
  }

  // Escrita que perdeu: sempre um item próprio, porque alguém tem trabalho
  // no histórico da sala (A2, gate da 3.3 REL-005).
  conflito(autorId: string, outroId: string, caminho: string, resolvido: "guardado" | "sobrescrito"): EventoFeed {
    const agora = this.agora();
    return this.inserir({ tipo: "conflito", autorId, outroId, caminho, resolvido, em: agora, atualizadoEm: agora });
  }

  // Arquivo acima do limite (A14). O conector avisa uma vez por arquivo a
  // cada vez que liga; o mesmo arquivo e tamanho já no feed recente não
  // entra de novo. Devolve null quando não entrou.
  grande(autorId: string, caminho: string, tamanho: number): EventoFeed | null {
    const repetido = this.armazenamento
      .ultimos(OLHAR_PARA_TRAS)
      .some((e) => e.tipo === "grande" && e.autorId === autorId && e.caminho === caminho && e.tamanho === tamanho);
    if (repetido) return null;
    const agora = this.agora();
    return this.inserir({ tipo: "grande", autorId, caminho, tamanho, em: agora, atualizadoEm: agora });
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
