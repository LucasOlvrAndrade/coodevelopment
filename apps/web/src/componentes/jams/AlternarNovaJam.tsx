"use client";

import { useState, type ReactNode } from "react";

type Modo = "importar" | "criar";

// "Importar repositório | Criar repositório" (front-end spec, Nova jam). Os
// dois painéis ficam montados (o escondido com hidden), para nada do que foi
// digitado se perder ao trocar.
export function AlternarNovaJam({ importar, criar }: { importar: ReactNode; criar: ReactNode }) {
  const [modo, setModo] = useState<Modo>("importar");
  const opcoes: { modo: Modo; rotulo: string }[] = [
    { modo: "importar", rotulo: "Importar repositório" },
    { modo: "criar", rotulo: "Criar repositório" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* A pílula da navegação da página inicial, com a opção escolhida em branco. */}
      <div role="group" aria-label="Repositório da jam" className="inline-flex w-fit max-w-full rounded-full bg-texto/5 p-1 ring-1 ring-divisoria">
        {opcoes.map((opcao) => (
          <button
            key={opcao.modo}
            type="button"
            aria-pressed={modo === opcao.modo}
            onClick={() => setModo(opcao.modo)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              modo === opcao.modo ? "bg-primaria text-sobre-primaria" : "text-texto/80 hover:text-texto"
            }`}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <div hidden={modo !== "importar"}>{importar}</div>
      <div hidden={modo !== "criar"}>{criar}</div>
    </div>
  );
}
