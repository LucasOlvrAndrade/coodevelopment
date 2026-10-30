import {
  TAMANHO_MAXIMO,
  caminhoSincronizavel,
  hashDoConteudo,
  juntar,
  tamanhoDoConteudo,
  type MensagemArquivo,
  type MensagemDaSala,
  type MensagemEscrever,
} from "@coodevelopment/protocolo";

// Regra da sincronização de arquivos (Story 3.3, decisão A2). Pura: recebe o
// armazenamento por uma interface, para rodar no Durable Object (SQLite) e
// em Node (memória, no teste de integração do conector).

export type Registro = {
  caminho: string;
  versao: number;
  hash: string;
  conteudo: string;
  binario: boolean;
  apagado: boolean;
  autorId: string;
  atualizadoEm: string;
};

export type Conteudo = { conteudo: string; binario: boolean; apagado: boolean };

export interface Armazenamento {
  ler(caminho: string): Registro | null;
  // Outro arquivo com o mesmo caminho em outra caixa ("README.md" e
  // "Readme.md"): um arquivo só no Windows e no macOS.
  outroComOutraCaixa(caminho: string): string | null;
  gravar(registro: Registro): void;
  // O conteúdo de cada versão aceita, para servir de base a um merge; a
  // versão 0 é o conteúdo do baseSha, guardado na primeira escrita.
  lerVersao(caminho: string, versao: number): Conteudo | null;
  guardarVersao(caminho: string, versao: number, conteudo: Conteudo): void;
  guardarNoHistorico(entrada: { caminho: string; autorId: string; motivo: "conflito" | "sobrescrito"; em: string } & Conteudo): void;
  todos(): Registro[];
}

export type Envio = { para: "autor" | "outros" | "todos"; mensagem: MensagemDaSala };

const recusado = (caminho: string, motivo: "conflito_guardado" | "caminho_invalido" | "proibido" | "grande_demais" | "erro"): Envio => ({
  para: "autor",
  mensagem: { v: 1, tipo: "recusado", caminho, motivo },
});

const comoArquivo = (r: Registro, origem: MensagemArquivo["origem"]): MensagemArquivo => ({
  v: 1,
  tipo: "arquivo",
  caminho: r.caminho,
  versao: r.versao,
  hash: r.hash,
  conteudo: r.conteudo,
  binario: r.binario,
  apagado: r.apagado,
  autorId: r.autorId,
  origem,
});

// O merge de três vias mora no protocolo: a sala e o conector usam o mesmo.
export { juntar };

// Chave para comparar caminhos sem diferenciar caixa nem a forma do acento:
// o macOS manda "ç" decomposto (NFD) e o Windows composto (NFC), e os dois são
// o mesmo nome (gate da 3.3, REL-001 e REL-011).
export function chaveDeCaixa(caminho: string): string {
  return caminho.normalize("NFC").toLowerCase();
}

export class Sincronizacao {
  // Uma escrita por vez: o hash é assíncrono, e duas escritas no mesmo
  // arquivo não podem ler a mesma versão e gravar as duas.
  private fila: Promise<unknown> = Promise.resolve();

  constructor(
    private armazenamento: Armazenamento,
    private agora: () => string = () => new Date().toISOString(),
  ) {}

  // O que mudou desde o baseSha, para quem conecta (FR21): o manifesto e
  // cada arquivo em seguida.
  estado(): MensagemDaSala[] {
    const todos = this.armazenamento.todos();
    return [
      { v: 1, tipo: "manifesto", arquivos: todos.map(({ caminho, versao, hash, apagado }) => ({ caminho, versao, hash, apagado })) },
      ...todos.map((r) => comoArquivo(r, "estado")),
    ];
  }

  // Qualquer erro no meio (base64 inválido, banco) volta como recusado para o
  // autor: sem resposta, a escrita dele ficaria no ar (gate da 3.3, REL-002).
  escrever(autorId: string, msg: MensagemEscrever): Promise<Envio[]> {
    const vez = this.fila.then(() => this.processar(autorId, msg)).catch((e: unknown) => {
      console.error(JSON.stringify({ nivel: "erro", evento: "escrever", caminho: msg.caminho, erro: String(e) }));
      return [recusado(msg.caminho, "erro")];
    });
    this.fila = vez.catch(() => {});
    return vez;
  }

