import Image from "next/image";

type Props = { nome: string; foto?: string | null; tamanho?: 24 | 32 | 40 };

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

// Foto do GitHub; sem foto, iniciais. O nome sempre aparece ao lado em listas,
// então a imagem é decorativa (alt vazio).
export function Avatar({ nome, foto, tamanho = 32 }: Props) {
  if (foto) {
    return <Image src={foto} alt="" width={tamanho} height={tamanho} className="rounded-full" />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: tamanho, height: tamanho }}
      className="inline-flex items-center justify-center rounded-full bg-participante-1 text-pequeno font-medium text-sobre-primaria"
    >
      {iniciais(nome)}
    </span>
  );
}
