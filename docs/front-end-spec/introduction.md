# Introduction

This document defines the user experience goals, information architecture,
user flows, and visual design specifications for Coodevelopment's user
interface. It serves as the foundation for visual design and frontend
development, ensuring a cohesive and user-centered experience.

## Overall UX Goals & Principles

### Target User Personas

- **Desenvolvedor na jam (o Lucas, o pai):** já usa o Claude Code todo dia, no
  Windows, com terminal e editor abertos. Usa o app numa aba ao lado ou no
  celular apoiado na mesa. Quer saber de relance o que o outro Claude está
  fazendo e não quer configurar nada além do necessário.
- **Amigo convidado (segmento secundário):** desenvolvedor que entra numa jam
  pela primeira vez; precisa sair do "recebi um convite" para "estou
  conectado" sem ajuda de ninguém.

### Usability Goals

- **Leitura de relance:** em menos de 2 segundos olhando a página da jam, a
  pessoa sabe quem está trabalhando e em quê.
- **Primeira conexão sozinho:** quem nunca usou conecta à jam em até 5 minutos
  seguindo só a página, inclusive instalando o Node.
- **Nada some sem querer:** toda ação que mexe no repositório (fechar jam,
  atualizar a pasta) mostra o que vai acontecer e pede confirmação.
- **Silêncio quando nada acontece:** sem Claude trabalhando, a página fica
  quieta; nenhum elemento pisca ou se mexe sem motivo.

### Design Principles

1. **O status é a interface:** a frase "Claude Code de Lucas está trabalhando
   em: ..." é o elemento mais importante de toda a página e tem o maior
   destaque.
2. **Cada pessoa tem uma cor:** a cor do participante marca o status, os
   avisos e os arquivos dele em todo lugar; cor nunca aparece sozinha, sempre
   com nome ou foto.
3. **Ferramenta, não vitrine:** visual sóbrio de ferramenta de desenvolvedor;
   sem degradê, vidro fosco, brilho de fundo ou animação decorativa.
4. **Dizer o que faz:** textos curtos e concretos, em português, sem buzzword
   e sem travessão.
5. **Atualizar sem empurrar:** o que chega em tempo real entra no lugar dele
   sem deslocar o que a pessoa está lendo.

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-10-22 | 0.1 | Primeira versão, modo YOLO, a partir do PRD 0.1 | Uma (@ux-design-expert), via Claude |
| 2026-10-23 | 0.2 | Lucas confirmou todas as suposições | Uma (@ux-design-expert), via Claude |
| 2026-10-23 | 0.3 | Ajustes da validação do @po: instalação do GitHub App no login, tela de confirmar o código do conector, Git no prompt, aviso de aprovar o MCP | Pax (@po), via Claude |
