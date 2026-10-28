// Mostrado quando o GitHub volta com erro (a pessoa recusou ou cancelou).
export async function AvisoErroLogin({ busca }: { busca: Promise<{ erro?: string | string[] }> }) {
  const { erro } = await busca;
  if (!erro) return null;
  return (
    <div role="alert" className="max-w-[60ch] rounded-2xl bg-fundo/70 px-4 py-3 ring-1 ring-erro backdrop-blur">
      <p className="font-medium">Não deu para entrar com o GitHub.</p>
      <p className="text-texto-suave">
        O Coodevelopment precisa da sua autorização no GitHub para saber quem você é e, nas jams,
        criar repositório, chamar seus amigos como colaboradores e fazer o commit. Tente de novo e
        confirme na tela do GitHub.
      </p>
    </div>
  );
}
