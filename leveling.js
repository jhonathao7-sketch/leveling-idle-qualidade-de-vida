(() => {
  'use strict';
  if (document.querySelector('#lioncode-leveling')) return;
  const KEY='lioncode:leveling:qol:v2', POS='lioncode:leveling:posicao', DAILY='lioncode:leveling:diaria:resgatada', BOSS_DAY='lioncode:leveling:chefe:feito', TOWER_DAY='lioncode:leveling:torre:feita', BOSS_SORT='lioncode:leveling:chefe:sorteio', TOWER_SORT='lioncode:leveling:torre:sorteio', LOJA_F5='lioncode:leveling:loja:recarregar', MISS_SORT='lioncode:leveling:missoes:sorteio', MISS_FEITAS='lioncode:leveling:missoes:feitas', TAL_SORT='lioncode:leveling:talentos:sorteio', TAL_FEITAS='lioncode:leveling:talentos:feitas';
  const DEFAULTS={aberto:true,minimizado:false,pausado:false,aba:'resumo',leve:false,semAnimacoes:true,semCenario:false,intervalo:1000,escada:false,marco:10,nivelHunt:5,margemHunt:0,codex:false,codexAba:'monstros',codexAbas:['monstros'],codexMin:5,potions:false,hpPotion:45,mpPotion:35,shadowPotion:20,reviver:false,reviverItem:'barato',reviverMax:3,bag:false,bagLimit:90,autoSell:false,autoWarehouse:false,party:true,partyAlert:25,routines:false,missions:true,missoesFaixas:[],talentosFaixas:[],daily:true,events:true,war:true,bossAuto:false,bossRank:'E',bossHora:'12:00',bossHoraFim:'12:00',towerAuto:false,towerHora:'12:10',towerHoraFim:'12:10',towerMargem:30,towerStop:'10',towerBossPause:true,forgeAuto:false,forgeNivel:5,forgeGoldReserve:100000,forgeStoneReserve:0,forgeMin:1440,shadowBest:false,shadowEquip:false,shadowMin:60,fatigue:false,fatigueLimit:80,returnFatigue:true,autoStatus:false,buildModo:'jogo',buildJogo:'',pesos:{},builds:{},classeBuild:'',autoLoja:false,vendaAuto:false,lojaRefresh:true,vendaRaridade:'Incomum',vendaMochila:90,lojaMin:0,lojaItens:[{nome:'Poção Pequena',alvo:200},{nome:'Poção de Mana Pequena',alvo:100}],lojaNomes:['Poção Pequena','Poção Média','Poção Grande','Poção de Mana Pequena','Poção de Mana Média','Poção de Mana Grande','Reviver Pequeno','Reviver Médio','Reviver Grande','Poção de Sombra','Reviver de Sombra'],rotas:[],charPos:null,lojaUltima:0,autoEquip:false,equipCriterio:'jogo',equipPesos:{Poder:100},equipExigir:{},equipLabels:['Ataque','Defesa','Vida','Mana','Poder'],equipModo:'minutos',equipMin:60,equipHora:'04:00',equipDia:'1',equipNivel:false,equipUltimo:0,autoTalentos:false,talPreReq:true,talArvore:{},talBuilds:{}};
  const json=(v,d)=>{try{return JSON.parse(v)??d}catch{return d}},load=(k,d)=>json(localStorage.getItem(k),d),save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
  /* ─────────────────────────── MODO SEGURO ───────────────────────────
   * Desliga as automações que simulam um jogador: andar pelo mapa, comprar no
   * NPC, recarregar a página e entrar sozinho em chefe/Torre.
   * O que cada uma fazia, e como foi implementada, está em COMO-FUNCIONA.md.
   * Fica de pé tudo que só lê a tela ou clica num botão da janela que você já
   * abriria: painel, resumo, pontos de atributo, talentos, alerta de party e o
   * resgate da diária de login.
   * Para voltar ao comportamento original do upstream: MODO_SEGURO=false.
   */
  const MODO_SEGURO=true;
  const BLOQUEADAS=['autoLoja','vendaAuto','lojaRefresh','bossAuto','towerAuto'];
  const seguro=c=>{if(MODO_SEGURO){for(const k of BLOQUEADAS)c[k]=false;c.rotas=[];c.charPos=null}return c};
  const barrado=nome=>{if(!MODO_SEGURO)return false;try{log(`Modo seguro: ${nome} está desligado. Veja COMO-FUNCIONA.md.`,'warn')}catch{}return true};
  let cfg=seguro((c=>(Array.isArray(c.rota)&&c.rota.length&&!(c.rotas||[]).length&&(c.rotas=[c.rota]),delete c.rota,Array.isArray(c.codexAbas)||(c.codexAbas=[c.codexAba||'monstros']),c))({...DEFAULTS,...load(KEY,{})})),timer=0,running=false,statusBusy=false,huntBusy=false,codexBusy=false,missionBusy=false,challengeBusy=false,forgeBusy=false,shadowBusy=false,lojaBusy=false,faltaPocao=0,gravando=null,ultimaRota=-1,marcandoChar=false,equipBusy=false,lastEquipLevel=0,talBusy=false,lastTalLevel=0,lastTalCheck=0,lastStatusLevel=0,lastStatusCheck=0,lastRoutine=0,lastMission=0,lastCodex=0,lastForge=0,lastShadow=0,codexIndex=0,nextHunt=0,lastLevel=0,drag=null,reviverUsos=[],tamanhoGuardado=0,diariaBusy=false;
  const cooldown=new Map(),logs=[];
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const text=(s,r=document)=>r.querySelector(s)?.textContent?.replace(/\s+/g,' ').trim()||'';
  const num=v=>Number(String(v||'').replace(/\./g,'').replace(',','.').match(/-?[\d.]+/)?.[0]||0);
  const ratio=v=>{const m=String(v||'').match(/([\d.,]+)\s*\/\s*([\d.,]+)/);return m?{value:num(m[1]),max:num(m[2]),pct:num(m[2])?num(m[1])/num(m[2])*100:0}:{value:num(v),max:0,pct:0}};
  const ready=(k,ms)=>{const n=Date.now();if((cooldown.get(k)||0)>n)return false;cooldown.set(k,n+ms);return true};
  const visible=e=>!!e&&!e.disabled&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
  const findButton=(names,r=document)=>[...r.querySelectorAll('button,[role="button"]')].filter(e=>visible(e)&&!panel?.contains(e)).find(e=>(Array.isArray(names)?names:[names]).map(norm).some(n=>norm(`${e.textContent} ${e.ariaLabel||''} ${e.title||''}`).includes(n)));
  const unsafe=e=>/diamante|premium|cristal|comprar|pix|r\$/.test(norm(`${e?.textContent} ${e?.ariaLabel} ${e?.title}`));
  const clickSafe=(e,label)=>{if(!visible(e)||unsafe(e)){if(e)log(`Bloqueado por segurança: ${label}`,'warn');return false}e.click();log(label);return true};

  const STATS=['STR','AGI','VIT','INT','PER','CRIT','LUK','DEF FIS','RES MAG'],STAT_NOMES={STR:'Força',AGI:'Agilidade',VIT:'Vitalidade',INT:'Inteligência',PER:'Percepção',CRIT:'Crítico',LUK:'Sorte','DEF FIS':'Defesa física','RES MAG':'Resist. mágica'};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const panel=document.createElement('section');panel.id='lioncode-leveling';
  panel.innerHTML=`<header data-drag><strong>Leveling QoL <small>${(()=>{try{return chrome.runtime.getManifest().version}catch{return ''}})()}</small></strong><i data-engine></i><button data-min>–</button><button data-close>×</button></header><div class="mini" data-mini>Carregando…</div><nav>${['resumo','caçadas','desafios','suprimentos','build','talentos','equipamento','rotinas','ajustes'].map(x=>`<button data-tab="${x}">${x}</button>`).join('')}</nav><main>
  <section data-page="resumo"><div class="grid"><span>Personagem</span><b data-personagem>—</b><span>HP / Mana</span><b data-vitals>—</b><span>XP</span><b data-xp>—</b><span>Alvo</span><b data-alvo>—</b><span>Mochila</span><b data-mochila>—</b><span>Party</span><b data-party>—</b><span>Fadiga</span><b data-fatigue>—</b><span>Ping</span><b data-ping>—</b></div><div class="actions"><button class="primary" data-pause></button><button data-city>Voltar à cidade</button></div><div class="log" data-log></div></section>
  <section data-page="caçadas"><fieldset><legend>Escada por nível</legend><label class="toggle"><input type="checkbox" data-cfg="escada"> Escada automática</label><label>Trocar a cada <input type="number" min="1" max="500" data-cfg="marco"> níveis</label><label>Nível-alvo da caça <input type="number" min="1" max="9999" data-cfg="nivelHunt"></label><label>Margem permitida <input type="number" min="0" max="100" data-cfg="margemHunt"></label><p class="hint">Escolhe a área mais perto do nível-alvo sem ultrapassar a margem.</p><button data-hunt-now>Procurar caça agora</button><output data-hunt-state>Desligada</output></fieldset><fieldset><legend>Caçada pelo Codex</legend><label class="toggle"><input type="checkbox" data-cfg="codex"> Verificar automaticamente</label>${Object.entries({monstros:'Monstros',loots:'Loots',equipamentos:'Equipamentos',aprimoramento:'Aprimoramento'}).map(([k,v])=>`<label class="toggle"><input type="checkbox" data-codex-aba="${k}"> ${v}</label>`).join('')}<label>Verificar a cada <input type="number" min="1" max="1440" data-cfg="codexMin"> min</label><button data-codex-now>Procurar objetivo agora</button><output data-codex-state>Desligado</output><p class="hint">Percorre as abas marcadas em fila e escolhe o incompleto mais perto do próximo marco. Aprimoramento só abre a Forja.</p></fieldset></section>
  <section data-page="desafios"><fieldset><legend>Chefe diário</legend><label class="toggle"><input type="checkbox" data-cfg="bossAuto"> Enfrentar automaticamente</label><label>Rank <select data-cfg="bossRank" data-str>${['E','D','C','B','A','S'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Entre <input type="time" data-cfg="bossHora" data-str> e <input type="time" data-cfg="bossHoraFim" data-str></label><button data-boss-now>Verificar chefe agora</button><output data-boss-state>Desligado</output><output data-boss-sorteio>—</output><p class="hint">Uma tentativa por dia. Perder também consome a chance. O horário é sorteado uma vez por dia dentro da faixa; deixe as duas caixas iguais para ter hora fixa.</p></fieldset><fieldset><legend>Torre Infinita</legend><label class="toggle"><input type="checkbox" data-cfg="towerAuto"> Subir automaticamente</label><label>Entre <input type="time" data-cfg="towerHora" data-str> e <input type="time" data-cfg="towerHoraFim" data-str></label><label>Margem de poder <input type="number" min="0" max="300" data-cfg="towerMargem">%</label><label>Parar <select data-cfg="towerStop" data-str><option value="derrota">quando perder</option><option value="10">após 10 andares</option><option value="20">após 20 andares</option></select></label><label class="toggle"><input type="checkbox" data-cfg="towerBossPause"> Pausar antes de chefes</label><button data-tower-now>Verificar Torre agora</button><output data-tower-state>Desligada</output><output data-tower-sorteio>—</output><p class="hint">O horário é sorteado uma vez por dia dentro da faixa; deixe as duas caixas iguais para ter hora fixa.</p></fieldset><fieldset><legend>Forja inteligente</legend><label class="toggle"><input type="checkbox" data-cfg="forgeAuto"> Encantar peças vestidas</label><label>Até +<input type="number" min="1" max="20" data-cfg="forgeNivel"></label><label>Reservar ouro <input type="number" min="0" data-cfg="forgeGoldReserve"></label><label>Reservar pedras <input type="number" min="0" data-cfg="forgeStoneReserve"></label><label>A cada <input type="number" min="10" max="10080" data-cfg="forgeMin"> min</label><button data-forge-now>Aprimorar agora</button><output data-forge-state>Desligada</output></fieldset><fieldset><legend>Sombras</legend><label class="toggle"><input type="checkbox" data-cfg="shadowBest"> Montar melhor time</label><label class="toggle"><input type="checkbox" data-cfg="shadowEquip"> Equipar melhores nas sombras do time</label><label>A cada <input type="number" min="10" max="10080" data-cfg="shadowMin"> min</label><button data-shadow-now>Organizar agora</button><output data-shadow-state>Desligado</output><p class="hint">Não libera nem funde sombras. Extração já é automática no jogo.</p></fieldset><fieldset><legend>Descanso offline</legend><output>O jogo só calcula o descanso desconectado. Reservas pagas do Hotel permanecem manuais.</output></fieldset></section>
  <section data-page="suprimentos"><fieldset><legend>Poções</legend><label class="toggle"><input type="checkbox" data-cfg="potions"> Usar automaticamente</label><label>HP abaixo de <input type="number" min="1" max="99" data-cfg="hpPotion">%</label><label>Mana abaixo de <input type="number" min="1" max="99" data-cfg="mpPotion">%</label><label>Sombra abaixo de <input type="number" min="1" max="99" data-cfg="shadowPotion">%</label></fieldset><fieldset><legend>Ao cair na caçada</legend><label class="toggle"><input type="checkbox" data-cfg="reviver"> Usar Reviver sozinho</label><label>Qual <select data-cfg="reviverItem" data-str><option value="barato">o mais barato que houver</option><option value="melhor">o melhor que houver</option><option value="pequeno">só Pequeno</option><option value="medio">só Médio</option><option value="grande">só Grande</option></select></label><label>No máximo <input type="number" min="0" max="50" data-cfg="reviverMax"> por hora</label><output data-reviver-state>Desligado</output><p class="hint">Reviver gasta um item da mochila. O jogo dá uma contagem curta antes de levar você para Seul; alcançado o teto, a extensão deixa o prazo correr em vez de queimar o estoque. O XP perdido na queda não volta — isso é da morte, e nenhum Reviver desfaz.</p></fieldset><fieldset><legend>Mochila e depósito</legend><label class="toggle"><input type="checkbox" data-cfg="bag"> Controlar lotação</label><label>Agir com <input type="number" min="20" max="100" data-cfg="bagLimit">%</label><label class="toggle"><input type="checkbox" data-cfg="autoWarehouse"> Abrir armazém na cidade</label><label class="toggle"><input type="checkbox" data-cfg="autoSell"> Preparar venda segura</label><p class="hint">Nunca confirma itens raros, equipados, marcados, bloqueados ou melhorados. A confirmação final é manual.</p></fieldset><fieldset><legend>Comprar no NPC</legend><label class="toggle"><input type="checkbox" data-cfg="autoLoja"> Comprar sozinho quando a poção acabar</label><label>Também a cada <input type="number" min="0" max="10080" data-cfg="lojaMin"> min</label><label class="toggle"><input type="checkbox" data-cfg="lojaRefresh"> Se a loja não abrir, recarregar a página e tentar outra vez</label><p class="hint">No máximo duas vezes por hora: se a loja nunca abrir — NPC movido, caminho velho, jogo em manutenção — recarregar sem teto vira um laço que nunca diz o que está errado.</p><div class="tal-list" data-loja-list></div><button data-loja-add>+ item</button><div class="tal-list" data-rota-list></div><output data-rota-state>—</output><div class="actions"><button data-rota-rec>Gravar novo caminho</button><button data-char-mark>Marcar meu personagem</button><button data-loja-now>Comprar agora</button></div><output data-loja-state>—</output><p class="hint">Para gravar: volte à cidade, espere aparecer, clique em "Gravar novo caminho", ande até o NPC (setas ou WASD) e clique nele. A gravação para sozinha quando a loja abre. Se o clique não acerta o NPC, ela procura em volta do ponto gravado e depois em volta do seu personagem (o centro da tela, ou o ponto marcado em "Marcar meu personagem"). Grave vários caminhos diferentes: a cada compra um deles é sorteado, nunca o mesmo duas vezes seguidas, com uma espera inicial e o clique no NPC variando um pouco. Cada item é completado até a quantidade escolhida, só com ouro e só se o ouro der; a aba de Essências entra junto com a de Consumíveis, e a de diamantes nunca é aberta. Os itens de Essências aparecem na lista depois que você abrir essa aba uma vez com a extensão ligada.</p></fieldset><fieldset><legend>Vender ao Brok</legend><label class="toggle"><input type="checkbox" data-cfg="vendaAuto"> Vender equipamento na ida ao NPC</label><label>Até a raridade <select data-cfg="vendaRaridade" data-str>${['Comum','Incomum','Raro','Épico','Lendário'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Ir vender com a mochila em <input type="number" min="20" max="100" data-cfg="vendaMochila">%</label><button data-venda-now>Vender agora</button><output data-venda-state>—</output><p class="hint">Só armas e armaduras, nunca materiais. O jogo já esconde o que está equipado e não vende o que está travado 🔒; trave as peças que quer guardar. Antes de vender confere que o jogo marcou exatamente as peças escolhidas.</p></fieldset></section>
  <section data-page="build"><label class="toggle"><input type="checkbox" data-cfg="autoStatus"> Distribuir pontos automaticamente</label><label>Usar <select data-cfg="buildModo" data-str><option value="jogo">Build do jogo</option><option value="propria">Minha build</option></select></label><fieldset data-build-jogo><legend>Builds da classe</legend><label>Build <select data-cfg="buildJogo" data-str data-build-pick></select></label><output data-build-desc></output><button data-build-load>Ler builds da classe</button></fieldset><fieldset data-build-propria><legend>Minha build (peso de cada atributo)</legend>${STATS.map(k=>`<label>${STAT_NOMES[k]} <input type="number" min="0" max="100" data-peso="${k}"></label>`).join('')}<output data-peso-soma></output></fieldset><button data-status-now>Distribuir agora</button><output data-status-state>—</output><p class="hint">Com pontos livres, abre a janela de Status, distribui pela build escolhida, confirma e fecha. Os pesos repartem os pontos para aproximar o total investido de cada atributo, como o botão "Distribuir pela build" do jogo.</p></section>
  <section data-page="talentos"><label class="toggle"><input type="checkbox" data-cfg="autoTalentos"> Gastar pontos de talento automaticamente</label><label class="toggle"><input type="checkbox" data-cfg="talPreReq"> Subir pré-requisitos sozinho</label><button data-tal-load>Ler árvore de talentos</button><div class="tal-list" data-tal-list></div><div class="actions"><button data-tal-add>+ talento</button><button data-tal-now>Gastar agora</button></div><output data-tal-state>—</output><div class="tal-list" data-talf-list></div><button data-faixa-add="talentos">+ faixa de horário</button><p class="hint">Sem faixa nenhuma, confere sempre que houver pontos novos. Com faixas, sorteia uma hora dentro de cada faixa e confere uma vez por faixa, por dia.</p><p class="hint">A lista vale em ordem: cada talento sobe até o nível escolhido antes do próximo. Um talento bloqueado tem os pré-requisitos subidos um nível por vez até o jogo liberá-lo, inclusive quando ele exige nível mínimo no anterior; com essa opção desligada, ele é pulado e tentado de novo depois. Os pontos de talento servem a todas as árvores.</p></section>
  <section data-page="equipamento"><label class="toggle"><input type="checkbox" data-cfg="autoEquip"> Equipar os melhores automaticamente</label><label>Escolher por <select data-cfg="equipCriterio" data-str><option value="jogo">poder (botão do jogo)</option><option value="build">meus atributos</option></select></label><fieldset data-equip-build><legend>Atributos preferidos</legend><div class="tal-list" data-eq-pesos></div><p class="hint">Peso de 0 a 100 para cada atributo das peças. Cada atributo é comparado com o maior valor dele entre as suas peças, então o peso vale como proporção mesmo entre Vida (+51) e Defesa (+9). "Exigir" só aceita peças que tenham aquele atributo. Atributos novos aparecem aqui depois da primeira leitura.</p></fieldset><fieldset><legend>Quando</legend><label>Repetir <select data-cfg="equipModo" data-str><option value="minutos">a cada N minutos</option><option value="dia">uma vez por dia</option><option value="semana">uma vez por semana</option></select></label><label data-equip-show="minutos">A cada <input type="number" min="5" max="10080" data-cfg="equipMin"> min</label><label data-equip-show="semana">No dia <select data-cfg="equipDia" data-str>${['domingo','segunda','terça','quarta','quinta','sexta','sábado'].map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select></label><label data-equip-show="dia semana">Às <input type="time" data-cfg="equipHora" data-str></label><label class="toggle"><input type="checkbox" data-cfg="equipNivel"> Também ao subir de nível</label><output data-equip-next>—</output></fieldset><button data-equip-now>Equipar agora</button><output data-equip-state>—</output><p class="hint">Por poder, usa o botão "Equipar melhores" do jogo. Por atributos, lê cada peça de Armas e Armadura da mochila (leva um ou dois minutos com a mochila cheia), dá a nota pelos pesos e equipa em cada espaço a melhor, só se for melhor que a equipada e do seu nível. A mochila fecha no fim. O horário é o do seu computador; se o jogo estiver fechado na hora marcada, roda assim que abrir.</p></section>
  <section data-page="rotinas"><fieldset><legend>Party</legend><label class="toggle"><input type="checkbox" data-cfg="party"> Monitorar grupo</label><label>Alertar HP abaixo de <input type="number" min="1" max="99" data-cfg="partyAlert">%</label><output data-party-state>—</output></fieldset><fieldset><legend>Missões, diária, eventos e guerra</legend><label class="toggle"><input type="checkbox" data-cfg="routines"> Verificar automaticamente</label><label class="toggle"><input type="checkbox" data-cfg="missions"> Aceitar e resgatar missões</label><div class="tal-list" data-miss-list></div><button data-faixa-add="missoes">+ faixa de horário</button><p class="hint">Sem faixa nenhuma, confere de 5 em 5 minutos como sempre. Com faixas, confere uma vez por faixa, numa hora sorteada dentro dela — duas faixas apanham o que só fica pronto mais tarde.</p><label class="toggle"><input type="checkbox" data-cfg="daily"> Diária</label><label class="toggle"><input type="checkbox" data-cfg="events"> Eventos</label><label class="toggle"><input type="checkbox" data-cfg="war"> Guerra de time</label><div class="actions"><button data-missions-now>Verificar missões</button><button data-routines-now>Outras rotinas</button></div><output data-fila-state>Fila livre.</output><output data-missions-state>Missões desligadas</output><output data-routines-state>Desligado</output></fieldset><fieldset><legend>Fadiga e farm offline</legend><label class="toggle"><input type="checkbox" data-cfg="fatigue"> Controlar fadiga</label><label>Parar com <input type="number" min="10" max="100" data-cfg="fatigueLimit">%</label><label class="toggle"><input type="checkbox" data-cfg="returnFatigue"> Voltar à cidade</label><output data-fatigue-state>—</output></fieldset></section>
  <section data-page="ajustes"><fieldset><legend>Modo leve</legend><label class="toggle"><input type="checkbox" data-cfg="leve"> Ativar</label><label class="toggle"><input type="checkbox" data-cfg="semAnimacoes"> Remover animações</label><label class="toggle"><input type="checkbox" data-cfg="semCenario"> Ocultar cenário</label><label>Atualizar <select data-cfg="intervalo"><option value="500">0,5 s</option><option value="1000">1 s</option><option value="2000">2 s</option><option value="5000">5 s</option></select></label></fieldset><div class="actions"><button data-export>Exportar para arquivo</button><button data-import>Importar de arquivo</button><button data-reset>Restaurar padrão</button></div><p class="hint">O arquivo exportado leva a classe do personagem. Importado num personagem de outra classe, a build de status e os pesos de atributos do equipamento ficam de fora; caminhos até o NPC, compras, venda, agenda e o resto vêm. O que é estado desta conta (última compra, última troca, aba aberta, pausa) nunca vem.</p><p class="hint">Alt+Q mostra ou esconde o painel. Alt+G desliga os gráficos, Alt+H liga.</p></section></main>`;
  const style=document.createElement('style');style.textContent=`#lioncode-leveling,#lioncode-leveling *{box-sizing:border-box}#lioncode-leveling{position:fixed;z-index:2147483000;top:16px;right:16px;width:330px;max-height:calc(100vh - 32px);overflow:auto;resize:both;min-width:250px;min-height:120px;border:1px solid #46556d;border-radius:10px;background:#101722f5;color:#e8eef8;box-shadow:0 10px 32px #0009;font:13px/1.35 system-ui,sans-serif}#lioncode-leveling header{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:1px solid #303c50;cursor:move;position:sticky;top:0;background:#101722;z-index:2}#lioncode-leveling header strong{flex:1;color:#f2d37b}#lioncode-leveling header small{color:#7f8da1}#lioncode-leveling button{border:1px solid #46556d;border-radius:5px;background:#182131;color:#e8eef8;padding:5px 8px;cursor:pointer}#lioncode-leveling header button{border:0;background:none}#lioncode-leveling [data-engine]{width:8px;height:8px;border-radius:50%;background:#e35b5b}#lioncode-leveling [data-engine].on{background:#55cf7b;box-shadow:0 0 7px #55cf7b}#lioncode-leveling .mini{padding:7px 10px;color:#aeb9c9;font-size:12px}#lioncode-leveling nav{display:flex;overflow:auto;border-block:1px solid #303c50}#lioncode-leveling nav button{flex:1;border:0;border-radius:0;padding:7px 4px;font-size:11px;text-transform:capitalize}#lioncode-leveling nav button.active{color:#f2d37b;border-bottom:2px solid #d5aa42}#lioncode-leveling main{padding:10px}#lioncode-leveling [data-page]{display:none;gap:9px}#lioncode-leveling [data-page].active{display:grid}#lioncode-leveling.minimizado nav,#lioncode-leveling.minimizado main{display:none}#lioncode-leveling .grid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;padding:8px;border:1px solid #303c50;border-radius:7px;background:#0b111a}#lioncode-leveling .grid span{color:#8592a5}#lioncode-leveling .grid b{text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#lioncode-leveling fieldset{display:grid;gap:7px;margin:0;padding:8px;border:1px solid #303c50;border-radius:7px}#lioncode-leveling legend{color:#f2d37b}#lioncode-leveling label{display:flex;align-items:center;gap:6px;color:#c7d0dd}#lioncode-leveling label:not(.toggle) input,#lioncode-leveling label select{margin-left:auto;width:72px;border:1px solid #46556d;border-radius:5px;background:#182131;color:#e8eef8;padding:3px}#lioncode-leveling .actions{display:flex;gap:6px;flex-wrap:wrap}#lioncode-leveling .primary{border-color:#b58b32;color:#f2d37b}#lioncode-leveling output{display:block;color:#8ea0b8;font-size:11px}#lioncode-leveling .hint{margin:0;color:#8190a4;font-size:11px}#lioncode-leveling input[type=time]{width:90px!important}#lioncode-leveling [hidden]{display:none!important}#lioncode-leveling .tal-list{display:grid;gap:4px}#lioncode-leveling .tal-row{display:flex;gap:4px;align-items:center}#lioncode-leveling .tal-row select{flex:1;min-width:0}#lioncode-leveling .tal-row select,#lioncode-leveling .tal-row input{border:1px solid #46556d;border-radius:5px;background:#182131;color:#e8eef8;padding:3px}#lioncode-leveling .tal-row input{width:48px}#lioncode-leveling .tal-row button{padding:3px 6px}#lioncode-leveling .log{max-height:105px;overflow:auto;font-size:11px;color:#99a7b9}#lioncode-leveling .log div{padding:3px;border-top:1px solid #263043}#lioncode-leveling .warn{color:#f0b35e}#lioncode-leveling .error{color:#ef7272}html.lioncode-leveling-sem-animacao *,html.lioncode-leveling-sem-animacao *::before,html.lioncode-leveling-sem-animacao *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}html.lioncode-leveling-sem-cenario #game>canvas{display:none!important}`;document.documentElement.append(style,panel);
  const $=(s,r=panel)=>r.querySelector(s);
  function log(message,kind='info'){logs.unshift({at:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),message,kind});logs.splice(12);drawLog()}
  function drawLog(){const e=$('[data-log]');if(e)e.innerHTML=logs.map(x=>`<div class="${x.kind}">${x.at} · ${x.message}</div>`).join('')||'<div>Nenhuma ação.</div>'}
  function screen(){const hp=ratio(text('.slHudCard .slBar-hp .slBarText')),mana=ratio(text('.slHudCard .slBar-mana .slBarText')),fatigueText=text('.hsFatMiniV')||document.querySelector('.hsFatMini')?.ariaLabel||'',bagText=text('.slHudBagText'),m=bagText.match(/([\d.]+)\s*\/\s*([\d.]+)/);return{name:text('.slHudCardName'),className:text('.slHudCardClass'),level:num(text('.slHudSealV')),hp,mana,xp:text('.slHudXpRow b')||text('.slHudXpHint')||'—',target:[text('.slHudTgtName'),text('.slHudTgtLv')].filter(Boolean).join(' · ')||'cidade/sem alvo',bagText:bagText||'—',bagPct:m?num(m[1])/num(m[2])*100:0,partyDamage:text('.slPdmHeadText').replace(/^Dano\/hora do grupo/i,'').trim()||'solo',partyRows:[...document.querySelectorAll('.slPartyFrame,.slPdmRow')],fatigue:num(fatigueText),fatigueText:fatigueText||'—',ping:text('.slHudPingText')||'—'}}
  function draw(d=screen()){$('[data-personagem]').textContent=[d.name,d.className,d.level&&`Nv ${d.level}`].filter(Boolean).join(' · ')||'—';$('[data-vitals]').textContent=`${Math.round(d.hp.pct)}% / ${Math.round(d.mana.pct)}%`;$('[data-xp]').textContent=d.xp;$('[data-alvo]').textContent=d.target;$('[data-mochila]').textContent=d.bagText;$('[data-party]').textContent=d.partyDamage;$('[data-fatigue]').textContent=d.fatigueText;$('[data-ping]').textContent=d.ping;$('[data-mini]').textContent=`${d.name||'—'} Nv ${d.level||'—'} · HP ${Math.round(d.hp.pct)}% · ${d.target}`;$('[data-engine]').classList.toggle('on',!cfg.pausado);$('[data-pause]').textContent=cfg.pausado?'▶ Retomar automações':'⏸ Pausar automações'}
  function aplicarAltura(){panel.style.height=cfg.minimizado||!tamanhoGuardado?'auto':`${tamanhoGuardado}px`}
  /**
   * Quantas idas ao NPC estao a decorrer com o cenario devolvido.
   *
   * Esconder o cenario esconde **o NPC tambem**: ele faz parte da cena, e a extensao ficava a andar
   * contra um boneco invisivel. Enquanto vai falar com ele o cenario volta, e no fim desaparece
   * outra vez. E' um contador e nao um booleano para duas idas encavalitadas nao devolverem o
   * cenario a meio da primeira; e nao se toca em `cfg`, senao a preferencia do dono mudava sozinha
   * — e um erro a meio deixava os graficos ligados para sempre.
   */
  let cenarioSuspenso=0;
  async function comCenario(fn){cenarioSuspenso++;applyUI();await sleep(400);
    try{return await fn()}
    finally{cenarioSuspenso=Math.max(0,cenarioSuspenso-1);applyUI()}}
  function applyUI(){panel.classList.toggle('minimizado',cfg.minimizado);aplicarAltura();panel.style.display=cfg.aberto?'block':'none';document.documentElement.classList.toggle('lioncode-leveling-sem-animacao',cfg.leve&&cfg.semAnimacoes);document.documentElement.classList.toggle('lioncode-leveling-sem-cenario',cfg.leve&&cfg.semCenario&&!cenarioSuspenso);panel.querySelectorAll('[data-tab]').forEach(e=>e.classList.toggle('active',e.dataset.tab===cfg.aba));panel.querySelectorAll('[data-page]').forEach(e=>e.classList.toggle('active',e.dataset.page===cfg.aba));drawBuild();drawTal();drawEquip();drawLoja();drawMissoes();drawTalFaixas();panel.querySelectorAll('[data-cfg]').forEach(e=>{const v=cfg[e.dataset.cfg];e.type==='checkbox'?e.checked=!!v:e.value=String(v)});panel.querySelectorAll('[data-codex-aba]').forEach(e=>e.checked=cfg.codexAbas.includes(e.dataset.codexAba));$('[data-min]').textContent=cfg.minimizado?'□':'–';draw()}
  // Exportar/importar entre janelas. Estado da conta nunca viaja; o que depende da classe só viaja para a mesma classe. Os mapas guardados por classe (builds lidas, árvore e build de talentos) entram sem tocar no que já existe para a classe deste personagem.
  const ESTADO=['equipUltimo','lojaUltima','aba','aberto','minimizado','pausado'],DA_CLASSE=['buildModo','buildJogo','pesos','classeBuild','equipCriterio','equipPesos','equipExigir','equipLabels'],POR_CLASSE=['builds','talArvore','talBuilds'];
  function exportar(){const classe=classeAtual(),dados={app:'lioncode-leveling-qol',versao:'0.11.1',classe,cfg:Object.fromEntries(Object.entries(cfg).filter(([k])=>!ESTADO.includes(k)))},txt=JSON.stringify(dados,null,1),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'application/json'}));a.download=`leveling-qol-${(classe||'personagem').replace(/[^a-z0-9]+/gi,'-')}.json`;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);navigator.clipboard?.writeText(txt).catch(()=>{});log(`Configuração exportada${classe?` (${classe})`:''}.`)}
  function importar(txt){const d=json(txt,null);if(!d||typeof d!=='object'){log('Arquivo inválido.','error');return}const vinda=d.app==='lioncode-leveling-qol'?d.cfg||{}:d,origem=d.app==='lioncode-leveling-qol'?norm(d.classe||''):'',aqui=classeAtual(),mesma=!!origem&&!!aqui&&origem===aqui,novo={...cfg},fora=[];for(const[k,v]of Object.entries(vinda)){if(!(k in DEFAULTS)||ESTADO.includes(k))continue;if(DA_CLASSE.includes(k)&&!mesma){fora.push(k);continue}if(POR_CLASSE.includes(k)&&v&&typeof v==='object'){novo[k]={...v,...cfg[k]};continue}novo[k]=v}cfg=novo;persist();log(mesma?`Configuração importada de ${origem}.`:`Configuração importada${origem?` de ${origem}`:''} sem o que é da classe (build de status e pesos do equipamento).`)}
  function escolherArquivo(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json,text/plain';i.onchange=()=>{const f=i.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>importar(String(rd.result||''));rd.readAsText(f)};i.click()}
  const persist=()=>{seguro(cfg);save(KEY,cfg);applyUI();restart()};
  function returnCity(reason){const b=[...document.querySelectorAll('.slHudQbLeave')].find(visible)||findButton(['sair da caçada','voltar à cidade','retornar à cidade']);if(!b){log(`Não achei retorno à cidade (${reason}).`,'warn');return false}if(!clickSafe(b,`Voltando à cidade: ${reason}`))return false;setTimeout(()=>{const c=[...document.querySelectorAll('.slModalActions .slBtn-danger')].find(e=>visible(e)&&norm(e.textContent)==='sair da cacada');if(c){c.click();log('Saída da caçada confirmada.')}},350);return true}
  function potion(kind){const names=kind==='hp'?['poção pequena','poção de vida','poção de hp']:kind==='mana'?['poção de mana']:['poção de sombra'];const b=findButton(names);if(!b){faltaPocao=Date.now();return false}return b&&clickSafe(b,`Usou poção de ${kind==='hp'?'HP':kind}`)}
  // Ao cair, o jogo tira o `hidden` de `.slHudDeath` e mostra um botao por Reviver da mochila, com
  // uma contagem ate' levar o personagem de volta para Seul. Medido no jogo em 18/10/2026:
  // `<button class="slBtn slBtn-primary slHudDeathRev">Reviver Pequeno (25%) · ×7</button>`, dentro
  // de `.slHudDeathBtns`; o item sem estoque vem `disabled`, e a contagem fica em `.slHudDeathCount`.
  //
  // O cartao **vive sempre no DOM** e so' perde o `hidden` na morte: perguntar se ele existe
  // responde "sim" com o personagem de pe'. Quem decide e' a visibilidade.
  const morteAberta=()=>{const c=document.querySelector('.slHudDeath');return c&&!c.hidden&&c.getClientRects().length>0?c:null};
  /** Os Reviveres que dao para usar agora: visiveis, com percentual e com estoque. */
  const reviveres=card=>[...card.querySelectorAll('.slHudDeathRev')].filter(visible).map(e=>{const t=norm(e.textContent);return{e,nome:t,pct:num(t.match(/\((\d+)\s*%\)/)?.[1]),estoque:num(t.match(/[x\u00d7]\s*([\d.]+)/)?.[1])}}).filter(x=>x.pct>0&&x.estoque>0);
  /** O mais barato e' o de menor percentual: gastar um Grande numa queda boba e' desperdicio. */
  function reviverEscolhido(lista){const q=cfg.reviverItem;if(q==='pequeno'||q==='medio'||q==='grande')return lista.find(x=>x.nome.includes(q))||null;const ordem=[...lista].sort((a,b)=>a.pct-b.pct);return(q==='melhor'?ordem.at(-1):ordem[0])||null}
  /**
   * Reviver sozinho ao cair.
   *
   * Reviver **gasta um item**, e e' por isso que isto comeca desligado e tem teto por hora: uma
   * cacada que mata o personagem em laco esvaziaria a mochila enquanto ninguem olha, e o aviso so'
   * apareceria no estoque no dia seguinte. Alcancado o teto, nao se faz nada — a contagem do jogo
   * corre e ele leva o personagem para Seul, que e' exactamente o que acontecia antes desta opcao.
   */
  function reviverTick(){if(!cfg.reviver)return;const card=morteAberta();if(!card)return;
    const avisar=(frase,tipo='warn')=>{if(ready('reviver-aviso',20000))log(frase,tipo)};
    const agora=Date.now();reviverUsos=reviverUsos.filter(t=>agora-t<3600000);
    const teto=Math.max(0,Number(cfg.reviverMax)||0);
    if(teto&&reviverUsos.length>=teto){avisar(`Caí, mas já usei ${reviverUsos.length} Reviver nesta hora: deixo a contagem correr.`);return}
    // Duas tentativas coladas no mesmo cartao clicariam duas vezes e gastariam dois itens: o jogo
    // leva um instante para fechar o cartao depois do clique.
    if(!ready('reviver',2500))return;
    const lista=reviveres(card);
    if(!lista.length){avisar('Caí e não há Reviver com estoque na mochila: vou ser levado para Seul.');return}
    const alvo=reviverEscolhido(lista);
    if(!alvo){avisar('Caí, mas o Reviver escolhido está sem estoque — não troco por outro sozinho.');return}
    if(!clickSafe(alvo.e,`Caí e usei ${alvo.e.textContent.trim()}`))return;
    reviverUsos.push(agora)}
  function potionTick(d){if(!cfg.potions)return;if(d.hp.max&&d.hp.pct<=cfg.hpPotion&&ready('hp',5000))potion('hp');if(d.mana.max&&d.mana.pct<=cfg.mpPotion&&ready('mana',5000))potion('mana');const s=ratio(text('.slHudShadow .slBarText,.slHudShadowText'));if(s.max&&s.pct<=cfg.shadowPotion&&ready('shadow',5000))potion('shadow')}
  // Caçadas: janela data-win="hunts" com cartões .slHuntCard (data-state live/available/locked, "Área Nv N" e "Req. Nv N" em .slHuntMeta, botão Iniciar) divididos em páginas; a escada passa por todas, com a dificuldade em "Todas", em vez de só pela primeira.
  const huntWin=()=>[...document.querySelectorAll('.slWin[data-win="hunts"]')].find(visible);
  function lerCard(card){const meta=text('.slHuntMeta',card);return{nome:text('.slHuntName',card),dif:text('.slHuntDif',card),area:num((meta.match(/[áa]rea\s*nv\s*(\d+)/i)||[])[1]),req:num((meta.match(/req\.?\s*nv\s*(\d+)/i)||[])[1]),estado:card.dataset.state||''}}
  async function huntPagina1(W){const b=W().querySelector('.slHuntPager .slPagBtn[aria-label="Primeira página"]');if(b&&!b.disabled){b.click();await sleep(350)}}
  async function huntProxima(W){const b=W().querySelector('.slHuntPager .slPagBtn[aria-label="Avançar"]');if(!b||b.disabled)return false;b.click();await sleep(400);return true}
  /**
   * A caçada **nao entra na fila**, de proposito.
   *
   * Pedido assim em 19/10/2026: ela nao tem prioridade e pode sempre ser adiada. Entao ela nao toma
   * a vez (ninguem espera por ela) e nao se mexe enquanto houver alguem com a vez ou na fila — a
   * proxima volta do laco tenta de novo, e ela nao perde nada com isso: trocar de caçada um minuto
   * depois da' no mesmo. Era o contrario que custava caro: abrir a lista de caçadas por cima da
   * loja aberta fechava a janela de quem estava a comprar.
   *
   * No manual o dono mandou, e o dono passa a' frente da regra.
   */
  async function chooseHunt(manual=false){if(!manual&&!cfg.escada)return;if(huntBusy)return;if(!manual&&!vezLivre())return;huntBusy=true;const st=$('[data-hunt-state]');let aberto=null;try{aberto=await openWin(huntWin,'Caçadas');if(!aberto){st.textContent='Não consegui abrir a lista de caçadas.';log(st.textContent,'warn');return}const W=()=>huntWin()||aberto.w,tab=W().querySelector('.slTab[data-tab="hunts"]');if(tab&&!tab.classList.contains('slTabOn')){tab.click();await sleep(400)}const todas=[...W().querySelectorAll('.slHuntFilters .slChip')].find(c=>norm(c.textContent).startsWith('todas'));if(todas&&!todas.classList.contains('slChipOn')){todas.click();await sleep(400)}await huntPagina1(W);const nivel=screen().level||Infinity,lista=[];for(let pg=0;pg<60;pg++){W().querySelectorAll('.slHuntCard').forEach(c=>lista.push({...lerCard(c),pg}));st.textContent=`Lendo caçadas… ${lista.length}`;if(!await huntProxima(W))break}const max=Number(cfg.nivelHunt)+Number(cfg.margemHunt),pick=lista.filter(x=>x.area&&x.estado!=='locked'&&(!x.req||x.req<=nivel)&&x.area<=max).sort((a,b)=>Math.abs(a.area-cfg.nivelHunt)-Math.abs(b.area-cfg.nivelHunt)||b.area-a.area)[0];if(!pick){st.textContent=`Nenhuma das ${lista.length} caçadas serve para Nv ${cfg.nivelHunt}; ficou na atual.`;log(st.textContent,'warn');return}if(pick.estado==='live'){st.textContent=`Já está em ${pick.nome} (área Nv ${pick.area}).`;log(st.textContent);return}await huntPagina1(W);for(let k=0;k<pick.pg;k++)await huntProxima(W);const card=[...W().querySelectorAll('.slHuntCard')].find(c=>{const x=lerCard(c);return x.nome===pick.nome&&x.area===pick.area&&x.dif===pick.dif}),b=card&&[...card.querySelectorAll('button')].find(e=>norm(e.textContent)==='iniciar'&&!e.disabled);if(!b){st.textContent=`O botão Iniciar de ${pick.nome} não apareceu.`;log(st.textContent,'warn');return}b.click();await sleep(700);for(let k=0;k<2;k++){const c=[...document.querySelectorAll('button')].find(e=>visible(e)&&!panel.contains(e)&&/cacar mesmo assim|sair e iniciar|trocar de cacada|confirmar/.test(norm(e.textContent)));if(!c||unsafe(c))break;c.click();await sleep(600)}st.textContent=`Indo para ${pick.nome} (área Nv ${pick.area}${pick.dif?`, ${pick.dif}`:''}).`;log(st.textContent)}catch(e){log(`Erro nas caçadas: ${e.message}`,'error')}finally{if(aberto)await fechar(huntWin);huntBusy=false}}
  function huntTick(d){if(!cfg.escada||!d.level)return;if(!nextHunt)nextHunt=Math.ceil(d.level/cfg.marco)*cfg.marco;if(d.level>=nextHunt&&d.level!==lastLevel&&ready('hunt',15000)){cfg.nivelHunt=Math.max(1,Number(cfg.nivelHunt)+Number(cfg.marco));nextHunt+=Number(cfg.marco);save(KEY,cfg);chooseHunt()}lastLevel=d.level}
  const CODEX_ABAS={monstros:'Monstros',loots:'Loots',equipamentos:'Equipamentos',aprimoramento:'Aprimoramento'};
  const codexWin=()=>[...document.querySelectorAll('[role="dialog"],.slWin,.slModal')].find(e=>visible(e)&&norm(e.querySelector('h1,h2')?.textContent)==='codex');
  let ultimoCodexAlvo='';
  const codexButton=(w,pred)=>[...w.querySelectorAll('button,[role="tab"]')].find(e=>visible(e)&&pred(norm(e.textContent),e));
  async function codexObjetivo(manual=false){if(!manual&&!cfg.codex)return;if(codexBusy)return;const abas=cfg.codexAbas.filter(x=>CODEX_ABAS[x]);if(!abas.length){$('[data-codex-state]').textContent='Marque pelo menos uma aba.';return}cfg.codexAba=abas[codexIndex%abas.length];codexIndex=(codexIndex+1)%abas.length;codexBusy=true;const soltar=await pedirVez('codex');if(!soltar){codexBusy=false;return}const st=$('[data-codex-state]');let aberto=null;try{aberto=await openWin(codexWin,'Codex');if(!aberto){st.textContent='Não consegui abrir o Codex.';log(st.textContent,'warn');return}const W=()=>codexWin()||aberto.w,nomeAba=CODEX_ABAS[cfg.codexAba]||'Monstros';let w=W(),tab=codexButton(w,t=>t.startsWith(norm(nomeAba)));if(!tab){st.textContent=`A aba ${nomeAba} não apareceu.`;log(st.textContent,'warn');return}if(tab.getAttribute('aria-selected')!=='true'){tab.click();await sleep(450);w=W()}const incompletos=codexButton(w,t=>t.startsWith('incompletos'));if(incompletos&&incompletos.getAttribute('aria-pressed')!=='true'){incompletos.click();await sleep(350);w=W()}const ordenar=[...w.querySelectorAll('select')].find(s=>[...s.options].some(o=>norm(o.textContent)==='perto do proximo marco'));if(ordenar){const opt=[...ordenar.options].find(o=>norm(o.textContent)==='perto do proximo marco');if(opt&&ordenar.value!==opt.value){ordenar.value=opt.value;ordenar.dispatchEvent(new Event('change',{bubbles:true}));await sleep(400);w=W()}}const itens=[...w.querySelectorAll('button')].filter(b=>{const t=norm(b.textContent);return visible(b)&&/\d+\s*\/\s*\d+/.test(t)&&!/^(todos|incompletos|completos|marcos)\b/.test(t)});const item=itens[0];if(!item){st.textContent=`Nenhum objetivo incompleto em ${nomeAba}.`;log(st.textContent);ultimoCodexAlvo='';return}if(item.getAttribute('aria-pressed')!=='true'){item.click();await sleep(350);w=W()}const alvo=(item.textContent||'').replace(/\s*\d+\s*\/\s*\d+.*$/,'').trim()||'objetivo';const acao=codexButton(w,t=>cfg.codexAba==='aprimoramento'?t==='abrir forja':t==='ir cacar');if(!acao){st.textContent=`${alvo}: ação indisponível agora.`;log(st.textContent,'warn');return}if(!manual&&ultimoCodexAlvo===`${cfg.codexAba}:${alvo}`){st.textContent=`${nomeAba}: continuando ${alvo}.`;return}ultimoCodexAlvo=`${cfg.codexAba}:${alvo}`;st.textContent=cfg.codexAba==='aprimoramento'?`${alvo}: abrindo a Forja (sem gastar sozinho).`:`${alvo}: procurando a caçada indicada pelo jogo.`;if(!clickSafe(acao,st.textContent))return;log(st.textContent);await sleep(600)}catch(e){st.textContent=`Erro no Codex: ${e.message}`;log(st.textContent,'error')}finally{soltar();if(aberto&&codexWin())await fechar(codexWin);codexBusy=false;lastCodex=Date.now()}}
  function codexTick(){if(!cfg.codex||codexBusy)return;const intervalo=Math.max(1,Number(cfg.codexMin)||5)*60000;if(!lastCodex||Date.now()-lastCodex>=intervalo)codexObjetivo()}
  async function bagTick(d){if(!cfg.bag||!d.bagPct||d.bagPct<cfg.bagLimit||!ready('bag',30000))return;log(`Mochila em ${Math.round(d.bagPct)}%.`,'warn');if(!/cidade|sem alvo/.test(norm(d.target))){await guardarParada('mochila');returnCity('mochila cheia');return}if(cfg.autoWarehouse){const b=document.querySelector('.slHudBag')||findButton(['mochila','inventário']);if(b)clickSafe(b,'Abrindo mochila/armazém')}if(cfg.autoSell)setTimeout(()=>{const b=findButton(['vender'],document.querySelector('.slInv,.slShop')||document);if(b)clickSafe(b,'Abrindo preparação de venda (confirmação manual)')},700)}
  function partyTick(d){if(!cfg.party)return;const low=d.partyRows.map(r=>({name:text('.slPdmName,.slPartyTop',r)||'membro',hp:ratio(text('.slPartyBar,.slBar-hp .slBarText',r))})).filter(x=>x.hp.max&&x.hp.pct<=cfg.partyAlert);$('[data-party-state]').textContent=low.length?`Atenção: ${low.map(x=>`${x.name} ${Math.round(x.hp.pct)}%`).join(', ')}`:`${d.partyRows.length||0} membro(s), sem alerta`;if(low.length&&ready('party',30000))log($('[data-party-state]').textContent,'warn')}
  const diaBrasilia=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const diariaFeita=()=>load(DAILY,'')===diaBrasilia();
  function marcarDiariaFeita(){save(DAILY,diaBrasilia());cooldown.set('routine',0);$('[data-routines-state]').textContent='Diária resgatada hoje.';log('Diária resgatada; verifico novamente depois da virada em Brasília.')}
  /**
   * O jogo diz quando ha' diaria por resgatar, e e' nele que se acredita.
   *
   * Medido no jogo em 19/10/2026: o botao do chat e' `button.slChatDaily`, e ele ganha a classe
   * `is-ready` enquanto houver recompensa de hoje; assim que ela e' resgatada, a classe cai.
   *
   * **Isto manda mais do que a marca guardada aqui.** A marca diz "ja' resgatei hoje" e serve para
   * nao reabrir a janela a toda a hora; mas se ela se enganar — relogio do computador mexido, conta
   * aberta noutra maquina, um dia que virou enquanto o jogo estava fechado — quem acredita so' nela
   * nunca mais resgata nada, e nao diz porque'. O jogo acender `is-ready` ganha sempre.
   */
  const diariaPronta=()=>{const b=document.querySelector('.slChatDaily');return !!b&&visible(b)&&b.classList.contains('is-ready')};
  const painelDiaria=()=>[...document.querySelectorAll('.slWin[data-win="daily"],.slPanel-daily')].find(visible)||null;
  /**
   * Abre a janela da diaria, carrega em Resgatar e confere que resgatou mesmo.
   *
   * Conferir importa: um clique que nao pega deixaria a extensao a dizer "resgatada hoje" e a nao
   * voltar la' ate' amanha, que e' o defeito mais caro possivel aqui — o dono so' descobre quando
   * a sequencia de dias se parte. Medido: depois do resgate o botao `.drwClaim` **desaparece** e o
   * `is-ready` do chat cai, e a janela passa a dizer "Recompensa de hoje resgatada".
   */
  async function resgatarDiaria(manual=false){
    if(!manual&&!cfg.daily)return false;
    if(diariaBusy)return false;
    if(!manual&&!diariaPronta()&&diariaFeita())return false;
    diariaBusy=true;const soltar=await pedirVez('diaria');if(!soltar){diariaBusy=false;return}
    const st=$('[data-routines-state]');
    try{
      let w=painelDiaria();
      if(!w){
        const abrir=[...document.querySelectorAll('.slChatDaily')].find(visible)||findButton(['recompensas diarias','diaria!']);
        if(!abrir){if(manual)st.textContent='Não achei por onde abrir a diária.';return false}
        if(!clickSafe(abrir,'Abrindo as Recompensas Diárias'))return false;
        for(let i=0;i<20&&!painelDiaria();i++)await sleep(250);
        w=painelDiaria();
      }
      if(!w){st.textContent='A janela da diária não abriu.';log(st.textContent,'warn');return false}
      const botao=w.querySelector('.drwClaim');
      if(!botao||!visible(botao)){
        // Sem botao: ou ja' estava resgatada, ou o jogo mudou a janela. O texto separa os dois.
        const feita=/resgatad|volte amanha/.test(norm(w.textContent));
        if(feita)marcarDiariaFeita();else log('Abri a diária e não achei o botão de resgatar.','warn');
        await fechar(painelDiaria);
        return feita}
      if(!clickSafe(botao,'Resgatando a recompensa diária'))return false;
      for(let i=0;i<16;i++){await sleep(250);const atual=painelDiaria();if(!atual)break;if(!atual.querySelector('.drwClaim')||!diariaPronta())break}
      const depois=painelDiaria();
      const resgatou=!diariaPronta()||(depois&&!depois.querySelector('.drwClaim'));
      if(resgatou)marcarDiariaFeita();
      else{st.textContent='Carreguei em Resgatar e o jogo não confirmou.';log(st.textContent,'warn')}
      await fechar(painelDiaria);
      return!!resgatou;
    }catch(e){log(`Erro na diária: ${e.message}`,'error');return false}
    finally{soltar();diariaBusy=false;}}
  const janelaDiaria=()=>[...document.querySelectorAll('[role="dialog"],.slModal,.slWin')].find(e=>visible(e)&&/recompensas diarias/.test(norm(e.textContent)));
  function conferirDiariaAberta(fechar=false){const w=janelaDiaria();if(!w)return false;const botoes=[...w.querySelectorAll('button')],resgatar=botoes.find(b=>visible(b)&&norm(b.textContent)==='resgatar'),confirmado=/resgatad|volte amanha|ja resgat/.test(norm(w.textContent));if(!confirmado)return false;marcarDiariaFeita();if(fechar){const x=botoes.find(b=>visible(b)&&(/fechar/.test(norm(`${b.textContent} ${b.ariaLabel||''} ${b.title||''}`))||norm(b.textContent)==='✕'));x?.click()}return !resgatar}
  const missionWin=()=>[...document.querySelectorAll('[role="dialog"],.slWin,.slModal')].find(e=>visible(e)&&norm(e.querySelector('h1,h2')?.textContent).startsWith('missoes'));
  async function missionsTick(force=false){if(!force&&(!cfg.routines||!cfg.missions))return;if(missionBusy)return;missionBusy=true;const soltar=await pedirVez('missoes');if(!soltar){missionBusy=false;return}const st=$('[data-missions-state]');let aberto=null,aceitas=0,resgatadas=0;try{aberto=await openWin(missionWin,'Missões');if(!aberto){st.textContent='Não consegui abrir Missões.';log(st.textContent,'warn');return}const W=()=>missionWin()||aberto.w,tabs=[...W().querySelectorAll('[role="tab"],.slTab')].filter(visible);for(const tab of tabs.length?tabs:[null]){if(tab&&tab.getAttribute('aria-selected')!=='true'&&!tab.classList.contains('slTabOn')){tab.click();await sleep(300)}for(let i=0;i<30;i++){const w=W(),b=[...w.querySelectorAll('button')].find(x=>{const t=norm(x.textContent);return visible(x)&&!x.disabled&&['resgatar','receber','coletar','reivindicar','aceitar','iniciar missao'].includes(t)&&!unsafe(x)});if(!b)break;const t=norm(b.textContent),resgate=['resgatar','receber','coletar','reivindicar'].includes(t);b.click();resgate?resgatadas++:aceitas++;await sleep(450);const confirmar=[...document.querySelectorAll('.slModalActions button,[role="dialog"] button')].find(x=>visible(x)&&!W().contains(x)&&/^(confirmar|aceitar|resgatar|coletar)$/.test(norm(x.textContent))&&!unsafe(x));if(confirmar){confirmar.click();await sleep(400)}}}st.textContent=`Missões: ${aceitas} aceita(s), ${resgatadas} recompensa(s).`;log(st.textContent)}catch(e){st.textContent=`Erro nas missões: ${e.message}`;log(st.textContent,'error')}finally{soltar();if(aberto)await fechar(missionWin);missionBusy=false;lastMission=Date.now()}}
  /**
   * As faixas de horario das missoes: uma verificacao por faixa, por dia.
   *
   * Sao varias faixas e nao uma so' porque foi isso que o dono pediu em 19/10/2026: uma de manha e
   * outra a' noite apanham as missoes que so' ficam prontas mais tarde, coisa que uma visita unica
   * nunca apanharia.
   *
   * Cada faixa sorteia a sua hora pelo mesmo `horaDoDia` dos desafios — a hora fica a mesma durante
   * o dia, muda de um dia para o outro, e mexer na faixa sorteia outra vez na hora.
   */
  // **Sem filtrar.** O painel e o botao de apagar contam pelo indice desta lista; filtrar aqui e' nao
  // la' faria apagar a faixa errada no dia em que uma linha ficasse com o horario em branco. Linha
  // incompleta e' ignorada na hora de decidir, logo abaixo.
  /**
   * Quem tem faixas de horario. Em 20/10/2026 juntaram-se os talentos: a verificacao deles batia a
   * cada 20 segundos porque o saldo de pontos que a build nao cobre fica sempre la', e o dono pediu
   * o mesmo que ja' existia para as missoes. A alternativa era copiar vinte linhas e ficar com duas
   * copias para corrigir — uma delas sempre esquecida.
   */
  const FAIXAS={
    missoes:{campo:'missoesFaixas',sort:MISS_SORT,feitas:MISS_FEITAS},
    talentos:{campo:'talentosFaixas',sort:TAL_SORT,feitas:TAL_FEITAS},
  };
  const faixasDe=k=>(Array.isArray(cfg[FAIXAS[k].campo])?cfg[FAIXAS[k].campo]:[]);
  const faixasDasMissoes=()=>faixasDe('missoes');
  // A chave do sorteio leva o dono: duas faixas iguais nas missoes e nos talentos sorteariam a mesma
  // hora, e — pior — partilhariam a marca de "feita", logo correr uma calava a outra.
  const horaDaFaixa=(k,f,i)=>horaDoDia(`${FAIXAS[k].sort}:${i}`,f.de,f.ate);
  const chaveDaFaixa=(f,hora)=>`${f.de}-${f.ate||f.de}-${hora}`;
  const faixasFeitasHoje=k=>{const r=load(FAIXAS[k].feitas,null);return r&&r.dia===diaBrasilia()&&Array.isArray(r.feitas)?r.feitas:[]};
  function marcarFaixaFeita(k,chave){const feitas=[...faixasFeitasHoje(k),chave];save(FAIXAS[k].feitas,{dia:diaBrasilia(),feitas})}
  /** A primeira faixa cuja hora ja' passou e que ainda nao correu hoje. */
  function faixaDeAgora(k){
    const feitas=faixasFeitasHoje(k);
    const lista=faixasDe(k);
    for(let i=0;i<lista.length;i++){
      const f=lista[i];if(!f)continue;const hora=horaDaFaixa(k,f,i);
      if(!hora||!horaPassou(hora))continue;
      const chave=chaveDaFaixa(f,hora);
      if(feitas.includes(chave))continue;
      return{f,hora,chave,i};
    }
    return null}
  /**
   * Sem faixa nenhuma, nada muda: continua a conferir de cinco em cinco minutos, como sempre fez.
   *
   * Com faixas, a hora sorteada manda, e **a faixa e' marcada antes de a verificacao comecar**. Se
   * a janela das missoes nao abrir, perde-se aquela faixa e espera-se a seguinte, em vez de tentar
   * outra vez a cada volta do laco ate' ao fim do dia — que e' martelar o jogo por causa de um
   * defeito que nao vai passar sozinho. E' tambem por isso que ter duas faixas vale a pena.
   */
  function missionsAutoTick(){if(!cfg.routines||!cfg.missions||missionBusy)return;
    const lista=faixasDe('missoes');
    if(!lista.length){if(!lastMission||Date.now()-lastMission>=300000)missionsTick();return}
    const agora=faixaDeAgora('missoes');
    if(!agora||!ready('missoes-faixa',60000))return;
    marcarFaixaFeita('missoes',agora.chave);
    log(`Missões: é a hora sorteada da faixa ${agora.i+1} (${agora.f.de}–${agora.f.ate||agora.f.de}, hoje às ${agora.hora}).`);
    missionsTick()}
  /**
   * A diaria nao passa pelo interruptor "Rotinas".
   *
   * Ela nao e' uma acao de risco: nao gasta, nao vende, nao viaja e nao mexe no personagem — recebe
   * o que o jogo esta' a oferecer de graca. Esconde-la atras do interruptor das automacoes de risco
   * fazia com que, com tudo no padrao, a recompensa simplesmente nunca fosse resgatada — que foi o
   * que o dono encontrou em 19/10/2026, com `routines:false` na conta dele.
   */
  function diariaTick(){if(!cfg.daily||diariaBusy)return;if(!diariaPronta())return;if(!ready('diaria',120000))return;void resgatarDiaria()}
  function routinesTick(force=false){if(!force&&!cfg.routines)return;if(cfg.daily)conferirDiariaAberta(true);const found=[];if(cfg.daily&&!diariaFeita()){const b=findButton(['diária!','diaria!','recompensa diária']);if(b)found.push({b,n:'diária'})}if(cfg.events){const b=findButton(['evento !','eventos !','evento disponível']);if(b)found.push({b,n:'evento'})}if(cfg.war){const b=findButton(['guerra de time !','guerra !','team war !']);if(b)found.push({b,n:'guerra'})}$('[data-routines-state]').textContent=diariaFeita()&&!found.length?'Diária resgatada hoje.':found.length?`Disponível: ${found.map(x=>x.n).join(', ')}`:'Nada disponível agora.';if(found.length&&ready('routine',60000)&&clickSafe(found[0].b,`Abrindo ${found[0].n} disponível`)&&found[0].n==='diária')setTimeout(()=>conferirDiariaAberta(true),1200)}
  const desafioWin=titulo=>[...document.querySelectorAll('[role="dialog"],.slWin,.slModal')].find(e=>visible(e)&&norm(e.querySelector('h1,h2')?.textContent)===norm(titulo));
  const bossWin=()=>desafioWin('Chefes Diários'),towerWin=()=>desafioWin('Torre Infinita');
  const horaPassou=h=>{const[a,b]=String(h||'00:00').split(':').map(Number),n=new Date();return n.getHours()*60+n.getMinutes()>=a*60+b};
  const minutosDe=h=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(h||'').trim());return m?Number(m[1])*60+Number(m[2]):null};
  const horaDe=min=>`${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
  /**
   * O horario de hoje, sorteado uma vez dentro da faixa que o dono escreveu.
   *
   * **Sorteado uma vez, e guardado.** Sortear a cada volta do laco sairia sempre no primeiro minuto
   * possivel: basta um sorteio baixo numa das voltas para a hora ja' ter passado, e com uma volta
   * por segundo isso acontece quase imediatamente — a faixa viraria enfeite e tudo cairia no inicio
   * dela.
   *
   * O registo leva a faixa junto: mexer nas caixas sorteia outra vez na hora, em vez de deixar o
   * dono a olhar para uma faixa nova que so' valeria amanha.
   *
   * Fim vazio, igual ou anterior ao inicio nao e' faixa: vale o inicio, que e' como isto funcionava
   * antes de haver duas caixas.
   */
  function horaDoDia(chave,inicio,fim){const a=minutosDe(inicio);if(a===null)return null;const b=minutosDe(fim);const dia=diaBrasilia();const g=load(chave,null);
    if(g&&g.dia===dia&&g.inicio===inicio&&g.fim===fim&&minutosDe(g.hora)!==null)return g.hora;
    const hora=horaDe(b===null||b<=a?a:a+Math.floor(Math.random()*(b-a+1)));
    save(chave,{dia,hora,inicio,fim});return hora}
  const horaDoChefe=()=>horaDoDia(BOSS_SORT,cfg.bossHora,cfg.bossHoraFim);
  const horaDaTorre=()=>horaDoDia(TOWER_SORT,cfg.towerHora,cfg.towerHoraFim);
  /**
   * O que o **jogo** diz sobre o chefe de hoje: `'feito'`, `'bloqueado'` ou `null` (da' para entrar).
   *
   * A marca local (`BOSS_DAY`) nao basta: ela nao sabe do chefe que o dono enfrentou a' mao, nem do
   * que outra janela ja' fez, nem sobrevive a limpar os dados do navegador. Sem perguntar ao jogo, a
   * extensao reabria a janela a cada minuto ate' a' meia-noite e nunca conseguia entrar.
   *
   * Nao haver botao `Enfrentar` com a aba do rank aberta e' a prova mais firme de que a tentativa de
   * hoje foi gasta — nao depende de adivinhar como o jogo escreve "concluido".
   */
  const estadoDoChefe=(rotulo,temEnfrentar)=>/concluido|concluida|completo|completa|feito|feita|enfrentado|derrotado/.test(rotulo)?'feito':/bloqueado|indisponivel/.test(rotulo)?'bloqueado':temEnfrentar?null:'feito';
  /**
   * A caçada em que o personagem estava, para poder voltar a ela depois do desafio.
   *
   * Um desafio obriga a sair da caçada, e sair era so' metade do trabalho: o personagem ficava
   * parado na cidade a ganhar nada ate' a escada reparar nisso — e com a escada desligada, ou com a
   * caçada escolhida a' mao, ficava ali para sempre. A lista e' a unica fonte que diz **qual** era:
   * o HUD nao traz o nome da caçada.
   */
  let cacaAnterior=null;
  async function cacaViva(){let aberto=null;
    try{aberto=await openWin(huntWin,'Caçadas');if(!aberto)return null;
      const W=()=>huntWin()||aberto.w;await huntPagina1(W);
      for(let pg=0;pg<60;pg++){const x=[...W().querySelectorAll('.slHuntCard')].map(lerCard).find(c=>c.estado==='live');
        if(x)return{nome:x.nome,area:x.area,dif:x.dif};
        if(!await huntProxima(W))break}
      return null}
    catch(e){log(`Não consegui ver em que caçada estava: ${e.message}`,'warn');return null}
    finally{if(aberto)await fechar(huntWin)}}
  /** Procura, pagina a pagina, o cartao daquela caçada exacta. */
  async function cardDaCaca(W,alvo){await huntPagina1(W);
    for(let pg=0;pg<60;pg++){const c=[...W().querySelectorAll('.slHuntCard')].find(e=>{const x=lerCard(e);return x.nome===alvo.nome&&x.area===alvo.area&&x.dif===alvo.dif});
      if(c)return c;if(!await huntProxima(W))break}
    return null}
  /** Volta a' caçada guardada. Nao faz nada se nao havia nenhuma, ou se ja' esta' numa. */
  async function retomarCaca(){const alvo=cacaAnterior;cacaAnterior=null;
    if(!alvo||naCacada())return;
    let aberto=null;
    try{aberto=await openWin(huntWin,'Caçadas');if(!aberto){log(`Não consegui abrir as caçadas para voltar a ${alvo.nome}.`,'warn');return}
      const W=()=>huntWin()||aberto.w,tab=W().querySelector('.slTab[data-tab="hunts"]');
      if(tab&&!tab.classList.contains('slTabOn')){tab.click();await sleep(400)}
      const todas=[...W().querySelectorAll('.slHuntFilters .slChip')].find(c=>norm(c.textContent).startsWith('todas'));
      if(todas&&!todas.classList.contains('slChipOn')){todas.click();await sleep(400)}
      const card=await cardDaCaca(W,alvo);
      const b=card&&[...card.querySelectorAll('button')].find(e=>norm(e.textContent)==='iniciar'&&!e.disabled);
      if(!b){log(`Não achei o Iniciar de ${alvo.nome} para voltar; ficou na cidade.`,'warn');return}
      b.click();await sleep(700);
      const c=[...document.querySelectorAll('button')].find(e=>visible(e)&&!panel.contains(e)&&/cacar mesmo assim|sair e iniciar|trocar de cacada|confirmar/.test(norm(e.textContent)));
      if(c&&!unsafe(c)){c.click();await sleep(600)}
      log(`Voltei à caçada ${alvo.nome}${alvo.area?` (área Nv ${alvo.area})`:''}.`)}
    catch(e){log(`Erro ao voltar à caçada: ${e.message}`,'error')}
    finally{if(aberto)await fechar(huntWin)}}
  /**
   * A caçada deixada para tras pela mochila cheia ou pelo limite de fadiga, e o motivo.
   *
   * Estas duas nao sao idas e voltas como a loja: elas saem da caçada e **ficam** — a mochila ate'
   * ser esvaziada a' mao, a fadiga ate' o descanso, que no jogo so' corre offline. Nao ha' fim de
   * rotina onde voltar, por isso a volta vive num tick proprio e espera pela condicao que a tirou
   * de la': a mochila abaixo do limite, ou a fadiga abaixo do limite com a pausa ja' levantada.
   * Voltar antes disso seria desfazer o que a pausa foi fazer.
   *
   * A memoria e' da sessao: recarregar a pagina perde-a, e e' o preco de nao gravar no disco uma
   * coisa que fica velha depressa.
   */
  let cacaParada=null,paradaBusy=false;
  const PARADA_PRONTA={
    mochila:d=>!d.bagPct||d.bagPct<cfg.bagLimit,
    fadiga:d=>!cfg.pausado&&(!d.fatigue||d.fatigue<cfg.fatigueLimit),
  };
  async function guardarParada(motivo){if(!naCacada())return;const c=await cacaViva();if(c)cacaParada={caca:c,motivo}}
  async function paradaTick(d){
    if(!cacaParada||paradaBusy)return;
    if(naCacada()){cacaParada=null;return}
    if(!PARADA_PRONTA[cacaParada.motivo]?.(d)||!ready('parada',15000))return;
    paradaBusy=true;
    const soltar=await pedirVez('voltar');if(!soltar){paradaBusy=false;return}
    try{cacaAnterior=cacaParada.caca;cacaParada=null;await retomarCaca()}
    finally{soltar();paradaBusy=false}}
  async function prepararDesafio(nome){if(!naCacada())return true;cacaAnterior=await cacaViva();if(!returnCity(nome))return false;for(let i=0;i<40&&naCacada();i++)await sleep(500);if(naCacada())return false;await sleep(2000);return true}
  async function chefeDiario(force=false){if(barrado('entrada automática no chefe diário'))return;if(!force&&!cfg.bossAuto)return;if(challengeBusy)return;if(!force&&load(BOSS_DAY,'')===diaBrasilia())return;challengeBusy=true;const soltar=await pedirVez('chefe');if(!soltar){challengeBusy=false;return}const st=$('[data-boss-state]');let aberto=null,entrou=false;
    /**
     * A ida de hoje fica marcada **antes** de sair da caçada, e nao no fim.
     *
     * Era este o defeito: so' se marcava o dia ao entrar no chefe, e todo o caminho que falhava —
     * rank que nao apareceu, janela que nao abriu, rank bloqueado — deixava o dia em branco. O tick
     * voltava a chamar um minuto depois, e o `prepararDesafio` sai da caçada **antes** de olhar para
     * nada: o personagem passava o dia a ser levado para a cidade e trazido de volta, de minuto a
     * minuto, sem nunca jogar. Uma tentativa por dia e' o que foi pedido, e falhar gasta a do dia:
     * o botao `Verificar chefe agora` repete-a a' mao quando se quiser.
     */
    if(!force)save(BOSS_DAY,diaBrasilia());
    try{if(!await prepararDesafio('chefe diário')){st.textContent='Não consegui voltar à cidade; o chefe fica para amanhã.';log(st.textContent,'warn');return}aberto=await openWin(bossWin,'Chefes Diários');if(!aberto){st.textContent='Não consegui abrir Chefes Diários; o chefe fica para amanhã.';log(st.textContent,'warn');return}const W=()=>bossWin()||aberto.w,rank=String(cfg.bossRank||'E').toUpperCase();let tab=[...W().querySelectorAll('[role="tab"]')].find(t=>norm(t.textContent).startsWith(rank.toLowerCase()+' '));if(!tab){st.textContent=`Rank ${rank} não apareceu; o chefe fica para amanhã.`;log(st.textContent,'warn');return}
    if(estadoDoChefe(norm(tab.textContent),true)==='feito'){save(BOSS_DAY,diaBrasilia());st.textContent=`Chefe Rank ${rank} já estava feito hoje; fechei a janela.`;log(st.textContent);return}
    if(estadoDoChefe(norm(tab.textContent),true)==='bloqueado'){st.textContent=`Chefe Rank ${rank}: ${tab.textContent.replace(/\s+/g,' ').trim()}.`;return}
    if(tab.getAttribute('aria-selected')!=='true'){tab.click();await sleep(350)}
    const b=[...W().querySelectorAll('button')].find(x=>visible(x)&&norm(x.textContent)==='enfrentar'&&!x.disabled);
    if(estadoDoChefe(norm(tab.textContent),!!b)==='feito'){save(BOSS_DAY,diaBrasilia());st.textContent=`Chefe Rank ${rank} sem tentativa hoje: dei por feito e fechei a janela.`;log(st.textContent);return}
    if(!b){st.textContent=`Chefe Rank ${rank} sem tentativa disponível; fica para amanhã.`;log(st.textContent,'warn');return}b.click();await sleep(500);const c=[...document.querySelectorAll('[role="dialog"] button,.slModalActions button')].find(x=>visible(x)&&/^(enfrentar|confirmar|entrar)$/.test(norm(x.textContent))&&!unsafe(x));c?.click();entrou=true;save(BOSS_DAY,diaBrasilia());st.textContent=`Entrou no chefe diário Rank ${rank}.`;log(st.textContent)}catch(e){st.textContent=`Erro no chefe: ${e.message}`;log(st.textContent,'error')}finally{if(aberto)await fechar(bossWin);if(!entrou)await retomarCaca();cacaAnterior=null;soltar();challengeBusy=false}}
  async function torre(force=false){
    if(barrado('entrada automática na Torre'))return;
    if(!force&&!cfg.towerAuto)return;
    if(challengeBusy)return;
    if(!force&&load(TOWER_DAY,'')===diaBrasilia())return;
    challengeBusy=true;
    const soltar=await pedirVez('torre');if(!soltar){challengeBusy=false;return}
    const st=$('[data-tower-state]');
    let aberto=null,entrou=false;
    // A mesma regra do chefe, e pelo mesmo motivo: o `prepararDesafio` sai da caçada antes de olhar
    // para nada, e o dia so' era marcado ao entrar. Cada falha — janela que nao abre, poder a menos,
    // nenhum andar disponivel — devolvia o laco de sair e voltar de minuto a minuto. A troca e' que
    // falhar gasta a ida do dia, inclusive quando o poder ainda nao chega; o botao `Verificar Torre
    // agora` repete-a a' mao.
    if(!force)save(TOWER_DAY,diaBrasilia());
    try{
      if(!await prepararDesafio('Torre Infinita')){st.textContent='Não consegui voltar à cidade; a Torre fica para amanhã.';log(st.textContent,'warn');return}
      aberto=await openWin(towerWin,'Torre Infinita');
      if(!aberto){st.textContent='Não consegui abrir a Torre; fica para amanhã.';log(st.textContent,'warn');return}
      const W=()=>towerWin()||aberto.w,w=W(),txt=norm(w.textContent);
      const poder=num((txt.match(/seu poder\s*([\d.]+)/)||[])[1]);
      const rec=num((txt.match(/poder recomendado\s*([\d.]+)/)||[])[1]);
      const necessario=Math.ceil(rec*(1+Number(cfg.towerMargem||0)/100));
      if(rec&&poder<necessario){st.textContent=`Torre fica para amanhã: poder ${poder.toLocaleString('pt-BR')}, precisa ${necessario.toLocaleString('pt-BR')}.`;log(st.textContent,'warn');return}
      const boxes=[...w.querySelectorAll('input[type="checkbox"]')];
      const label=x=>norm(x.closest('label')?.textContent||x.parentElement?.textContent||x.ariaLabel);
      const auto=boxes.find(x=>/avancar automaticamente/.test(label(x)));
      const boss=boxes.find(x=>/pausar antes de chefes/.test(label(x)));
      if(auto&&!auto.checked)auto.click();
      if(boss&&boss.checked!==!!cfg.towerBossPause)boss.click();
      const sel=[...w.querySelectorAll('select')].find(x=>/condicao de parada/.test(norm(x.ariaLabel||x.closest('label')?.textContent||x.parentElement?.textContent)));
      if(sel){
        const deseja=cfg.towerStop==='derrota'?'ate ser derrotado':`apos conquistar ${cfg.towerStop} andares`;
        const opt=[...sel.options].find(o=>norm(o.textContent)===norm(deseja));
        if(opt&&sel.value!==opt.value){sel.value=opt.value;sel.dispatchEvent(new Event('change',{bubbles:true}));await sleep(200)}
      }
      const entrar=[...W().querySelectorAll('button')].find(x=>visible(x)&&/^entrar no andar/.test(norm(x.textContent))&&!x.disabled);
      if(!entrar){st.textContent='Nenhum andar disponível; a Torre fica para amanhã.';log(st.textContent,'warn');return}
      entrar.click();
      await sleep(500);
      const c=[...document.querySelectorAll('[role="dialog"] button,.slModalActions button')].find(x=>visible(x)&&/^(entrar|confirmar)$/.test(norm(x.textContent))&&!unsafe(x));
      c?.click();
      entrou=true;
      save(TOWER_DAY,diaBrasilia());
      st.textContent=`Torre iniciada com margem de ${cfg.towerMargem}%.`;
      log(st.textContent);
    }catch(e){st.textContent=`Erro na Torre: ${e.message}`;log(st.textContent,'error')}
    finally{if(aberto&&!entrou)await fechar(towerWin);if(!entrou)await retomarCaca();cacaAnterior=null;soltar();challengeBusy=false}
  }
  function desafiosTick(){if(MODO_SEGURO)return;if(challengeBusy)return;if(cfg.bossAuto&&horaPassou(horaDoChefe())&&load(BOSS_DAY,'')!==diaBrasilia()&&ready('boss-auto',60000))chefeDiario();else if(cfg.towerAuto&&horaPassou(horaDaTorre())&&load(TOWER_DAY,'')!==diaBrasilia()&&ready('tower-auto',60000))torre()}
  const forgeWin=()=>desafioWin('Forja'),shadowWin=()=>desafioWin('Exército das Sombras');
  function custoForja(w){const nomes=[...w.querySelectorAll('.slForgeCostName')],custos=[...w.querySelectorAll('.slForgeCostNum')],tem=[...w.querySelectorAll('.slForgeCostHave')],r={};nomes.forEach((n,i)=>r[norm(n.textContent)]={custo:num(custos[i]?.textContent),tem:num(tem[i]?.textContent)});return r}
  async function forja(manual=false){if(!manual&&!cfg.forgeAuto)return;if(forgeBusy)return;forgeBusy=true;const soltar=await pedirVez('forja');if(!soltar){forgeBusy=false;return}const st=$('[data-forge-state]');let aberto=null,feitos=0;try{aberto=await openWin(forgeWin,'Forja');if(!aberto){st.textContent='Não consegui abrir a Forja.';return}const W=()=>forgeWin()||aberto.w,w=W(),enc=[...w.querySelectorAll('[role="tab"]')].find(t=>norm(t.textContent)==='encantamento');if(enc&&enc.getAttribute('aria-selected')!=='true'){enc.click();await sleep(350)}const filtro=[...W().querySelectorAll('select')].find(s=>[...s.options].some(o=>norm(o.textContent)==='so vestidas'));if(filtro){const opt=[...filtro.options].find(o=>norm(o.textContent)==='so vestidas');filtro.value=opt.value;filtro.dispatchEvent(new Event('change',{bubbles:true}));await sleep(350)}const pecas=[...W().querySelectorAll('.slForgeTile')].filter(b=>b.querySelector('.slSlotMarkEq'));for(const p of pecas){p.click();await sleep(250);for(let tentativa=0;tentativa<25;tentativa++){const ww=W(),go=ww.querySelector('.slForgeGo'),alvo=num((go?.textContent.match(/\+(\d+)/)||[])[1]);if(!go||go.disabled||!alvo||alvo>Number(cfg.forgeNivel))break;const c=custoForja(ww),pedra=c['pedra de encanto'],ouro=c.ouro;if(!pedra||!ouro||pedra.tem-pedra.custo<Number(cfg.forgeStoneReserve)||ouro.tem-ouro.custo<Number(cfg.forgeGoldReserve))break;go.click();feitos++;await sleep(500)}}st.textContent=`Forja: ${feitos} encantamento(s) em peças vestidas.`;log(st.textContent)}catch(e){st.textContent=`Erro na Forja: ${e.message}`;log(st.textContent,'error')}finally{soltar();if(aberto)await fechar(forgeWin);forgeBusy=false;lastForge=Date.now()}}
  function forgeTick(){if(!cfg.forgeAuto||forgeBusy)return;if(!lastForge||Date.now()-lastForge>=Math.max(10,Number(cfg.forgeMin)||1440)*60000)forja()}
  async function sombras(manual=false){if(!manual&&!cfg.shadowBest&&!cfg.shadowEquip)return;if(shadowBusy)return;shadowBusy=true;const soltar=await pedirVez('sombras');if(!soltar){shadowBusy=false;return}const st=$('[data-shadow-state]');let aberto=null,acoes=0;try{aberto=await openWin(shadowWin,'Exército');if(!aberto){st.textContent='Não consegui abrir o Exército.';return}const W=()=>shadowWin()||aberto.w;if(cfg.shadowBest||manual){const b=[...W().querySelectorAll('button')].find(x=>visible(x)&&norm(x.textContent)==='montar melhor time');if(b){b.click();acoes++;await sleep(500);const c=[...document.querySelectorAll('.slModalActions button,[role="dialog"] button')].find(x=>visible(x)&&!W().contains(x)&&/^(confirmar|montar)$/.test(norm(x.textContent))&&!unsafe(x));if(c){c.click();await sleep(400)}}}if(cfg.shadowEquip||manual){const vagas=[...W().querySelectorAll('button')].filter(x=>/^vaga \d+/.test(norm(x.textContent))&&!/vaga livre/.test(norm(x.textContent)));for(const vaga of vagas){vaga.click();await sleep(250);const b=[...W().querySelectorAll('button')].find(x=>visible(x)&&norm(x.textContent)==='equipar melhores'&&!x.disabled);if(b){b.click();acoes++;await sleep(350);const c=[...document.querySelectorAll('.slModalActions button,[role="dialog"] button')].find(x=>visible(x)&&!W().contains(x)&&/^(confirmar|equipar)$/.test(norm(x.textContent))&&!unsafe(x));if(c){c.click();await sleep(300)}}}}st.textContent=`Sombras organizadas: ${acoes} ação(ões).`;log(st.textContent)}catch(e){st.textContent=`Erro nas sombras: ${e.message}`;log(st.textContent,'error')}finally{soltar();if(aberto)await fechar(shadowWin);shadowBusy=false;lastShadow=Date.now()}}
  function shadowTick(){if((!cfg.shadowBest&&!cfg.shadowEquip)||shadowBusy)return;if(!lastShadow||Date.now()-lastShadow>=Math.max(10,Number(cfg.shadowMin)||60)*60000)sombras()}
  async function fatigueTick(d){$('[data-fatigue-state]').textContent=d.fatigue?`${d.fatigue}%${d.fatigue>=cfg.fatigueLimit?' · limite atingido':''}`:d.fatigueText;if(!cfg.fatigue||!d.fatigue||d.fatigue<cfg.fatigueLimit||!ready('fatigue',30000))return;cfg.pausado=true;save(KEY,cfg);log(`Fadiga em ${d.fatigue}%. Automações pausadas.`,'warn');if(cfg.returnFatigue){await guardarParada('fadiga');returnCity('limite de fadiga')}applyUI()}
  // Pontos de status: a janela "Status" (data-win="character") deixa os +1/+5 pendentes até o "Confirmar (N)", e lista as 3 builds da classe com o botão "Distribuir pela build".
  const classeAtual=()=>norm(text('.slHudCardClass').split('·')[0]);
  const buildsDaClasse=()=>cfg.builds[classeAtual()]||cfg.builds[cfg.classeBuild]||[];
  function drawBuild(){const list=buildsDaClasse(),pick=$('[data-build-pick]');pick.innerHTML=`<option value="">— escolha —</option>`+list.map(b=>`<option>${b.nome}</option>`).join('');const b=list.find(x=>x.nome===cfg.buildJogo);$('[data-build-desc]').textContent=list.length?b?`${b.desc} ${b.pesos}`:'Escolha uma das builds da classe.':'Clique em "Ler builds da classe" para carregar as 3 builds do jogo.';$('[data-build-jogo]').hidden=cfg.buildModo!=='jogo';$('[data-build-propria]').hidden=cfg.buildModo!=='propria';panel.querySelectorAll('[data-peso]').forEach(e=>e.value=String(cfg.pesos[e.dataset.peso]||0));const soma=STATS.reduce((t,k)=>t+(Number(cfg.pesos[k])||0),0);$('[data-peso-soma]').textContent=soma?`Soma dos pesos: ${soma}${soma!==100?' (a proporção é o que vale)':''}`:'Dê peso a pelo menos um atributo.'}
  const charWin=()=>[...document.querySelectorAll('.slWin[data-win="character"]')].find(visible);
  async function openWin(find,label){let w=find();if(w)return{w,opened:false};const item=()=>[...document.querySelectorAll('.slHudDrawerItem,.slGmItem')].find(e=>visible(e)&&(e.getAttribute('aria-label')===label||norm(text('.slHudDrawerName',e))===norm(label)));let b=item();if(!b){const m=[...document.querySelectorAll('.slHudQbMenu')].find(visible);if(m){m.click();await sleep(400);b=item()}}if(!b)return null;b.click();for(let i=0;i<15&&!(w=find());i++)await sleep(200);return w?{w,opened:true}:null}
  // Depois de mexer nos pontos a janela sempre fecha, mesmo que já estivesse aberta: o jogo continua por baixo e a janela só atrapalha.
  async function fechar(find){for(let i=0;i<5;i++){const w=find();if(!w)return;w.querySelector('.slWinClose')?.click();await sleep(250)}}
  const openChar=()=>openWin(charWin,'Status');
  function readChar(w){const stats={};w.querySelectorAll('.slCharStat').forEach(r=>{const k=text('.slCharAbbr',r).toUpperCase();if(STATS.includes(k))stats[k]={row:r,inv:num((text('.slCharStatBreak',r).match(/pontos\s*([\d.]+)/i)||[])[1])}});const builds=[...w.querySelectorAll('.slCharBuild')].map(a=>({nome:text('.slCharBuildName',a),desc:text('.slCharBuildDesc',a),pesos:[...a.querySelectorAll('.slCharBuildW')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join(' · ')})).filter(b=>b.nome);return{free:num(text('.slCharMarcoFree dd b',w)),classe:norm(text('.slCharHeroCls',w).split('·')[0]),stats,builds}}
  function plan(c){const W=STATS.reduce((t,k)=>t+(Number(cfg.pesos[k])||0),0);if(!W)return null;const T=Object.values(c.stats).reduce((t,s)=>t+s.inv,0)+c.free,alloc={};for(let i=0;i<c.free;i++){let best=null,gap=-Infinity;for(const k of STATS){const p=Number(cfg.pesos[k])||0;if(!p||!c.stats[k])continue;const g=p/W*T-(c.stats[k].inv+(alloc[k]||0));if(g>gap){gap=g;best=k}}if(!best)break;alloc[best]=(alloc[best]||0)+1}return alloc}
  async function confirmDraft(W,esperado){await sleep(400);const w=W(),ok=w.querySelector('.slCharDraftOk');if(ok&&visible(ok)){const n=num(ok.textContent);if(esperado&&n!==esperado){w.querySelector('.slCharDraftActs .slBtn-ghost')?.click();log(`Prévia com ${n} pontos em vez de ${esperado}; cancelada.`,'warn');return false}ok.click();await sleep(500)}const m=[...document.querySelectorAll('.slModalActions button')].find(e=>visible(e)&&/confirmar|distribuir/.test(norm(e.textContent)));if(m&&!unsafe(m)){m.click();await sleep(400)}return true}
  async function distribute(manual=false,soLer=false){if(statusBusy)return;statusBusy=true;const soltar=soLer?()=>{}:await pedirVez('status');if(!soltar){statusBusy=false;return}const st=$('[data-status-state]');let aberto=null;try{aberto=await openChar();if(!aberto){st.textContent='Não consegui abrir a janela de Status.';log(st.textContent,'warn');return}const W=()=>charWin()||aberto.w,tab=W().querySelector('.slTab[data-tab="status"]');if(tab&&!tab.classList.contains('slTabOn')){tab.click();await sleep(300)}let c=readChar(W());if(c.classe&&c.builds.length){cfg.builds={...cfg.builds,[c.classe]:c.builds};cfg.classeBuild=c.classe;save(KEY,cfg);applyUI()}if(soLer){st.textContent=`${c.builds.length} builds lidas.`;return}if(!c.free){st.textContent='Sem pontos livres.';return}const antes=c.free;if(cfg.buildModo==='jogo'){const art=[...W().querySelectorAll('.slCharBuild')].find(a=>text('.slCharBuildName',a)===cfg.buildJogo),b=art?.querySelector('.slCharBuildBtn');if(!b){st.textContent=cfg.buildJogo?`Build "${cfg.buildJogo}" não existe nesta classe.`:'Escolha uma build na aba Build.';log(st.textContent,'warn');return}if(b.disabled){st.textContent=`O jogo não liberou a build agora${b.title?`: ${b.title}`:''}.`;return}b.click();await confirmDraft(W,0)}else{const alloc=plan(c);if(!alloc){st.textContent='Dê peso a pelo menos um atributo.';log(st.textContent,'warn');return}for(const[k,qt]of Object.entries(alloc)){let n=qt;while(n>0){const r=readChar(W()).stats[k]?.row,passo=n>=5?'+5':'+1',b=r&&[...r.querySelectorAll('button')].find(x=>x.textContent.trim()===passo&&!x.disabled);if(!b){log(`Botão ${passo} de ${k} não encontrado.`,'warn');break}b.click();n-=passo==='+5'?5:1;await sleep(150)}}if(!await confirmDraft(W,antes))return}await sleep(300);c=readChar(W());const usados=antes-c.free;st.textContent=usados>0?`${usados} ponto(s) distribuído(s)${cfg.buildModo==='jogo'?` pela build ${cfg.buildJogo}`:''}.`:'Os pontos não saíram; confira a janela de Status.';log(st.textContent,usados>0?'info':'warn')}catch(e){log(`Erro nos pontos: ${e.message}`,'error')}finally{soltar();if(aberto)await fechar(charWin);statusBusy=false}}
  function statusTick(d){if(!cfg.autoStatus||statusBusy)return;const w=charWin(),livres=w?num(text('.slCharMarcoFree dd b',w)):0,badge=[...document.querySelectorAll('.slHudDrawerItem')].find(e=>norm(text('.slHudDrawerName',e))==='status')?.querySelector('.slHudMenuBadge:not([hidden])'),due=livres>0||num(badge?.textContent)>0||(d.level&&d.level>lastStatusLevel)||Date.now()-lastStatusCheck>600000;if(!due||!ready('status',15000))return;lastStatusLevel=d.level||lastStatusLevel;lastStatusCheck=Date.now();distribute()}
  // Talentos: janela data-win="talents"; cada talento é um g.slTalNode do SVG com data-senda, data-estado e "n/max" em .slTalLevel. O jogo ensina que dois cliques no talento aprendem 1 nível.
  const talWin=()=>[...document.querySelectorAll('.slWin[data-win="talents"]')].find(visible);
  const mouse=(e,tipos)=>tipos.forEach(t=>e.dispatchEvent(new (t.startsWith('pointer')?PointerEvent:MouseEvent)(t,{bubbles:true,cancelable:true,view:window,detail:t==='dblclick'?2:1})));
  const talId=n=>`${n.dataset.senda}:${(n.querySelector('.slTalSprite')?.getAttribute('href')||'').split('/').pop().replace(/\.\w+$/,'')}`;
  const talNivel=n=>{const m=text('.slTalLevel',n).match(/(\d+)\s*\/\s*(\d+)/);return m?{lv:+m[1],max:+m[2]}:{lv:n.dataset.estado==='complete'?1:0,max:1}};
  const talArvore=()=>cfg.talArvore[classeAtual()]||cfg.talArvore[cfg.classeBuild]||[];
  const talBuild=()=>cfg.talBuilds[classeAtual()]||[];
  const setTalBuild=b=>{cfg.talBuilds={...cfg.talBuilds,[classeAtual()]:b};persist()};
  function drawTal(){const a=talArvore(),opts=sel=>a.map(n=>`<option value="${n.id}"${n.id===sel?' selected':''}>${n.nome} (máx ${n.max})</option>`).join('');$('[data-tal-list]').innerHTML=talBuild().map((it,i)=>`<div class="tal-row" data-tal-i="${i}"><select data-tal-id>${a.some(n=>n.id===it.id)?'':`<option value="${it.id}" selected>${it.id}</option>`}${opts(it.id)}</select><input type="number" min="1" max="99" data-tal-alvo value="${it.alvo}" title="Subir até este nível"><button data-tal-up title="Subir na ordem">↑</button><button data-tal-del title="Tirar da lista">✕</button></div>`).join('')||`<p class="hint">${a.length?'Adicione talentos com "+ talento".':'Clique em "Ler árvore de talentos" para carregar os talentos da classe.'}</p>`}
  const chavesTalTabs=w=>[...w.querySelectorAll('.slTalTab')].map(t=>({senda:t.dataset.senda||'',nome:norm(text('.slTalTabName',t)||t.textContent)}));
  const acharTalTab=(w,chave)=>[...w.querySelectorAll('.slTalTab')].find(t=>(chave.senda&&t.dataset.senda===chave.senda)||(!chave.senda&&norm(text('.slTalTabName',t)||t.textContent)===chave.nome));
  async function achaTal(id){let w=talWin();const ache=()=>[...(talWin()||w).querySelectorAll('.slTalNode')].find(n=>talId(n)===id);if(ache())return ache();const chaves=chavesTalTabs(w);for(const chave of chaves){const t=acharTalTab(talWin()||w,chave);if(!t)continue;if(!t.classList.contains('slTabOn')){t.click();await sleep(400)}if(ache())return ache()}return null}
  async function lerArvore(){const w=talWin(),nos=new Map(),chaves=chavesTalTabs(w);for(const chave of chaves.length?chaves:[null]){const atual=talWin()||w,t=chave&&acharTalTab(atual,chave);if(t&&!t.classList.contains('slTabOn')){t.click();await sleep(400)}const W=talWin()||w;for(const id of [...W.querySelectorAll('.slTalNode')].map(talId)){if(nos.has(id))continue;const n=[...(talWin()||w).querySelectorAll('.slTalNode')].find(x=>talId(x)===id);if(!n)continue;mouse(n.querySelector('.slTalTouch')||n,['pointerdown','mousedown','pointerup','mouseup','click']);await sleep(150);const det=(talWin()||w).querySelector('.slTalDetail'),h=det&&[...det.querySelectorAll('h3,h4,h5,strong,b')].find(e=>!e.closest('.slTalGuide')&&e.textContent.trim()),arv=text(`.slTalTreeLabel[data-senda="${n.dataset.senda}"]`,talWin()||w)||n.dataset.senda;nos.set(id,{id,nome:`${arv} · ${h?h.textContent.trim():id.split(':')[1].replace(/^[a-z]{1,2}_/,'')}`,max:talNivel(n).max})}}return[...nos.values()]}
  async function aprender(id){let n=await achaTal(id);if(!n)return false;const antes=talNivel(n).lv;mouse(n.querySelector('.slTalTouch')||n,['pointerdown','mousedown','pointerup','mouseup','click']);await sleep(150);n=await achaTal(id);if(!n)return false;mouse(n.querySelector('.slTalTouch')||n,['dblclick']);await sleep(450);n=await achaTal(id);if(n&&talNivel(n).lv>antes)return true;const b=[...((talWin()||document).querySelector('.slTalDetail')||document.createElement('div')).querySelectorAll('button')].find(e=>visible(e)&&/aprender|evoluir|\+\s*1\b/.test(norm(e.textContent))&&!/tud|max|redefin/.test(norm(e.textContent))&&!unsafe(e));if(!b)return false;b.click();await sleep(450);n=await achaTal(id);return!!n&&talNivel(n).lv>antes}
  // As linhas da árvore (line.slTalLink) vão do centro do pré-requisito (x1,y1) ao centro do talento (x2,y2); o centro de cada nó está no translate dele.
  const talPos=n=>(n.getAttribute('transform')||'').match(/translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/)?.slice(1).map(Number)||[NaN,NaN];
  function talPais(n){const w=n.closest('.slWin')||document,[x,y]=talPos(n),nos=[...w.querySelectorAll('.slTalNode')];return[...w.querySelectorAll('line.slTalLink')].filter(l=>+l.getAttribute('x2')===x&&+l.getAttribute('y2')===y).map(l=>nos.find(o=>{const[a,b]=talPos(o);return a===+l.getAttribute('x1')&&b===+l.getAttribute('y1')})).filter(Boolean)}
  async function desbloquear(id,pts,prof=0){if(prof>8||pts()<=0)return false;let n=await achaTal(id);if(!n||n.dataset.estado!=='locked')return!!n;const pais=talPais(n).map(p=>({id:talId(p),lv:talNivel(p).lv})).sort((a,b)=>b.lv-a.lv);for(const p of pais){let pn=await achaTal(p.id);if(pn?.dataset.estado==='locked'&&!await desbloquear(p.id,pts,prof+1))continue;while(pts()>0){n=await achaTal(id);if(n?.dataset.estado!=='locked')return true;pn=await achaTal(p.id);if(!pn||pn.dataset.estado==='complete'||talNivel(pn).lv>=talNivel(pn).max)break;if(!await aprender(p.id))return false;log(`Pré-requisito ${p.id} subiu para liberar ${id}.`)}n=await achaTal(id);if(n?.dataset.estado!=='locked')return true}return false}
  async function talentos(manual=false,soLer=false){if(talBusy)return;talBusy=true;const soltar=soLer?()=>{}:await pedirVez('talentos');if(!soltar){talBusy=false;return}const st=$('[data-tal-state]');let aberto=null;try{aberto=await openWin(talWin,'Talentos');if(!aberto){st.textContent='Não consegui abrir a árvore de talentos.';log(st.textContent,'warn');return}const pontos=()=>num(text('.slTalSaldo b',talWin()||aberto.w));if(soLer){const a=await lerArvore();cfg.talArvore={...cfg.talArvore,[classeAtual()||cfg.classeBuild||'geral']:a};save(KEY,cfg);applyUI();st.textContent=`${a.length} talentos lidos.`;return}const b=talBuild();if(!b.length){st.textContent='Monte a lista de talentos primeiro.';return}let pts=pontos(),gastos=0;const inicio=pts;for(const it of b){while(pts>0){const n=await achaTal(it.id);if(!n){log(`Talento ${it.id} não está na árvore.`,'warn');break}const{lv,max}=talNivel(n);if(lv>=Math.min(it.alvo||max,max)||n.dataset.estado==='complete')break;if(n.dataset.estado==='locked'){const p0=pts;if(!cfg.talPreReq||!await desbloquear(it.id,pontos)){gastos+=p0-pontos();pts=pontos();break}gastos+=p0-pontos();pts=pontos();continue}if(!await aprender(it.id)){st.textContent='O jogo não aceitou o clique no talento; parei.';log(st.textContent,'warn');return}gastos++;pts=pontos()}if(pts<=0)break}st.textContent=gastos?`${gastos} ponto(s) de talento gastos; sobram ${pts}.`:inicio?'Nada a aprender agora: o que falta está bloqueado ou completo.':'Sem pontos de talento.';if(gastos||manual)log(st.textContent)}catch(e){log(`Erro nos talentos: ${e.message}`,'error')}finally{soltar();if(aberto)await fechar(talWin);talBusy=false}}
  /**
   * Com faixas, os talentos sao vistos **uma vez por faixa, por dia**, na hora sorteada dentro dela.
   *
   * Sem isto a conta do `due` dava verdadeiro quase sempre: o saldo de pontos que a build nao cobre
   * — talento no maximo, pre-requisito que falta, arvore que acabou — fica la' parado, e com ele o
   * `talTick` reabria a janela de 20 em 20 segundos para nao fazer nada. Era o que o dono via em
   * 20/10/2026: "fica toda hora olhando os talentos".
   *
   * A faixa e' marcada **antes** de a verificacao comecar, como nas missoes: se a janela nao abrir,
   * perde-se aquela faixa e espera-se a seguinte, em vez de martelar o jogo ate' a' meia-noite.
   */
  function talFaixaTick(d){
    const agora=faixaDeAgora('talentos');
    if(!agora||!ready('talentos-faixa',60000))return;
    marcarFaixaFeita('talentos',agora.chave);
    lastTalLevel=d.level||lastTalLevel;lastTalCheck=Date.now();
    log(`Talentos: é a hora sorteada da faixa ${agora.i+1} (${agora.f.de}–${agora.f.ate||agora.f.de}, hoje às ${agora.hora}).`);
    talentos()}
  function talTick(d){if(!cfg.autoTalentos||talBusy||!talBuild().length)return;
    if(faixasDe('talentos').length)return talFaixaTick(d);
    const badge=[...document.querySelectorAll('.slHudDrawerItem')].find(e=>norm(text('.slHudDrawerName',e))==='talentos')?.querySelector('.slHudMenuBadge:not([hidden])'),w=talWin(),due=(w&&num(text('.slTalSaldo b',w))>0)||num(badge?.textContent)>0||(d.level&&d.level>lastTalLevel)||Date.now()-lastTalCheck>600000;if(!due||!ready('talentos',20000))return;lastTalLevel=d.level||lastTalLevel;lastTalCheck=Date.now();talentos()}
  // Equipamento: a mochila (data-win="inventory") tem o botão "Equipar melhores" (.slInvBestBtn), que já filtra classe e só troca por peça melhor; o poder total fica em .slInvDollPower.
  // Quando não há peça melhor o jogo abre um aviso que só sai pelo X; tudo o que ganhou um botão de fechar depois do clique é fechado, menos a própria mochila.
  async function fecharSobras(antes){for(let i=0;i<4;i++){const novos=[...document.querySelectorAll('.slFechar,.slWinClose,[aria-label="Fechar"]')].filter(e=>!antes.has(e)&&visible(e)&&!panel.contains(e)&&!e.closest('.slWin[data-win="inventory"] .slWinBar'));if(!novos.length)return;novos.forEach(e=>e.click());await sleep(300)}}
  // O botão abre um diálogo "Equipar melhores" (critério, poder atual → novo poder) com Cancelar e um segundo EQUIPAR MELHORES, que fica desativado quando não há nada melhor; sem X, era ali que travava.
  async function confirmarEquipar(origem){const achar=re=>[...document.querySelectorAll('button')].filter(e=>e!==origem&&!e.classList.contains('slInvBestBtn')&&visible(e)&&!panel.contains(e)&&re.test(norm(e.textContent)));for(let i=0;i<8;i++){const ok=achar(/^equipar melhores$/).find(e=>!e.disabled);if(ok){ok.click();await sleep(800);break}if(achar(/^equipar melhores$/).length)break;await sleep(150)}for(let i=0;i<3;i++){const c=achar(/^cancelar$/)[0];if(!c)break;c.click();await sleep(300)}}
  const invWin=()=>[...document.querySelectorAll('.slWin[data-win="inventory"]')].find(visible);
  async function equipar(manual=false){if(cfg.equipCriterio==='build')return equiparBuild(manual);if(equipBusy)return;equipBusy=true;const soltar=await pedirVez('equipamento');if(!soltar){equipBusy=false;return}cfg.equipUltimo=Date.now();save(KEY,cfg);drawEquip();const st=$('[data-equip-state]');let aberto=null;try{aberto=await openWin(invWin,'Inventário');if(!aberto){st.textContent='Não consegui abrir a mochila.';log(st.textContent,'warn');return}const W=()=>invWin()||aberto.w,tab=W().querySelector('.slTab[data-tab="bag"]');if(tab&&!tab.classList.contains('slTabOn')){tab.click();await sleep(300)}const poder=()=>num(text('.slInvDollPower b',W())),antes=poder(),b=W().querySelector('.slInvBestBtn');if(!b||!visible(b)){st.textContent='Botão "Equipar melhores" não apareceu.';log(st.textContent,'warn');return}if(b.disabled){st.textContent='Nada melhor para equipar.';if(manual)log(st.textContent);return}const xAntes=new Set(document.querySelectorAll('.slFechar,.slWinClose,[aria-label="Fechar"]'));b.click();await sleep(700);await confirmarEquipar(b);const depois=poder();await fecharSobras(xAntes);st.textContent=depois>antes?`Equipamento trocado: poder ${antes.toLocaleString('pt-BR')} → ${depois.toLocaleString('pt-BR')}.`:'Nada melhor para equipar.';if(depois>antes||manual)log(st.textContent)}catch(e){log(`Erro no equipamento: ${e.message}`,'error')}finally{soltar();if(aberto)await fechar(invWin);equipBusy=false}}
  // Equipamento pelos atributos: o detalhe da peça (.slInvDetail) traz o nome, "Raridade · Espaço · Nv N", as linhas .slInvStat (rótulo e valor), a etiqueta "Equipada pelo caçador" e o botão principal Equipar/Desequipar.
  function lerDetalhe(w){const d=w?.querySelector('.slInvDetail:not(.slInvDetailIdle)');if(!d)return null;const nome=text('.slInvDetailName',d),sub=text('.slInvDetailSubline',d).split('·').map(x=>x.trim()),stats={};d.querySelectorAll('.slInvStat').forEach(x=>{const k=text('.slInvStatLabel',x);if(k)stats[k]=num(text('b',x))});const tags=[...d.querySelectorAll('.slInvTag')].map(t=>norm(t.textContent));return{nome,espaco:sub[1]||'',nivel:num(sub[2]),stats,equipado:tags.some(t=>t.includes('equipada pelo')),sombra:tags.some(t=>t.includes('sombra')),assin:`${nome}|${sub.join('|')}|${JSON.stringify(stats)}`}}
  async function abrirDetalhe(W,el,nome){el.click();let d=null;for(let i=0;i<12;i++){await sleep(70);d=lerDetalhe(W());if(d&&(!nome||d.nome===nome))return d}return d}
  const eqChip=(W,n)=>[...W().querySelectorAll('.slInvChipsRow .slChip')].find(c=>norm(c.textContent).startsWith(n));
  const eqCelulas=W=>[...W().querySelectorAll('.slInvGrid .slInvCell')];
  async function eqPagina1(W){const b=W().querySelector('.slPagBtn[aria-label="Primeira página"]');if(b&&!b.disabled){b.click();await sleep(300)}}
  async function eqProxima(W){const b=W().querySelector('.slPagBtn[aria-label="Avançar"]');if(!b||b.disabled)return false;b.click();await sleep(300);return true}
  async function varrerMochila(W,st){const itens=[];for(const n of['armas','armadura']){const c=eqChip(W,n);if(!c)continue;c.click();await sleep(400);await eqPagina1(W);for(let pg=0;pg<300;pg++){const total=eqCelulas(W).length;for(let i=0;i<total;i++){const cell=eqCelulas(W)[i];if(!cell)break;const d=await abrirDetalhe(W,cell,cell.querySelector('img')?.alt);if(d&&d.espaco&&!d.equipado&&!d.sombra)itens.push(d)}st.textContent=`Lendo a mochila… ${itens.length} peça(s)`;if(!await eqProxima(W))break}}eqChip(W,'tudo')?.click();await sleep(300);return itens}
  async function lerEquipados(W){const lay=W().querySelector('.slInvLayer');if(lay&&!lay.classList.contains('on')){lay.click();await sleep(300)}const eq={};const n=W().querySelectorAll('.slInvDoll .slInvEq').length;for(let i=0;i<n;i++){const slot=W().querySelectorAll('.slInvDoll .slInvEq')[i],nomeEsp=text('.slInvEqName',slot);if(slot.classList.contains('slInvEqEmpty')){if(nomeEsp&&!(nomeEsp in eq))eq[nomeEsp]=null;continue}const alvo=slot.querySelector('.slSlot');if(!alvo)continue;const d=await abrirDetalhe(W,alvo,alvo.querySelector('img')?.alt);if(d?.espaco)eq[d.espaco]=d;else if(nomeEsp)eq[nomeEsp]=null}const limpar=W().querySelector('.slInvClearAll');if(limpar&&visible(limpar)){limpar.click();await sleep(300)}return eq}
  async function equiparPeca(W,it){const busca=W().querySelector('.slInvSearch');eqChip(W,'tudo')?.click();await sleep(250);if(busca){setValor(busca,it.nome);await sleep(450)}await eqPagina1(W);try{for(let pg=0;pg<300;pg++){const total=eqCelulas(W).length;for(let i=0;i<total;i++){const cell=eqCelulas(W)[i];if(!cell||cell.querySelector('img')?.alt!==it.nome)continue;const d=await abrirDetalhe(W,cell,it.nome);if(d?.assin!==it.assin||d.equipado)continue;const b=W().querySelector('.slInvDetail .slInvActMain');if(!b||norm(b.textContent)!=='equipar'||b.disabled)return false;const antes=new Set(document.querySelectorAll('.slFechar,.slWinClose,[aria-label="Fechar"]'));b.click();await sleep(700);await fecharSobras(antes);return true}if(!await eqProxima(W))break}return false}finally{if(busca){setValor(busca,'');await sleep(300)}}}
  async function equiparBuild(manual=false){if(equipBusy)return;equipBusy=true;const soltar=await pedirVez('equipamento');if(!soltar){equipBusy=false;return}cfg.equipUltimo=Date.now();save(KEY,cfg);drawEquip();const st=$('[data-equip-state]');let aberto=null;try{aberto=await openWin(invWin,'Inventário');if(!aberto){st.textContent='Não consegui abrir a mochila.';log(st.textContent,'warn');return}const W=()=>invWin()||aberto.w,tab=W().querySelector('.slTab[data-tab="bag"]');if(tab&&!tab.classList.contains('slTabOn')){tab.click();await sleep(300)}const nivel=screen().level||Infinity,itens=(await varrerMochila(W,st)).filter(x=>!x.nivel||x.nivel<=nivel),eq=await lerEquipados(W),todos=[...itens,...Object.values(eq).filter(Boolean)],labels=[...new Set([...cfg.equipLabels,...todos.flatMap(x=>Object.keys(x.stats))])];if(labels.length!==cfg.equipLabels.length){cfg.equipLabels=labels;save(KEY,cfg)}const max={};todos.forEach(x=>Object.entries(x.stats).forEach(([k,v])=>max[k]=Math.max(max[k]||0,v)));const nota=x=>Object.entries(cfg.equipPesos).reduce((t,[k,p])=>t+(Number(p)||0)*((x.stats[k]||0)/(max[k]||1)),0),exige=Object.keys(cfg.equipExigir).filter(k=>cfg.equipExigir[k]),aceita=x=>exige.every(k=>(x.stats[k]||0)>0),trocas=[];for(const esp of new Set([...Object.keys(eq),...itens.map(x=>x.espaco)])){const atual=eq[esp]||null,base=atual?nota(atual):0,melhor=itens.filter(x=>x.espaco===esp&&aceita(x)).sort((a,b)=>nota(b)-nota(a))[0];if(melhor&&nota(melhor)>base+0.01&&(!atual||melhor.assin!==atual.assin))trocas.push({esp,atual,melhor})}const feitas=[];for(const t of trocas){st.textContent=`Equipando ${t.melhor.nome}…`;if(await equiparPeca(W,t.melhor))feitas.push(`${t.esp}: ${t.atual?.nome||'vazio'} → ${t.melhor.nome}`);else log(`Não consegui equipar ${t.melhor.nome} (${t.esp}).`,'warn')}st.textContent=feitas.length?feitas.join(' · '):`Nada melhor pelos seus atributos (${itens.length} peça(s) lidas).`;if(feitas.length||manual)log(st.textContent)}catch(e){log(`Erro no equipamento: ${e.message}`,'error')}finally{soltar();if(aberto)await fechar(invWin);equipBusy=false;drawEquip()}}
  // Agenda: "minutos" conta a partir da última troca; "dia" e "semana" valem a partir da ocorrência mais recente do horário marcado, e a última troca fica guardada para sobreviver a um recarregamento.
  const DIA=86400000;
  function equipMarco(now){const[h,m]=String(cfg.equipHora||'04:00').split(':').map(Number),d=new Date(now);d.setHours(h||0,m||0,0,0);if(cfg.equipModo==='semana')d.setDate(d.getDate()-((d.getDay()-Number(cfg.equipDia)+7)%7));if(d.getTime()>now)d.setDate(d.getDate()-(cfg.equipModo==='semana'?7:1));return d.getTime()}
  function equipProxima(now=Date.now()){if(cfg.equipModo==='minutos')return(cfg.equipUltimo||0)+Math.max(5,Number(cfg.equipMin)||60)*60000;const marco=equipMarco(now);return cfg.equipUltimo<marco?marco:marco+(cfg.equipModo==='semana'?7:1)*DIA}
  function drawEquip(){$('[data-equip-build]').hidden=cfg.equipCriterio!=='build';const pesosEl=$('[data-eq-pesos]');if(!pesosEl.contains(document.activeElement))pesosEl.innerHTML=cfg.equipLabels.map(k=>`<div class="tal-row"><span style="flex:1">${k}</span><input type="number" min="0" max="100" data-eqpeso="${k}" value="${Number(cfg.equipPesos[k])||0}"><label class="toggle"><input type="checkbox" data-eqexigir="${k}"${cfg.equipExigir[k]?' checked':''}> Exigir</label></div>`).join('');panel.querySelectorAll('[data-equip-show]').forEach(e=>e.hidden=!e.dataset.equipShow.split(' ').includes(cfg.equipModo));const p=equipProxima(),fmt=t=>new Date(t).toLocaleString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});$('[data-equip-next]').textContent=!cfg.autoEquip?'Desligado.':`${cfg.equipUltimo?`Última: ${fmt(cfg.equipUltimo)} · `:''}Próxima: ${p<=Date.now()?'agora':fmt(p)}`}
  function equipTick(d){drawEquip();if(!cfg.autoEquip||equipBusy)return;const subiu=cfg.equipNivel&&d.level&&lastEquipLevel&&d.level>lastEquipLevel;if(d.level)lastEquipLevel=Math.max(lastEquipLevel,d.level);if(!subiu&&Date.now()<equipProxima())return;if(!ready('equip',20000))return;equipar()}
  // Loja do NPC: a janela data-win="shop" só abre perto do NPC. O caminho até ele é gravado (teclas com o tempo de cada uma e cliques na tela em fração da janela) e repetido depois de voltar à cidade.
  const shopWin=()=>[...document.querySelectorAll('.slWin[data-win="shop"]')].find(visible);
  const naCacada=()=>[...document.querySelectorAll('.slHudQbLeave')].some(visible);
  const jogoCanvas=()=>[...document.querySelectorAll('canvas')].filter(visible).sort((a,b)=>b.width*b.height-a.width*a.height)[0]||document.body;
  /** A lista de faixas das missoes, com a hora que saiu hoje em cada uma. */
  /**
   * A lista de faixas de um dono, no painel. Um desenho so' para os dois, e um `data-faixa` que diz
   * de quem e' a linha: com atributos proprios de cada dono, o tratador de eventos virava duas copias
   * e a segunda ficava sempre a dever.
   */
  function drawFaixas(k,sel,vazio){
    const el=$(sel);if(!el)return;
    const feitas=faixasFeitasHoje(k);
    el.innerHTML=faixasDe(k).map((f,i)=>{
      const hora=f&&f.de?horaDaFaixa(k,f,i):'';
      const feita=hora&&feitas.includes(chaveDaFaixa(f,hora));
      const diz=!hora?'—':feita?`hoje já foi (${hora})`:`hoje às ${hora}`;
      return `<div class="tal-row" data-faixa="${k}" data-faixa-i="${i}"><input type="time" data-faixa-de value="${f?.de||''}"><input type="time" data-faixa-ate value="${f?.ate||''}"><span style="flex:1">${diz}</span><button data-faixa-del title="Tirar da lista">✕</button></div>`;
    }).join('')||`<p class="hint">${vazio}</p>`;
  }
  function drawMissoes(){drawFaixas('missoes','[data-miss-list]','Sem faixas: confere de 5 em 5 minutos.')}
  function drawTalFaixas(){drawFaixas('talentos','[data-talf-list]','Sem faixas: confere sempre que houver pontos novos.')}
  function drawLoja(){const nomes=cfg.lojaNomes;$('[data-loja-list]').innerHTML=cfg.lojaItens.map((it,i)=>`<div class="tal-row" data-loja-i="${i}"><select data-loja-nome>${(nomes.includes(it.nome)?nomes:[it.nome,...nomes]).map(n=>`<option${n===it.nome?' selected':''}>${n}</option>`).join('')}</select><input type="number" min="1" max="10000" value="${it.alvo}" title="Completar até"><button data-loja-del title="Tirar da lista">✕</button></div>`).join('')||'<p class="hint">Nenhum item.</p>';$('[data-rota-list]').innerHTML=cfg.rotas.map((r,i)=>`<div class="tal-row" data-rota-i="${i}"><span style="flex:1">Caminho ${i+1}: ${r.length} passo(s), ${Math.round((r[r.length-1]?.t||0)/1000)} s</span><button data-rota-test>Testar</button><button data-rota-del title="Apagar">✕</button></div>`).join('');$('[data-rota-state]').textContent=gravando?`Gravando… ${gravando.passos.length} passo(s). Clique de novo para parar.`:(cfg.rotas.length?`${cfg.rotas.length} caminho(s); um é sorteado a cada compra.`:'Nenhum caminho gravado.')+(cfg.charPos?' Personagem marcado.':' Personagem: centro da tela.');$('[data-rota-rec]').textContent=gravando?'Parar gravação':'Gravar novo caminho'}
  function ignorar(e){return(e.type==='pointerdown'&&panel.contains(e.target))||/^(input|textarea|select)$/i.test(e.target?.tagName||'')||e.target?.isContentEditable}
  function gravarEvento(e){if(marcandoChar&&e.type==='pointerdown'&&e.isTrusted&&!panel.contains(e.target)){marcandoChar=false;cfg.charPos={fx:e.clientX/innerWidth,fy:e.clientY/innerHeight};save(KEY,cfg);log('Posição do personagem marcada.');drawLoja();return}if(!gravando||!e.isTrusted||ignorar(e))return;const t=performance.now()-gravando.inicio;if(e.type==='pointerdown')gravando.passos.push({t,tipo:'clique',fx:e.clientX/innerWidth,fy:e.clientY/innerHeight});else{if(e.repeat)return;gravando.passos.push({t,tipo:e.type,key:e.key,code:e.code,keyCode:e.keyCode})}drawLoja()}
  // MODO SEGURO: sem gravação de caminho não há nada a escutar, e some junto o listener global de teclas.
  if(!MODO_SEGURO)['keydown','keyup','pointerdown'].forEach(t=>addEventListener(t,gravarEvento,true));
  function gravar(){if(barrado('gravar caminho'))return;if(shopWin()){$('[data-loja-state]').textContent='Feche a loja e volte ao ponto de partida antes de gravar.';return}document.activeElement?.blur?.();gravando={inicio:performance.now(),passos:[]};drawLoja();log('Gravando o caminho até o NPC.');const fim=Date.now()+120000,olhar=setInterval(()=>{if(!gravando){clearInterval(olhar);return}if(shopWin()||Date.now()>fim){clearInterval(olhar);pararGravacao()}},300)}
  function pararGravacao(){if(!gravando)return;const p=gravando.passos;gravando=null;if(p.length){cfg.rotas=[...cfg.rotas,p];save(KEY,cfg);log(`Caminho ${cfg.rotas.length} gravado: ${p.length} passo(s).`)}else log('Nada gravado.','warn');drawLoja()}
  function tecla(tipo,p){const e=new KeyboardEvent(tipo,{key:p.key,code:p.code,bubbles:true,cancelable:true});Object.defineProperty(e,'keyCode',{get:()=>p.keyCode});Object.defineProperty(e,'which',{get:()=>p.keyCode});(document.activeElement&&document.activeElement!==document.body&&!panel.contains(document.activeElement)?document.activeElement:jogoCanvas()).dispatchEvent(e)}
  function cliqueEm(fx,fy){const x=fx*innerWidth+(Math.random()*6-3),y=fy*innerHeight+(Math.random()*6-3),vis=panel.style.visibility;panel.style.visibility='hidden';const alvo=document.elementFromPoint(x,y)||jogoCanvas();panel.style.visibility=vis;const o={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:1};['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>alvo.dispatchEvent(new (t.startsWith('pointer')?PointerEvent:MouseEvent)(t,{...o,buttons:t.endsWith('down')?1:0})))}
  // setTimeout numa janela em segundo plano atrasa até 1 s, e isso desloca o boneco; a espera do caminho vai pelo relógio de alta precisão e, perto do instante, por MessageChannel, que não é estrangulado.
  const canal=new MessageChannel(),proximo=()=>new Promise(res=>{canal.port1.onmessage=()=>res();canal.port2.postMessage(0)});
  async function ate(t){while(performance.now()<t){const falta=t-performance.now();if(falta>80&&!document.hidden)await sleep(falta-60);else await proximo()}}
  // O personagem fica no centro do canvas do jogo (a câmera o segue), a não ser que tenha sido marcado à mão.
  function posChar(){if(cfg.charPos)return cfg.charPos;const c=jogoCanvas().getBoundingClientRect();return{fx:(c.left+c.width/2)/innerWidth,fy:(c.top+c.height/2)/innerHeight}}
  /**
   * Fala com o que estiver por perto, como o jogador faz: a tecla E.
   *
   * Medido no fonte do jogo em 19/10/2026:
   * `keyDown(e){if(!(e.ctrlKey||e.metaKey||e.altKey||...)){...if(!e.repeat)switch(e.code){case 'KeyE':
   * e.preventDefault(),this.net.send('interact',{entity:0})`, com o ouvinte em `window`.
   *
   * Tres coisas saem dai, e todas importam:
   * - o jogo le' o **`code`**, nao o `key` nem o `keyCode`: tem de ser `KeyE`;
   * - `!e.repeat` exige um evento novo, que e' o que `KeyboardEvent` da' por omissao;
   * - `entity:0` quer dizer **sem coordenada**: quem decide quem atende e' a proximidade, no
   *   servidor. E' por isso que isto substitui o clique no NPC com vantagem — nao ha ponto para
   *   errar, e um clique perdido no cenario mexe o personagem para longe.
   *
   * O ouvinte esta' em `window` e o evento sobe do canvas, entao o `tecla` de sempre serve.
   */
  async function falarComQuemEstaPerto(tentativas=3){document.activeElement?.blur?.();
    for(let i=0;i<tentativas&&!shopWin();i++){
      tecla('keydown',{key:'e',code:'KeyE',keyCode:69});
      tecla('keyup',{key:'e',code:'KeyE',keyCode:69});
      for(let j=0;j<5&&!shopWin();j++)await sleep(160);
    }
    return!!shopWin()}
  /**
   * Os sentidos que o caminho mais andou, do maior para o menor, com a propria tecla gravada.
   *
   * Devolve os passos de `keydown` tal como foram gravados — eles ja' trazem `key`, `code` e
   * `keyCode` certos, e inventar uma tabela de teclas aqui seria uma segunda verdade a divergir no
   * dia em que alguem gravar um caminho com as setas em vez do WASD.
   */
  function sentidosDaRota(passos){
    const tempo=new Map(),inicio=new Map(),exemplo=new Map();
    for(const p of passos||[]){
      if(p.tipo==='keydown'){inicio.set(p.code,p.t);exemplo.set(p.code,p)}
      else if(p.tipo==='keyup'&&inicio.has(p.code)){tempo.set(p.code,(tempo.get(p.code)||0)+Math.max(0,p.t-inicio.get(p.code)));inicio.delete(p.code)}
    }
    return[...tempo.entries()].sort((a,b)=>b[1]-a[1]).map(([code])=>exemplo.get(code)).filter(Boolean)}
  /**
   * Chegou perto, mas nao o bastante: anda mais um bocadinho no mesmo sentido e tenta de novo.
   *
   * **Por que no mesmo sentido, e nao a procurar em volta:** o erro de chegada aqui e' sistematico e
   * tem sinal. Medido no jogo em 19/10/2026, um caminho chega sempre *curto*, nunca longo, porque
   * cada perna recomeca a aceleracao e o tempo premido rende menos chao do que parece. Entao o
   * conserto e' continuar, e nao procurar.
   *
   * E anda-se, em vez de clicar: um clique por coordenada, a partir de uma posicao que ja' nao e' a
   * prevista, acerta no que estiver ali — num dia destes abriu o inventario e a guilda. O `interact`
   * do E nao tem alvo para errar.
   */
  async function aproximarDoNpc(passos,voltas=3){
    const sentidos=sentidosDaRota(passos).slice(0,2);
    if(!sentidos.length)return!!shopWin();
    for(let i=0;i<voltas&&!shopWin();i++){
      log(`A loja não abriu; chegando mais perto (${i+1}ª tentativa).`);
      for(const p of sentidos){if(shopWin())break;tecla('keydown',p);await sleep(240);tecla('keyup',p);await sleep(140)}
      if(await falarComQuemEstaPerto(1))return true;
    }
    return!!shopWin()}
  async function procurarEmVolta(c,raios,passos){for(const raio of raios)for(let a=0;a<passos&&!shopWin();a++){const ang=a*2*Math.PI/passos+raio;cliqueEm(c.fx+Math.cos(ang)*raio/innerWidth,c.fy+Math.sin(ang)*raio/innerHeight);await sleep(300)}}
  /**
   * O mesmo caminho, com outro compasso.
   *
   * Medido no jogo em 19/10/2026, e e' isto que separa o que se sacode do que nao se sacode:
   *
   * - **as pausas entre as pernas nao mexem o personagem.** Variam a' vontade, e sao elas que
   *   mudam a assinatura de tempos de uma ida para a outra.
   * - **o tempo de tecla premida e' distancia.** Uma copia do caminho que funciona todos os dias
   *   falhou quando o ponto de partida estava ~200 ms deslocado; sacudir a perna em ±8% seria o
   *   mesmo erro, de proposito. Por isso o limite aqui e' ±3%, que num trecho de 2,5 s da' ±75 ms.
   * - **perna partida em duas chega mais curto**, porque cada arranque recomeca a aceleracao: um
   *   caminho com tres pedacos no mesmo sentido ficou curto e nao abriu a loja. Entao nao se parte
   *   nada aqui; quem quiser um traçado diferente grava outro caminho.
   *
   * Nao grava nada: a variacao vive so' nesta ida, e o caminho guardado continua a ser o que o dono
   * andou.
   */
  function variarRota(passos){
    if(!Array.isArray(passos)||passos.length<2)return passos;
    const premidas=new Set();const saida=[];
    // A espera ate' ao primeiro passo tambem e' pausa: nada premido, personagem parado. Zera-la
    // faria a ida comecar sempre no mesmo instante, que e' metade da assinatura que se quer variar.
    let t=Math.round(Math.max(0,passos[0].t)*(0.8+Math.random()*0.7));
    for(let i=0;i<passos.length;i++){
      const p=passos[i],anterior=passos[i-1];
      if(i){
        const espera=Math.max(0,p.t-anterior.t);
        // Alguma tecla premida neste intervalo? Entao ele e' andar, e nao espera.
        const andando=premidas.size>0;
        t+=andando?Math.round(espera*(0.97+Math.random()*0.06)):Math.round(espera*(0.8+Math.random()*0.7));
      }
      saida.push({...p,t});
      if(p.tipo==='keydown')premidas.add(p.code);else if(p.tipo==='keyup')premidas.delete(p.code);
    }
    return saida}
  async function repetirRota(idx){if(barrado('repetir caminho'))return false;const n=cfg.rotas.length;if(!n)return false;if(idx==null){idx=Math.floor(Math.random()*n);if(n>1&&idx===ultimaRota)idx=(idx+1+Math.floor(Math.random()*(n-1)))%n}ultimaRota=idx;const guardado=cfg.rotas[idx];if(!guardado?.length)return false;const r=variarRota(guardado);log(`Indo ao NPC pelo caminho ${idx+1}, com o compasso variado.`);await sleep(300+Math.random()*1200);document.activeElement?.blur?.();const ini=performance.now(),soltar=new Map();for(const p of r){await ate(ini+p.t);if(shopWin())break;if(p.tipo==='clique')cliqueEm(p.fx,p.fy);else{tecla(p.tipo,p);p.tipo==='keydown'?soltar.set(p.code,p):soltar.delete(p.code)}}soltar.forEach(p=>tecla('keyup',p));for(let i=0;i<6&&!shopWin();i++)await sleep(200);
    // O "E" antes de qualquer clique: ele nao erra alvo e nao mexe o personagem.
    if(!shopWin()){log('Cheguei; falando com o NPC pela tecla E.');await falarComQuemEstaPerto()}
    // Faltou pouco: continua no mesmo sentido antes de pensar em clicar.
    if(!shopWin())await aproximarDoNpc(r);
    const npc=[...r].reverse().find(p=>p.tipo==='clique');if(npc&&!shopWin()){log('O E não abriu a loja; procurando o NPC em volta.');await procurarEmVolta(npc,[12,24,36,50],8)}if(!shopWin()){log('Procurando o NPC em volta do personagem.');await procurarEmVolta(posChar(),[40,60,80,100,125,150],12)}for(let i=0;i<6&&!shopWin();i++)await sleep(200);return!!shopWin()}
  async function testarRota(i){if(barrado('testar caminho'))return;if(lojaBusy)return;lojaBusy=true;const soltar=await pedirVez('loja');if(!soltar){lojaBusy=false;return}try{const ok=await comCenario(()=>repetirRota(i));$('[data-loja-state]').textContent=ok?'O caminho abriu a loja.':'O caminho terminou e a loja não abriu.';log($('[data-loja-state]').textContent,ok?'info':'warn')}finally{soltar();lojaBusy=false}}
  function setValor(inp,v){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(inp,String(v));inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}))}
  // A loja tem três abas: Consumíveis e Essências, pagas em ouro, e a Loja de diamantes, que nunca é aberta. Os nomes de cada aba em ouro entram na lista sempre que ela aparece na tela.
  const ouroCard=c=>!!c.querySelector('.slShopPrice img[src*="gold"]');
  function lerNomesLoja(){const w=shopWin(),aba=w?.querySelector('.slTab.slTabOn')?.dataset.tab;if(!w||!aba||aba==='premium')return;const novos=[...w.querySelectorAll('.slShopCard')].filter(ouroCard).map(c=>text('.slShopName strong',c)).filter(n=>n&&!cfg.lojaNomes.includes(n));if(novos.length){cfg.lojaNomes=[...cfg.lojaNomes,...novos];save(KEY,cfg);drawLoja()}}
  /**
   * O que vale como "sim" no pedido de confirmacao da compra.
   *
   * O `unsafe()` geral nao serve aqui: ele barra tudo o que diga "comprar", e numa loja o botao de
   * confirmar chama-se justamente isso. Em troca, a lista do que nunca se confirma fica explicita —
   * diamante, premium, cristal, pix, R$ — para nenhum atalho destes virar uma compra paga.
   */
  const CONFIRMA_COMPRA=/^(confirmar|confirmar compra|comprar|comprar agora|sim|ok)$/;
  const COMPRA_PAGA=/diamante|premium|crista|pix|r\$/;
  const MODAIS='[role="dialog"],.slModal,.slModalCard,.slConfirm,.slDialog,.slModalActions';
  /**
   * So' dentro de um modal, e nunca num cartao da loja: o proprio `Comprar` do cartao da' pelo mesmo
   * nome, e clica-lo outra vez comprava em dobro.
   */
  function botaoDeConfirmar(){return [...document.querySelectorAll(MODAIS)].filter(m=>visible(m)&&!panel.contains(m))
    .flatMap(m=>[...m.querySelectorAll('button')])
    .find(b=>visible(b)&&!b.disabled&&!b.closest('.slShopCard')&&CONFIRMA_COMPRA.test(norm(b.textContent))&&!COMPRA_PAGA.test(norm(`${b.textContent} ${b.ariaLabel} ${b.title}`)))}
  /**
   * Espera pelo pedido de confirmacao em vez de o espiar uma vez.
   *
   * Era aqui que a compra se perdia: um `sleep` fixo de 800 ms e uma unica olhada. Se o modal
   * demorasse mais do que isso — e demora, e' uma ida ao servidor —, ninguem confirmava e a
   * extensao dizia "a compra nao apareceu" sem nada ter sido comprado.
   */
  async function esperarConfirmacao(ms=4000){for(let t=0;t<ms;t+=150){const b=botaoDeConfirmar();if(b)return b;await sleep(150)}return null}
  /** A quantidade na mochila so' muda quando o servidor responde; esperar por ela e' a prova. */
  async function esperarCompra(card,tem,ms=4000){for(let t=0;t<ms;t+=200){const d=num(text('.slShopOwned b',card()));if(d>tem)return d;await sleep(200)}return num(text('.slShopOwned b',card()))}
  async function comprarItens(){const W=shopWin,res=[],feitos=new Set();for(const aba of['consumables','essences']){const t=W()?.querySelector(`.slTab[data-tab="${aba}"]`);if(!t)continue;if(!t.classList.contains('slTabOn')){t.click();await sleep(450)}lerNomesLoja();for(const it of cfg.lojaItens){if(feitos.has(it))continue;const card=()=>[...(W()||document).querySelectorAll('.slShopCard')].find(c=>text('.slShopName strong',c)===it.nome);let c=card();if(!c)continue;feitos.add(it);if(!ouroCard(c)){res.push(`${it.nome}: não é pago em ouro`);continue}const tem=num(text('.slShopOwned b',c)),preco=num(text('.slShopPrice',c)),ouro=num(text('.slShopWallet .slMoneyGold',W())),inp=c.querySelector('.slNumInput'),qt=Math.min(Number(it.alvo)-tem,preco?Math.floor(ouro/preco):0,Number(inp?.max)||Infinity);if(qt<=0){if(Number(it.alvo)>tem)res.push(`${it.nome}: ouro insuficiente`);continue}if(!inp){res.push(`${it.nome}: sem campo de quantidade`);continue}setValor(inp,qt);await sleep(300);c=card();const b=c?.querySelector('.slShopBuy'),total=num(text('.slShopBuyTotal',c));if(!b||b.disabled||num(text('.slShopBuyCount',c))!==qt||total!==qt*preco||total>ouro){res.push(`${it.nome}: a loja mostrou outra quantidade ou preço; não comprei`);continue}b.click();const m=await esperarConfirmacao();if(m){m.click();await sleep(400)}const depois=await esperarCompra(card,tem);res.push(depois>tem?`${it.nome} +${depois-tem}`:m?`${it.nome}: confirmei e a compra não apareceu`:`${it.nome}: não achei o botão de confirmar e nada mudou`)}}cfg.lojaItens.filter(it=>!feitos.has(it)).forEach(it=>res.push(`${it.nome}: não está na loja`));save(KEY,cfg);return res}
  /**
   * Teto de recarregamentos por hora.
   *
   * O numero existe porque o defeito que isto conserta e o defeito que isto pode causar sao o
   * mesmo: se a loja nunca abrir — NPC movido, caminho velho, jogo em manutencao —, recarregar sem
   * teto vira um laco que recarrega a pagina para sempre e nunca diz porque'. Duas por hora chegam
   * para um tropecao e nao chegam para um laco.
   */
  const F5_POR_HORA=2;
  const f5Recentes=()=>((load(LOJA_F5,null)||{}).feitas||[]).filter(t=>Date.now()-t<3600000);
  const podeRecarregar=()=>cfg.lojaRefresh===true&&f5Recentes().length<F5_POR_HORA;
  /**
   * Pede o recarregamento e deixa um bilhete para o outro lado.
   *
   * O bilhete vai para o `localStorage` porque **nada em memoria sobrevive ao `reload`** — nem o
   * contador de tentativas, que e' justamente o que impede o laco. Ele leva a hora, e quem o le' do
   * outro lado recusa um bilhete velho: senao um F5 que o dono desse amanha de manha mandaria a
   * extensao sair a comprar sozinha.
   */
  function recarregarETentar(){
    if(barrado('recarregar a página'))return;
    save(LOJA_F5,{feitas:[...f5Recentes(),Date.now()],pendente:Date.now()});
    log('A loja não abriu; vou recarregar a página e tentar outra vez.','warn');
    setTimeout(()=>location.reload(),1500)}
  async function comprar(manual=false,vender=cfg.vendaAuto){if(barrado('compra e venda no NPC'))return;if(lojaBusy)return;lojaBusy=true;const soltar=await pedirVez('loja');if(!soltar){lojaBusy=false;return}const st=$('[data-loja-state]');cfg.lojaUltima=Date.now();faltaPocao=0;save(KEY,cfg);try{await comCenario(async()=>{if(!shopWin()){if(!cfg.rotas.length){st.textContent='Grave o caminho até o NPC primeiro.';log(st.textContent,'warn');return}if(naCacada()){st.textContent='Voltando à cidade para comprar…';cacaAnterior=await cacaViva();if(!returnCity('comprar poções'))return;for(let i=0;i<40&&naCacada();i++)await sleep(500);if(naCacada()){st.textContent='Não saí da caçada.';log(st.textContent,'warn');return}await sleep(2500)}st.textContent='Indo até o NPC…';if(!await repetirRota()){st.textContent=`Fiz o caminho ${ultimaRota+1} e a loja não abriu; teste-o ou grave de novo a partir do ponto em que você aparece na cidade.`;log(st.textContent,'warn');if(podeRecarregar())recarregarETentar();return}}st.textContent='Comprando…';const res=await comprarItens();if(vender){st.textContent='Vendendo…';const v=await venderItens();$('[data-venda-state]').textContent=v;res.push(`Venda: ${v}`);await fechar(sellWin)}st.textContent=res.length?res.join(' · '):'Nada a comprar: tudo já está na quantidade.';log(st.textContent);})}catch(e){log(`Erro na compra: ${e.message}`,'error')}finally{await fechar(sellWin);await fechar(shopWin);await retomarCaca();cacaAnterior=null;soltar();
    // Se nao havia caçada para voltar — a compra comecou na cidade —, quem escolhe e' a escada, e so'
    // depois de a vez estar largada: ela abre a lista de caçadas, que e' outra janela.
    if(cfg.escada&&!naCacada())setTimeout(()=>chooseHunt(true),1500);
    lojaBusy=false;drawLoja()}}
  // Venda ao Brok: "Vender itens" na loja abre data-win="sell", com linhas .slSellRow (caixa .slSellCheck e "Raridade · Espaço · Nv N"), páginas e "Vender selecionados" (.slSellGo). Equipados não aparecem e travados não vendem.
  const RARIDADES=['Comum','Incomum','Raro','Épico','Lendário','Monarca'],sellWin=()=>[...document.querySelectorAll('.slWin[data-win="sell"]')].find(visible);
  async function venderItens(){const loja=shopWin(),bt=loja?.querySelector('.slShopSell');if(!bt)return'o botão Vender itens não apareceu';bt.click();for(let i=0;i<15&&!sellWin();i++)await sleep(200);const W=sellWin;if(!W())return'o painel de venda não abriu';const limite=RARIDADES.indexOf(cfg.vendaRaridade),ouro0=num(text('.slSellPurse',W())),ir1=W().querySelector('.slSellPager .slPagBtn[aria-label="Primeira página"]');if(ir1&&!ir1.disabled){ir1.click();await sleep(350)}let marcados=0;for(let pg=0;pg<100;pg++){for(const row of W().querySelectorAll('.slSellRow')){const sub=text('.slSellName small',row).split('·').map(x=>x.trim()),rar=RARIDADES.indexOf(sub[0]),cb=row.querySelector('.slSellCheck');if(sub.length<3||!/^nv\b/i.test(sub[2])||rar<0||rar>limite||!cb||cb.disabled||cb.checked)continue;cb.click();marcados++;await sleep(30)}const prox=W().querySelector('.slSellPager .slPagBtn[aria-label="Avançar"]');if(!prox||prox.disabled)break;prox.click();await sleep(400)}if(!marcados)return'nada para vender';await sleep(300);const cont=num(text('.slSellSumCount',W()));if(cont!==marcados){[...W().querySelectorAll('.slSellFootActs button')].find(e=>norm(e.textContent).includes('limpar'))?.click();return`o jogo marcou ${cont} em vez de ${marcados}; não vendi`}const go=W().querySelector('.slSellGo');if(!go||go.disabled)return'o botão Vender selecionados está desativado';const antes=new Set(document.querySelectorAll('button'));go.click();await sleep(800);const c=[...document.querySelectorAll('button')].find(e=>!antes.has(e)&&!e.matches('.slShopSell,.slSellGo')&&!/^vender (itens|selecionados)/.test(norm(e.textContent))&&visible(e)&&!panel.contains(e)&&/^(vender|confirmar|sim)/.test(norm(e.textContent))&&!/diamante|premium/.test(norm(e.textContent)));if(c){c.click();await sleep(900)}const ouro1=num(text('.slSellPurse',W()||document));return ouro1>ouro0?`${marcados} peça(s) vendida(s) por ${(ouro1-ouro0).toLocaleString('pt-BR')} de ouro`:`marquei ${marcados} peça(s), mas o ouro não subiu; confira`}
  function lojaTick(d){if(!lojaBusy&&shopWin())lerNomesLoja();if(MODO_SEGURO)return;if((!cfg.autoLoja&&!cfg.vendaAuto)||lojaBusy||!cfg.rotas.length)return;const intervalo=cfg.autoLoja&&Number(cfg.lojaMin)>0&&Date.now()-cfg.lojaUltima>=Number(cfg.lojaMin)*60000,acabou=cfg.autoLoja&&faltaPocao&&Date.now()-faltaPocao<60000,cheia=cfg.vendaAuto&&d.bagPct>=Number(cfg.vendaMochila);if((intervalo||acabou||cheia)&&ready('loja',120000))comprar()}
  /**
   * A fila: uma automacao de cada vez, por ordem de chegada.
   *
   * Antes disto havia onze bandeiras (`lojaBusy`, `statusBusy`, `challengeBusy`...) e **cada tick
   * conferia um subconjunto diferente delas**: o `desafiosTick` so' olhava a sua, por exemplo, e por
   * isso o chefe diario podia comecar no meio da ida ao NPC — duas automacoes a clicar na mesma
   * tela, cada uma a abrir a janela que a outra fechava. Uma fila so' acaba com a classe inteira
   * desse defeito, em vez de remendar par a par.
   *
   * O nome de cada uma e' o que aparece no painel: quem espera tem direito a saber por quem.
   */
  const NOMES_DA_FILA={loja:'a ida ao NPC',missoes:'as missões',diaria:'a diária',chefe:'o chefe diário',torre:'a Torre',forja:'a Forja',sombras:'as sombras',status:'os pontos de status',talentos:'os talentos',equipamento:'o equipamento',codex:'o Codex',voltar:'a volta à caçada'};
  /**
   * Prazo para dar a vez por abandonada.
   *
   * Uma automacao que rebente de um jeito que escape ao `finally` — a aba dormir a meio, o jogo
   * recarregar — ficaria com a vez para sempre, e o painel diria "esperando" ate' ao fim do mundo
   * sem nada acontecer. Dez minutos sao mais do que qualquer uma delas demora.
   */
  const FILA_ABANDONO=600000;
  let vezDe=null,vezDesde=0;const filaDeEspera=[];
  const vezViva=()=>{if(vezDe&&Date.now()-vezDesde>FILA_ABANDONO){log(`A vez de ${NOMES_DA_FILA[vezDe]||vezDe} passou dos 10 minutos; dei por abandonada.`,'warn');vezDe=null}return vezDe};
  const tomarVez=id=>{vezDe=id;vezDesde=Date.now();drawFila()};
  function largarVez(id){if(vezDe!==id)return;vezDe=null;drawFila();andarAFila()}
  function andarAFila(){if(vezViva()||!filaDeEspera.length)return;const e=filaDeEspera.shift();tomarVez(e.id);e.ok(()=>largarVez(e.id))}
  /**
   * Pede a vez e espera por ela. Devolve a funcao de largar, ou `null` se desistiu.
   *
   * Desistir tem de existir: sem prazo, uma automacao que ficasse a' espera de outra presa nunca
   * mais devolveria o controlo, e o `finally` de quem a chamou nunca correria.
   */
  function pedirVez(id,{espera=300000}={}){
    return new Promise(ok=>{
      if(!vezViva()){tomarVez(id);return ok(()=>largarVez(id))}
      const e={id,ok,prazo:0};
      e.prazo=setTimeout(()=>{const i=filaDeEspera.indexOf(e);if(i>=0)filaDeEspera.splice(i,1);drawFila();log(`${NOMES_DA_FILA[id]||id}: esperei demais pela vez e desisti por agora.`,'warn');ok(null)},espera);
      filaDeEspera.push(e);drawFila();
    })}
  /** Ninguem com a vez e ninguem a' espera. E' o que a caçada pergunta antes de se mexer. */
  const vezLivre=()=>!vezViva()&&!filaDeEspera.length;
  function drawFila(){const e=$('[data-fila-state]');if(!e)return;
    const dono=vezViva();
    const espera=filaDeEspera.map(x=>NOMES_DA_FILA[x.id]||x.id);
    e.textContent=!dono?'Fila livre.':`Agora: ${NOMES_DA_FILA[dono]||dono}.${espera.length?` Esperando: ${espera.join(', ')}.`:''}`}
  function tick(){const d=screen();draw(d);drawReviver();drawDesafios();drawFila();partyTick(d);fatigueTick(d);paradaTick(d);if(cfg.pausado||running)return;running=true;try{reviverTick();potionTick(d);huntTick(d);codexTick();bagTick(d);statusTick(d);talTick(d);equipTick(d);lojaTick(d);diariaTick();missionsAutoTick();desafiosTick();forgeTick();shadowTick();if(Date.now()-lastRoutine>60000){routinesTick();lastRoutine=Date.now()}}catch(e){log(`Erro isolado: ${e.message}`,'error')}finally{running=false}}
  /**
   * Diz a hora que saiu hoje para cada desafio.
   *
   * Sem isto, uma faixa de duas horas seria uma caixa preta: o dono nao teria como saber se hoje
   * ainda vai acontecer ou se ja' passou da hora sorteada e algo falhou.
   */
  function drawDesafios(){
    for(const[sel,ligado,hora,feito] of [['[data-boss-sorteio]',cfg.bossAuto,horaDoChefe(),load(BOSS_DAY,'')===diaBrasilia()],['[data-tower-sorteio]',cfg.towerAuto,horaDaTorre(),load(TOWER_DAY,'')===diaBrasilia()]]){
      const e=$(sel);if(!e)continue;
      e.textContent=!ligado?'—':feito?`Hoje já foi (sorteio: ${hora}).`:`Hoje às ${hora}${horaPassou(hora)?' — já passou, vou na primeira chance':''}.`;
    }
  }
  function drawReviver(){const e=$('[data-reviver-state]');if(!e)return;const n=reviverUsos.filter(t=>Date.now()-t<3600000).length;e.textContent=!cfg.reviver?'Desligado':`Ligado · ${n} usado(s) na última hora`}
  function restart(){clearInterval(timer);tick();timer=setInterval(tick,Math.max(500,Number(cfg.intervalo)||1000))}
  panel.addEventListener('change',e=>{const eqp=e.target.dataset.eqpeso,eqx=e.target.dataset.eqexigir;if(eqp){cfg.equipPesos={...cfg.equipPesos,[eqp]:Math.max(0,Math.min(100,Number(e.target.value)||0))};persist();return}if(eqx){cfg.equipExigir={...cfg.equipExigir,[eqx]:e.target.checked};persist();return}const ca=e.target.dataset.codexAba;if(ca){cfg.codexAbas=e.target.checked?[...new Set([...cfg.codexAbas,ca])]:cfg.codexAbas.filter(x=>x!==ca);ultimoCodexAlvo='';lastCodex=0;persist();return}const mf=e.target.closest('[data-faixa-i]');if(mf){const k=mf.dataset.faixa,l=[...faixasDe(k)],i=Number(mf.dataset.faixaI);l[i]={...l[i],['faixaDe' in e.target.dataset?'de':'ate']:e.target.value};cfg[FAIXAS[k].campo]=l;persist();return}const lr=e.target.closest('[data-loja-i]');if(lr){const l=[...cfg.lojaItens],i=Number(lr.dataset.lojaI);l[i]='lojaNome' in e.target.dataset?{...l[i],nome:e.target.value}:{...l[i],alvo:Math.max(1,Number(e.target.value)||1)};cfg.lojaItens=l;persist();return}const row=e.target.closest('[data-tal-i]');if(row){const b=[...talBuild()],i=Number(row.dataset.talI),n=talArvore().find(x=>x.id===(e.target.dataset.talId!==undefined?e.target.value:b[i].id));b[i]=e.target.dataset.talId!==undefined?{id:e.target.value,alvo:n?.max||1}:{...b[i],alvo:Math.max(1,Number(e.target.value)||1)};setTalBuild(b);return}const peso=e.target.dataset.peso;if(peso){cfg.pesos={...cfg.pesos,[peso]:Math.max(0,Number(e.target.value)||0)};persist();return}const k=e.target.dataset.cfg;if(!k)return;cfg[k]=e.target.type==='checkbox'?e.target.checked:'str' in e.target.dataset?e.target.value:Number(e.target.value);if(k==='codex'&&cfg.codex)cfg.escada=false;if(k==='escada'&&cfg.escada)cfg.codex=false;persist()});
  panel.addEventListener('click',e=>{const tab=e.target.closest('[data-tab]')?.dataset.tab;if(tab){cfg.aba=tab;persist();return}if(e.target.closest('[data-min]')){cfg.minimizado=!cfg.minimizado;persist()}else if(e.target.closest('[data-close]')){cfg.aberto=false;persist()}else if(e.target.closest('[data-pause]')){cfg.pausado=!cfg.pausado;log(cfg.pausado?'Automações pausadas.':'Automações retomadas.');persist()}else if(e.target.closest('[data-city]'))returnCity('comando manual');else if(e.target.closest('[data-hunt-now]'))chooseHunt(true);else if(e.target.closest('[data-codex-now]'))codexObjetivo(true);else if(e.target.closest('[data-boss-now]'))chefeDiario(true);else if(e.target.closest('[data-tower-now]'))torre(true);else if(e.target.closest('[data-forge-now]'))forja(true);else if(e.target.closest('[data-shadow-now]'))sombras(true);else if(e.target.closest('[data-missions-now]'))missionsTick(true);else if(e.target.closest('[data-routines-now]'))routinesTick(true);else if(e.target.closest('[data-status-now]'))distribute(true);else if(e.target.closest('[data-build-load]'))distribute(true,true);else if(e.target.closest('[data-tal-load]'))talentos(true,true);else if(e.target.closest('[data-tal-now]'))talentos(true);else if(e.target.closest('[data-equip-now]'))equipar(true);else if(e.target.closest('[data-loja-now]'))comprar(true);else if(e.target.closest('[data-venda-now]'))comprar(true,true);else if(e.target.closest('[data-rota-rec]'))gravando?pararGravacao():gravar();else if(e.target.closest('[data-char-mark]')){marcandoChar=true;$('[data-rota-state]').textContent='Clique em cima do seu personagem no jogo.'}else if(e.target.closest('[data-rota-test]'))testarRota(Number(e.target.closest('[data-rota-i]').dataset.rotaI));else if(e.target.closest('[data-rota-del]')){const l=[...cfg.rotas];l.splice(Number(e.target.closest('[data-rota-i]').dataset.rotaI),1);cfg.rotas=l;persist()}else if(e.target.closest('[data-faixa-add]')){const k=e.target.closest('[data-faixa-add]').dataset.faixaAdd;cfg[FAIXAS[k].campo]=[...faixasDe(k),{de:'12:00',ate:'14:00'}];persist()}else if(e.target.closest('[data-faixa-del]')){const row=e.target.closest('[data-faixa-i]'),k=row.dataset.faixa,l=[...faixasDe(k)];l.splice(Number(row.dataset.faixaI),1);cfg[FAIXAS[k].campo]=l;persist()}else if(e.target.closest('[data-loja-add]')){cfg.lojaItens=[...cfg.lojaItens,{nome:cfg.lojaNomes[0]||'Poção Pequena',alvo:100}];persist()}else if(e.target.closest('[data-loja-del]')){const l=[...cfg.lojaItens];l.splice(Number(e.target.closest('[data-loja-i]').dataset.lojaI),1);cfg.lojaItens=l;persist()}else if(e.target.closest('[data-tal-add]')){const a=talArvore();if(!a.length){$('[data-tal-state]').textContent='Leia a árvore primeiro.';return}setTalBuild([...talBuild(),{id:a[0].id,alvo:a[0].max}])}else if(e.target.closest('[data-tal-up]')){const b=[...talBuild()],i=Number(e.target.closest('[data-tal-i]').dataset.talI);if(i>0){[b[i-1],b[i]]=[b[i],b[i-1]];setTalBuild(b)}}else if(e.target.closest('[data-tal-del]')){const b=[...talBuild()];b.splice(Number(e.target.closest('[data-tal-i]').dataset.talI),1);setTalBuild(b)}else if(e.target.closest('[data-export]'))exportar();else if(e.target.closest('[data-import]'))escolherArquivo();else if(e.target.closest('[data-reset]')&&confirm('Restaurar todas as configurações?')){cfg={...DEFAULTS};persist();log('Configuração restaurada.')}});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||norm(b.textContent)!=='resgatar'||!b.closest('[role="dialog"],.slModal,.slWin'))return;setTimeout(()=>conferirDiariaAberta(false),900);setTimeout(()=>conferirDiariaAberta(false),2500)},true);
  addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyQ'){e.preventDefault();cfg.aberto=panel.style.display==='none';persist()}});
  // Duas teclas em vez de uma que alterna, como nos outros pacotes: Alt+G desliga os gráficos (modo leve sem animações e sem cenário), Alt+H liga de novo.
  function aviso(t){const c=document.createElement('div');c.textContent=t;c.style.cssText='position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483647;background:#101722e0;color:#e8eef8;font:13px system-ui,sans-serif;padding:8px 14px;opacity:.88;border:1px solid #46556d;border-radius:8px;pointer-events:none';document.body.append(c);setTimeout(()=>c.remove(),1400)}
  addEventListener('keydown',e=>{if(!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||(e.code!=='KeyG'&&e.code!=='KeyH'))return;e.preventDefault();e.stopPropagation();const off=e.code==='KeyG';if(off)Object.assign(cfg,{leve:true,semAnimacoes:true,semCenario:true});else cfg.leve=false;persist();log(off?'Gráficos desligados (Alt+G).':'Gráficos ligados (Alt+H).');aviso(off?'Gráficos desligados (Alt+G)':'Gráficos ligados (Alt+H)')},true);
  const p=load(POS,null);if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){panel.style.left=`${p.x}px`;panel.style.top=`${p.y}px`;panel.style.right='auto'}
  if(p&&Number.isFinite(p.w)&&p.w>=250)panel.style.width=`${p.w}px`;
  if(p&&Number.isFinite(p.h)&&p.h>=120)tamanhoGuardado=p.h;
  aplicarAltura();
  /**
   * Guarda o tamanho quando o dono larga a alca, e nao a cada pixel arrastado.
   *
   * O `ResizeObserver` dispara dezenas de vezes num unico arrasto; gravar em todas encheria o
   * `localStorage` de escritas identicas. E **nao grava minimizado**: ali a altura e' a do cabecalho
   * sozinho, e guardá-la faria o painel reabrir como uma faixa vazia.
   */
  let gravarTamanho=0;
  new ResizeObserver(()=>{if(cfg.minimizado)return;clearTimeout(gravarTamanho);gravarTamanho=setTimeout(()=>{const r=panel.getBoundingClientRect();tamanhoGuardado=Math.round(r.height);save(POS,{...(load(POS,null)||{}),x:r.left,y:r.top,w:Math.round(r.width),h:tamanhoGuardado})},400)}).observe(panel);
  $('[data-drag]').addEventListener('pointerdown',e=>{if(!e.target.closest('button')){const r=panel.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top}}});addEventListener('pointermove',e=>{if(drag){panel.style.left=`${Math.max(0,Math.min(innerWidth-panel.offsetWidth,e.clientX-drag.x))}px`;panel.style.top=`${Math.max(0,Math.min(innerHeight-40,e.clientY-drag.y))}px`;panel.style.right='auto'}});addEventListener('pointerup',()=>{if(drag){drag=null;const r=panel.getBoundingClientRect();save(POS,{...(load(POS,null)||{}),x:r.left,y:r.top})}});addEventListener('pagehide',()=>clearInterval(timer));
  applyUI();drawLog();restart();log('Extensão pronta; automações de risco começam desligadas.');
  /**
   * Retoma a ida a' loja depois de um recarregamento que ela mesma pediu.
   *
   * O bilhete e' apagado **antes** de a segunda tentativa comecar, e nao depois: se ela rebentar a
   * meio, o bilhete ja' nao esta' la' para ser lido no arranque seguinte. Apagar no fim seria um
   * laco a espera de um erro.
   *
   * E espera o jogo ficar de pe': logo apos o `reload` nao ha' HUD nenhum, e sair a andar contra uma
   * tela em branco poe o personagem em qualquer sitio.
   */
  (function retomarLoja(){
    const bilhete=load(LOJA_F5,null);
    if(!bilhete?.pendente)return;
    save(LOJA_F5,{...bilhete,pendente:0});
    if(Date.now()-bilhete.pendente>300000){log('Havia um pedido de nova tentativa, mas velho demais; ignorei.','warn');return}
    log('Voltei do recarregamento; vou tentar a loja outra vez.');
    let voltas=0;
    const olhar=setInterval(()=>{
      if(cfg.pausado){clearInterval(olhar);log('Em pausa: não retomei a ida à loja.','warn');return}
      if(++voltas>90){clearInterval(olhar);log('O jogo não ficou pronto a tempo; desisti da segunda tentativa.','warn');return}
      if(!document.querySelector('.slHudCard'))return;
      clearInterval(olhar);
      setTimeout(()=>{if(!cfg.pausado)comprar()},3000);
    },1000);
  })();
})();
