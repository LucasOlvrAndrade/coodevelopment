"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { botaoPrincipalGrande, botaoSecundarioGrande, campo, painel } from "@/componentes/ui/estilo";
import { consultarDispositivo, responderDispositivo, type SituacaoDispositivo } from "@/servidor/acoes/dispositivo";

export type EtapaDispositivo =
  | { tipo: "digitar"; erro?: string }
  | { tipo: "consultando" }
  | { tipo: "decidir"; codigo: string; situacao: SituacaoDispositivo };

// Confirmar o login do conector (Story 3.1). O link do terminal traz o código,
// já consultado pela página no servidor; a pessoa confere se é o mesmo do
// terminal e confirma. Quem abriu o link sem ter rodado o comando recusa:
// confirmar dá ao outro computador acesso à conta.
export function ConfirmarDispositivo({ inicial }: { inicial: EtapaDispositivo }) {
  const [etapa, setEtapa] = useState<EtapaDispositivo>(inicial);
  const [digitado, setDigitado] = useState("");
  const [erro, setErro] = useState<string | null>(inicial.tipo === "digitar" ? (inicial.erro ?? null) : null);
  const [respondendo, iniciar] = useTransition();
  const resultado = useRef<HTMLDivElement>(null);

  async function consultar(valor: string) {
    setErro(null);
    setEtapa({ tipo: "consultando" });
    const r = await semQuebrar(() => consultarDispositivo(valor));
    if (!r.ok) {
      setErro(r.erro.mensagem);
      setEtapa({ tipo: "digitar" });
      return;
    }
    setEtapa({ tipo: "decidir", codigo: r.dados.codigo, situacao: r.dados.situacao });
  }

  function enviarDigitado(evento: FormEvent) {
    evento.preventDefault();
    void consultar(digitado);
  }

  function responder(codigo: string, confirmar: boolean) {
    setErro(null);
    iniciar(async () => {
      const r = await semQuebrar(() => responderDispositivo(codigo, confirmar));
      if (!r.ok) {
        setErro(r.erro.mensagem);
        return;
      }
      setEtapa({ tipo: "decidir", codigo, situacao: r.dados.situacao });
      // Os botões somem: o foco vai para o resultado (como na 2.4).
      requestAnimationFrame(() => resultado.current?.focus());
    });
  }

  const mensagemDeErro = erro && (
    <p role="alert" className="text-pequeno text-erro">
      {erro}
    </p>
  );

  if (etapa.tipo === "consultando") return <p className="text-texto-suave">Conferindo o código...</p>;

  if (etapa.tipo === "digitar") {
    return (
      <form onSubmit={enviarDigitado} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="codigo-dispositivo" className="text-corpo font-medium">
            Código que aparece no terminal
          </label>
          <input
            id="codigo-dispositivo"
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            required
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={erro ? true : undefined}
            className={`${campo} font-mono uppercase`}
          />
        </div>
        {mensagemDeErro}
        <div>
          <button type="submit" className={botaoPrincipalGrande}>
            Continuar
          </button>
        </div>
      </form>
    );
  }

  const { codigo, situacao } = etapa;
  return (
    <div className="flex flex-col gap-6">
      <div className={`${painel} flex flex-col items-center gap-2 p-6`}>
        <span className="text-pequeno text-texto-suave">Código</span>
        <span className="font-mono text-h1 tracking-[0.2em]">{codigo}</span>
      </div>

      {situacao === "pendente" ? (
        <>
          <p>
            Confira se é o mesmo código que aparece no terminal. <strong>Só confirme se você acabou de rodar o comando do
            Coodevelopment no seu computador</strong>: confirmar dá a ele acesso às suas jams. Se alguém te mandou este
            link, recuse.
          </p>
          {mensagemDeErro}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={respondendo} onClick={() => responder(codigo, true)} className={botaoPrincipalGrande}>
              Confirmar
            </button>
            <button type="button" disabled={respondendo} onClick={() => responder(codigo, false)} className={botaoSecundarioGrande}>
              Recusar
            </button>
          </div>
        </>
      ) : (
        <div ref={resultado} tabIndex={-1} role="status" className="outline-none">
          {situacao === "confirmado" ? (
            <p>Pronto, o conector entrou na sua conta. Pode voltar para o terminal.</p>
          ) : (
            <p>Recusado. O conector não entrou na sua conta.</p>
          )}
        </div>
      )}
    </div>
  );
}
