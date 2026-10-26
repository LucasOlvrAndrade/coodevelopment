export default function PaginaInicial() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-4 md:px-8">
      <header className="py-4">
        <span className="font-mono text-corpo font-medium">coodevelopment</span>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6 py-12">
        <h1 className="max-w-[24ch] text-h1 font-semibold">
          Programe junto com seus amigos, cada um com o seu Claude Code, vendo ao vivo o que cada
          Claude está fazendo.
        </h1>

        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            disabled
            aria-describedby="aviso-login"
            className="rounded-controle bg-primaria px-4 py-3 text-corpo font-medium text-sobre-primaria disabled:opacity-60"
          >
            Entrar com GitHub
          </button>
          <p id="aviso-login" className="text-pequeno text-texto-suave">
            O login com GitHub chega na próxima versão.
          </p>
        </div>
      </main>
    </div>
  );
}
