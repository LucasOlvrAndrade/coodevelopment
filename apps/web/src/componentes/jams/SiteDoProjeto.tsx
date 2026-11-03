import { link, painel } from "@/componentes/ui/estilo";
import { siteDoProjeto, type SiteDoProjeto as Site } from "@/servidor/site-do-projeto";

const tituloDaColuna = "font-instrument-serif text-h2 tracking-tight";

// O endereço sem o https:// e sem a barra do fim, para ler de relance.
const curto = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export function ColunaDoSite({ site, repositorio }: { site: Site | null; repositorio: string }) {
  return (
    <section aria-labelledby="titulo-site" className="flex flex-col gap-4">
      <h2 id="titulo-site" className={tituloDaColuna}>
        Site do projeto
      </h2>
      {!site ? (
        <div className={`${painel} flex flex-col gap-2 px-4 py-4 text-texto-suave`}>
          <p>O repositório ainda não tem site.</p>
          <p className="text-pequeno">
            Ponha o endereço em <span className="font-medium text-texto">Website</span>, na engrenagem ao lado de About, na{" "}
            <a href={`https://github.com/${repositorio}`} className={link} target="_blank" rel="noopener noreferrer">
              página do repositório no GitHub
            </a>
            . Ele aparece aqui para todos da jam.
          </p>
        </div>
      ) : (
        <>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${painel} flex items-center justify-between gap-3 px-4 py-3 font-mono text-pequeno break-all text-texto transition-colors hover:bg-texto/10`}
          >
            <span>{curto(site.url)}</span>
            <span aria-hidden className="shrink-0 text-texto-suave">
              ↗
            </span>
            <span className="sr-only"> (abre em outra aba)</span>
          </a>
          {site.embutir ? (
            // Outro site, em outra origem: os scripts dele rodam isolados do app.
            <iframe
              src={site.url}
              title="Prévia do site do projeto"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              loading="lazy"
              className="h-[70vh] min-h-96 w-full rounded-2xl bg-white ring-1 ring-divisoria"
            />
          ) : (
            <p className="text-pequeno text-texto-suave">Este site não deixa aparecer dentro de outra página. Abra pelo link acima.</p>
          )}
        </>
      )}
    </section>
  );
}

// Busca o site no GitHub; se o GitHub não responder, a coluna diz que não há site.
export async function SiteDoProjeto({ usuarioId, dono, nome }: { usuarioId: string; dono: string; nome: string }) {
  const site = await siteDoProjeto(usuarioId, dono, nome).catch(() => null);
  return <ColunaDoSite site={site} repositorio={`${dono}/${nome}`} />;
}
