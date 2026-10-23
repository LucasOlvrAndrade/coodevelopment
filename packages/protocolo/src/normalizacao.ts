// Caminho no protocolo: sempre relativo à raiz do projeto e com "/".
// Devolve null quando o caminho sai da raiz ou é absoluto; quem chama recusa.
export function normalizarCaminho(caminho: string): string | null {
  const comBarra = caminho.replace(/\\/g, "/");
  if (comBarra.startsWith("/") || /^[a-zA-Z]:/.test(comBarra)) return null;

  const partes: string[] = [];
  for (const parte of comBarra.split("/")) {
    if (parte === "" || parte === ".") continue;
    if (parte === "..") {
      if (partes.length === 0) return null;
      partes.pop();
      continue;
    }
    partes.push(parte);
  }
  return partes.length > 0 ? partes.join("/") : null;
}

// Hash e merge usam o texto com LF (NFR7); CR solto também vira LF.
export function normalizarFinalDeLinha(texto: string): string {
  return texto.replace(/\r\n?/g, "\n");
}
