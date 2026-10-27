"use client";

import { useState, useTransition, type FormEvent } from "react";
import { aceitarPedido, buscarAmigo, pedirAmizade } from "@/servidor/acoes/amizade";
import type { Pessoa, Relacao } from "@/servidor/dominio/amizade";
import { botaoPrincipal, botaoSecundario } from "./estilos";
import { LinhaPessoa } from "./LinhaPessoa";

type Achado = Pessoa & { relacao: Relacao };

// Busca exata pelo usuário do GitHub (AC 1, A10). Pedir amizade muda o botão
// para "Pedido enviado" na hora (front-end spec) e volta se der erro.
export function BuscaAmigo() {
  const [texto, setTexto] = useState("");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [buscando, iniciar] = useTransition();

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    setAviso("");
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
            <li key={`${achado.id}-${achado.relacao.tipo}`}>
              <LinhaPessoa nome={achado.nome} login={achado.login} foto={achado.foto}>
                <AcaoDoAchado achado={achado} anunciar={setAviso} />
              </LinhaPessoa>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AcaoDoAchado({ achado, anunciar }: { achado: Achado; anunciar: (texto: string) => void }) {
  const [relacao, setRelacao] = useState<Relacao>(achado.relacao);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();

  function pedir() {
    setErro(null);
    setRelacao({ tipo: "pedido_enviado" });
    iniciar(async () => {
      const resultado = await pedirAmizade(achado.id);
      if (!resultado.ok) {
        setRelacao(achado.relacao);
        setErro(resultado.erro.mensagem);
      } else if (resultado.dados === "amigos") {
        // Ela já tinha pedido: o pedido cruzado vira amizade (front-end spec).
        setRelacao({ tipo: "amigo" });
        anunciar(`${achado.nome} já tinha pedido amizade a você. Agora vocês são amigos.`);
      } else {
        anunciar(`Pedido enviado para ${achado.nome}.`);
      }
    });
  }

  function aceitar(pedidoId: string) {
    setErro(null);
    iniciar(async () => {
      const resultado = await aceitarPedido(pedidoId);
      if (resultado.ok) {
        setRelacao({ tipo: "amigo" });
        anunciar(`Agora você e ${achado.nome} são amigos.`);
      } else {
        setErro(resultado.erro.mensagem);
      }
    });
  }

  return (
    <>
      {relacao.tipo === "eu" && <span className="text-pequeno text-texto-suave">É você</span>}
      {relacao.tipo === "amigo" && <span className="text-pequeno text-sucesso">Amigo</span>}
      {relacao.tipo === "pedido_enviado" && (
        <button type="button" disabled className={botaoSecundario}>
          Pedido enviado
        </button>
      )}
      {relacao.tipo === "pedido_recebido" && (
        <button
          type="button"
          disabled={indo}
          onClick={() => aceitar(relacao.pedidoId)}
          aria-label={`Aceitar o pedido de ${achado.nome}`}
          className={botaoPrincipal}
        >
          Aceitar pedido
        </button>
      )}
      {relacao.tipo === "nenhuma" && (
        <button type="button" disabled={indo} onClick={pedir} aria-label={`Pedir amizade a ${achado.nome}`} className={botaoPrincipal}>
          Pedir amizade
        </button>
      )}
      {erro && (
        <p role="alert" className="w-full text-pequeno text-erro">
          {erro}
        </p>
      )}
    </>
  );
}
