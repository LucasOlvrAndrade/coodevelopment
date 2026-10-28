"use client";

import { useState, useTransition, type FormEvent } from "react";
import { botaoPrincipal } from "@/componentes/ui/botoes";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { criarJamComRepositorio } from "@/servidor/acoes/jam";
import { useFinalizarCriacao } from "./AmigosDaJam";

// Mesma regra do servidor (dominio/jam.ts): o GitHub aceita até 100 caracteres
// de letras, números, ponto, hífen e sublinhado, sem ser "." nem "..".
const valido = (nome: string) => /^[\w.-]{1,100}$/.test(nome) && nome !== "." && nome !== "..";
const NOME_INVALIDO = "Use só letras, números, ponto, hífen e sublinhado, com até 100 caracteres.";
const ERROS_DO_NOME = new Set(["nome_repositorio_invalido", "repositorio_ja_existe"]);

// Criar repositório (Story 2.2): nome e visibilidade, e a jam ligada a ele.
// Erro de nome aparece no próprio campo (front-end spec, Nova jam).
export function CriarRepositorio() {
  const { finalizar, painel } = useFinalizarCriacao();
  const [nome, setNome] = useState("");
  const [privado, setPrivado] = useState(true);
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, iniciar] = useTransition();

  function criar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    const limpo = nome.trim();
    if (!valido(limpo)) {
      setErroDoNome(NOME_INVALIDO);
      return;
    }
    setErroDoNome(null);
    iniciar(async () => {
      const resultado = await semQuebrar(() => criarJamComRepositorio(limpo, privado));
      if (!resultado.ok) {
        if (ERROS_DO_NOME.has(resultado.erro.codigo)) setErroDoNome(resultado.erro.mensagem);
        else setErro(resultado.erro.mensagem);
        return;
      }
      await finalizar(resultado.dados.id);
    });
  }

  return (
    <form onSubmit={criar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nome-repositorio" className="text-corpo font-medium">
          Nome do repositório
        </label>
        <input
          id="nome-repositorio"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          maxLength={100}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={erroDoNome ? true : undefined}
          aria-describedby={erroDoNome ? "nome-repositorio-dica nome-repositorio-erro" : "nome-repositorio-dica"}
          className="rounded-controle border border-borda-controle bg-superficie px-3 py-2 font-mono text-corpo"
        />
        <p id="nome-repositorio-dica" className="text-pequeno text-texto-suave">
          Letras, números, ponto, hífen e sublinhado. Ele fica na sua conta do GitHub, com um primeiro commit.
        </p>
        {erroDoNome && (
          <p id="nome-repositorio-erro" role="alert" className="text-pequeno text-erro">
            {erroDoNome}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-corpo font-medium">Visibilidade</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibilidade" checked={privado} onChange={() => setPrivado(true)} className="mt-1 accent-primaria" />
          <span>
            Privado <span className="text-texto-suave">(só você e quem você chamar)</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibilidade" checked={!privado} onChange={() => setPrivado(false)} className="mt-1 accent-primaria" />
          <span>
            Público <span className="text-texto-suave">(qualquer pessoa vê o código)</span>
          </span>
        </label>
      </fieldset>

      {painel}
      {erro && (
        <p role="alert" className="text-pequeno text-erro">
          {erro}
        </p>
      )}
      <div>
        <button type="submit" disabled={criando} className={`${botaoPrincipal} px-4 py-3`}>
          {criando ? "Criando o repositório e a jam..." : "Criar repositório e jam"}
        </button>
      </div>
    </form>
  );
}
