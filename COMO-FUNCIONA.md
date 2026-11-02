# Como as automações de risco foram feitas

Documento de estudo. Descreve as quatro máquinas que o **modo seguro** desliga, para que o
conhecimento não se perca junto com o código desativado.

Tudo aqui foi lido do `leveling.js` do upstream
([lioncodetech/leveling-idle-qualidade-de-vida](https://github.com/lioncodetech/leveling-idle-qualidade-de-vida)),
versão 0.25.0. Os comentários do autor datam as medições de 19/10/2026.

---

## 1. Gravação e repetição de caminho

A peça mais sofisticada. Permite gravar o trajeto do personagem até um NPC e refazê-lo depois.

### Gravação

Três listeners globais em fase de captura:

```js
['keydown','keyup','pointerdown'].forEach(t => addEventListener(t, gravarEvento, true));
```

`gravarEvento` só grava eventos com `e.isTrusted` — ou seja, gerados por humano, nunca por
script. Cada passo guarda:

- `t` — o instante relativo, por `performance.now() - inicio`;
- para teclas: `key`, `code`, `keyCode` e o tipo (`keydown`/`keyup`), ignorando `e.repeat`;
- para cliques: a posição **normalizada** `fx = clientX/innerWidth`, `fy = clientY/innerHeight`,
  o que torna o caminho independente do tamanho da janela.

A gravação para sozinha quando a loja abre ou após 120 s.

### Reprodução de teclas

O ponto mais interessante do projeto. O autor leu o código-fonte do jogo e documentou:

```js
keyDown(e){ if(!(e.ctrlKey||e.metaKey||e.altKey||...)){ ...
  if(!e.repeat) switch(e.code){ case 'KeyE':
    e.preventDefault(), this.net.send('interact',{entity:0})
```

Três consequências que ele explora:

1. o jogo lê **`e.code`**, não `key` nem `keyCode` — então o evento sintético precisa de `code: 'KeyE'`;
2. `!e.repeat` exige evento novo, que é o padrão do `KeyboardEvent`;
3. **`entity:0` significa "sem coordenada"** — quem decide qual NPC atende é a proximidade, no
   servidor.

Esse ponto 3 é a razão de a extensão falar com o NPC por tecla E em vez de clicar nele: não existe
alvo para errar, e um clique perdido no cenário moveria o personagem para longe.

Como `KeyboardEvent` não deixa definir `keyCode` pelo construtor, ele força por descritor:

```js
Object.defineProperty(e,'keyCode',{get:()=>p.keyCode});
Object.defineProperty(e,'which',{get:()=>p.keyCode});
```

E despacha no elemento com foco ou no canvas do jogo.

### Reprodução de cliques

`cliqueEm(fx, fy)` reconstrói a coordenada absoluta, **soma um ruído de ±3 px**, esconde o painel
da extensão por um instante para que `document.elementFromPoint` não acerte nele, e despacha a
sequência completa `pointerdown → mousedown → pointerup → mouseup → click`.

### Temporização precisa

Um detalhe fino: `setTimeout` em aba de segundo plano é estrangulado para ~1 s, o que deslocaria o
personagem. A solução usa `MessageChannel`, que não sofre throttling:

```js
const canal = new MessageChannel();
const proximo = () => new Promise(res => { canal.port1.onmessage = () => res(); canal.port2.postMessage(0) });
async function ate(t){ while(performance.now() < t){ const falta = t - performance.now();
  if(falta > 80 && !document.hidden) await sleep(falta - 60); else await proximo(); } }
```

Dorme grosso enquanto sobra tempo e afina no fim pelo canal.

### Variação de compasso — a parte que mais importa

`variarRota()` reembaralha os tempos a cada ida. A assimetria é deliberada e o autor explica o
porquê:

| O que | Variação | Razão |
|---|---|---|
| Pausas entre as pernas | **±0,8× a 1,5×** | nada premido, personagem parado — varia à vontade e é isso que muda a assinatura de tempos |
| Tecla premida | **±3%** | tecla premida **é distância**; ±8% erraria o destino de propósito |
| Espera até o primeiro passo | ±0,8× a 1,5× | senão toda ida começaria no mesmo instante, "metade da assinatura que se quer variar" |

O autor também registra que **não parte uma perna em duas**, porque cada arranque recomeça a
aceleração e o trajeto chega curto.

A variação vive só naquela ida; o caminho gravado continua sendo o que o dono andou. E
`repetirRota` sorteia entre os caminhos gravados, evitando repetir o último.

> É essa combinação — jitter assimétrico calibrado, tecla E em vez de clique, timing imune a
> throttling — que caracteriza o módulo como automação desenhada para não ser distinguida de um
> jogador. Foi o motivo principal de desligá-lo.

### Correção de erro de chegada

Se a loja não abre, `aproximarDoNpc` anda **mais um pouco no mesmo sentido**, não procura em volta.
A justificativa é boa engenharia: o erro é sistemático e tem sinal — o caminho chega sempre curto,
nunca longo, porque cada perna recomeça a aceleração. `sentidosDaRota` descobre quais direções
dominaram somando o tempo total de cada `code` premido.

Só como último recurso, `procurarEmVolta` clica em círculos de raio crescente (12, 24, 36, 50 px e
depois 40…150 px em volta do personagem).

---

## 2. Compra automática no NPC

Encadeada no caminho acima. O fluxo em `comprar()`:

1. se estiver em caçada, guarda qual é (`cacaViva()` lê o cartão **live** da lista) e volta à cidade;
2. refaz um caminho gravado até o NPC;
3. nas abas **Consumíveis** e **Essências** apenas — nunca na de diamantes — preenche a quantidade
   e compra;
4. volta para a **mesma** caçada.

As travas de segurança do autor, que merecem registro:

```js
const unsafe = e => /diamante|premium|cristal|comprar|pix|r\$/
  .test(norm(`${e?.textContent} ${e?.ariaLabel} ${e?.title}`));
```

- nenhum botão cujo texto, `aria-label` ou `title` fale de diamante, premium, cristal, pix ou R$ é
  clicado;
- a confirmação só é clicada **dentro de um modal**, nunca num `.slShopCard` — porque o botão
  `Comprar` do cartão tem o mesmo nome e clicá-lo de novo compraria em dobro;
- `esperarConfirmacao()` aguarda o modal até 4 s em vez de espiar uma vez (ida ao servidor demora);
- `esperarCompra()` espera a **quantidade na mochila mudar**, que é a prova de que o servidor
  aceitou;
- antes de confirmar, confere que a loja mostra a mesma quantidade e o mesmo preço total que ele
  calculou; se divergir, não compra.

A venda ao Brok (`venderItens`) segue a mesma disciplina: marca por raridade até o limite
escolhido, confere que o jogo marcou **exatamente** a mesma contagem e, se não bater, limpa a
seleção e desiste.

---

## 3. Recarregamento de página

Último recurso quando a loja não abre de jeito nenhum.

```js
const F5_POR_HORA = 2;
function recarregarETentar(){
  save(LOJA_F5, { feitas:[...f5Recentes(), Date.now()], pendente: Date.now() });
  setTimeout(() => location.reload(), 1500);
}
```

O raciocínio do autor sobre o teto é o melhor comentário do arquivo: *"o defeito que isto conserta
e o defeito que isto pode causar são o mesmo"* — com o NPC movido ou o jogo em manutenção,
recarregar sem limite vira um laço infinito que nunca diz o que está errado.

Dois detalhes:

- o bilhete vai para o `localStorage` porque **nada em memória sobrevive ao `reload`** — inclusive
  o próprio contador que impede o laço;
- quem lê o bilhete do outro lado **recusa bilhete com mais de 5 minutos**, para que um F5 do dono
  no dia seguinte não mande a extensão sair comprando sozinha.

---

## 4. Entrada automática em chefe e Torre

`chefeDiario()` e `torre()`, agendados por `desafiosTick()`.

### Horário sorteado dentro de uma faixa

Em vez de hora fixa, o usuário define uma faixa (ex.: 10:00–12:00) e a extensão **sorteia uma hora
por dia dentro dela**, guardando o sorteio. O autor anota o motivo: sortear a cada segundo cairia
sempre no início da faixa. Duas caixas iguais equivalem a hora fixa.

É o mesmo mecanismo usado para missões e talentos, com chaves próprias para não compartilharem nem
a hora sorteada nem a marca de "já foi hoje".

### Estado de "já fiz hoje"

Guardado em `localStorage` pelo **dia de Brasília** (`diaBrasilia()`), não pelo dia local.

A lição aprendida está no README: a marca local não bastava, porque ela não sabe do chefe que você
enfrentou à mão nem do que outra aba já fez. Então ao abrir a janela a extensão **pergunta ao
jogo** se o rank de hoje já foi — pelo rótulo da aba e sobretudo pela ausência do botão
*Enfrentar*.

Outra lição: o dia é marcado **antes** de sair da caçada. Antes era marcado só ao entrar, e todo
caminho que falhava deixava a marca em branco — o tick voltava um minuto depois e o personagem
passava o dia sendo levado para a cidade e trazido de volta sem nunca jogar.

### Ida e volta à caçada

`prepararDesafio()` guarda a caçada atual, volta à cidade, espera até 20 s sair da caçada. No fim,
`retomarCaca()` volta para a **mesma** caçada — lendo o cartão `live` da lista antes de sair, que é
a única fonte do nome. Quem **entrou** no desafio não é arrancado de volta.

### Torre: decisão por poder

A Torre lê o *poder recomendado* do andar e compara com o do personagem, aplicando a margem
configurada:

```js
const necessario = Math.ceil(rec * (1 + Number(cfg.towerMargem||0)/100));
if (rec && poder < necessario) { /* fica para amanhã */ }
```

Também marca as caixas *avançar automaticamente* e *pausar antes de chefes* e escolhe a condição de
parada no `select`, disparando `new Event('change',{bubbles:true})` para o framework perceber.

---

## Padrões gerais que valem estudo

Independente do risco, o código tem decisões boas de engenharia:

- **Fila de uma automação por vez** (`pedirVez`/`largarVez`). Antes, cada automação olhava só a
  própria flag e o chefe diário podia começar no meio da ida ao NPC — duas clicando na mesma tela,
  cada uma fechando a janela da outra. Quem chega e encontra alguém trabalhando espera a vez, por
  ordem de chegada. Quem espera mais de 5 minutos desiste; mais de 10, é dada por abandonada.
- **Verificar o efeito, não o clique.** Toda ação confere o estado que o servidor devolveu
  (quantidade na mochila, contagem de seleção, prévia de pontos) antes de dar por feita.
- **Prévia conferida**: em `confirmDraft`, se a prévia de distribuição mostra um número de pontos
  diferente do esperado, ele **cancela** em vez de confirmar.
- **Coordenadas normalizadas** por `innerWidth`/`innerHeight`, imunes a redimensionamento.
- Nenhuma chamada de rede em todo o arquivo. A extensão não fala com servidor nenhum.

---

## O que o modo seguro mantém

Tudo que apenas lê a tela ou clica num botão que você clicaria de qualquer forma, na janela que já
está aberta: painel e resumo, modo leve, distribuição de pontos de atributo, build de talentos,
alerta de party, e o resgate da recompensa diária de login.

Automações de risco médio (escada de caçadas, Codex, Forja, organização de sombras, equipar)
continuam no código e **já vêm desligadas de fábrica**. Elas não andam com o personagem nem
simulam jogador — abrem uma janela e clicam num botão —, mas gastam recursos ou trocam sua caçada.
Ligue cada uma conscientemente.