  private async processar(autorId: string, msg: MensagemEscrever): Promise<Envio[]> {
    const permitido = caminhoSincronizavel(msg.caminho);
    if (!permitido.ok) return [recusado(msg.caminho, permitido.motivo)];
    const caminho = permitido.caminho;
    if (tamanhoDoConteudo(msg.conteudo, msg.binario) > TAMANHO_MAXIMO) return [recusado(caminho, "grande_demais")];

    const atual = this.armazenamento.ler(caminho);
    // Caixa diferente de um caminho que já circula: no Windows seriam o mesmo
    // arquivo, e as pastas nunca convergiriam (gate da 3.3, REL-001).
    if (!atual && this.armazenamento.outroComOutraCaixa(caminho)) return [recusado(caminho, "caminho_invalido")];
    const versaoAtual = atual?.versao ?? 0;
    const chegou: Conteudo = { conteudo: msg.apagado ? "" : msg.conteudo, binario: msg.binario, apagado: msg.apagado };

    // Primeira escrita do arquivo: o conteúdo do baseSha vira a versão 0,
    // base dos merges seguintes; null é arquivo que não existia no baseSha.
    // Sem a base (não veio, ou acima do limite), a versão 0 fica sem registro,
    // e uma escrita concorrente a partir dela vai para o histórico em vez de
    // ser juntada contra uma base errada (gate da 3.3, DATA-003 e REL-002).
    if (!atual) {
      const base = msg.conteudoBase;
      if (base === null) this.armazenamento.guardarVersao(caminho, 0, { conteudo: "", binario: msg.binario, apagado: true });
      else if (base !== undefined && tamanhoDoConteudo(base, false) <= TAMANHO_MAXIMO) {
        this.armazenamento.guardarVersao(caminho, 0, { conteudo: base, binario: false, apagado: false });
      }
    }

    // Escreveu a partir da versão atual: entra como veio.
    if (msg.versaoBase === versaoAtual) {
      const novo = await this.gravar(caminho, versaoAtual + 1, chegou, autorId);
      return [
        { para: "autor", mensagem: { v: 1, tipo: "aceito", caminho, versao: novo.versao, hash: novo.hash } },
        { para: "outros", mensagem: comoArquivo(novo, "escrita") },
      ];
    }

    // Versão base que a sala não conhece (à frente da atual): o conector se
    // perdeu; recebe o arquivo atual para recomeçar dele.
    if (msg.versaoBase > versaoAtual || !atual) {
      return atual ? [{ para: "autor", mensagem: comoArquivo(atual, "estado") }] : [recusado(caminho, "caminho_invalido")];
    }

    // Escreveu a partir de uma versão antiga: outra escrita entrou antes.
    // Binário: a última vence, e a anterior vai para o histórico.
    if (msg.binario || atual.binario) {
      this.armazenamento.guardarNoHistorico({ caminho, autorId: atual.autorId, motivo: "sobrescrito", em: this.agora(), conteudo: atual.conteudo, binario: atual.binario, apagado: atual.apagado });
      const novo = await this.gravar(caminho, versaoAtual + 1, chegou, autorId);
      return [
        { para: "autor", mensagem: { v: 1, tipo: "aceito", caminho, versao: novo.versao, hash: novo.hash } },
        { para: "outros", mensagem: comoArquivo(novo, "escrita") },
      ];
    }

    // Texto: merge de três vias a partir da versão que o autor conhecia. Sem
    // a base, apagado de um lado ou trechos cruzados, fica o que já estava e
    // a escrita do autor vai para o histórico, com aviso para ele (A2).
    const base = this.armazenamento.lerVersao(caminho, msg.versaoBase);
    const resultado =
      base && !base.binario && !atual.apagado && !chegou.apagado ? juntar(base.apagado ? "" : base.conteudo, atual.conteudo, chegou.conteudo) : null;
    if (resultado === null) {
      this.armazenamento.guardarNoHistorico({ caminho, autorId, motivo: "conflito", em: this.agora(), ...chegou });
      return [recusado(caminho, "conflito_guardado"), { para: "autor", mensagem: comoArquivo(atual, "escrita") }];
    }
    const novo = await this.gravar(caminho, versaoAtual + 1, { conteudo: resultado, binario: false, apagado: false }, autorId);
    return [{ para: "todos", mensagem: comoArquivo(novo, "merge") }];
  }

  private async gravar(caminho: string, versao: number, conteudo: Conteudo, autorId: string): Promise<Registro> {
    const registro: Registro = {
      caminho,
      versao,
      hash: await hashDoConteudo(conteudo.conteudo, conteudo.binario),
      ...conteudo,
      autorId,
      atualizadoEm: this.agora(),
    };
    this.armazenamento.gravar(registro);
    this.armazenamento.guardarVersao(caminho, versao, conteudo);
    return registro;
  }
}

// Armazenamento em memória: para o teste de integração do conector e para os
// testes da regra.
export class ArmazenamentoEmMemoria implements Armazenamento {
  private arquivos = new Map<string, Registro>();
  private versoes = new Map<string, Conteudo>();
  historico: ({ caminho: string; autorId: string; motivo: string; em: string } & Conteudo)[] = [];

  ler(caminho: string) {
    return this.arquivos.get(caminho) ?? null;
  }
  outroComOutraCaixa(caminho: string) {
    const baixo = chaveDeCaixa(caminho);
    return [...this.arquivos.keys()].find((c) => c !== caminho && chaveDeCaixa(c) === baixo) ?? null;
  }
  gravar(registro: Registro) {
    this.arquivos.set(registro.caminho, registro);
  }
  lerVersao(caminho: string, versao: number) {
    return this.versoes.get(`${versao}:${caminho}`) ?? null;
  }
  guardarVersao(caminho: string, versao: number, conteudo: Conteudo) {
    this.versoes.set(`${versao}:${caminho}`, conteudo);
  }
  guardarNoHistorico(entrada: { caminho: string; autorId: string; motivo: "conflito" | "sobrescrito"; em: string } & Conteudo) {
    this.historico.push(entrada);
  }
  todos() {
    return [...this.arquivos.values()].sort((a, b) => a.caminho.localeCompare(b.caminho));
  }
}
