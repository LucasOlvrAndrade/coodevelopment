import Link from "next/link";
import { botaoPrincipal } from "@/componentes/ui/botoes";

// 404 das páginas internas. Para a jam, a mesma mensagem vale para "não existe"
// e "você não participa": a página não diz qual é (Story 2.4, AC 3).
export default function NaoEncontrada() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-3">
      <h1 className="text-h1 font-semibold">Não achei essa página</h1>
      <p className="text-texto-suave">Se era uma jam, ela não existe, foi excluída ou você não participa dela.</p>
      <Link href="/inicio" className={`${botaoPrincipal} px-4 py-3`}>
        Voltar para as jams
      </Link>
    </div>
  );
}
