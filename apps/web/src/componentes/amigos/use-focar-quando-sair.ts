import { useEffect, useRef, type RefObject } from "react";

// Aceitar, recusar, desfazer e pedir pela sugestão tiram a linha da lista
// quando a página volta do servidor, e o foco cairia no body. Marcando a
// linha da ação, o foco vai para o aviso da lista quando ela sumir (gate da
// 1.3, A11Y-002).
export function useFocarQuandoSair(idsNaLista: string[], aviso: RefObject<HTMLElement | null>) {
  const esperando = useRef<string | null>(null);

  useEffect(() => {
    if (esperando.current !== null && !idsNaLista.includes(esperando.current)) {
      esperando.current = null;
      aviso.current?.focus();
    }
  }, [idsNaLista, aviso]);

  return (id: string) => {
    esperando.current = id;
  };
}
