"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { buscarAmigo } from "@/servidor/acoes/amizade";
import type { Pessoa, Relacao } from "@/servidor/dominio/amizade";
import { AcaoPessoa } from "./AcaoPessoa";
import { botaoPrincipal } from "./estilos";
import { LinhaPessoa } from "./LinhaPessoa";

type Achado = Pessoa & { relacao: Relacao };

// Busca exata pelo usuário do GitHub (AC 1, A10). Pedir amizade muda o botão
// para "Pedido enviado" na hora (front-end spec) e volta se der erro. A versão
// muda quando os pedidos ou amigos da página mudam; aí a última busca é refeita
// para a relação de cada linha não ficar velha (gate da 1.3, REL-001).
export function BuscaAmigo({ versao }: { versao: string }) {
  const [texto, setTexto] = useState("");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [buscando, iniciar] = useTransition();
  const ultimaBusca = useRef<string | null>(null);
  // Cada busca enviada recria as linhas; a refeita pela versão só atualiza a
  // relação de cada uma, sem tirar o foco de onde ele está.
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    const consulta = ultimaBusca.current;
    if (consulta === null) return;
    let valendo = true;
    buscarAmigo(consulta).then((resultado) => {
      if (valendo && resultado.ok) setAchados(resultado.dados);
    });
    return () => {
      valendo = false;
    };
  }, [versao]);

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    setAviso("");
    ultimaBusca.current = texto;
    setRodada((n) => n + 1);
    iniciar(async () => {
      const resultado = await buscarAmigo(texto);
      if (resultado.ok) {
        setErro(null);
        setAchados(resultado.dados);
        if (resultado.dados.length === 0) setAviso("Ninguém com esse usuário usa o Coodevelopment ainda.");
      } else {
        setAchados(null);
        setErro(resultado.erro.mensagem);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form role="search" aria-label="Buscar pelo usuário do GitHub" onSubmit={buscar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="busca-login" className="text-corpo font-medium">
            Usuário do GitHub
          </label>
          <input
            id="busca-login"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="@usuario"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "busca-dica busca-erro" : "busca-dica"}
            className="rounded-controle border border-borda-controle bg-superficie px-3 py-2 font-mono text-corpo"
          />
        </div>
        <button type="submit" disabled={buscando} className={botaoPrincipal}>
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>
      <p id="busca-dica" className="text-pequeno text-texto-suave">
        Digite o usuário exato, como aparece no perfil do GitHub.
      </p>
      {erro && (
        <p id="busca-erro" role="alert" className="text-pequeno text-erro">
          {erro}
        </p>
      )}
      {/* Sempre na página: leitor de tela só anuncia região que já existia. */}
      <p role="status" className="text-corpo">
        {aviso}
      </p>
      {achados && achados.length > 0 && (
        <ul aria-label="Resultado da busca" className="divide-y divide-divisoria">
          {achados.map((achado) => (
            <li key={`${rodada}:${achado.id}`}>
              <LinhaPessoa nome={achado.nome} login={achado.login} foto={achado.foto}>
                <AcaoPessoa pessoa={achado} relacaoInicial={achado.relacao} anunciar={setAviso} />
              </LinhaPessoa>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
