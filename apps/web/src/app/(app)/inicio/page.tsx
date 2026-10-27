import { Suspense } from "react";
import { obterSessao } from "@/servidor/auth";

export async function Saudacao() {
  const sessao = await obterSessao();
  const primeiroNome = sessao?.user.name.split(" ")[0] ?? "";
  return <h1 className="text-h1 font-semibold">Olá, {primeiroNome}</h1>;
}

// Início vazio: ainda não há jams. Criar jam (2.1) e Adicionar amigos (1.3)
// ganham ação nas stories delas.
export default function Inicio() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<h1 className="text-h1 font-semibold">Olá</h1>}>
        <Saudacao />
      </Suspense>
      <section aria-labelledby="titulo-jams" className="flex flex-col items-start gap-4">
        <h2 id="titulo-jams" className="text-h2 font-semibold">
          Suas jams
        </h2>
        <p className="text-texto-suave">Você ainda não tem nenhuma jam.</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            aria-describedby="aviso-em-breve"
            className="rounded-controle bg-primaria px-4 py-3 text-corpo font-medium text-sobre-primaria disabled:opacity-60"
          >
            Criar jam
          </button>
          <button
            type="button"
            disabled
            aria-describedby="aviso-em-breve"
            className="rounded-controle border border-borda-controle px-4 py-3 text-corpo font-medium disabled:opacity-60"
          >
            Adicionar amigos
          </button>
        </div>
        <p id="aviso-em-breve" className="text-pequeno text-texto-suave">
          Criar jam e adicionar amigos chegam nas próximas versões.
        </p>
      </section>
    </div>
  );
}
