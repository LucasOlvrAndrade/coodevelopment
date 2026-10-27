"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { botaoPrincipal } from "@/componentes/ui/botoes";
import { criarJamImportando } from "@/servidor/acoes/jam";
import type { Repositorio } from "@/servidor/dominio/jam";

const MAX_NA_TELA = 100;
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Importar repositório (Story 2.1, AC 1 e 2): a lista dos repositórios da conta
// com busca, e "Criar jam" só com um escolhido (front-end spec, Nova jam).
export function EscolherRepositorio({ repositorios }: { repositorios: Repositorio[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const [escolhido, setEscolhido] = useState<Repositorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, iniciar] = useTransition();
  const idLista = useId();

  const termo = filtro.trim().toLowerCase();
  const filtrados = termo ? repositorios.filter((r) => r.nome.toLowerCase().includes(termo)) : repositorios;
  const naTela = filtrados.slice(0, MAX_NA_TELA);

  function criar() {
    if (!escolhido) return;
    setErro(null);
    iniciar(async () => {
      const resultado = await criarJamImportando(escolhido.owner, escolhido.nome);
      if (resultado.ok) router.push(`/inicio?nova=${encodeURIComponent(resultado.dados.id)}`);
      else setErro(resultado.erro.mensagem);
    });
  }

  if (repositorios.length === 0) {
    return (
      <p className="text-texto-suave">
        Não achei repositórios da sua conta que o Coodevelopment alcance. No GitHub, confira se o app está instalado com
        &quot;All repositories&quot;.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idLista}-busca`} className="text-corpo font-medium">
          Buscar repositório
        </label>
        <input
          id={`${idLista}-busca`}
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-controls={idLista}
          className="rounded-controle border border-borda-controle bg-superficie px-3 py-2 font-mono text-corpo"
        />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-corpo font-medium">Seus repositórios</legend>
        {naTela.length === 0 ? (
          <p className="text-texto-suave">Nenhum repositório com esse nome.</p>
        ) : (
          <ul id={idLista} className="max-h-[28rem] divide-y divide-divisoria overflow-y-auto rounded-controle border border-divisoria">
            {naTela.map((r) => {
              const chave = `${r.owner}/${r.nome}`;
              const marcado = escolhido?.owner === r.owner && escolhido.nome === r.nome;
              return (
                <li key={chave}>
                  <label className={`flex cursor-pointer items-start gap-3 px-3 py-3 ${marcado ? "bg-superficie" : ""}`}>
                    <input
                      type="radio"
                      name="repositorio"
                      value={chave}
                      checked={marcado}
                      onChange={() => setEscolhido(r)}
                      className="mt-1 accent-primaria"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-mono text-corpo font-medium">{r.nome}</span>
                        {r.privado && (
                          <span className="rounded-controle border border-divisoria px-1.5 text-pequeno text-texto-suave">privado</span>
                        )}
                      </span>
                      {r.descricao && <span className="text-pequeno text-texto-suave">{r.descricao}</span>}
                      {r.atualizadoEm && (
                        <span className="text-pequeno text-texto-suave">Último push em {dataCurta.format(new Date(r.atualizadoEm))}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {filtrados.length > MAX_NA_TELA && (
          <p className="text-pequeno text-texto-suave">
            Mostrando {MAX_NA_TELA} de {filtrados.length}. Digite parte do nome para achar os outros.
          </p>
        )}
      </fieldset>

      {erro && (
        <p role="alert" className="text-pequeno text-erro">
          {erro}
        </p>
      )}
      <div>
        <button type="button" disabled={!escolhido || criando} onClick={criar} className={`${botaoPrincipal} px-4 py-3`}>
          {criando ? "Criando a jam..." : "Criar jam"}
        </button>
      </div>
    </div>
  );
}
