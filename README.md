# Leveling Idle — QoL, modo seguro

Fork de [lioncodetech/leveling-idle-qualidade-de-vida](https://github.com/lioncodetech/leveling-idle-qualidade-de-vida)
com as automações que simulam um jogador desligadas.

A extensão original é um bot. Este fork mantém só a parte de interface.

---

## O que foi desligado

| Máquina | Por quê |
|---|---|
| Gravação e repetição de caminho | anda com o personagem por eventos sintéticos, com variação de compasso calibrada para não parecer script |
| Compra e venda automática no NPC | depende do caminho acima; sai da caçada, vai à cidade e volta |
| Recarregamento automático da página | `location.reload()` quando a loja não abre |
| Entrada automática em chefe diário e Torre | sai da caçada em horário sorteado e entra sozinho |

Como cada uma foi implementada está em **[COMO-FUNCIONA.md](COMO-FUNCIONA.md)** — o estudo foi
preservado, só o comportamento saiu.

## O que ficou

Painel e resumo (HP, mana, XP, alvo, mochila, ping), modo leve, ocultar cenário, `Alt+Q` para
mostrar/esconder, distribuição de pontos de atributo pela build, build de talentos, alerta de
party e resgate da recompensa diária de login.

São coisas que leem a tela ou clicam num botão da janela que você já abriria.

## Risco médio, continua disponível e desligado de fábrica

Escada de caçadas, Codex, Forja, organização de sombras e equipar automático. Não andam com o
personagem, mas gastam recursos ou trocam sua caçada. Ligue conscientemente.

---

## Instalar

1. baixe ou clone este repositório;
2. `chrome://extensions` → ligue **Modo do desenvolvedor**;
3. **Carregar sem compactação** → aponte para a pasta.

## Reverter ao original

Em `leveling.js`, linha ~16:

```js
const MODO_SEGURO = true;   // false devolve tudo que o upstream faz
```

---

## Revisão de segurança

Feita sobre o commit `6ca23d7` do upstream (v0.25.0, 815 linhas, sem ofuscação):

- permissões: **só `storage`**; sem cookies, abas, webRequest ou `host_permissions`;
- roda **só** em `levelingidle2d.com.br/*`;
- **zero chamadas de rede** — nenhum `fetch`, `XHR`, `WebSocket`, `sendBeacon`, nenhuma URL
  externa no arquivo inteiro;
- sem `eval`, `new Function` ou carregamento de script remoto;
- não lê token, cookie nem senha; o `localStorage` guarda só a própria configuração;
- o autor bloqueia por conta própria qualquer clique em botão que mencione diamante, premium,
  cristal, pix ou R$, e compra apenas com ouro.

Nada malicioso. O risco é de **banimento**, não de malware: o jogo tem Mercado e RMT, e operador
de jogo com economia real costuma ser agressivo com automação. Confirme as regras antes de usar.

O modo seguro também remove o listener global de `keydown`/`keyup`/`pointerdown` que existia só
para gravar caminho.

## Licença

O upstream **não tem arquivo de licença**, então o padrão é todos os direitos reservados. Este
fork existe para estudo e uso próprio. Não republique como projeto independente.
