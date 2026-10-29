// next/font/google só existe no build do Next; nos testes, cada fonte vira
// uma classe vazia.
const fonte = () => ({ className: "", variable: "", style: { fontFamily: "" } });

export const Sora = fonte;
export const Inter = fonte;
export const Instrument_Serif = fonte;
export const IBM_Plex_Mono = fonte;
