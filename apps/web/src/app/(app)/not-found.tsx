import Link from "next/link";
import { botaoPrincipalGrande, tituloPagina } from "@/componentes/ui/estilo";

// 404 das páginas internas. Para a jam, a mesma mensagem vale para "não existe"
// e "você não participa": a página não diz qual é (Story 2.4, AC 3).
export default function NaoEncontrada() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4">
      <h1 className={tituloPagina}>Não achei essa página</h1>
      <p className="text-texto-suave">Se era uma jam, ela não existe, foi excluída ou você não participa dela.</p>
      <Link href="/inicio" className={botaoPrincipalGrande}>
        Voltar para as jams
      </Link>
    </div>
  );
}
