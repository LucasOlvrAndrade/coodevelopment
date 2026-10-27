import { Avatar } from "@/componentes/ui/Avatar";
import type { JamDoInicio } from "@/servidor/dominio/jam";

// Jams do Início (FR7): lista simples, abertas primeiro (front-end spec). A
// página da jam chega na Story 2.4; até lá o item não tem link.
export function ListaJams({ jams, nova }: { jams: JamDoInicio[]; nova?: string }) {
  return (
    <ul aria-label="Suas jams" className="w-full divide-y divide-divisoria">
      {jams.map((jam) => {
        const destaque = jam.id === nova;
        return (
          <li key={jam.id} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${destaque ? "bg-superficie px-3" : ""}`}>
            <div className="min-w-0">
              <p className="truncate font-mono text-corpo font-medium">
                {jam.repoOwner}/{jam.repoNome}
              </p>
              <p className="text-pequeno text-texto-suave">
                {destaque ? "Jam criada agora · " : ""}
                {jam.estado === "fechada" ? "Fechada" : "Aberta"} · código {jam.id}
              </p>
            </div>
            <ul aria-label={`Quem está na jam ${jam.repoNome}`} className="flex items-center gap-1">
              {jam.participantes.map((p) => (
                <li key={p.id} title={p.nome} className="flex items-center">
                  <Avatar nome={p.nome} foto={p.foto} tamanho={24} />
                  <span className="sr-only">{p.nome}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
