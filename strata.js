/*!
 * Strata.viz — editor visual de aulas em camadas
 * https://github.com/fabiolimath/Strata.viz · Licença MIT · (c) 2026 Fabio Lima
 *
 * Um único documento HTML que se lê como texto corrido (modo leitura), se
 * apresenta passo a passo como num quadro (modo apresentação) e se edita no
 * próprio navegador (modo edição). Veja o README para as convenções do HTML.
 *
 * USO, no <head> da aula (antes de qualquer outro script que mexa no MathJax):
 *
 *   <link rel="stylesheet" href=".../strata.css">
 *   <script src=".../strata.js"></script>
 *
 * O strata.js:
 *   1. configura o MathJax (delimitadores \( \) e \[ \], macros padrão e
 *      \mk{nome}{termo} das marcações), juntando com um window.MathJax que a
 *      página já tenha definido antes;
 *   2. define, antes da primeira fórmula, as macros LaTeX escritas na própria
 *      página em <script type="text/x-tex-macros"> ... </script> (ou no antigo
 *      <script type="text/plain" id="fol-mathjax">);
 *   3. quando a página termina de carregar, põe a interface (ícones dos modos,
 *      barra de edição, painéis), carrega o MathJax (se a página não o
 *      carregou) e liga o editor.
 *
 * Ao salvar, sai só o conteúdo: tudo o que tiver o atributo data-strata-temp
 * (a interface, o MathJax, figuras geradas por outros motores) é retirado, e
 * os elementos com data-strata-limpar são esvaziados (gráficos desenhados por
 * script).
 *
 * Compatibilidade: funções novas devem manter funcionando os arquivos já
 * salvos. O que muda no HTML salvo é anotado no CHANGELOG.md.
 */
(function () {
  if (window.Strata) return;   // carregado duas vezes
  const Strata = window.Strata = { versao: '0.1.0' };
  const script = document.currentScript;
  Strata.base = (script && script.src || '').replace(/[^\/?#]*([?#].*)?$/, '');
  Strata.mathjax = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';

  // ---------- tema (claro/escuro): preferência de quem lê, guardada no navegador ----------
  Strata.temaEscuro = () => document.documentElement.classList.contains('strata-escuro');
  // sem escolha guardada, segue o sistema (ou data-theme="light|dark" no <html>, dos arquivos antigos)
  (() => {
    let t = null; try { t = localStorage.getItem('strata-tema'); } catch (e) {}
    const h = document.documentElement, dt = h.getAttribute('data-theme');
    const escuro = t ? t === 'escuro' : dt ? dt === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    h.classList.toggle('strata-escuro', escuro);
  })();

  // ---------- folha de estilos (se a página não a pôs) ----------
  if (Strata.base && !document.querySelector('link[rel="stylesheet"][href*="strata.css"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = Strata.base + 'strata.css'; l.setAttribute('data-strata-temp', '');
    document.head.appendChild(l);
  }

  // ---------- 1. configuração do MathJax ----------
  const MACROS = {
    red:  ['\\textcolor{red}{#1}', 1],
    blue: ['\\textcolor{blue}{#1}', 1],
    Imp:  '\\quad\\Rightarrow\\quad',
    ee:   '\\operatorname{e}',
    mk:   ['\\class{mk-#1}{#2}', 2],      // rótulo das marcações (não muda a aparência)
    mt:   ['\\text{#1}', 1],
    sen:  '\\operatorname{sen}',
    tg:   '\\operatorname{tg}'
  };
  // 2. macros escritas na página, definidas antes da primeira fórmula
  function macrosDaPagina() {
    const blocos = document.querySelectorAll('script[type="text/x-tex-macros"], script#fol-mathjax');
    let p = Promise.resolve();
    blocos.forEach(b => {
      p = p.then(() => MathJax.tex2svgPromise(b.textContent, { display: false })).then(n => {
        const e = n && n.querySelector('[data-mjx-error]');
        if (e) console.warn('[strata] erro nas macros da página:', e.getAttribute('data-mjx-error'));
      }).catch(e => console.warn('[strata] macros da página não carregadas:', e));
    });
    return p;
  }
  const cfg = window.MathJax;
  if (!(cfg && cfg.version)) {             // ainda não carregado: só configuração
    const c = window.MathJax = cfg && typeof cfg === 'object' ? cfg : {};
    c.tex = c.tex || {};
    c.tex.inlineMath = c.tex.inlineMath || [['\\(', '\\)']];
    c.tex.displayMath = c.tex.displayMath || [['\\[', '\\]']];
    c.tex.macros = Object.assign({}, MACROS, c.tex.macros || {});
    c.svg = Object.assign({ fontCache: 'local' }, c.svg || {});
    c.startup = c.startup || {};
    c.startup.typeset = false;             // o Strata guarda o LaTeX e depois tipografa
    const pageReadyPagina = c.startup.pageReady;
    c.startup.pageReady = () => macrosDaPagina().then(() => pageReadyPagina ? pageReadyPagina() : MathJax.startup.defaultPageReady());
  }

  // ---------- 3. interface ----------
  const UI_ANTES = String.raw`
<button id="b-sumario" type="button" title="Mostrar/ocultar o sumário">☰ Sumário</button>
<nav id="sumario" aria-label="Sumário"><div class="sum-titulo">Sumário</div><ol id="sum-lista"></ol></nav>
<div id="modos">
  <span id="aviso"></span>
  <button type="button" id="b-salvar" title="Salvar (Ctrl+S): há alterações não salvas" aria-label="Salvar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M8 3v5h7V3"></path><rect x="7" y="13" width="10" height="6" rx="1"></rect></svg></button>
  <button type="button" id="b-novo" title="Novo documento: abre, numa nova aba, uma página em branco com o mesmo editor" aria-label="Novo documento"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h8l5 5v6"></path><path d="M13 3v5h5"></path><path d="M5 3v18h8"></path><path d="M18 16v6M15 19h6"></path></svg></button>
  <button type="button" id="b-tema" title="Tema claro (clique para o escuro; só nesta tela, o arquivo não muda)" aria-label="Tema claro ou escuro"><svg class="lua" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path></svg><svg class="sol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"></path></svg></button>
  <span class="menu-strata"><button type="button" id="b-menu" title="Menu" aria-label="Menu" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h16"></path></svg></button>
    <span id="menu-strata" role="menu" hidden><button type="button" role="menuitem" id="mi-macros" class="so-edicao"><span class="mi-check" aria-hidden="true"></span>Adicionar macros LaTeX…</button><button type="button" role="menuitemcheckbox" id="mi-enter-camada" class="so-edicao" aria-checked="false" title="Na edição, cada Enter no texto começa uma camada nova (preferência desta tela; o arquivo não muda)"><span class="mi-check" aria-hidden="true"></span>Enter cria camada</button><button type="button" role="menuitem" id="mi-offline" title="Baixa este documento num arquivo só, com o Strata e o MathJax dentro, que abre sem internet"><span class="mi-check" aria-hidden="true"></span>Salvar para usar offline</button><button type="button" role="menuitem" id="mi-pdf" title="Abre a impressão com as páginas no tamanho certo; escolha &quot;Salvar como PDF&quot;"><span class="mi-check" aria-hidden="true"></span>Exportar PDF…</button><a role="menuitem" href="https://fabiolimath.github.io/Strata.viz/" target="_blank" rel="noopener"><span class="mi-check" aria-hidden="true"></span>Sobre o Strata.viz</a></span></span>
  <span id="modos-v">
  <button type="button" id="m-leitura" data-modo="leitura" title="Modo leitura" aria-label="Modo leitura"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5C5.5 4.3 8.5 4.3 12 6c3.5-1.7 6.5-1.7 9-.5V19c-2.5-1.2-5.5-1.2-9 .5-3.5-1.7-6.5-1.7-9-.5z"></path><path d="M12 6v13.5"></path></svg></button>
  <button type="button" id="m-aula" data-modo="aula" title="Modo apresentação (camadas). Clique de novo para voltar ao modo anterior" aria-label="Modo apresentação"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5"></rect><path d="M12 16v3M8 21l4-2 4 2"></path><path d="M10 7.8v4.4l3.8-2.2z"></path></svg></button>
  <button type="button" id="m-edicao" data-modo="edicao" title="Modo edição. Clique de novo para voltar ao modo anterior (Ctrl+\)" aria-label="Modo edição"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path></svg></button>
  </span>
</div>
<div id="barra">
  <span class="combo" id="c-estilo"><button type="button" id="b-estilo" class="b-icone" title="Estilo do parágrafo: Parágrafo" aria-label="Estilo do parágrafo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4v16M17 4v16M19.5 4H10.5a4.5 4.5 0 0 0 0 9H13"/></svg></button><button type="button" class="combo-seta" title="Estilo do parágrafo: escolher" aria-label="Estilo do parágrafo: escolher">▾</button>
    <span class="combo-menu" hidden=""><button type="button" data-estilo="p" style="font: 15px system-ui, sans-serif"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4v16M17 4v16M19.5 4H10.5a4.5 4.5 0 0 0 0 9H13"/></svg></span>Parágrafo</button><button type="button" data-estilo="h1" style="font: bold 25px system-ui, sans-serif"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="2" y="17" font-size="15" font-weight="700" font-family="system-ui, sans-serif">H</text><text x="14.5" y="19.5" font-size="10" font-weight="700" font-family="system-ui, sans-serif">1</text></svg></span>Título 1</button><button type="button" data-estilo="subtitulo" style="font: 17px system-ui, sans-serif"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16" stroke-width="3"/><path d="M7 15h10M9 19h6"/></svg></span>Subtítulo</button><button type="button" data-estilo="h2" style="font: bold 23px system-ui, sans-serif"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="2" y="17" font-size="15" font-weight="700" font-family="system-ui, sans-serif">H</text><text x="14.5" y="19.5" font-size="10" font-weight="700" font-family="system-ui, sans-serif">2</text></svg></span>Título 2</button><button type="button" data-estilo="h3" style="font: bold 21px system-ui, sans-serif"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="2" y="17" font-size="15" font-weight="700" font-family="system-ui, sans-serif">H</text><text x="14.5" y="19.5" font-size="10" font-weight="700" font-family="system-ui, sans-serif">3</text></svg></span>Título 3</button><button type="button" data-estilo="h4" style="font: bold 18px system-ui, sans-serif"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="2" y="17" font-size="15" font-weight="700" font-family="system-ui, sans-serif">H</text><text x="14.5" y="19.5" font-size="10" font-weight="700" font-family="system-ui, sans-serif">4</text></svg></span>Título 4</button><button type="button" data-estilo="eq" style="font: 15px system-ui, sans-serif" title="Linha de equação: fórmulas sem recuo; alinhada à esquerda vira linha de igualdades (Enter no fim cria a próxima linha)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="5" y="18.5" font-family="Times New Roman, serif" font-style="italic" font-weight="bold" font-size="17">x</text><text x="14" y="10.5" font-family="Times New Roman, serif" font-weight="bold" font-size="10">2</text></svg></span>Equação</button><button type="button" data-estilo="pre" style="font: 14px ui-monospace, Consolas, monospace"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 5l-3 14"/></svg></span>Pré-formatado</button><button type="button" data-estilo="blockquote" style="font: 15px system-ui, sans-serif; color: #666"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 7c-3.2.6-5 2.8-5 6v4h5v-5H7.2c.2-1.6 1.2-2.7 2.8-3.1zM19 7c-3.2.6-5 2.8-5 6v4h5v-5h-2.8c.2-1.6 1.2-2.7 2.8-3.1z" fill="currentColor" stroke="none"/></svg></span>Bloco de citação</button></span></span>
  <span class="combo grupo" id="c-num"><button type="button" id="b-num" class="b-icone" title="Numerados: capítulo, seção, subseção, definição, teorema, exemplo, observação" aria-label="Numerados"></button><button type="button" class="combo-seta" title="Numerados: escolher" aria-label="Numerados: escolher">▾</button>
    <span class="combo-menu" hidden=""><button type="button" id="bn-capitulo" data-numerado="capitulo" title="Capítulo numerado (1, 2, ...): o parágrafo do cursor vira o título"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" font-family="system-ui, sans-serif" fill="currentColor" stroke="none">C1</text></svg></span>Capítulo</button><button type="button" id="bn-secao" data-numerado="secao" title="Seção numerada (1, 2, ... ou 2.1 com capítulos): o parágrafo do cursor vira o título"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" font-family="system-ui, sans-serif" fill="currentColor" stroke="none">1.1</text></svg></span>Seção</button><button type="button" id="bn-subsecao" data-numerado="subsecao" title="Subseção numerada (1.1, 1.2, ...): o parágrafo do cursor vira o título"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="9.5" font-weight="700" font-family="system-ui, sans-serif" fill="currentColor" stroke="none">1.1.1</text></svg></span>Subseção</button><button type="button" id="bn-definicao" data-numerado="definicao" title="Definição numerada, em caixa, em volta dos parágrafos selecionados; nome opcional"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5" stroke="#1b8a3a"/><path d="M6 8.5h5" stroke="#1b8a3a" stroke-width="2.4"/><path d="M6 12.5h12M6 16h9"/></svg></span>Definição</button><button type="button" id="bn-teorema" data-numerado="teorema" title="Teorema numerada, em caixa, em volta dos parágrafos selecionados; nome opcional"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5" stroke="#3333cc"/><path d="M6 8.5h5" stroke="#3333cc" stroke-width="2.4"/><path d="M6 12.5h12M6 16h9"/></svg></span>Teorema</button><button type="button" id="bn-exemplo" data-numerado="exemplo" title="Exemplo numerada, em caixa, em volta dos parágrafos selecionados; nome opcional"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5" stroke="#ff8000"/><path d="M6 8.5h5" stroke="#ff8000" stroke-width="2.4"/><path d="M6 12.5h12M6 16h9"/></svg></span>Exemplo</button><button type="button" id="bn-observacao" data-numerado="observacao" title="Observação numerada, em caixa, em volta dos parágrafos selecionados; nome opcional"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5" stroke="#777"/><path d="M6 8.5h5" stroke="#777" stroke-width="2.4"/><path d="M6 12.5h12M6 16h9"/></svg></span>Observação</button></span></span>
  <span class="combo grupo" id="c-fmt"><button type="button" id="b-fmt" class="b-icone" title="Formatação do texto" aria-label="Formatação do texto"></button><button type="button" class="combo-seta" title="Formatação do texto: escolher" aria-label="Formatação do texto: escolher">▾</button>
    <span class="combo-menu" hidden=""><button type="button" id="b-negrito" title="Negrito (Ctrl+B)" aria-label="Negrito"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" font-size="17" font-family="Times New Roman, serif" font-weight="bold">B</text></svg></span>Negrito (Ctrl+B)</button><button type="button" id="b-italico" title="Itálico (Ctrl+I)" aria-label="Itálico"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" font-size="17" font-family="Times New Roman, serif" font-style="italic">I</text></svg></span>Itálico (Ctrl+I)</button><button type="button" id="b-limpar" title="Remover formatação (negrito, itálico, cor do texto)" aria-label="Remover formatação"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h11M11.5 5L9 18"/><path d="M14.5 14.5l5 5M19.5 14.5l-5 5"/></svg></span>Remover formatação</button></span></span>
  <span class="combo" id="c-cor"><button type="button" id="b-cor" class="b-icone" title="Cor do texto: preto (clique de novo na mesma cor para remover)" aria-label="Cor do texto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 16L12 4l5 12M8.8 12h6.4"></path><rect class="barra-cor" x="4" y="18.5" width="16" height="3.5" rx="1" stroke="none"></rect></svg></button><button type="button" class="combo-seta" title="Escolher a cor" aria-label="Escolher a cor">▾</button>
    <span class="combo-menu" hidden=""><button type="button" class="b-cor" data-cor="cor-preto" style="--c: #111111" title="Preto">Preto</button><button type="button" class="b-cor" data-cor="cor-azul" style="--c: #3333cc" title="Azul">Azul</button><button type="button" class="b-cor" data-cor="rotulo" style="--c: #ff8000" title="Laranja">Laranja</button><button type="button" class="b-cor" data-cor="cor-vermelho" style="--c: #d01c1c" title="Vermelho">Vermelho</button><button type="button" class="b-cor" data-cor="cor-verde" style="--c: #1b8a3a" title="Verde">Verde</button><button type="button" class="b-cor" data-cor="cor-roxo" style="--c: #8e24aa" title="Roxo">Roxo</button></span></span>
  <button type="button" id="b-link" class="b-icone" title="Inserir ou editar link (Ctrl+K)" aria-label="Link"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></button>
  <span class="combo grupo" id="c-midia"><button type="button" id="b-midia" class="b-icone" title="Imagem, vídeo e símbolos" aria-label="Imagem, vídeo e símbolos"></button><button type="button" class="combo-seta" title="Imagem, vídeo e símbolos: escolher" aria-label="Imagem, vídeo e símbolos: escolher">▾</button>
    <span class="combo-menu" hidden=""><button type="button" id="b-imagem" title="Inserir imagem: colar, arrastar, arquivo ou link"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg></span>Imagem</button><button type="button" id="b-video" title="Inserir vídeo ou conteúdo embutido (YouTube, Vimeo, GeoGebra, código de incorporação)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.8-2.8z"/></svg></span>Vídeo</button><button type="button" id="b-simbolos" title="Símbolos e caracteres especiais"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="18" text-anchor="middle" font-size="16" font-family="Times New Roman, serif" fill="currentColor" stroke="none">Ω</text></svg></span>Símbolos</button></span></span>
  <span class="combo" id="c-tabela"><button type="button" id="b-tabela" class="b-icone" title="Inserir tabela" aria-label="Inserir tabela"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/></svg></button><button type="button" class="combo-seta" title="Tabela: linhas, colunas, mesclar" aria-label="Tabela: linhas, colunas, mesclar">▾</button>
    <span class="combo-menu" hidden=""><button type="button" data-tab="sel-linha" title="Selecionar a linha inteira (ou as linhas da seleção)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><rect x="3" y="9.5" width="18" height="5" fill="#3366ff" stroke="none" opacity=".45"/><path d="M3 9.5h18M3 14.5h18M9 4v16M15 4v16"/></svg></span>Selecionar linha</button><button type="button" data-tab="sel-col" title="Selecionar a coluna inteira (ou as colunas da seleção)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><rect x="9" y="4" width="6" height="16" fill="#3366ff" stroke="none" opacity=".45"/><path d="M3 9.5h18M3 14.5h18M9 4v16M15 4v16"/></svg></span>Selecionar coluna</button><button type="button" data-tab="linha-acima" title="Inserir linha acima"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="9" rx="1"/><path d="M3 15.5h18M9 11v9M15 11v9M12 2.5v6M9 5.5h6"/></svg></span>Inserir linha acima</button><button type="button" data-tab="linha-abaixo" title="Inserir linha abaixo"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="9" rx="1"/><path d="M3 8.5h18M9 4v9M15 4v9M12 15.5v6M9 18.5h6"/></svg></span>Inserir linha abaixo</button><button type="button" data-tab="col-esq" title="Inserir coluna à esquerda"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="11" y="3" width="9" height="18" rx="1"/><path d="M15.5 3v18M11 9h9M11 15h9M2.5 12h6M5.5 9v6"/></svg></span>Inserir coluna à esquerda</button><button type="button" data-tab="col-dir" title="Inserir coluna à direita"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="9" height="18" rx="1"/><path d="M8.5 3v18M4 9h9M4 15h9M15.5 12h6M18.5 9v6"/></svg></span>Inserir coluna à direita</button><button type="button" data-tab="del-linha" title="Excluir linha"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="8" rx="1"/><path d="M9 8v8M15 8v8"/><path d="M8 3l8 18" stroke="#d01c1c"/></svg></span>Excluir linha</button><button type="button" data-tab="del-col" title="Excluir coluna"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="18" rx="1"/><path d="M8 9h8M8 15h8"/><path d="M3 8l18 8" stroke="#d01c1c"/></svg></span>Excluir coluna</button><button type="button" data-tab="mesclar" title="Mesclar células (selecione duas ou mais)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 12h10M14 9l3 3-3 3M10 9l-3 3 3 3"/></svg></span>Mesclar células</button><button type="button" data-tab="separar" title="Separar célula mesclada"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M4.5 12h5M7 9.5L9.5 12 7 14.5M19.5 12h-5M17 9.5L14.5 12l2.5 2.5"/></svg></span>Separar célula mesclada</button><button type="button" data-tab="cabecalho" title="1ª linha como cabeçalho (liga/desliga)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><rect x="3" y="4" width="18" height="5" fill="#ff8000" stroke="none" opacity=".7"/><path d="M3 9h18M3 14.5h18M12 4v16"/></svg></span>1ª linha como cabeçalho</button><span class="tab-cores" title="Posição da tabela na página"><span class="tab-cores-rot">Tabela na página</span><button type="button" class="pt-pos" data-tab="tab-pos" data-pos="esq" title="À esquerda" aria-label="À esquerda"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4v16"/><rect x="5" y="7" width="10" height="10" rx="1"/><path d="M5 12h10M10 7v10"/></svg></button><button type="button" class="pt-pos" data-tab="tab-pos" data-pos="centro" title="Centralizada" aria-label="Centralizada"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4v16M21 4v16" stroke-dasharray="2 2"/><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M7 12h10M12 7v10"/></svg></button><button type="button" class="pt-pos" data-tab="tab-pos" data-pos="dir" title="À direita" aria-label="À direita"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4v16"/><rect x="9" y="7" width="10" height="10" rx="1"/><path d="M9 12h10M14 7v10"/></svg></button></span><span class="tab-cores" title="Cor do texto do cabeçalho"><span class="tab-cores-rot">Cor do cabeçalho</span><button type="button" class="pt-cor" data-tab="cab-cor" data-cab-cor="" style="--c: #ff8000" title="Laranja (padrão)" aria-label="Laranja (padrão)"></button><button type="button" class="pt-cor" data-tab="cab-cor" data-cab-cor="cor-preto" style="--c: #111111" title="Preto" aria-label="Preto"></button><button type="button" class="pt-cor" data-tab="cab-cor" data-cab-cor="cor-azul" style="--c: #3333cc" title="Azul" aria-label="Azul"></button><button type="button" class="pt-cor" data-tab="cab-cor" data-cab-cor="cor-vermelho" style="--c: #d01c1c" title="Vermelho" aria-label="Vermelho"></button><button type="button" class="pt-cor" data-tab="cab-cor" data-cab-cor="cor-verde" style="--c: #1b8a3a" title="Verde" aria-label="Verde"></button><button type="button" class="pt-cor" data-tab="cab-cor" data-cab-cor="cor-roxo" style="--c: #8e24aa" title="Roxo" aria-label="Roxo"></button></span><button type="button" data-tab="del-tabela" title="Excluir tabela"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/><path d="M4 21L20 3" stroke="#d01c1c"/></svg></span>Excluir tabela</button></span></span>
  <span class="sep"></span>
  <span class="combo grupo" id="c-alinha"><button type="button" id="b-alinha" class="b-icone" title="Alinhamento" aria-label="Alinhamento"></button><button type="button" class="combo-seta" title="Alinhamento: escolher" aria-label="Alinhamento: escolher">▾</button>
    <span class="combo-menu" hidden=""><button type="button" id="b-al-esq" data-alinha="alinha-esq" title="Alinhar à esquerda" aria-label="Alinhar à esquerda"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg></span>À esquerda</button><button type="button" id="b-al-centro" data-alinha="alinha-centro" title="Centralizar" aria-label="Centralizar"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg></span>Centralizado</button><button type="button" id="b-al-dir" data-alinha="alinha-dir" title="Alinhar à direita" aria-label="Alinhar à direita"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg></span>À direita</button><button type="button" id="b-al-just" data-alinha="alinha-just" title="Justificado (com hifenização automática)" aria-label="Justificado"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h16M4 18h10"/></svg></span>Justificado</button><button type="button" id="b-colunas" title="Duas colunas: os blocos selecionados (ou o atual) ficam em duas colunas. Clique de novo para voltar a uma." aria-label="Duas colunas"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h7.5M3 10h7.5M3 14h7.5M3 18h5M13.5 6H21M13.5 10H21M13.5 14H21M13.5 18h5"/></svg></span>Duas colunas</button><button type="button" id="b-nota" title="Nota lateral vermelha (*:) ao lado do parágrafo atual" aria-label="Nota lateral"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3.5" width="12" height="17" rx="1"></rect><path d="M5.5 8h6M5.5 11.5h6M5.5 15h4"></path><path d="M19.5 6.5v6M16.9 8l5.2 3M22.1 8l-5.2 3" stroke="#d01c1c"></path></svg></span>Nota lateral</button><button type="button" id="b-nota-rodape" title="Nota de rodapé: número no ponto do cursor e o texto no pé da página" aria-label="Nota de rodapé"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="2.5" width="15" height="19" rx="1"/><path d="M7.5 6.5h9M7.5 10h9"/><path d="M7.5 17.5h7" stroke-width="1.3"/><path d="M7.5 15h9" stroke-dasharray="2 1.5" stroke-width="1"/><text x="15.5" y="9" font-size="6" fill="#d01c1c" stroke="none">1</text></svg></span>Nota de rodapé</button><button type="button" id="b-qed" title="Quod erat demonstrandum (Q.E.D.): ◼ laranja à direita, no fim do bloco atual, numa camada própria. Clique de novo no mesmo bloco para tirar." aria-label="Quod erat demonstrandum (Q.E.D.)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11M3 12h11M3 17h8"/><rect x="15" y="13" width="6" height="6" fill="#ff8000" stroke="none"/></svg></span>Quod erat demonstrandum (Q.E.D.)</button></span></span>
  <span class="combo grupo" id="c-lista"><button type="button" id="b-listas" class="b-icone" title="Listas" aria-label="Listas"></button><button type="button" class="combo-seta" title="Listas: escolher" aria-label="Listas: escolher">▾</button>
    <span class="combo-menu" hidden=""><button type="button" id="b-lista" title="Lista com marcadores" aria-label="Lista com marcadores"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none"/><path d="M9 6h11M9 12h11M9 18h11"/></svg></span>Com marcadores</button><button type="button" id="b-lista-num" title="Lista numerada" aria-label="Lista numerada"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="2" y="8.5" font-size="7.5">1</text><text x="2" y="14.5" font-size="7.5">2</text><text x="2" y="20.5" font-size="7.5">3</text><path d="M9 6h11M9 12h11M9 18h11"/></svg></span>Numerada</button><button type="button" id="b-lista-rom" title="Lista com romanos: i), ii), iii)" aria-label="Lista com romanos"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="1" y="8.5" font-size="6.5" font-family="Times New Roman, serif" font-style="italic">i)</text><text x="1" y="14.5" font-size="6.5" font-family="Times New Roman, serif" font-style="italic">ii)</text><text x="1" y="20.5" font-size="6.5" font-family="Times New Roman, serif" font-style="italic">iii)</text><path d="M10 6h10M10 12h10M10 18h10"/></svg></span>Romanos: i), ii), iii)</button><button type="button" id="b-lista-alfa" title="Lista com letras: a), b), c)" aria-label="Lista com letras"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="1" y="8.5" font-size="6.5" font-family="Times New Roman, serif" font-style="italic">a)</text><text x="1" y="14.5" font-size="6.5" font-family="Times New Roman, serif" font-style="italic">b)</text><text x="1" y="20.5" font-size="6.5" font-family="Times New Roman, serif" font-style="italic">c)</text><path d="M10 6h10M10 12h10M10 18h10"/></svg></span>Letras: a), b), c)</button></span></span>
  <button type="button" id="b-menos-recuo" class="b-icone" title="Diminuir recuo (no parágrafo sem recuo, tira o recuo da primeira linha)" aria-label="Diminuir recuo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6h9M11 10h9M11 14h9M4 18h16"/><path d="M7.5 8.5L4.5 11.5l3 3"/></svg></button>
  <button type="button" id="b-mais-recuo" class="b-icone" title="Aumentar recuo (no parágrafo sem recuo da primeira linha, devolve esse recuo primeiro)" aria-label="Aumentar recuo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 6h9M11 10h9M11 14h9M4 18h16"/><path d="M4.5 8.5l3 3-3 3"/></svg></button>
  <button type="button" id="b-busca" class="b-icone" title="Localizar e substituir (Ctrl+H), também no LaTeX das fórmulas" aria-label="Localizar e substituir"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20"/></svg></button>
  <span class="sep"></span>
  <button type="button" id="b-camada" class="b-icone" title="Insere camada de conteúdo. A camada começa no ponto do cursor (no início ou no meio da linha). Com o cursor logo depois de uma âncora de camada, junta essa camada à anterior. (Alt+C)" aria-label="Camada"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"></path><path d="M3 13l9 5 9-5"></path></svg></button>
  <span class="combo" id="c-marcar"><button type="button" id="b-marcar" class="b-icone com-emblema" title="Insere camada de marcação. Marca termos já escritos (destaque, risco, círculo, seta...); a marcação aparece, no modo apresentação, no ponto do cursor. O botão abre com o último tipo e cor usados." aria-label="Marcar"></button><button type="button" class="combo-seta" title="Escolher o tipo de marcação" aria-label="Escolher o tipo de marcação">▾</button>
    <span class="combo-menu" hidden=""><button type="button" data-tipo="destaque" title="Destaque (marca-texto)"><span class="ci"></span>Destaque (marca-texto)</button><button type="button" data-tipo="risca" title="Risco"><span class="ci"></span>Risco</button><button type="button" data-tipo="circula" title="Círculo"><span class="ci"></span>Círculo</button><button type="button" data-tipo="caixa" title="Retângulo"><span class="ci"></span>Retângulo</button><button type="button" data-tipo="seta" title="Seta apontando para cada termo"><span class="ci"></span>Seta apontando para cada termo</button><button type="button" data-tipo="liga" title="Seta ligando o 1º termo ao 2º"><span class="ci"></span>Seta ligando o 1º termo ao 2º</button><button type="button" data-tipo="check" title="Visto (✓)"><span class="ci"></span>Visto (✓)</button><button type="button" data-tipo="texto" title="Texto à direita do termo"><span class="ci"></span>Texto</button></span></span>
  <span class="combo" id="c-desenho"><button type="button" id="b-desenho" class="b-icone com-emblema" title="Insere camada de desenho: caneta, marca-texto, linha, seta, retângulo e elipse, livres na página. O desenho aparece, no modo apresentação, no ponto do cursor, e acompanha o parágrafo em que está a âncora. O botão abre com a última ferramenta e cor usadas." aria-label="Desenhar"></button><button type="button" class="combo-seta" title="Escolher a ferramenta de desenho" aria-label="Escolher a ferramenta de desenho">▾</button>
    <span class="combo-menu" hidden=""><button type="button" data-ferr="livre"><span class="ci"></span>Caneta</button><button type="button" data-ferr="marca"><span class="ci"></span>Marca-texto</button><button type="button" data-ferr="linha"><span class="ci"></span>Linha</button><button type="button" data-ferr="seta"><span class="ci"></span>Seta</button><button type="button" data-ferr="ret"><span class="ci"></span>Retângulo</button><button type="button" data-ferr="elipse"><span class="ci"></span>Elipse</button></span></span>
  <button type="button" id="b-olho" class="b-icone" title="Mostra ou recolhe as âncoras. Recolhidas, cada âncora vira uma linha vertical, na cor dela, no ponto em que está; passe o mouse sobre a linha para ver o ícone. (Ctrl+Q)" aria-label="Mostrar ou recolher âncoras"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="olho-aberto" d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle class="olho-aberto" cx="12" cy="12" r="3"/><path class="olho-fechado" d="M2.5 10.5s3.5 4.5 9.5 4.5 9.5-4.5 9.5-4.5M5.2 13.4l-1.7 2.3M9.2 14.8l-.7 2.7M14.8 14.8l.7 2.7M18.8 13.4l1.7 2.3"/></svg></button>
  <span class="sep"></span>
  <span class="combo grupo" id="c-eq"><button type="button" id="b-eqs" class="b-icone" title="Equações" aria-label="Equações"></button><button type="button" class="combo-seta" title="Equações: escolher" aria-label="Equações: escolher">▾</button>
    <span class="combo-menu" hidden=""><button type="button" id="b-inline" title="Fórmula no meio do texto, na posição do cursor (Alt+X)"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="5" y="18.5" font-family="Times New Roman, serif" font-style="italic" font-weight="bold" font-size="17">x</text><text x="14" y="10.5" font-family="Times New Roman, serif" font-weight="bold" font-size="10">2</text></svg></span>Equação em linha (Alt+X)</button><button type="button" id="b-display" title="Equação destacada (centralizada), abaixo do parágrafo atual"><span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h20M2 21.5h20" stroke-width="1.3"/><g transform="translate(2.2 1.6) scale(.8)"><text x="6" y="18.5" font-family="Times New Roman, serif" font-style="italic" font-weight="bold" font-size="17">x</text><text x="15" y="10.5" font-family="Times New Roman, serif" font-weight="bold" font-size="10">2</text></g></svg></span>Equação destacada</button></span></span>
  <span class="sep"></span>
  <button type="button" id="b-pagina" class="b-icone" title="Nova página, depois da página atual" aria-label="Nova página"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v4h4"></path><path d="M12 11v6M9 14h6"></path></svg></button>
</div>
<div id="painel-link" class="painel-mini" hidden="">
  <div class="linha"><span class="rot">Link</span><input type="url" id="pl-url" placeholder="https://..." spellcheck="false"></div>
  <div class="linha"><span class="rot">Ou ir para</span><select id="pl-destino"><option value="">(um ponto deste documento)</option></select></div>
  <div class="linha" style="justify-content:flex-end"><button type="button" id="pl-remover">Remover link</button><button type="button" id="pl-cancelar">Cancelar</button><button type="button" id="pl-ok" style="background:#2a6;color:#fff;border-color:#2a6">OK</button></div>
</div>
<div id="painel-imagem" class="painel-mini" hidden="" role="dialog" aria-label="Inserir imagem">
  <div class="linha"><b>Inserir imagem</b></div>
  <div id="pi-zona" tabindex="0" title="Clique aqui e cole (Ctrl+V)"><div>Cole aqui (Ctrl+V) ou arraste uma imagem</div><button type="button" id="pi-arquivo-b">Escolher arquivo…</button><input type="file" id="pi-arquivo" accept="image/*" hidden=""></div>
  <div class="linha"><span class="rot">Link</span><input type="url" id="pi-url" placeholder="https://.../figura.png" spellcheck="false"><button type="button" id="pi-ok">Inserir</button></div>
  <div id="pi-erro"></div>
  <div class="pmc-dica">Dica: no modo edição também dá para colar ou arrastar a imagem direto no texto.</div>
  <div class="linha" style="justify-content:flex-end"><button type="button" id="pi-cancelar">Cancelar</button></div>
</div>
<div id="painel-tabela" class="painel-mini" hidden="" role="dialog" aria-label="Inserir tabela">
  <div class="linha"><b>Inserir tabela</b></div>
  <div class="linha"><span class="rot">Linhas</span><input type="number" id="pt-linhas" min="1" max="60" value="3"><span class="rot" style="width:auto;margin-left:10px">Colunas</span><input type="number" id="pt-colunas" min="1" max="20" value="3"></div>
  <div class="linha"><label><input type="checkbox" id="pt-cab" checked=""> 1ª linha como cabeçalho</label></div>
  <div class="linha" id="pt-cores"><span class="rot">Cabeçalho</span><button type="button" class="pt-cor" data-cab-cor="" style="--c: #ff8000" title="Laranja (padrão)" aria-label="Laranja (padrão)"></button><button type="button" class="pt-cor" data-cab-cor="cor-preto" style="--c: #111111" title="Preto" aria-label="Preto"></button><button type="button" class="pt-cor" data-cab-cor="cor-azul" style="--c: #3333cc" title="Azul" aria-label="Azul"></button><button type="button" class="pt-cor" data-cab-cor="cor-vermelho" style="--c: #d01c1c" title="Vermelho" aria-label="Vermelho"></button><button type="button" class="pt-cor" data-cab-cor="cor-verde" style="--c: #1b8a3a" title="Verde" aria-label="Verde"></button><button type="button" class="pt-cor" data-cab-cor="cor-roxo" style="--c: #8e24aa" title="Roxo" aria-label="Roxo"></button></div>
  <div class="linha" style="justify-content:flex-end"><button type="button" id="pt-cancelar">Cancelar</button><button type="button" id="pt-ok" style="background:#2a6;color:#fff;border-color:#2a6">Inserir</button></div>
</div>
<div id="aviso-rascunho" hidden="" role="alert"><span id="ar-texto"></span><button type="button" id="ar-recuperar">Recuperar</button><button type="button" id="ar-baixar" title="Baixa o rascunho como um arquivo à parte">Baixar</button><button type="button" id="ar-descartar">Descartar</button></div>
<div id="painel-video" class="painel-mini" hidden="" role="dialog" aria-label="Inserir vídeo">
  <div class="linha"><b>Inserir vídeo ou conteúdo</b></div>
  <div class="linha"><span class="rot">Link</span><input type="url" id="pv-url" placeholder="YouTube, Vimeo, GeoGebra ou código &lt;iframe&gt;" spellcheck="false"></div>
  <div id="pv-erro"></div>
  <div class="pmc-dica">O vídeo fica na página como um quadro (precisa de internet). Na edição, clique nele para mudar a largura ou apagar.</div>
  <div class="linha" style="justify-content:flex-end"><button type="button" id="pv-cancelar">Cancelar</button><button type="button" id="pv-ok" style="background:#2a6;color:#fff;border-color:#2a6">Inserir</button></div>
</div>
<div id="painel-simbolos" class="painel-mini" hidden="" role="dialog" aria-label="Símbolos">
  <div class="linha"><b>Símbolos</b><select id="ps-secao" title="Seção de símbolos"><option value="0">Gregas</option><option value="1">Operadores</option><option value="2">Relações</option><option value="3">Setas</option><option value="4">Conjuntos</option><option value="5">Texto</option></select><span class="pmc-dica" style="margin-left:auto">clique para inserir no texto</span><button type="button" id="ps-fechar" title="Fechar (Esc)">✕</button></div>
  <div class="ps-grupo" data-secao="0"><button type="button" data-s="α">α</button><button type="button" data-s="β">β</button><button type="button" data-s="γ">γ</button><button type="button" data-s="δ">δ</button><button type="button" data-s="ε">ε</button><button type="button" data-s="ϵ">ϵ</button><button type="button" data-s="ζ">ζ</button><button type="button" data-s="η">η</button><button type="button" data-s="θ">θ</button><button type="button" data-s="ϑ">ϑ</button><button type="button" data-s="ι">ι</button><button type="button" data-s="κ">κ</button><button type="button" data-s="λ">λ</button><button type="button" data-s="μ">μ</button><button type="button" data-s="ν">ν</button><button type="button" data-s="ξ">ξ</button><button type="button" data-s="π">π</button><button type="button" data-s="ρ">ρ</button><button type="button" data-s="σ">σ</button><button type="button" data-s="τ">τ</button><button type="button" data-s="υ">υ</button><button type="button" data-s="φ">φ</button><button type="button" data-s="ϕ">ϕ</button><button type="button" data-s="χ">χ</button><button type="button" data-s="ψ">ψ</button><button type="button" data-s="ω">ω</button><button type="button" data-s="Γ">Γ</button><button type="button" data-s="Δ">Δ</button><button type="button" data-s="Θ">Θ</button><button type="button" data-s="Λ">Λ</button><button type="button" data-s="Ξ">Ξ</button><button type="button" data-s="Π">Π</button><button type="button" data-s="Σ">Σ</button><button type="button" data-s="Φ">Φ</button><button type="button" data-s="Ψ">Ψ</button><button type="button" data-s="Ω">Ω</button></div><div class="ps-grupo" data-secao="1" hidden=""><button type="button" data-s="±">±</button><button type="button" data-s="∓">∓</button><button type="button" data-s="×">×</button><button type="button" data-s="÷">÷</button><button type="button" data-s="·">·</button><button type="button" data-s="∘">∘</button><button type="button" data-s="√">√</button><button type="button" data-s="∞">∞</button><button type="button" data-s="∂">∂</button><button type="button" data-s="∇">∇</button><button type="button" data-s="∑">∑</button><button type="button" data-s="∏">∏</button><button type="button" data-s="∫">∫</button><button type="button" data-s="∮">∮</button><button type="button" data-s="′">′</button><button type="button" data-s="″">″</button><button type="button" data-s="°">°</button><button type="button" data-s="‰">‰</button><button type="button" data-s="%">%</button></div><div class="ps-grupo" data-secao="2" hidden=""><button type="button" data-s="=">=</button><button type="button" data-s="≠">≠</button><button type="button" data-s="≈">≈</button><button type="button" data-s="≡">≡</button><button type="button" data-s="∼">∼</button><button type="button" data-s="≃">≃</button><button type="button" data-s="∝">∝</button><button type="button" data-s="<"><</button><button type="button" data-s=">">></button><button type="button" data-s="≤">≤</button><button type="button" data-s="≥">≥</button><button type="button" data-s="≪">≪</button><button type="button" data-s="≫">≫</button></div><div class="ps-grupo" data-secao="3" hidden=""><button type="button" data-s="→">→</button><button type="button" data-s="←">←</button><button type="button" data-s="↔">↔</button><button type="button" data-s="⇒">⇒</button><button type="button" data-s="⇐">⇐</button><button type="button" data-s="⇔">⇔</button><button type="button" data-s="↑">↑</button><button type="button" data-s="↓">↓</button><button type="button" data-s="↦">↦</button><button type="button" data-s="⟶">⟶</button><button type="button" data-s="⟹">⟹</button></div><div class="ps-grupo" data-secao="4" hidden=""><button type="button" data-s="∈">∈</button><button type="button" data-s="∉">∉</button><button type="button" data-s="⊂">⊂</button><button type="button" data-s="⊆">⊆</button><button type="button" data-s="⊃">⊃</button><button type="button" data-s="⊇">⊇</button><button type="button" data-s="∪">∪</button><button type="button" data-s="∩">∩</button><button type="button" data-s="∅">∅</button><button type="button" data-s="∀">∀</button><button type="button" data-s="∃">∃</button><button type="button" data-s="∄">∄</button><button type="button" data-s="¬">¬</button><button type="button" data-s="∧">∧</button><button type="button" data-s="∨">∨</button><button type="button" data-s="ℕ">ℕ</button><button type="button" data-s="ℤ">ℤ</button><button type="button" data-s="ℚ">ℚ</button><button type="button" data-s="ℝ">ℝ</button><button type="button" data-s="ℂ">ℂ</button></div><div class="ps-grupo" data-secao="5" hidden=""><button type="button" data-s="…">…</button><button type="button" data-s="–">–</button><button type="button" data-s="—">—</button><button type="button" data-s="«">«</button><button type="button" data-s="»">»</button><button type="button" data-s="“">“</button><button type="button" data-s="”">”</button><button type="button" data-s="‘">‘</button><button type="button" data-s="’">’</button><button type="button" data-s="•">•</button><button type="button" data-s="§">§</button><button type="button" data-s="¶">¶</button><button type="button" data-s="†">†</button><button type="button" data-s="‡">‡</button><button type="button" data-s="©">©</button><button type="button" data-s="®">®</button><button type="button" data-s="™">™</button><button type="button" data-s="€">€</button><button type="button" data-s="£">£</button><button type="button" data-s="¹">¹</button><button type="button" data-s="²">²</button><button type="button" data-s="³">³</button><button type="button" data-s="½">½</button><button type="button" data-s="¼">¼</button><button type="button" data-s="¾">¾</button></div>
</div>
<div id="painel-macros" class="painel-mini" hidden="" role="dialog" aria-label="Macros LaTeX do documento">
  <div class="linha"><b>Adicionar macros LaTeX</b></div>
  <div class="pmc-dica">Acrescente macros a este documento, um <code>\newcommand</code> por linha. Elas são gravadas no arquivo. <a href="https://github.com/fabiolimath/Preambulo/blob/HEAD/fol-MathJax.sty" target="_blank" rel="noopener">Todas as macros (fol-MathJax.sty, no Preambulo)</a></div>
  <textarea id="pmc-tex" rows="6" spellcheck="false"></textarea>
  <div id="pmc-erro"></div>
  <div class="linha" style="justify-content:flex-end"><button type="button" id="pmc-cancelar">Cancelar</button><button type="button" id="pmc-ok" style="background:#2a6;color:#fff;border-color:#2a6">Aplicar</button></div>
</div>
<div id="painel-busca" class="painel-mini" hidden="">
  <div class="linha"><span class="rot">Localizar</span><input type="text" id="pb-busca" spellcheck="false"><span id="pb-conta"></span></div>
  <div class="linha"><span class="rot">Substituir</span><input type="text" id="pb-troca" spellcheck="false"></div>
  <div class="linha"><label><input type="checkbox" id="pb-caixa"> Maiúsc./minúsc.</label><label><input type="checkbox" id="pb-latex" checked=""> LaTeX das fórmulas</label></div>
  <div class="linha" style="justify-content:flex-end"><button type="button" id="pb-ant" title="Anterior (Shift+Enter)">◀</button><button type="button" id="pb-prox" title="Próximo (Enter)">▶</button><button type="button" id="pb-um">Substituir</button><button type="button" id="pb-todos">Substituir tudo</button><button type="button" id="pb-fechar" title="Fechar (Esc)">✕</button></div>
</div>
`;
  const UI_DEPOIS = String.raw`
<div id="editor-eq" hidden="">
  <div>Fórmula em LaTeX <span style="color: rgb(136, 136, 136);">(Enter aplica, Ctrl+Enter quebra a linha, Esc cancela)</span></div>
  <textarea id="ee-tex" rows="3" spellcheck="false"></textarea>
  <div id="ee-previa"></div>
  <div id="ee-num-l" hidden=""><label title="Numera a equação automaticamente, (1), (2), ..., na ordem do documento"><input type="checkbox" id="ee-num"> numerar</label> <label id="ee-label-l" title="Nome da equação, para citá-la num link (Ctrl+K). Pode trocar por um nome seu.">label <input type="text" id="ee-label" spellcheck="false"></label></div>
  <label><input type="checkbox" id="ee-display"> destacada (linha própria, centralizada)</label>
  <div id="ee-cores"><span>Cor:</span><button type="button" class="ee-cor" data-cor="cor-preto" style="--c: #111111" title="Preto (padrão)" aria-label="Preto (padrão)"></button><button type="button" class="ee-cor" data-cor="cor-azul" style="--c: #3333cc" title="Azul" aria-label="Azul"></button><button type="button" class="ee-cor" data-cor="rotulo" style="--c: #ff8000" title="Laranja" aria-label="Laranja"></button><button type="button" class="ee-cor" data-cor="cor-vermelho" style="--c: #d01c1c" title="Vermelho" aria-label="Vermelho"></button><button type="button" class="ee-cor" data-cor="cor-verde" style="--c: #1b8a3a" title="Verde" aria-label="Verde"></button><button type="button" class="ee-cor" data-cor="cor-roxo" style="--c: #8e24aa" title="Roxo" aria-label="Roxo"></button><button type="button" class="ee-cor" data-cor="cor-amarelo" style="--c: #c9a000" title="Amarelo" aria-label="Amarelo"></button><button type="button" class="ee-cor" data-cor="cor-rosa" style="--c: #e020b0" title="Rosa" aria-label="Rosa"></button></div>
  <div class="ee-botoes"><button type="button" id="ee-remover">Remover</button><button type="button" id="ee-cancelar">Cancelar</button><button type="button" id="ee-aplicar">Aplicar</button></div>
</div>
<div id="painel-marca" hidden="">
  <div class="pm-linha"><b>Marcação</b> <span class="pm-dica">Arraste de termo a termo na fórmula; no texto, selecione o trecho.</span></div>
  <div class="pm-linha"><span class="pm-rot">Tipo</span><button type="button" data-tipo="destaque" title="Destaque (marca-texto)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21.5h10" stroke="#f0c000" stroke-width="3.2"></path><path d="M14.2 3.6l6.2 6.2-8.3 8.3-6.2-6.2z"></path><path d="M5.9 11.9l-1.6 4.4 3.4 3.4 4.4-1.6"></path><path d="M8.8 9.3l6 6"></path></svg></button><button type="button" data-tipo="risca" title="Risco"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="3" y="18.5" font-family="Times New Roman, serif" font-style="italic" font-weight="bold" font-size="18" fill="currentColor" stroke="none">x</text><text x="13" y="10.5" font-family="Times New Roman, serif" font-weight="bold" font-size="11" fill="currentColor" stroke="none">2</text><path d="M3 20L20 4" stroke="#e01010" stroke-width="2.2" stroke-opacity=".55"></path></svg></button><button type="button" data-tipo="circula" title="Círculo"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle></svg></button><button type="button" data-tipo="caixa" title="Retângulo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="1"></rect></svg></button><button type="button" data-tipo="seta" title="Seta apontando para cada termo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12H4.5M10 6.5L4.5 12l5.5 5.5"></path></svg></button><button type="button" data-tipo="liga" title="Seta ligando o 1º termo ao 2º"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="15.5" width="6" height="6"></rect><rect x="15.5" y="2.5" width="6" height="6"></rect><path d="M8.5 15.5l5.6-5.6"></path><path d="M14.6 9.4l-4.2 1.1 3.1 3.1z" fill="currentColor"></path></svg></button><button type="button" data-tipo="check" title="Visto (✓)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13l5 5L20 6" stroke-width="2.4"></path></svg></button><button type="button" data-tipo="texto" title="Texto à direita do termo (fórmulas entre $...$)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"></rect><path d="M8 9h8M12 9v7"></path></svg></button></div>
  <div class="pm-linha" id="pm-linha-texto" hidden=""><span class="pm-rot">Texto</span><input type="text" id="pm-texto" spellcheck="false" placeholder="texto; fórmulas entre $...$, por exemplo: logo $y'=ay$"></div>
  <div class="pm-linha" id="pm-cores-texto" hidden=""><span class="pm-rot">Cor</span><button type="button" class="pm-cor" data-cor="preto" style="--c:#111111" title="preto"></button><button type="button" class="pm-cor" data-cor="azul" style="--c:#3333cc" title="azul"></button><button type="button" class="pm-cor" data-cor="laranja" style="--c:#ff8000" title="laranja"></button><button type="button" class="pm-cor" data-cor="vermelho" style="--c:#d01c1c" title="vermelho"></button><button type="button" class="pm-cor" data-cor="verde" style="--c:#1b8a3a" title="verde"></button><button type="button" class="pm-cor" data-cor="roxo" style="--c:#8e24aa" title="roxo"></button></div>
  <div class="pm-linha" id="pm-cores-marca"><span class="pm-rot">Cor</span><button type="button" class="pm-cor" data-cor="amarelo" style="--c:#ffe600" title="amarelo"></button><button type="button" class="pm-cor" data-cor="verde" style="--c:#2ee82e" title="verde"></button><button type="button" class="pm-cor" data-cor="laranja" style="--c:#ff9a2e" title="laranja"></button><button type="button" class="pm-cor" data-cor="azul" style="--c:#22c3ff" title="azul"></button><button type="button" class="pm-cor" data-cor="rosa" style="--c:#ff3fd5" title="rosa"></button><button type="button" class="pm-cor" data-cor="vermelho" style="--c:#e01010" title="vermelho"></button></div>
  <div class="pm-linha"><span class="pm-rot">Termos</span><span id="pm-termos"></span></div>
  <div class="ee-botoes"><button type="button" id="pm-apagar" title="Apagar marcação"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"></path></svg></button><button type="button" id="pm-cancelar">Cancelar</button><button type="button" id="pm-ok">Pronto</button></div>
</div>
<div id="retangulo" hidden=""></div>
<div id="painel-desenho" hidden="">
  <div class="pm-linha"><b>Desenho</b> <span class="pm-dica">Desenhe na página. Tudo o que fizer aqui é uma camada só. Enter conclui, Esc cancela, Ctrl+Z desfaz o último traço.</span></div>
  <div class="pm-linha"><span class="pm-rot">Ferram.</span><button type="button" data-ferr="livre" title="Caneta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c3-5 5-7 6.5-7 2 0 .5 6 3 6s3.5-7 8-10"/></svg></button><button type="button" data-ferr="marca" title="Marca-texto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21.5h10" stroke="#f0c000" stroke-width="3.2"/><path d="M14.2 3.6l6.2 6.2-8.3 8.3-6.2-6.2z"/><path d="M5.9 11.9l-1.6 4.4 3.4 3.4 4.4-1.6"/></svg></button><button type="button" data-ferr="linha" title="Linha"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20L20 4"/></svg></button><button type="button" data-ferr="seta" title="Seta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20L19 5M11 5h8v8"/></svg></button><button type="button" data-ferr="ret" title="Retângulo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="1"/></svg></button><button type="button" data-ferr="elipse" title="Elipse"><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="6.5"/></svg></button><button type="button" data-ferr="borracha" title="Borracha (apaga o traço inteiro)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20h12M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H9z"/><path d="M9.5 10.5l5 5"/></svg></button></div>
  <div class="pm-linha"><span class="pm-rot">Cor</span><button type="button" class="pm-cor" data-dcor="preto" style="--c:#111111" title="preto"></button><button type="button" class="pm-cor" data-dcor="azul" style="--c:#3333cc" title="azul"></button><button type="button" class="pm-cor" data-dcor="laranja" style="--c:#ff8000" title="laranja"></button><button type="button" class="pm-cor" data-dcor="vermelho" style="--c:#d01c1c" title="vermelho"></button><button type="button" class="pm-cor" data-dcor="verde" style="--c:#1b8a3a" title="verde"></button><button type="button" class="pm-cor" data-dcor="roxo" style="--c:#8e24aa" title="roxo"></button><button type="button" class="pm-cor" data-dcor="amarelo" style="--c:#ffe600" title="amarelo"></button><span class="pm-rot" style="width:auto;margin-left:12px">Traço</span><button type="button" data-esp="1.6" title="Fino"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" stroke-width="1.4"/></svg></button><button type="button" data-esp="2.6" title="Médio"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" stroke-width="2.6"/></svg></button><button type="button" data-esp="4.5" title="Grosso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" stroke-width="4.4"/></svg></button></div>
  <div class="ee-botoes"><button type="button" id="pd-apagar">Apagar desenhos</button><button type="button" id="pd-desfazer" title="Desfazer o último traço (Ctrl+Z)">Desfazer traço</button><button type="button" id="pd-cancelar">Cancelar</button><button type="button" id="pd-ok">Concluir</button></div>
</div>
<div id="painel-rotulo" class="painel-mini" hidden="" role="dialog" aria-label="Legenda e label">
  <div class="linha"><b id="pr-titulo">Legenda</b></div>
  <div class="linha"><span class="rot" id="pr-texto-rot">Texto</span><input type="text" id="pr-texto" spellcheck="true"></div>
  <div class="linha" id="pr-cores"><span class="rot">Cor</span><button type="button" class="pr-cor" data-cor="" style="--c: transparent" title="Padrão do estilo" aria-label="Padrão do estilo"></button><button type="button" class="pr-cor" data-cor="cor-preto" style="--c: #111111" title="Preto" aria-label="Preto"></button><button type="button" class="pr-cor" data-cor="cor-azul" style="--c: #3333cc" title="Azul" aria-label="Azul"></button><button type="button" class="pr-cor" data-cor="rotulo" style="--c: #ff8000" title="Laranja" aria-label="Laranja"></button><button type="button" class="pr-cor" data-cor="cor-vermelho" style="--c: #d01c1c" title="Vermelho" aria-label="Vermelho"></button><button type="button" class="pr-cor" data-cor="cor-verde" style="--c: #1b8a3a" title="Verde" aria-label="Verde"></button><button type="button" class="pr-cor" data-cor="cor-roxo" style="--c: #8e24aa" title="Roxo" aria-label="Roxo"></button></div>
  <div class="linha"><span class="rot">Label</span><input type="text" id="pr-label" spellcheck="false" title="Nome para citar num link (Ctrl+K, Ou ir para). Pode trocar por um nome seu."></div>
  <div id="pr-erro"></div>
  <div class="linha" style="justify-content:flex-end"><button type="button" id="pr-remover">Remover</button><button type="button" id="pr-cancelar">Cancelar</button><button type="button" id="pr-salvar">Salvar</button></div>
</div>
<button type="button" id="b-rotulo" hidden="">Legenda</button>
<div id="img-sel" hidden=""><span class="img-alca" data-canto="nw"></span><span class="img-alca" data-canto="ne"></span><span class="img-alca" data-canto="sw"></span><span class="img-alca" data-canto="se"></span><span id="img-tam"></span><button type="button" id="img-legenda">Legenda</button></div>
<div id="passos"><button id="ant" title="Camada anterior (←)">◀</button><span id="contador"></span><button id="prox" title="Próxima camada (→)">▶</button></div>
`;
  const IDS_UI = ['b-sumario', 'sumario', 'modos', 'barra', 'painel-link', 'painel-imagem', 'painel-busca', 'editor-eq', 'painel-marca', 'retangulo', 'passos'];
  function porInterface() {
    // arquivo antigo, com a interface gravada nele: troca pela desta versão
    IDS_UI.forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    const criar = html => {
      const t = document.createElement('template'); t.innerHTML = html.trim();
      [...t.content.childNodes].forEach(n => { if (n.nodeType === 1) n.setAttribute('data-strata-temp', ''); else n.remove(); });
      return t.content;
    };
    document.body.prepend(criar(UI_ANTES));
    document.body.append(criar(UI_DEPOIS));
  }

  let mathjaxCarregado;
  function carregarMathJax() {
    if (window.MathJax && window.MathJax.version) return Promise.resolve();
    const ja = document.querySelector('script[src*="mathjax"]');
    return new Promise((ok, falha) => {
      const s = ja || document.createElement('script');
      s.addEventListener('load', ok); s.addEventListener('error', falha);
      if (!ja) { s.src = Strata.mathjax; s.async = true; s.setAttribute('data-strata-temp', ''); document.head.appendChild(s); }
    });
  }

  function iniciar() {
    if (!document.querySelector('main.apostila')) { console.warn('[strata] a página não tem <main class="apostila">'); return; }
    porInterface();
    mathjaxCarregado = carregarMathJax();
    mathjaxCarregado.catch(() => console.warn('[strata] MathJax não carregou (sem internet?)'));

    // Novo documento (?novo): a mesma ferramenta, com uma única página em branco
    if (new URLSearchParams(location.search).has('novo')) {
      document.querySelector('main.apostila').innerHTML = '<section class="pagina"><p><br></p><div class="rodape">1</div></section>';
      document.title = 'Novo documento';
      // o arquivo novo vai ser salvo em outra pasta: os endereços do Strata viram absolutos
      // (no exemplo eles são relativos, ../strata.js, e não achariam nada a partir de Downloads)
      // (numa pasta do computador, como a do pacote offline, ficam relativos: o arquivo novo é salvo junto)
      if (/^https?:$/.test(location.protocol)) {
        document.querySelectorAll('head script[src*="strata.js"], head script[src*="mathjax"]').forEach(e => e.setAttribute('src', e.src));
        document.querySelectorAll('head link[rel="stylesheet"][href*="strata.css"]').forEach(e => e.setAttribute('href', e.href));
      }
    }

    // ---------- modo leitura (padrão) x modo apresentação (?aula) x edição (?editar) ----------
    const MODO_AULA = new URLSearchParams(location.search).has('aula');

    // ---------- modo apresentação: camadas aparecem uma a uma ----------
    // As camadas são recalculadas a cada entrada no modo apresentação, a partir da página
    // como ela está agora (inclusive com edições ainda não salvas).
    const AULA = { passos: [], k: 0 };
    function emAula() { return document.body.classList.contains('aula'); }
    function contarCamadas() {
      const passos = [];
      // agrupa elementos com o mesmo data-junto em uma única camada
      document.querySelectorAll('.apostila .fragment').forEach(el => {
        const j = el.getAttribute('data-junto');
        const ult = passos[passos.length - 1];
        if (j && ult && ult.junto === j) ult.els.push(el);
        else passos.push({ junto: j, els: [el] });
      });
      AULA.passos = passos;
    }
    function atualizarContador() { document.getElementById('contador').textContent = AULA.k + ' / ' + AULA.passos.length; }
    // mostra as camadas que vêm antes de "alvo" (o alvo, se for camada, fica para a próxima seta)
    function mostrarAte(alvo, incluir) {
      let n = 0;
      AULA.passos.forEach((p, i) => {
        const e = p.els[0];
        const dentro = e === alvo || e.contains(alvo) || alvo.contains(e);
        if ((incluir && dentro) || (!dentro && (alvo.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING))) n = i + 1;
      });
      AULA.passos.forEach((p, i) => p.els.forEach(e => e.classList.toggle('visivel', i < n)));
      AULA.k = n; atualizarContador(); desenharMarcas();
    }
    function prox() {
      if (AULA.k >= AULA.passos.length) return;
      const p = AULA.passos[AULA.k++];
      p.els.forEach(e => e.classList.add('visivel'));
      p.els[p.els.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      atualizarContador(); desenharMarcas(new Set(p.els));
    }
    function ant() {
      if (AULA.k <= 0) return;
      const p = AULA.passos[--AULA.k];
      p.els.forEach(e => e.classList.remove('visivel'));
      const v = AULA.passos[AULA.k - 1];
      if (v) v.els[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      atualizarContador(); desenharMarcas();
    }
    document.addEventListener('keydown', ev => {
      if (!emAula() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.target.closest && ev.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(ev.key)) { ev.preventDefault(); prox(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(ev.key)) { ev.preventDefault(); ant(); }
    });
    document.getElementById('prox').onclick = prox;
    document.getElementById('ant').onclick = ant;
    // usado pelo sumário: mostra todas as camadas até o elemento escolhido
    AULA.ir = alvo => { if (emAula()) mostrarAte(alvo, true); };

    // ---------- troca de modo sem recarregar, mantendo a posição ----------
    const ANCORAS = 'section.pagina p, section.pagina div.eq, section.pagina div.caixa, section.pagina h1, section.pagina h2, section.pagina h3, section.pagina li, section.pagina svg:not(.tinta):not(.tinta-html svg), section.pagina figure, section.pagina table, section.pagina .subtitulo';
    // primeiro bloco visível logo abaixo do topo da janela (descontando a barra de edição)
    function ancoraAtual() {
      const y = (document.body.classList.contains('editando') ? 64 : 0) + 70;
      for (const e of document.querySelectorAll(ANCORAS)) {
        const r = e.getBoundingClientRect();
        if (r.height > 0 && r.bottom > y) return { el: e, topo: r.top };
      }
      return null;
    }
    function restaurar(a) {
      if (!a) return;
      const d = a.el.getBoundingClientRect().top - a.topo;
      if (d) window.scrollTo({ top: window.scrollY + d, behavior: 'instant' });
    }
    function noEcra(e) {
      if (!e || !e.isConnected) return false;
      const r = e.getBoundingClientRect();
      return r.height > 0 && r.bottom > 64 && r.top < window.innerHeight;
    }
    function modoAtual() { return document.body.classList.contains('editando') ? 'edicao' : emAula() ? 'aula' : 'leitura'; }
    var MODO_ANT = null;   // modo de antes: clicar de novo no botão do modo atual volta para ele
    function cursorNoFimDe(el) {
      const sec = el.closest('section.pagina'); if (!sec) return;
      const r = document.createRange();
      if (el.matches('.marca, mjx-container')) { const n = el.nextSibling; if (n && n.nodeType === 3 && n.data[0] === '\u200B') r.setStart(n, 1); else r.setStartAfter(el); }
      else {
        // último texto editável dentro da camada (depois de fórmulas e âncoras, o espaço invisível que as segue)
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => t.parentElement.closest('mjx-container, .marca, .ancora-camada, .tinta-html') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        let t = null, x; while ((x = w.nextNode())) t = x;
        if (t) r.setStart(t, t.length); else { r.selectNodeContents(el); r.collapse(false); }
      }
      r.collapse(true);
      sec.focus({ preventScroll: true });
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      if (typeof lerCursor === 'function') lerCursor();
    }
    function mudarModo(novo, inicio) {
      const antes = modoAtual();
      if (novo === antes && !inicio) return;
      if (!inicio) MODO_ANT = antes;
      const a = inicio ? null : ancoraAtual();
      // vindo da edição: as camadas aparecem até o parágrafo do cursor, inclusive (se estiver na tela)
      const cursor = antes === 'edicao' && typeof ED !== 'undefined' && noEcra(ED.bloco) ? ED.bloco : null;
      // vindo da apresentação para a edição: o cursor vai para o fim da última camada exibida
      const ultimaVista = antes === 'aula' && novo === 'edicao' && AULA.k > 0 ? AULA.passos[AULA.k - 1].els.slice().sort((x, y) => x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1).pop() : null;
      if (antes === 'edicao') sairEdicao();
      if (antes === 'aula') {
        document.body.classList.remove('aula');
        document.querySelectorAll('.visivel').forEach(e => e.classList.remove('visivel'));
      }
      if (novo === 'edicao') { entrarEdicao(); const h = document.getElementById('barra').offsetHeight; if (h) document.body.style.setProperty('--barra', h + 'px'); }
      if (novo === 'aula') {
        contarCamadas();
        document.body.classList.add('aula');
        const ref = cursor || (a && a.el);
        if (ref) mostrarAte(ref, !!cursor); else { AULA.k = 0; atualizarContador(); }
      }
      document.querySelectorAll('#modos [data-modo]').forEach(b => b.classList.toggle('ativo', b.dataset.modo === novo));
      try { history.replaceState(null, '', location.pathname + (novo === 'aula' ? '?aula' : novo === 'edicao' ? '?editar' : '') + location.hash); } catch (e) {}
      desenharMarcas();
      restaurar(a);
      if (ultimaVista && ultimaVista.isConnected) cursorNoFimDe(ultimaVista);
      if (typeof montarSumario === 'function' && SUM.itens) montarSumario();
    }
    document.querySelectorAll('#modos [data-modo]').forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());   // não tira o cursor do texto
      b.addEventListener('click', () => {
        const atual = modoAtual(), alvo = b.dataset.modo;
        // edição e apresentação são liga/desliga: desligar volta ao modo anterior
        if (alvo === atual && alvo !== 'leitura') mudarModo(MODO_ANT && MODO_ANT !== atual ? MODO_ANT : 'leitura');
        else mudarModo(alvo);
        b.blur();
      });
    });

    // ---------- sumário no painel lateral (montado sozinho a partir dos títulos) ----------
    const SUM = { itens: [] };
    function textoTitulo(h) {
      const c = h.cloneNode(true);
      c.querySelectorAll('mjx-container').forEach(m => m.replaceWith(m.dataset.tex || ''));
      return c.textContent.replace(/\s+/g, ' ').trim().replace(/[.:]$/, '');
    }
    function montarSumario() {
      if (NUM_OK) numerar();
      const lista = document.getElementById('sum-lista');
      lista.innerHTML = ''; SUM.itens = [];
      document.querySelectorAll('.apostila h1, .apostila h2, .apostila h3').forEach(h => {
        const nivel = +h.tagName[1];
        const t = textoTitulo(h);
        if (!t || (nivel === 3 && !/^Exemplo/i.test(t) && !h.classList.contains('subsecao'))) return;   // dos h3, só os exemplos e as subseções
        const li = document.createElement('li'), a = document.createElement('a');
        a.href = '#'; a.className = 'nivel-' + nivel; a.textContent = (h.dataset.num ? h.dataset.num + ' ' : '') + t;
        a.onclick = ev => { ev.preventDefault(); irPara(h); a.blur(); };
        li.append(a); lista.append(li);
        SUM.itens.push({ h, a });
      });
      marcarAtual();
    }
    function irPara(h) {
      if (AULA.ir) AULA.ir(h);
      const topo = document.body.classList.contains('editando') ? 110 : 60;
      window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - topo, behavior: 'smooth' });
      if (window.innerWidth < 1500) abrirSumario(false);
    }
    function marcarAtual() {
      let atual = SUM.itens[0];
      for (const it of SUM.itens) if (it.h.getBoundingClientRect().top < 160) atual = it;
      SUM.itens.forEach(it => it.a.classList.toggle('atual', it === atual));
    }
    function abrirSumario(sim) {
      document.body.classList.toggle('sumario-aberto', sim);
      try { localStorage.setItem('apostila-sumario', sim ? '1' : '0'); } catch (e) {}
    }
    document.getElementById('b-sumario').onclick = () => abrirSumario(!document.body.classList.contains('sumario-aberto'));
    window.addEventListener('scroll', () => { if (!marcarAtual.t) marcarAtual.t = requestAnimationFrame(() => { marcarAtual.t = 0; marcarAtual(); }); }, { passive: true });
    (() => {
      let pref = null;
      try { pref = localStorage.getItem('apostila-sumario'); } catch (e) {}
      const abrir = window.innerWidth >= 1100 && (pref === null ? (window.innerWidth >= 1500 && !MODO_AULA) : pref === '1');
      document.body.classList.toggle('sumario-aberto', abrir);
    })();
    montarSumario();

    // ---------- modo edição (não precisa editar) ----------
    const ED = { range: null, bloco: null, alvo: null, modo: null, handle: null, sujo: false };
    // marca se há alterações não salvas (mostra o disquete)
    function sujo(v) { ED.sujo = v; document.body.classList.toggle('sujo', v); if (v) histAgendar(); else apagarRascunho(); }
    const $ = id => document.getElementById(id);
    const BLOCOS = 'p, div.eq, div.caixa, h1, h2, h3, h4, h5, h6, pre, blockquote, aside.nota, li, .subtitulo';
    // tabela e vídeo ficam numa linha própria (div.linha-objeto): os pontos antes e depois deles recebem âncoras
    // de camada, marcação e desenho, como na equação destacada
    const LINHA_OBJ = 'div.linha-objeto';
    const BLOCOS_L = BLOCOS + ', ' + LINHA_OBJ;
    function embrulharObjetos() {
      let mudou = false;
      document.querySelectorAll('section.pagina table.tabela, section.pagina div.video').forEach(t => {
        const pai = t.parentElement;
        if (pai.matches(LINHA_OBJ) || pai.closest('td, th, ' + BLOCOS)) return;
        const d = document.createElement('div'); d.className = 'linha-objeto';
        if (t.classList.contains('fragment')) {   // tabela (ou vídeo) que era camada: a camada passa a ser a linha
          d.classList.add('fragment'); t.classList.remove('fragment', 'visivel', 'camada-foco');
          if (t.dataset.junto) { d.dataset.junto = t.dataset.junto; delete t.dataset.junto; }
          t.querySelectorAll(':scope > .ancora-camada, :scope > tbody > .ancora-camada').forEach(a => a.remove());
        }
        t.before(d); d.append(t); mudou = true;
      });
      return mudou;
    }

    function guardarTex() {
      for (const it of MathJax.startup.document.math) {
        const c = it.typesetRoot; if (!c) continue;
        c.dataset.tex = it.math; c.dataset.display = it.display ? '1' : '0';
        c.setAttribute('contenteditable', 'false');
      }
    }
    async function renderTex(tex, display) {
      const c = await MathJax.tex2svgPromise(tex, { display });
      c.dataset.tex = tex; c.dataset.display = display ? '1' : '0';
      c.setAttribute('contenteditable', 'false');
      return c;
    }
    function avisar(t) { $('aviso').textContent = t; clearTimeout(avisar.t); avisar.t = setTimeout(() => $('aviso').textContent = '', 2500); }

    function entrarEdicao() {
      document.body.classList.add('editando');
      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
      document.querySelectorAll('section.pagina').forEach(s => s.setAttribute('contenteditable', 'true'));
      document.querySelectorAll('section.pagina > .rodape').forEach(r => r.setAttribute('contenteditable', 'false'));   // número da página: automático
      document.querySelectorAll('.apostila .marca').forEach(prepararIcone);
      soltasParaDentro(); embrulharObjetos();
      iconesCamada(); garantirPontos();
      montarSumario();
      HIST.atual = null;
    }
    // marcação solta entre dois parágrafos ocupa uma linha só para ela: vai para o fim do parágrafo
    // anterior (fica no mesmo ponto da ordem das camadas)
    function soltasParaDentro() {
      document.querySelectorAll('section.pagina > .marca').forEach(m => {
        let a = m.previousSibling;
        while (a && (a.nodeType === 3 && !a.data.trim() || a.nodeType === 8)) a = a.previousSibling;
        if (a && a.nodeType === 1 && a.matches(BLOCOS)) a.append(m);
      });
    }
    // Fórmulas, âncoras e marcações não são editáveis; sem texto ao lado delas, o navegador
    // não deixa pôr o cursor antes ou depois. No modo edição ganham um espaço invisível (U+200B).
    const ZW = '\u200B';
    function garantirPontos() {
      if (embrulharObjetos()) iconesCamada();
      document.querySelectorAll('section.pagina').forEach(sec => sec.querySelectorAll('mjx-container, .marca, .ancora-camada, ' + LINHA_OBJ + ' > *, img:not(span.figura > img), span.figura').forEach(e => {
        if (!e.parentElement || e.parentElement.closest('mjx-container, .tinta-html')) return;
        if (e.parentElement.matches('table, tbody, thead, tr')) {   // âncora de tabela: texto solto aí vira célula fantasma
          [...e.parentElement.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); }); return;
        }
        const ok = (n, fim) => n && n.nodeType === 3 && (fim ? /[^\s]$/.test(n.data) : /^[^\s]/.test(n.data));
        if (!ok(e.previousSibling, true)) e.before(ZW);
        if (!ok(e.nextSibling, false)) e.after(ZW);
      }));
    }
    // Cursor e espaços invisíveis: para o teclado e o mouse, cada fórmula (ou âncora) é um
    // "caractere" só; os espaços invisíveis ao lado dela não contam.
    const NAO_EDIT = 'mjx-container, .marca, .ancora-camada';
    const OBJETOS = 'img, span.figura';   // imagens: um "caractere" só, como as fórmulas
    function itensDoBloco(b) {   // lista plana: caracteres de texto e elementos não editáveis
      const it = [];
      (function rec(n) {
        for (const f of n.childNodes) {
          if (f.nodeType === 3) for (let i = 0; i < f.data.length; i++) it.push({ no: f, i, zw: f.data[i] === ZW });
          else if (f.nodeType === 1) {
            if (f.matches(NAO_EDIT + ', ' + OBJETOS) || (f.matches('table, div.video') && n.matches(LINHA_OBJ))) it.push({ el: f });
            else if (!f.matches('.tinta-html, svg.tinta, aside.nota, .rodape')) rec(f);
          }
        }
      })(b);
      // espaços no começo e no fim do bloco não aparecem: contam como invisíveis
      for (let k = 0; k < it.length && !it[k].el && (it[k].zw || /\s/.test(it[k].no.data[it[k].i])); k++) it[k].zw = true;
      for (let k = it.length - 1; k >= 0 && !it[k].el && (it[k].zw || /\s/.test(it[k].no.data[it[k].i])); k--) it[k].zw = true;
      return it;
    }
    function inicioDoItem(t) { const r = document.createRange(); if (t.el) r.setStartBefore(t.el); else r.setStart(t.no, t.i); return r; }
    function posicaoNoBloco(it, no, off) {   // índice do primeiro item que fica depois do cursor
      for (let k = 0; k < it.length; k++) { const r = inicioDoItem(it[k]); if (r.comparePoint(no, off) <= 0) return k; }
      return it.length;
    }
    function porCursor(it, k) {
      const r = document.createRange(), a = it[k - 1], d = it[k];
      if (a && !a.el) r.setStart(a.no, a.i + 1);
      else if (a && a.el) r.setStartAfter(a.el);
      else if (d && !d.el) r.setStart(d.no, d.i);
      else if (d) r.setStartBefore(d.el);
      else return;
      r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function sairDaTabela(tab, dir) {
      if (tab.parentElement.matches(LINHA_OBJ)) {   // para o ponto logo depois (ou antes) da tabela, na linha dela
        const it = itensDoBloco(tab.parentElement), k = it.findIndex(t => t.el === tab);
        return porCursor(it, dir > 0 ? k + 1 : k);
      }
      let v = dir > 0 ? tab.nextElementSibling : tab.previousElementSibling;
      if (dir > 0 && (!v || v.matches('.rodape'))) { v = document.createElement('p'); v.innerHTML = '<br>'; tab.after(v); sujo(true); }
      if (!v) return;
      const it = itensDoBloco(v);
      it.forEach(t => { if (t.el && t.el.matches('.fragment:not(span) > .ancora-camada')) t.zw = true; });
      if (!it.length) { cursorEm(v); return; }
      let k = dir > 0 ? 0 : it.length;
      if (dir > 0) while (k < it.length && it[k].zw) k++; else while (k > 0 && it[k - 1].zw) k--;
      porCursor(it, k);
    }
    document.addEventListener('keydown', ev => {
      if ((ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo')) return;
      const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0), n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      if (!n || !n.closest('section.pagina') || n.closest(NAO_EDIT)) return;
      const b = n.closest('td, th, ' + BLOCOS_L) || n.closest('section.pagina');   // célula de tabela conta como bloco
      const it = itensDoBloco(b);
      // a âncora de uma camada de linha inteira fica na margem: as setas passam por ela sem parar
      it.forEach(t => { if (t.el && t.el.matches('.fragment:not(span) > .ancora-camada')) t.zw = true; });
      let k = posicaoNoBloco(it, r.startContainer, r.startOffset), pulou = false;
      // saindo da tabela pela última (ou primeira) célula: o navegador deixaria o cursor solto
      // na página, entre a tabela e o bloco vizinho; leva para dentro do bloco vizinho
      if (b.matches('td, th')) {
        const tab = b.closest('table'), cels = tab.querySelectorAll('td, th');
        const fimDaCel = !it.slice(k).some(t => !t.zw), iniDaCel = !it.slice(0, k).some(t => !t.zw);
        if (ev.key === 'ArrowRight' && fimDaCel && b === cels[cels.length - 1]) { ev.preventDefault(); sairDaTabela(tab, 1); return; }
        if (ev.key === 'ArrowLeft' && iniDaCel && b === cels[0]) { ev.preventDefault(); sairDaTabela(tab, -1); return; }
      } else if (b.matches(LINHA_OBJ)) {   // nos pontos da linha da tabela: a seta que encontra a tabela entra nela
        let j = k;
        if (ev.key === 'ArrowRight') { while (j < it.length && it[j].zw) j++; } else { while (j > 0 && it[j - 1].zw) j--; }
        const t = ev.key === 'ArrowRight' ? it[j] : it[j - 1];
        if (t && t.el && t.el.matches('table')) {
          const cels = t.el.querySelectorAll('td, th'); if (!cels.length) return;
          ev.preventDefault();
          const c = ev.key === 'ArrowRight' ? cels[0] : cels[cels.length - 1], ic = itensDoBloco(c);
          if (!ic.length) { cursorEm(c); return; }
          let q = ev.key === 'ArrowRight' ? 0 : ic.length;
          if (ev.key === 'ArrowRight') while (q < ic.length && ic[q].zw) q++; else while (q > 0 && ic[q - 1].zw) q--;
          porCursor(ic, q); return;
        }
      } else if (!b.matches('section.pagina')) {   // e o caminho inverso: do bloco vizinho para dentro da tabela
        const viz = ev.key === 'ArrowRight' ? b.nextElementSibling : b.previousElementSibling;
        const borda = ev.key === 'ArrowRight' ? !it.slice(k).some(t => !t.zw) : !it.slice(0, k).some(t => !t.zw);
        if (borda && viz && viz.matches('table')) {
          const cels = viz.querySelectorAll('td, th'); if (!cels.length) return;
          ev.preventDefault();
          const c = ev.key === 'ArrowRight' ? cels[0] : cels[cels.length - 1], ic = itensDoBloco(c);
          if (!ic.length) { cursorEm(c); return; }
          let j = ev.key === 'ArrowRight' ? 0 : ic.length;
          if (ev.key === 'ArrowRight') while (j < ic.length && ic[j].zw) j++; else while (j > 0 && ic[j - 1].zw) j--;
          porCursor(ic, j); return;
        }
      }
      if (ev.key === 'ArrowRight') {
        while (k < it.length && it[k].zw) { k++; pulou = true; }
        if (k >= it.length) { if (pulou) porCursor(it, it.length); return; }
        else if (it[k].el) { k++; pulou = true; while (k < it.length && it[k].zw) k++; }
        else if (pulou) k++;
        else return;
      } else {
        while (k > 0 && it[k - 1].zw) { k--; pulou = true; }
        if (k <= 0) { if (pulou) porCursor(it, 0); return; }   // só invisíveis antes: o navegador vai para a linha anterior
        else if (it[k - 1].el) { k--; pulou = true; while (k > 0 && it[k - 1].zw) k--; }
        else if (pulou) k--;
        else return;
      }
      ev.preventDefault(); porCursor(it, k);
    });
    // texto digitado (ou Enter) nos pontos da linha da tabela: vai para um parágrafo novo, antes ou depois dela
    document.addEventListener('beforeinput', ev => {
      if (!document.body.classList.contains('editando') || !/^(insertText|insertParagraph|insertLineBreak|insertFromPaste|insertReplacementText)$/.test(ev.inputType)) return;
      const sel = getSelection(); if (!sel.rangeCount) return;
      const r = sel.getRangeAt(0), n = noDe(r.startContainer); if (!n) return;
      const L = n.closest(LINHA_OBJ + ', td, th'); if (!L || !L.matches(LINHA_OBJ)) return;
      const tab = L.querySelector(':scope > table'); if (!tab) return;
      ev.preventDefault();
      const antes = r.comparePoint(tab, 0) > 0;   // cursor antes da tabela
      const p = document.createElement('p');
      if (antes) L.before(p); else L.after(p);
      const txt = ev.inputType === 'insertText' || ev.inputType === 'insertReplacementText' ? (ev.data || '') : ev.inputType === 'insertFromPaste' && ev.dataTransfer ? ev.dataTransfer.getData('text/plain') : '';
      if (txt) p.textContent = txt; else p.innerHTML = '<br>';
      const q = document.createRange(); q.selectNodeContents(p); q.collapse(!!txt ? false : true);
      if (!txt) { sel.removeAllRanges(); sel.addRange(q); } else { sel.removeAllRanges(); sel.addRange(q); }
      sujo(true); desenharMarcas();
    });
    // Del / Backspace: fórmula ou âncora vizinha (pulando os espaços invisíveis) é apagada de uma vez.
    // Fórmula: some. Âncora de marcação: apaga a marcação. Âncora de camada: junta a camada à anterior.
    function apagarItem(el) {
      if (el.matches('mjx-container')) {
        const w = el.parentElement; el.remove();
        if (w && w.matches('span.eq-cor') && !w.textContent.replace(/[\s\u200B]/g, '') && !w.querySelector('mjx-container')) w.remove();
      } else if (el.matches('.marca')) { el.remove(); MK.limpeza = limparRotulos(); }
      else if (el.matches('.ancora-camada')) { const f = el.parentElement; removerCamada(f); iconesCamada(); focarCamada(null); }
      else if (el.matches(OBJETOS)) el.remove();
      sujo(true); desenharMarcas();
    }
    document.addEventListener('keydown', ev => {
      if ((ev.key !== 'Backspace' && ev.key !== 'Delete') || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo')) return;
      if (ev.target.closest && ev.target.closest('input, textarea')) return;
      const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0), n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      if (!n || !n.closest('section.pagina') || n.closest(NAO_EDIT)) return;
      const b = n.closest('td, th, ' + BLOCOS_L) || n.closest('section.pagina');
      let it = itensDoBloco(b), k = posicaoNoBloco(it, r.startContainer, r.startOffset), k0 = k;
      // na borda de um bloco vizinho à linha de uma tabela: o navegador juntaria o bloco à linha da tabela
      if (b.matches(BLOCOS) && !b.closest('td, th')) {
        const viz = ev.key === 'Backspace' ? b.previousElementSibling : b.nextElementSibling;
        const borda = ev.key === 'Backspace' ? !it.slice(0, k).some(t => !t.zw) : !it.slice(k).some(t => !t.zw);
        if (borda && viz && viz.matches(LINHA_OBJ)) {
          ev.preventDefault();
          const vazio = !it.some(t => !t.zw) && !b.querySelector('img, table');
          if (vazio) { b.remove(); sujo(true); }
          const iv = itensDoBloco(viz);
          porCursor(iv, ev.key === 'Backspace' ? iv.length : 0);
          return;
        }
      }
      if (b.matches(LINHA_OBJ) && (ev.key === 'Backspace' ? !it.slice(0, k).some(t => !t.zw) : !it.slice(k).some(t => !t.zw))) { ev.preventDefault(); return; }
      if (ev.key === 'Backspace') {
        while (k > 0 && it[k - 1].zw) k--;
        if (k > 0 && it[k - 1].el && it[k - 1].el.matches('table, div.video')) { ev.preventDefault(); return; }   // a tabela sai pelo menu dela; o vídeo, selecionado
        if (k > 0 && it[k - 1].el) {
          ev.preventDefault();
          const el = it[k - 1].el, depois = it[k0] || null;
          apagarItem(el);
          it = itensDoBloco(b); const j = depois ? it.indexOf(it.find(t => t.el ? t.el === depois.el : t.no === depois.no && t.i === depois.i)) : -1;
          if (b.isConnected) porCursor(it, j >= 0 ? j : Math.min(k - 1, it.length));
          return;
        }
        if (k !== k0) porCursor(it, k);   // só espaços invisíveis antes: o Backspace age no que vem antes deles
      } else {
        while (k < it.length && it[k].zw) k++;
        if (k < it.length && it[k].el && it[k].el.matches('table, div.video')) { ev.preventDefault(); return; }
        if (k < it.length && it[k].el) {
          ev.preventDefault();
          const antes = it[k0 - 1] || null;
          apagarItem(it[k].el);
          it = itensDoBloco(b); const j = antes ? it.findIndex(t => t.el ? t.el === antes.el : t.no === antes.no && t.i === antes.i) + 1 : 0;
          if (b.isConnected) porCursor(it, Math.max(j, 0));
          return;
        }
        if (k !== k0) porCursor(it, k);
      }
    });
    // clicar à direita de uma fórmula no fim da linha: o cursor vai para depois dela
    document.addEventListener('mouseup', ev => {
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo') || ev.button !== 0) return;
      setTimeout(() => {
        const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
        const r = sel.getRangeAt(0), n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
        if (!n || !n.closest('section.pagina') || n.closest(NAO_EDIT)) return;
        const b = n.closest('td, th, ' + BLOCOS_L) || n.closest('section.pagina');
        const it = itensDoBloco(b);
        let k = posicaoNoBloco(it, r.startContainer, r.startOffset);
        while (k < it.length && it[k].zw) k++;
        // pula a fórmula (e âncoras coladas nela) que estiverem à esquerda do ponto clicado, na mesma linha
        let mudou = false;
        while (k < it.length && (it[k].el || it[k].zw)) {
          if (it[k].zw) { k++; continue; }
          const alvo = it[k].el.matches('mjx-container') ? (it[k].el.querySelector('svg') || it[k].el) : it[k].el;
          const q = alvo.getBoundingClientRect();
          if (ev.clientX > q.right && ev.clientY >= q.top - 4 && ev.clientY <= q.bottom + 4) { k++; mudou = true; } else break;
        }
        if (mudou) { while (k < it.length && it[k].zw) k++; porCursor(it, k); }
      }, 0);
    });
    function tirarPontos() {
      document.querySelectorAll('section.pagina').forEach(sec => {
        const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT), lixo = [];
        for (let n; (n = w.nextNode());) if (n.data.includes(ZW)) { n.data = n.data.replace(/\u200B/g, ''); if (!n.data) lixo.push(n); }
        lixo.forEach(n => n.remove());
      });
    }
    function sairEdicao() {
      if (DS.rascunho) fecharDesenho();
      if (document.body.classList.contains('escolhendo')) fecharPainel();
      document.querySelectorAll('.apostila .marca').forEach(m => { m.removeAttribute('draggable'); m.innerHTML = ''; });
      tirarIconesCamada(); tirarPontos();
      document.body.classList.remove('editando');
      document.querySelectorAll('section.pagina').forEach(s => s.removeAttribute('contenteditable'));
      $('editor-eq').hidden = true;
      montarSumario();
    }

    // posição atual do cursor dentro da apostila
    document.addEventListener('selectionchange', () => {
      if (!document.body.classList.contains('editando')) return;
      const sel = getSelection(); if (!sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      if (!n || !n.closest('section.pagina') || n.closest('#editor-eq')) return;
      ED.range = r.cloneRange();
      ED.bloco = n.closest(BLOCOS_L) || null;
      if (CAMADA_SEL && camadaNoCursor(ED.range) !== CAMADA_SEL) focarCamada(null);
    });
    document.addEventListener('input', e => {
      if (!(e.target.closest && e.target.closest('section.pagina'))) return;
      if (!/^(format|insertLink|insertOrderedList|insertUnorderedList)/.test(e.inputType || '')) histTexto();
      sujo(true);
      clearTimeout(montarSumario.t); montarSumario.t = setTimeout(montarSumario, 600);
      clearTimeout(desenharMarcas.t); desenharMarcas.t = setTimeout(() => desenharMarcas(), 150);
    });

    // barra: mousedown não tira o cursor do texto
    document.querySelectorAll('#barra button').forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); lerCursor(); }));
    // lê o cursor agora (o selectionchange chega atrasado quando se digita rápido)
    function lerCursor() {
      const sel = getSelection(); if (!sel.rangeCount) return;
      const r = sel.getRangeAt(0), n = noDe(r.startContainer);
      if (!n || !n.closest('section.pagina') || n.closest('#editor-eq')) return;
      ED.range = r.cloneRange(); ED.bloco = n.closest(BLOCOS_L) || null;
    }

    // destaque colorido: envolve a seleção; clicar de novo na mesma cor remove, em outra cor troca
    // cor do texto: envolve a seleção; a mesma cor de novo remove, outra cor troca
    const CORES = ['cor-preto', 'cor-azul', 'rotulo', 'cor-vermelho', 'cor-verde', 'cor-roxo'];
    function aplicarCor(cor) {
      const sel = getSelection(); if (!sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      if (!n || !n.closest('section.pagina')) return avisar('Selecione o texto');
      const span = n && n.closest(CORES.map(c => 'span.' + c).join(', '));
      // várias células da tabela: a cor vale para o conteúdo de cada uma (sem atravessar a estrutura)
      const xs = !r.collapsed && celulasDaSelecao();
      if (xs && xs.lista.length > 1) {
        const SEL = CORES.map(c => 'span.' + c).join(', ');
        const so = c => { const f = [...c.childNodes].filter(k => !(k.nodeType === 3 && !k.data.replace(/[\s\u200B]/g, ''))); return f.length === 1 && f[0].nodeType === 1 && f[0].matches('span.' + cor); };
        const tirar = xs.lista.every(so);
        xs.lista.forEach(c => {
          c.querySelectorAll(SEL).forEach(x => x.replaceWith(...x.childNodes));
          if (tirar || !c.textContent.replace(/[\s\u200B]/g, '') && !c.querySelector('mjx-container')) return;
          const sp = document.createElement('span'); sp.className = cor;
          const nos = [...c.childNodes]; while (nos.length && nos[nos.length - 1].nodeName === 'BR') nos.pop();
          nos[0] ? nos[0].before(sp) : c.append(sp); sp.append(...nos);
        });
        const L = xs.lista; selecionarCelulas(L[0], L[L.length - 1]); sujo(true); return;
      }
      if (r.collapsed) {   // sem seleção: a cor vale para o que for digitado a partir do cursor
        let ponto = r; const mesma = span && span.classList.contains(cor);   // a mesma cor de novo: volta à cor do bloco
        if (span) {        // divide o trecho colorido no cursor e para entre as duas partes
          const resto = document.createRange(); resto.setStart(r.startContainer, r.startOffset); resto.setEnd(span, span.childNodes.length);
          const frag = resto.extractContents(), dir = span.cloneNode(false); dir.append(frag);
          if (dir.textContent.replace(/\u200B/g, '') || dir.querySelector('mjx-container')) span.after(dir);
          ponto = document.createRange(); ponto.setStartAfter(span); ponto.collapse(true);
          if (!span.textContent.replace(/\u200B/g, '') && !span.querySelector('mjx-container')) span.remove();
        }
        const zw = document.createTextNode('\u200B');
        const s = document.createElement('span'); s.className = cor; s.append(zw); ponto.insertNode(s);
        if (mesma || getComputedStyle(s).color === getComputedStyle(s.parentElement).color) s.replaceWith(zw);   // já é a cor do bloco: sem span
        const c = document.createRange(); c.setStart(zw, 1); c.collapse(true); sel.removeAllRanges(); sel.addRange(c);
        sujo(true); return;
      }
      if (span && span.contains(r.endContainer)) {
        const mesma = span.classList.contains(cor);
        const tem = f => f.textContent.replace(/[\s\u200B]/g, '') || f.querySelector('mjx-container');
        const dir = document.createRange(); dir.setStart(r.endContainer, r.endOffset); dir.setEnd(span, span.childNodes.length);
        const esq = document.createRange(); esq.setStart(span, 0); esq.setEnd(r.startContainer, r.startOffset);
        if (!tem(esq.cloneContents()) && !tem(dir.cloneContents())) {   // seleção cobre o trecho todo
          if (mesma) span.replaceWith(...span.childNodes);
          else { CORES.forEach(c => span.classList.remove(c)); span.classList.add(cor); }
          sujo(true); return;
        }
        // só parte do trecho: divide em antes / selecionado / depois
        const D = span.cloneNode(false); D.append(dir.extractContents());
        const meio = r.extractContents(), nos = [...meio.childNodes];
        let M = meio;
        if (!mesma) { M = span.cloneNode(false); CORES.forEach(c => M.classList.remove(c)); M.classList.add(cor); M.append(meio); }
        const fim = document.createTextNode('');
        span.after(fim); fim.before(M); if (tem(D)) fim.before(D);
        const alvo = mesma ? nos : [M];
        if (!tem(span)) span.remove();
        fim.remove();
        if (alvo.length) { const c = document.createRange(); c.setStartBefore(alvo[0]); c.setEndAfter(alvo[alvo.length - 1]); sel.removeAllRanges(); sel.addRange(c); }
        sujo(true); return;
      }
      if (r.collapsed) return avisar('Selecione o texto');
      const s = document.createElement('span'); s.className = cor;
      s.append(r.extractContents()); r.insertNode(s); sujo(true);
    }
    // menus da barra (combo): o botão principal repete a última escolha
    function lembrar(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
    function combo(id, escolher) {
      const c = $(id), menu = c.querySelector('.combo-menu');
      c.querySelector('.combo-seta').onclick = () => { const ab = menu.hidden; document.querySelectorAll('.combo-menu').forEach(m => m.hidden = true); menu.hidden = !ab; };
      menu.querySelectorAll('button').forEach(b => b.onclick = () => { menu.hidden = true; escolher(b); });
    }
    document.addEventListener('mousedown', e => { if (!(e.target.closest && e.target.closest('.combo'))) document.querySelectorAll('.combo-menu').forEach(m => m.hidden = true); });
    const COR = { atual: CORES.includes(lembrar('apostila-cor')) ? lembrar('apostila-cor') : 'cor-preto' };
    function mostrarCor() {
      const b = document.querySelector('#c-cor .combo-menu [data-cor="' + COR.atual + '"]');
      $('b-cor').style.setProperty('--c', b.style.getPropertyValue('--c'));
      $('b-cor').title = 'Cor do texto: ' + b.textContent.toLowerCase() + ' (clique de novo na mesma cor para remover)';
      document.querySelectorAll('#c-cor .combo-menu button').forEach(x => x.classList.toggle('ativo', x === b));
    }
    $('b-cor').onclick = () => aplicarCor(COR.atual);
    // texto novo: num bloco vazio, o que se digita entra com a cor da barra (se for diferente da do bloco)
    document.addEventListener('beforeinput', ev => {
      if (ev.inputType !== 'insertText' || !ev.data || !document.body.classList.contains('editando')) return;
      const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0), n = noDe(r.startContainer); if (!n || !n.closest('section.pagina') || n.closest(CORES.map(c => 'span.' + c).join(', ') + ', mjx-container, .amb-titulo')) return;
      const b = n.closest(BLOCOS); if (!b || b.textContent.replace(/[\s\u200B]/g, '') || b.querySelector('mjx-container, img, .marca')) return;
      const s = document.createElement('span'); s.className = COR.atual; s.textContent = '\u200B'; r.insertNode(s);
      if (getComputedStyle(s).color === getComputedStyle(b).color) { s.remove(); return; }
      ev.preventDefault(); s.textContent = ev.data;
      const q = document.createRange(); q.setStart(s.firstChild, ev.data.length); q.collapse(true); sel.removeAllRanges(); sel.addRange(q);
      sujo(true);
    }, true);
    combo('c-cor', b => { COR.atual = b.dataset.cor; lembrar('apostila-cor', COR.atual); mostrarCor(); aplicarCor(COR.atual); });
    mostrarCor();
    // Q.E.D. apagado pelo teclado: tira o resto (camada e linha)
    document.addEventListener('input', e => {
      if (!(e.target.closest && e.target.closest('section.pagina'))) return;
      let mudou = false;
      document.querySelectorAll('.apostila .fim-exemplo').forEach(q => { if (!q.textContent.includes('◼')) { q.remove(); mudou = true; } });
      if (mudou) { contarCamadas(); iconesCamada(); desenharMarcas(); }
    });
    // Q.E.D.: ◼ no fim do bloco atual, numa camada própria (clicar de novo no mesmo bloco tira)
    $('b-qed').onclick = () => {
      const b = ED.bloco; if (!b) return avisar('Clique no bloco em que o exemplo termina');
      const ja = b.querySelector(':scope > .fim-exemplo');
      if (ja) ja.remove();
      else { const q = document.createElement('span'); q.className = 'fragment fim-exemplo'; q.textContent = '◼'; b.append(q); }
      contarCamadas(); iconesCamada(); sujo(true); desenharMarcas();
    };
    $('b-nota').onclick = () => {
      if (!ED.bloco) return avisar('Clique num parágrafo');
      const a = document.createElement('aside'); a.className = 'nota'; a.textContent = '*:\u00a0';
      ED.bloco.before(a); sujo(true);
      const r = document.createRange(); r.selectNodeContents(a); r.collapse(false);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    };
    $('b-inline').onclick = () => { if (!ED.range) return avisar('Clique no texto'); abrirEditor(null, 'inline', '', false); };
    $('b-display').onclick = () => { if (!ED.bloco) return avisar('Clique num parágrafo'); abrirEditor(null, 'bloco', '', true); };

    // editor de fórmulas
    // cor de uma fórmula: o span.eq-cor em volta dela (sem span = preto, o padrão)
    const CORES_EQ = [...document.querySelectorAll('#ee-cores .ee-cor')].map(b => b.dataset.cor);
    function corDaFormula(c) { const p = c && c.parentElement; return p && p.matches('span.eq-cor') ? (CORES_EQ.find(k => p.classList.contains(k)) || 'cor-preto') : 'cor-preto'; }
    function mostrarCorEq() { document.querySelectorAll('#ee-cores .ee-cor').forEach(b => b.classList.toggle('ativo', b.dataset.cor === ED.cor)); $('ee-previa').style.color = $('ee-cores').querySelector('[data-cor="' + ED.cor + '"]').style.getPropertyValue('--c'); }
    document.querySelectorAll('#ee-cores .ee-cor').forEach(b => { b.addEventListener('mousedown', e => e.preventDefault()); b.onclick = () => { ED.cor = b.dataset.cor; mostrarCorEq(); }; });
    function pintarFormula(c, cor) {
      const p = c.parentElement, tem = p && p.matches('span.eq-cor');
      if (cor === 'cor-preto') { if (tem) p.replaceWith(...p.childNodes); return; }
      if (tem) { CORES_EQ.forEach(k => p.classList.remove(k)); p.classList.add(cor); return; }
      const s = document.createElement('span'); s.className = 'eq-cor ' + cor; c.replaceWith(s); s.append(c);
    }
    function abrirEditor(alvo, modo, tex, display) {
      ED.alvo = alvo; ED.modo = modo; ED.cor = corDaFormula(alvo); mostrarCorEq();
      const en = alvo && alvo.closest('span.eq-num');
      $('ee-num').checked = !!en; $('ee-label').value = en ? en.id : labelAleatorio('eq'); $('ee-label-l').hidden = !en;
      $('ee-tex').value = tex; $('ee-display').checked = display; $('ee-num-l').hidden = !display;
      $('ee-remover').style.display = alvo ? '' : 'none';
      $('editor-eq').hidden = false; previa(); $('ee-tex').focus();
    }
    async function previa() {
      const t = $('ee-tex').value.trim();
      $('ee-previa').innerHTML = '';
      if (!t) return;
      try {
        const c = await MathJax.tex2svgPromise(t, { display: $('ee-display').checked });
        c.style.color = 'inherit'; $('ee-previa').append(c);
      } catch (e) { $('ee-previa').textContent = 'Erro: ' + e.message; }
    }
    $('ee-tex').addEventListener('input', () => { clearTimeout(previa.t); previa.t = setTimeout(previa, 250); });
    $('ee-display').onchange = () => { $('ee-num-l').hidden = !$('ee-display').checked; previa(); };
    $('ee-num').onchange = () => { $('ee-label-l').hidden = !$('ee-num').checked; };
    $('ee-label').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('ee-aplicar').click(); } else if (e.key === 'Escape') { e.preventDefault(); $('ee-cancelar').click(); } });
    $('ee-cancelar').onclick = () => { $('editor-eq').hidden = true; voltarAoTexto(); };
    $('ee-remover').onclick = () => {
      let pai = ED.alvo.parentElement; ED.alvo.remove();
      if (pai.matches('span.eq-cor') && !pai.textContent.replace(/[\s\u200B]/g, '')) { const q = pai.parentElement; pai.remove(); pai = q; }
      if (pai.matches('span.eq-num') && !pai.querySelector('mjx-container')) { const q = pai.parentElement; pai.remove(); pai = q; }
      if (pai.matches('div.eq') && !pai.textContent.trim() && !pai.querySelector('mjx-container')) pai.remove();
      sujo(true); $('editor-eq').hidden = true;
    };
    $('ee-aplicar').onclick = async () => {
      const t = $('ee-tex').value.trim(); if (!t) return;
      const numerada = $('ee-display').checked && $('ee-num').checked, lab = numerada ? limparLabel($('ee-label').value) : '';
      const en0 = ED.alvo && ED.alvo.closest('span.eq-num');
      if (numerada) { const erro = erroLabel(lab, en0); if (erro) return avisar(erro); }
      const c = await renderTex(t, $('ee-display').checked);
      if (ED.alvo) ED.alvo.replaceWith(c);
      else if (ED.modo === 'inline') { ED.range.collapse(false); ED.range.insertNode(c); }
      else { const d = document.createElement('div'); d.className = 'eq'; d.append(c); ED.bloco.after(d); }
      pintarFormula(c, ED.cor || 'cor-preto');
      numerarFormula(c, numerada ? lab : null);
      sujo(true); $('editor-eq').hidden = true; montarSumario(); desenharMarcas();
      cursorAposFormula(c);
    };
    // depois de aplicar a fórmula, o cursor volta ao texto, logo depois dela
    function cursorAposFormula(c) {
      const el = c.parentElement && c.parentElement.matches('span.eq-cor') ? c.parentElement : c;
      const sec = el.closest('section.pagina'); if (!sec) return;
      sec.focus({ preventScroll: true });
      const r = document.createRange(), n = el.nextSibling;
      if (n && n.nodeType === 3 && n.data[0] === ZW) r.setStart(n, 1); else r.setStartAfter(el);
      r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    function voltarAoTexto() {
      const r = ED.range; if (!r || !r.startContainer.isConnected) return;
      const sec = noDe(r.startContainer).closest('section.pagina'); if (!sec) return;
      sec.focus({ preventScroll: true });
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    $('ee-tex').addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
      else if (e.key === 'Enter') { e.preventDefault(); $('ee-aplicar').click(); }
      if (e.key === 'Escape') $('ee-cancelar').click();
    });
    document.addEventListener('click', e => {
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo')) return;
      const c = e.target.closest && e.target.closest('section.pagina mjx-container');
      if (!c) return;
      e.preventDefault();
      const r = document.createRange(); r.selectNode(c);
      getSelection().removeAllRanges(); getSelection().addRange(r);
    });
    document.addEventListener('dblclick', e => {
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo')) return;
      const c = e.target.closest && e.target.closest('section.pagina mjx-container');
      if (!c) return;
      e.preventDefault();
      abrirEditor(c, null, c.dataset.tex || '', c.dataset.display === '1');
    });
    // fórmulas dentro da seleção ficam destacadas
    document.addEventListener('selectionchange', () => {
      const sel = getSelection(), r = sel.rangeCount && !sel.isCollapsed && document.body.classList.contains('editando') ? sel.getRangeAt(0) : null;
      document.querySelectorAll('.apostila mjx-container').forEach(c => c.classList.toggle('eq-sel', !!r && r.intersectsNode(c)));
      document.querySelectorAll('.apostila .marca, .apostila .ancora-camada').forEach(c => c.classList.toggle('na-selecao', !!r && r.intersectsNode(c)));
    });
    // clicar numa área vazia da página fecha os diálogos (equação, marcação) sem salvar
    const VAZIO = 'section.pagina, main.apostila, body, html';
    document.addEventListener('mousedown', ev => {
      if (!document.body.classList.contains('editando') || !(ev.target.matches && ev.target.matches(VAZIO))) return;
      let fechou = false;
      if (!$('editor-eq').hidden) { $('editor-eq').hidden = true; fechou = true; }
      if (document.body.classList.contains('escolhendo')) { fecharPainel(); fechou = true; }
      if (fechou) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
    // linhas novas: clicar abaixo do último bloco da página cria um parágrafo;
    // Enter no fim de uma equação ou título cria um parágrafo comum (não uma cópia da equação)
    function cursorEm(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); }
    function novoParagrafo(depois, enter) { const p = document.createElement('p'); p.innerHTML = '<br>'; if (enter && ED.enterCamada) p.className = 'fragment'; depois.after(p); cursorEm(p); sujo(true); if (enter && ED.enterCamada) iconesCamada(); return p; }
    document.addEventListener('mousedown', ev => {
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo')) return;
      const sec = ev.target;
      if (!(sec.matches && sec.matches('section.pagina'))) return;
      const blocos = [...sec.children].filter(e => !e.matches('.rodape, svg.tinta, .tinta-html, aside.nota'));
      const ult = blocos[blocos.length - 1];
      if (ult && ev.clientY < ult.getBoundingClientRect().bottom) return;
      ev.preventDefault();
      if (ult && ult.matches('p') && !ult.textContent.trim() && !ult.querySelector('mjx-container')) return cursorEm(ult);
      if (ult) novoParagrafo(ult); else { const p = document.createElement('p'); p.innerHTML = '<br>'; sec.prepend(p); cursorEm(p); sujo(true); }
    });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo')) return;
      if (!(ev.target.closest && ev.target.closest('section.pagina'))) return; // Enter no editor de fórmula não é Enter no texto
      const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
      const r = sel.getRangeAt(0), n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      const b = n && n.closest('section.pagina div.eq, section.pagina h1, section.pagina h2, section.pagina h3, section.pagina .subtitulo');
      if (!b) return;
      const pos = document.createRange(); pos.setStart(r.startContainer, r.startOffset); pos.setEnd(b, b.childNodes.length);
      const resto = pos.cloneContents(); resto.querySelectorAll('.fim-exemplo, .marca, .ancora-camada').forEach(x => x.remove());
      if (resto.textContent.replace(/[\s\u200B]/g, '') || resto.querySelector('mjx-container')) return;
      ev.preventDefault();
      // linha de igualdades: Enter no fim cria a próxima linha; numa linha vazia, ela vira parágrafo
      if (b.matches('div.eq.passo')) {
        const vazia = !b.textContent.replace(/[\s\u200B]/g, '') && !b.querySelector('mjx-container, .marca');
        if (vazia) { const p = trocarTag(b, 'p'); p.classList.remove('eq', 'passo'); if (!p.classList.length) p.removeAttribute('class'); p.innerHTML = '<br>'; cursorEm(p); sujo(true); iconesCamada(); return; }
        const d = document.createElement('div'); d.className = 'eq passo' + (ED.enterCamada ? ' fragment' : ''); d.innerHTML = '<br>'; b.after(d); cursorEm(d); sujo(true); if (ED.enterCamada) iconesCamada(); return;
      }
      novoParagrafo(b, true);
    });
    // nova página, logo depois da página atual
    $('b-pagina').onclick = () => {
      const pags = [...document.querySelectorAll('section.pagina')];
      const atual = (ED.bloco && ED.bloco.closest('section.pagina')) || pags[pags.length - 1];
      const sec = document.createElement('section'); sec.className = 'pagina'; sec.setAttribute('contenteditable', 'true');
      const p = document.createElement('p'); p.innerHTML = '<br>'; sec.append(p);
      const rd = document.createElement('div'); rd.className = 'rodape'; rd.setAttribute('contenteditable', 'false'); sec.append(rd);
      atual.after(sec);
      // toda página tem rodapé com o número; renumera a partir do número da primeira (ou 1)
      const rods = [...document.querySelectorAll('section.pagina > .rodape')];
      const n0 = (rods.length && parseInt(rods[0].textContent, 10)) || 1;
      rods.forEach((r, k) => { r.textContent = n0 + k; });
      cursorEm(p); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); sujo(true);
    };

    // salvar: devolve as fórmulas para LaTeX e grava o HTML
    function gerarHTML() {
      const doc = document.documentElement.cloneNode(true);
      doc.querySelectorAll('mjx-container').forEach(c => {
        const t = c.dataset.tex; if (t == null) { c.remove(); return; }
        c.replaceWith(document.createTextNode(c.dataset.display === '1' ? '\\[ ' + t.trim() + ' \\]' : '\\(' + t + '\\)'));
      });
      doc.querySelectorAll('[id^="MJX"], head style[type="text/css"], head script[src*="/extensions/"], head script[src*="/output/"], head script[src*="/input/"]').forEach(e => e.remove());
      tirarFimDeLinha(doc);
      tirarBrFinal(doc);
      doc.querySelectorAll('section.pagina[style]').forEach(e => { e.style.removeProperty('padding-bottom'); });
      doc.querySelectorAll('.oculta, .piscando').forEach(e => e.classList.remove('oculta', 'piscando'));
      doc.querySelectorAll('[style=""]').forEach(e => e.removeAttribute('style'));
      doc.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
      doc.querySelectorAll('.visivel').forEach(e => e.classList.remove('visivel'));
      doc.querySelectorAll('svg.tinta, .tinta-html, .ancora-camada, .alca-marca').forEach(e => e.remove());
      doc.querySelectorAll('#ee-cores .ativo').forEach(e => e.classList.remove('ativo')); doc.querySelector('#ee-previa').removeAttribute('style');
      doc.querySelectorAll('#pm-texto').forEach(e => e.removeAttribute('value'));
      doc.querySelectorAll('.camada-foco, .na-camada').forEach(e => e.classList.remove('camada-foco', 'na-camada'));
      doc.querySelectorAll('.apostila .marca').forEach(e => { e.innerHTML = ''; });
      doc.querySelectorAll('[draggable]').forEach(e => e.removeAttribute('draggable'));
      doc.querySelectorAll('.apostila .marca').forEach(e => { e.removeAttribute('title'); e.classList.remove('editando-agora'); });
      doc.querySelector('#painel-marca').hidden = true;
      ['#painel-link', '#painel-busca'].forEach(q => { const e = doc.querySelector(q); e.hidden = true; e.removeAttribute('style'); });
      doc.querySelectorAll('#pl-url, #pb-busca, #pb-troca').forEach(e => e.removeAttribute('value'));
      doc.querySelectorAll('.busca-eq, .busca-eq-atual, .ativo-fmt').forEach(e => e.classList.remove('busca-eq', 'busca-eq-atual', 'ativo-fmt'));
      doc.querySelector('body').style.removeProperty('--barra'); if (!doc.querySelector('body').getAttribute('style')) doc.querySelector('body').removeAttribute('style');
      doc.querySelector('#pm-termos').innerHTML = '';
      doc.querySelector('#retangulo').hidden = true;
      doc.querySelectorAll('#painel-marca .ativo').forEach(e => e.classList.remove('ativo'));
      doc.querySelectorAll('svg[data-fourier-quadrada], svg[data-tipo]').forEach(e => { e.innerHTML = ''; });
      // trechos coloridos que ficaram vazios (cor escolhida sem nada digitado depois)
      doc.querySelectorAll('.apostila span.' + CORES.join(', .apostila span.')).forEach(e => { if (!e.textContent.replace(/[\u200B]/g, '') && !e.children.length) e.remove(); });
      doc.querySelectorAll('[class=""]').forEach(e => e.removeAttribute('class'));
      doc.querySelector('body').removeAttribute('class');
      doc.classList.remove('strata-escuro'); if (!doc.getAttribute('class')) doc.removeAttribute('class');
      doc.querySelector('#editor-eq').hidden = true;
      doc.querySelector('#ee-previa').innerHTML = '';
      doc.querySelector('#ee-remover').removeAttribute('style');
      doc.querySelector('#b-camada').classList.remove('ligada');
      doc.querySelectorAll('.eq-sel').forEach(e => e.classList.remove('eq-sel'));
      doc.querySelectorAll('.cel-sel, .com-sel').forEach(e => e.classList.remove('cel-sel', 'com-sel'));
      doc.querySelectorAll('.combo-menu').forEach(m => { m.hidden = true; });
      doc.querySelectorAll('#c-marcar .ci').forEach(e => { e.innerHTML = ''; });
      doc.querySelectorAll('#barra .ativo').forEach(e => e.classList.remove('ativo'));
      doc.querySelector('#b-marcar').innerHTML = ''; doc.querySelector('#b-marcar').removeAttribute('data-tipo'); doc.querySelector('#b-cor').removeAttribute('style');
      doc.querySelector('#ee-tex').value = '';
      doc.querySelector('#aviso').textContent = '';
      doc.querySelector('#contador').textContent = '';
      doc.querySelector('#sum-lista').innerHTML = '';
      doc.querySelectorAll('#modos .ativo').forEach(e => e.classList.remove('ativo'));
      doc.querySelector('#retangulo').removeAttribute('style');
      doc.querySelectorAll('#painel-marca [data-tipo]').forEach(b => { b.innerHTML = ''; });
      doc.querySelectorAll('[class=""]').forEach(e => e.removeAttribute('class'));
      // o que o Strata (ou outro motor, como o fol.js) pôs na página e não é conteúdo
      doc.querySelectorAll('[data-strata-temp]').forEach(e => e.remove());
      doc.querySelectorAll('[data-strata-limpar]').forEach(e => { e.innerHTML = ''; });
      // só uma quebra de linha no fim do <body> (senão cada gravação acrescenta uma)
      const corpo = doc.querySelector('body');
      while (corpo.lastChild && corpo.lastChild.nodeType === 3 && !corpo.lastChild.textContent.trim()) corpo.lastChild.remove();
      corpo.append('\n');
      limparExtensoes(doc);
      // dentro das fórmulas, mantém "&" legível no código (ex.: \begin{cases} a & b)
      const html = doc.outerHTML.replace(/\u200B/g, '').replace(/\\[\[(][\s\S]*?\\[\])]/g, m => m.replace(/&amp;/g, '&'));
      return '<!doctype html>\n' + html.replace(/^(<html[^>]*>)<head>/, '$1\n<head>') + '\n';
    }
    // Remove o que extensões do navegador (Dark Reader, corretores, etc.) injetam na página
    // e os <span>/<font> de cor e recuo que o Chrome cria sozinho durante a edição.
    function limparExtensoes(doc) {
      doc.querySelectorAll('style.darkreader, meta[name="darkreader"]').forEach(e => e.remove());
      doc.querySelectorAll('*').forEach(e => { if (e.tagName.includes('-') && !e.tagName.startsWith('MJX')) e.remove(); });
      [doc, ...doc.querySelectorAll('*')].forEach(e => {
        [...e.attributes].forEach(a => { if (/^data-(darkreader|qb|lpop|gramm|lt-|gr-)/.test(a.name)) e.removeAttribute(a.name); });
        if (e.style) {
          [...e.style].filter(p => p.startsWith('--darkreader')).forEach(p => e.style.removeProperty(p));
          if (!e.getAttribute('style') || !e.getAttribute('style').trim()) e.removeAttribute('style');
        }
      });
      doc.querySelectorAll('section.pagina[spellcheck]').forEach(e => e.removeAttribute('spellcheck'));
      const azul = c => /^(rgb\(51, 51, 204\)|#3333cc|rgb\(17, 17, 17\)|#111111)$/i.test(c || '');
      const desembrulhar = e => { e.replaceWith(...e.childNodes); };
      doc.querySelectorAll('section.pagina span:not([class])').forEach(s => {
        const props = [...s.style];
        if (!props.length || !props.every(p => p === 'text-indent' || (p === 'color' && azul(s.style.color)))) return;
        if (s.style.color && s.parentElement.closest('aside, .rotulo, [style*="color"], font')) return;
        if (s.attributes.length === 1) desembrulhar(s);
      });
      doc.querySelectorAll('section.pagina font').forEach(f => {
        if (f.attributes.length === 1 && azul(f.getAttribute('color')) && !f.parentElement.closest('aside, .rotulo')) desembrulhar(f);
      });
    }
    window.limparExtensoes = limparExtensoes;
    function baixar(html, nome) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      a.download = nome; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    async function salvar() {
      const html = gerarHTML();
      const nome = new URLSearchParams(location.search).has('novo') ? 'novo_documento.html' : (decodeURIComponent(location.pathname.split('/').pop() || '') || 'apostila.html');
      // Dentro de um iframe (por exemplo, no Moodle) o Chrome não deixa abrir o diálogo
      // "Salvar como"; nesse caso o arquivo vai direto para a pasta de downloads.
      const emIframe = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
      try {
        if (window.showSaveFilePicker && !emIframe) {
          if (!ED.handle) ED.handle = await showSaveFilePicker({ suggestedName: nome, types: [{ description: 'Página HTML', accept: { 'text/html': ['.html'] } }] });
          const w = await ED.handle.createWritable(); await w.write(html); await w.close();
          sujo(false); avisar('Salvo ✓');
        } else {
          baixar(html, nome);
          sujo(false); avisar('Baixado ✓');
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        try { baixar(html, nome); sujo(false); avisar('Baixado ✓'); }
        catch (e2) { avisar('Erro ao salvar'); }
      }
    }
    // ---------- salvar para usar offline: um arquivo só, com o Strata e o MathJax dentro ----------
    // O <script>/<link> do Strata viram <script id="strata-js">/<style id="strata-css"> com o código,
    // e entra o MathJax completo (tex-svg-full.js, que não busca extensões na internet).
    const emLinha = t => t.replace(/<\/(script|style)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
    async function salvarOffline() {
      const nome = (new URLSearchParams(location.search).has('novo') ? 'novo_documento' : (decodeURIComponent(location.pathname.split('/').pop() || '').replace(/\.html?$/i, '') || 'documento')).replace(/-offline$/, '') + '-offline.html';
      const html = gerarHTML();
      if (document.getElementById('strata-js')) { baixar(html, nome); avisar('Baixado ✓'); return; }   // já é offline
      avisar('Preparando a cópia offline…');
      let js, css, mj;
      try {
        const pegar = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status + ' ' + u); return r.text(); });
        [js, css, mj] = await Promise.all([pegar(Strata.base + 'strata.js'), pegar(Strata.base + 'strata.css'), pegar(Strata.mathjax.replace(/tex-svg\.js$/, 'tex-svg-full.js'))]);
      } catch (e) { console.warn('[strata] cópia offline:', e); avisar('Não deu para baixar o Strata e o MathJax (precisa de internet)'); return; }
      const d = new DOMParser().parseFromString(html, 'text/html');
      const sc = d.querySelector('head script[src*="strata.js"]'), ln = d.querySelector('head link[rel="stylesheet"][href*="strata.css"]');
      const st = d.createElement('style'); st.id = 'strata-css'; st.textContent = '\n' + emLinha(css) + '\n';
      const s1 = d.createElement('script'); s1.id = 'strata-js'; s1.textContent = '\n' + emLinha(js) + '\n';
      const s2 = d.createElement('script'); s2.id = 'strata-mathjax'; s2.textContent = '\n' + emLinha(mj) + '\n';
      if (ln) ln.replaceWith(st); else d.head.append(st);
      if (sc) sc.replaceWith(s1); else d.head.append(s1);
      s1.after(s2); s2.before(d.createTextNode('\n'));
      baixar('<!doctype html>\n' + d.documentElement.outerHTML.replace(/^(<html[^>]*>)<head>/, '$1\n<head>') + '\n', nome);
      avisar('Baixado ✓');
    }
    $('mi-offline').onclick = salvarOffline;
    $('b-salvar').onclick = salvar;
    $('b-novo').onclick = () => window.open(location.pathname + '?novo', '_blank');
    $('b-salvar').addEventListener('mousedown', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && (ED.sujo || document.body.classList.contains('editando'))) { e.preventDefault(); salvar(); }
    });
    window.addEventListener('beforeunload', e => { if (ED.sujo) { e.preventDefault(); e.returnValue = ''; } });

    // ---------- marcações sobre termos (destaque, risco, círculo, seta, check) ----------
    // \mk{nome}{termo} rotula um termo numa fórmula, sem mudar a aparência;
    // <span data-mk="nome">texto</span> rotula um trecho do texto.
    // A camada que marca é um <span class="fragment marca" data-marca="nome1 nome2"
    // data-tipo="destaque" data-cor="amarelo"></span>, no ponto do texto em que ela aparece.
    const MK_CORES = { amarelo: '#ffe600', verde: '#2ee82e', laranja: '#ff9a2e', azul: '#22c3ff', rosa: '#ff3fd5', vermelho: '#e01010' };
    const MK_TRACOS = { amarelo: '#e0b800', verde: '#16a32e', laranja: '#ff7a00', azul: '#0a9bd8', rosa: '#e020b0', vermelho: '#e01010' };   // traços: tons mais escuros
    const MK_CORES_TEXTO_ESCURO = { preto: '#e8e8ea', azul: '#9aa6ff', laranja: '#ff9a3c', vermelho: '#ff6b6b', verde: '#5fd17f', roxo: '#d58cf0' };
    const MK_CORES_TEXTO = { preto: '#111111', azul: '#3333cc', laranja: '#ff8000', vermelho: '#d01c1c', verde: '#1b8a3a', roxo: '#8e24aa' };   // marcador de texto: cores do texto
    // emblemas dos botões Marcar e Desenhar: a ferramenta fica no botão, e o emblema diz de qual dos dois é
    const EMB_MARCADOR = '<svg viewBox="19.75 13.6 56 56" aria-hidden="true"><path fill="currentColor" stroke="none" fill-rule="evenodd" d="M 73.4,41.2 C 73.4,40.1 72.5,39.2 71.4,39.2 C 70.7,39.2 70.0,39.5 69.4,40.1 L 58.4,51.5 C 57.1,52.8 55.2,52.8 53.9,51.5 L 40.9,38.3 C 39.5,36.9 39.5,35.6 40.9,34.2 L 53.1,22.1 C 54.3,20.9 53.7,19.0 51.9,19.0 C 51.2,19.0 50.6,19.3 50.1,19.8 L 37.0,32.9 C 35.4,34.5 35.2,36.7 36.3,38.5 L 23.3,51.5 C 22.5,52.2 22.1,53.2 22.1,54.3 L 22.1,61.7 C 22.1,63.1 23.2,64.2 24.6,64.2 L 46.2,64.2 C 47.2,64.2 48.2,63.8 48.9,63.1 L 55.1,56.9 C 56.1,55.9 57.2,55.3 58.8,55.3 C 60.1,55.3 61.2,54.8 62.1,53.9 L 72.7,43.3 C 73.3,42.7 73.5,42.0 73.4,41.2 Z M 39.3,41.7 L 51.0,53.7 C 51.5,54.2 51.5,55.1 51.0,55.6 L 47.4,59.2 C 46.9,59.7 46.3,60.0 45.6,60.0 L 27.7,60.0 C 27.0,60.0 26.5,59.5 26.5,58.7 L 26.5,55.5 C 26.5,55.0 26.7,54.6 27.1,54.2 L 37.6,43.1 C 38.1,42.6 38.8,41.9 39.3,41.7 Z"/></svg>';
    const EMB_PENA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8L7 10.4a5.8 5.8 0 0 0 .4 6.1 4.6 4.6 0 0 1 1 2h7.2a4.6 4.6 0 0 1 1-2 5.8 5.8 0 0 0 .4-6.1z" stroke-linejoin="round"/><path d="M12 2.4v7.3"/><circle cx="12" cy="11.6" r="1.7"/><rect x="6.6" y="18.5" width="10.8" height="3.6" rx="1.8"/></svg>';
    const emblema = svg => '<span class="emblema">' + svg + '</span>';
    const MK_PADRAO = { destaque: 'amarelo', risca: 'vermelho', circula: 'azul', caixa: 'laranja', seta: 'vermelho', liga: 'rosa', check: 'verde', texto: 'vermelho' };
    // ícones dos tipos (botões do painel e âncoras das marcações no modo edição)
    const MK_ICONES = {
      destaque: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21.5h10" stroke="#f0c000" stroke-width="3.2"/><path d="M14.2 3.6l6.2 6.2-8.3 8.3-6.2-6.2z"/><path d="M5.9 11.9l-1.6 4.4 3.4 3.4 4.4-1.6"/><path d="M8.8 9.3l6 6"/></svg>',
      risca: '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="3" y="18.5" font-family="Times New Roman, serif" font-style="italic" font-weight="bold" font-size="18" fill="currentColor" stroke="none">x</text><text x="13" y="10.5" font-family="Times New Roman, serif" font-weight="bold" font-size="11" fill="currentColor" stroke="none">2</text><path d="M3 20L20 4" stroke="#e01010" stroke-width="2.2" stroke-opacity=".55"/></svg>',
      circula: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/></svg>',
      caixa: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="1"/></svg>',
      seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12H4.5M10 6.5L4.5 12l5.5 5.5"/></svg>',
      liga: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="15.5" width="6" height="6"/><rect x="15.5" y="2.5" width="6" height="6"/><path d="M8.5 15.5l5.6-5.6"/><path d="M14.6 9.4l-4.2 1.1 3.1 3.1z" fill="currentColor"/></svg>',
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13l5 5L20 6" stroke-width="2.4"/></svg>',
      desenho: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8L7 10.4a5.8 5.8 0 0 0 .4 6.1 4.6 4.6 0 0 1 1 2h7.2a4.6 4.6 0 0 1 1-2 5.8 5.8 0 0 0 .4-6.1z" stroke-linejoin="round"/><path d="M12 2.4v7.3"/><circle cx="12" cy="11.6" r="1.7"/><rect x="6.6" y="18.5" width="10.8" height="3.6" rx="1.8"/></svg>',
      texto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M8 9h8M12 9v7"/></svg>'
    };
    const SVGNS = 'http://www.w3.org/2000/svg';
    const DS = { rascunho: null, existente: null, range: null, bloco: null, ferr: 'livre', cor: 'vermelho', esp: '2.6', vivo: null, desfeitos: [] };   // desenho em edição
    const MK = { formas: [], pairadas: new Set(), rascunho: null, existente: null, range: null, esc: [], arrasto: null, drag: null, foco: null, arrastoCamada: null };
    function svgEl(tag, at, pai) { const e = document.createElementNS(SVGNS, tag); for (const k in at) e.setAttribute(k, at[k]); if (pai) pai.append(e); return e; }
    function alvosDe(nome) {
      if (!/^[\w-]+$/.test(nome)) return [];
      return [...document.querySelectorAll('.apostila svg .mk-' + nome + ', .apostila [data-mk="' + nome + '"]')];
    }
    // texto do marcador: trechos entre $...$ viram fórmulas (desenhadas uma vez e guardadas)
    const TEXTOS = new Map();
    function textoMarca(texto, cor) {
      if (!texto.trim()) return null;
      let modelo = TEXTOS.get(texto);
      if (!modelo) {
        TEXTOS.set(texto, 'pendente');
        const partes = texto.split(/(\$[^$]+\$)/);
        Promise.all(partes.map(t => /^\$[^$]+\$$/.test(t) ? MathJax.tex2svgPromise(t.slice(1, -1), { display: false }).catch(() => document.createTextNode(t)) : document.createTextNode(t)))
          .then(nos => { const sp = document.createElement('span'); nos.forEach(n => sp.append(n)); TEXTOS.set(texto, sp); desenharMarcas(); });
        return null;
      }
      if (modelo === 'pendente') return null;
      const t = modelo.cloneNode(true); t.style.color = cor; return t;
    }
    function camadaHtml(pag) {
      let d = pag.querySelector(':scope > .tinta-html');
      if (!d) { d = document.createElement('div'); d.className = 'tinta-html'; d.setAttribute('aria-hidden', 'true'); d.setAttribute('contenteditable', 'false'); pag.append(d); }
      return d;
    }
    function tinta(pag) {
      let s = pag.querySelector(':scope > svg.tinta');
      if (!s) { s = svgEl('svg', { class: 'tinta', 'aria-hidden': 'true', contenteditable: 'false' }); pag.append(s); }
      return s;
    }
    // retângulos de um alvo, em coordenadas da página; texto quebrado em linhas dá um por linha
    function caixasDe(e) {
      const pag = e.closest('section.pagina'); if (!pag) return [];
      if (getComputedStyle(e).visibility === 'hidden') return [];
      const P = pag.getBoundingClientRect();
      let rs;
      if (e instanceof SVGElement) {
        const r = e.getBoundingClientRect();
        let top = r.top, bottom = r.bottom;
        // termos na linha principal da fórmula: altura uniforme, como uma faixa de marca-texto
        const raiz = e.ownerSVGElement && e.ownerSVGElement.querySelector(':scope > g');
        const m = raiz && raiz.getScreenCTM();
        if (m) {
          const base = m.f, em = Math.abs(m.d) * 1000;
          if (r.bottom < base + .5 * em && r.top > base - 1.2 * em) { top = Math.min(top, base - .78 * em); bottom = Math.max(bottom, base + .26 * em); }
        }
        rs = [{ left: r.left, top, width: r.width, height: bottom - top }];
      } else rs = [...e.getClientRects()];
      return rs.filter(r => r.width > 0).map(r => ({ pag, x: r.left - P.left, y: r.top - P.top, w: r.width, h: r.height }));
    }
    function marcaAtiva(m) {
      if (m === MK.rascunho || m === DS.rascunho) return true;
      if (m === DS.existente) return false;
      if (m === MK.existente) return false;
      return modoAtual() !== 'aula' || m.classList.contains('visivel');
    }
    var NUM_OK = false;   // a numeração (mais abaixo) já pode rodar
    function desenharMarcas(novas) {
      if (NUM_OK) numerar();
      document.querySelectorAll('.apostila svg.tinta, .apostila .tinta-html').forEach(s => s.replaceChildren());
      const lista = [...document.querySelectorAll('.apostila .marca')];
      if (MK.rascunho) lista.push(MK.rascunho);
      if (DS.rascunho) lista.push(DS.rascunho);
      // a marcação em edição (ou sob o mouse, no modo edição) fica em destaque; as outras, apagadas
      MK.formas = [];
      if (document.body.classList.contains('editando') && !document.body.classList.contains('escolhendo')) garantirPontos();
      const pairadas = !MK.rascunho && document.body.classList.contains('editando') ? MK.pairadas : new Set();
      document.querySelectorAll('.apostila .marca').forEach(c => c.classList.toggle('pairada', pairadas.has(c)));
      const estado = m => MK.rascunho ? (m === MK.rascunho ? 'foco' : 'apagada') : (pairadas.has(m) ? 'foco' : '');
      if (typeof tipoDaLista === 'function') numerarListas();
      if (typeof novoIdNota === 'function') sincronizarNotas();
      ajustarFimDeLinha();
      for (const m of lista) if (marcaAtiva(m)) desenharUma(m, !!(novas && novas.has(m)), estado(m));
      desenharAlcas();
    }
    // âncoras no fim de um parágrafo não ocupam lugar na linha: podem passar da margem direita
    // em vez de empurrar o fim da linha para baixo
    // Âncoras no fim de um parágrafo (ou ao lado de uma equação destacada) passam da margem em vez de
    // quebrar a linha: o bloco ganha, só no modo edição, a largura delas para fora da margem. Assim as
    // âncoras continuam ocupando lugar e o cursor para antes e depois delas.
    // <br> que o navegador deixa no fim de um bloco com texto (às vezes dentro da camada em linha do fim):
    // não muda nada na tela e, dentro de um span.fragment, fazia o Enter levar uma cópia vazia da camada
    function tirarBrFinal(raiz) {
      raiz.querySelectorAll('.apostila p, .apostila h1, .apostila h2, .apostila h3, .apostila h4, .apostila h5, .apostila h6, .apostila li, .apostila blockquote, .apostila .subtitulo').forEach(b => {
        if (!b.textContent.replace(/[\s\u200B]/g, '') && !b.querySelector('mjx-container, img, .marca')) return;   // linha vazia: o <br> a sustenta
        let u = b.lastChild;
        for (;;) {
          while (u && u.nodeType === 3 && !u.data.replace(/[\s\u200B]/g, '')) u = u.previousSibling;
          if (u && u.nodeType === 1 && u.matches('span') && !u.matches('.marca, .ancora-camada')) { u = u.lastChild; continue; }
          break;
        }
        if (!u || u.nodeName !== 'BR') return;
        let a = u.previousSibling; while (a && a.nodeType === 3 && !a.data.replace(/[\s\u200B]/g, '')) a = a.previousSibling;
        if (a && a.nodeName === 'BR') return;   // <br><br>: quebra de linha de verdade no fim
        u.remove();
      });
    }
    function tirarFimDeLinha(raiz) {
      raiz.querySelectorAll('.no-fim').forEach(e => { e.classList.remove('no-fim'); ['margin-right', 'margin-left', 'left', 'width'].forEach(k => e.style.removeProperty(k)); if (!e.getAttribute('style')) e.removeAttribute('style'); if (!e.classList.length) e.removeAttribute('class'); });
    }
    function ajustarFimDeLinha() {
      tirarFimDeLinha(document);
      if (!document.body.classList.contains('editando')) return;
      const blocos = new Set();
      document.querySelectorAll('.apostila .marca, .apostila span.fragment > .ancora-camada').forEach(a => { const b = a.closest(BLOCOS_L); if (b && b.closest('section.pagina')) blocos.add(b); });
      const anc = t => t.el && t.el.matches('.marca, span.fragment > .ancora-camada');
      const vazio = t => t.zw || (!t.el && /\s/.test(t.no.data[t.i])) || (t.el && t.el.matches('.fragment:not(span) > .ancora-camada'));   // a âncora da camada do bloco fica na margem
      const destacada = t => t && t.el && t.el.matches('mjx-container[display="true"]');
      const objeto = t => t && t.el && t.el.matches(OBJETOS + ', table, div.video');
      const larg = g => g.reduce((t, a) => { const cs = getComputedStyle(a); return t + a.getBoundingClientRect().width + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0); }, 0);
      const mudar = [], objs = [];
      for (const b of blocos) {
        const it = itensDoBloco(b), feitos = new Set();
        const juntar = (k, passo) => { const g = []; for (; k >= 0 && k < it.length; k += passo) { const t = it[k]; if (vazio(t)) continue; if (anc(t) && !feitos.has(t.el)) { g.push(t.el); feitos.add(t.el); } else break; } return g; };
        // linha só com um objeto (tabela, vídeo, imagem): as âncoras encostam nele e saem para fora, sem ocupar
        // lugar (margem negativa do tamanho do grupo); o objeto fica onde estava
        const cheios = it.map((t, k) => k).filter(k => !vazio(it[k]) && !anc(it[k]));
        if (cheios.length === 1 && objeto(it[cheios[0]])) {
          const k = cheios[0], antes = juntar(k - 1, -1), depois = juntar(k + 1, 1);
          if (antes.length) objs.push({ e: antes[antes.length - 1], lado: 'marginLeft', w: larg(antes) });
          if (depois.length) objs.push({ e: depois[depois.length - 1], lado: 'marginRight', w: larg(depois) });
          continue;
        }
        let wl = 0, wr = 0; const eqs = [];
        for (let k = 0; k < it.length; k++) if (destacada(it[k])) { eqs.push(it[k].el); wl = Math.max(wl, larg(juntar(k - 1, -1))); wr = Math.max(wr, larg(juntar(k + 1, 1))); }
        wr = Math.max(wr, larg(juntar(it.length - 1, -1)));
        if (wl || wr) mudar.push({ b, wl, wr, eqs, cs: getComputedStyle(b) });
      }
      // medir tudo antes de mudar (mudar um bloco não mexe na largura das âncoras dos outros)
      for (const { e, lado, w } of objs) { e.classList.add('no-fim'); e.style[lado] = (-w) + 'px'; }
      for (const { b, wl, wr, eqs, cs } of mudar) {
        const ml = parseFloat(cs.marginLeft) || 0, mr = parseFloat(cs.marginRight) || 0;
        b.classList.add('no-fim');
        if (wl) b.style.marginLeft = (ml - wl - 2) + 'px';
        if (wr) b.style.marginRight = (mr - wr - 2) + 'px';
        // a equação destacada continua com a largura de antes, no mesmo lugar
        eqs.filter(e => e.matches('mjx-container')).forEach(e => { e.classList.add('no-fim'); e.style.width = 'calc(100% - ' + ((wl ? wl + 2 : 0) + (wr ? wr + 2 : 0)) + 'px)'; });
      }
    }
    // no modo edição, as âncoras logo depois do termo empurram a seta e o visto para a direita
    function depoisDasAncoras(e) {
      const f = e.closest('mjx-container') || e;
      let dir = e.getBoundingClientRect().right;
      if (!document.body.classList.contains('editando') || Math.abs(f.getBoundingClientRect().right - dir) > 3) return dir;
      for (let n = f.nextSibling; n; n = n.nextSibling) {
        if (n.nodeType === 3) { if (/^[\s\u200B]*$/.test(n.data)) continue; break; }
        if (n.nodeType === 1 && n.matches('.marca, .ancora-camada')) { dir = Math.max(dir, n.getBoundingClientRect().right); continue; }
        break;
      }
      return dir;
    }
    function desenharUma(m, anima, estado) {
      const tipo = m.dataset.tipo || 'destaque';
      const paleta = tipo === 'destaque' ? MK_CORES : tipo === 'texto' ? (Strata.temaEscuro() ? MK_CORES_TEXTO_ESCURO : MK_CORES_TEXTO) : MK_TRACOS;
      const cor = paleta[m.dataset.cor] || paleta[MK_PADRAO[tipo]] || '#e01010';
      const nomes = (m.dataset.marca || '').split(/\s+/).filter(Boolean);
      const a = (anima ? ' anima' : '') + (estado ? ' ' + estado : '');
      const moldura = c => { if (estado === 'foco') svgEl('rect', { x: c.x - 6, y: c.y - 4, width: c.w + 12, height: c.h + 8, rx: 4, class: 'moldura' }, tinta(c.pag)); };
      const traco = (s, d) => svgEl('path', { d, class: 'traco' + a, stroke: cor, pathLength: 1 }, s);
      const ponta = (s, x, y, ang) => {   // ponta de seta em (x, y), apontando na direção ang
        const p = k => (x - 11 * Math.cos(ang + k)).toFixed(1) + ',' + (y - 11 * Math.sin(ang + k)).toFixed(1);
        traco(s, `M${p(.45)} L${x.toFixed(1)},${y.toFixed(1)} L${p(-.45)}`);
      };
      if (tipo === 'desenho') return desenharDesenho(m, anima, estado);
      if (tipo === 'liga') {   // seta ligando o primeiro termo ao segundo
        const [A, B] = nomes.map(n => alvosDe(n).flatMap(caixasDe)[0]);
        if (!A || !B || A.pag !== B.pag) return;
        const s = tinta(A.pag); moldura(A); moldura(B);
        [A, B].forEach(c => MK.formas.push({ m, pag: c.pag, x: c.x - 4, y: c.y - 4, w: c.w + 8, h: c.h + 8 }));
        const ax = A.x + A.w / 2, bx = B.x + B.w / 2;
        let ay, by, cx, cy;
        if (Math.abs((A.y + A.h / 2) - (B.y + B.h / 2)) < 12) { ay = A.y + A.h + 2; by = B.y + B.h + 2; cx = (ax + bx) / 2; cy = Math.max(ay, by) + 34; }
        else if (B.y > A.y) { ay = A.y + A.h + 2; by = B.y - 2; cx = (ax + bx) / 2 + 40; cy = (ay + by) / 2; }
        else { ay = A.y - 2; by = B.y + B.h + 2; cx = (ax + bx) / 2 + 40; cy = (ay + by) / 2; }
        traco(s, `M${ax},${ay} Q${cx},${cy} ${bx},${by}`);
        ponta(s, bx, by, Math.atan2(by - cy, bx - cx));
        return;
      }
      for (const n of nomes) for (const e of alvosDe(n)) for (const c of caixasDe(e)) {
        const s = tinta(c.pag), cy = c.y + c.h / 2;
        const dir = (tipo === 'seta' || tipo === 'check' || tipo === 'texto') ? Math.max(c.x + c.w, depoisDasAncoras(e) - c.pag.getBoundingClientRect().left) : c.x + c.w;
        MK.formas.push({ m, pag: c.pag, x: c.x - 4, y: c.y - 4, w: (tipo === 'seta' ? dir + 52 : tipo === 'check' ? dir + 26 : c.x + c.w) - c.x + 8, h: c.h + 8 });
        moldura(c);
        if (tipo === 'destaque') svgEl('rect', { x: c.x - 2, y: c.y, width: c.w + 4, height: c.h, rx: 3, class: 'pinta' + a, fill: cor }, s);
        else if (tipo === 'risca') traco(s, `M${c.x + 1},${c.y + c.h - 3} L${dir - 1},${c.y + 3}`);
        else if (tipo === 'circula') svgEl('ellipse', { cx: c.x + c.w / 2, cy, rx: c.w / 2 + 8, ry: c.h / 2 + 5, class: 'traco' + a, stroke: cor, pathLength: 1 }, s);
        else if (tipo === 'caixa') svgEl('rect', { x: c.x - 4, y: c.y - 2, width: c.w + 8, height: c.h + 4, rx: 2, class: 'traco' + a, stroke: cor, pathLength: 1 }, s);
        else if (tipo === 'seta') { traco(s, `M${dir + 50},${cy} L${dir + 8},${cy}`); ponta(s, dir + 8, cy, Math.PI); }
        else if (tipo === 'texto') {
          const t = textoMarca(m.dataset.texto || '', cor); if (!t) continue;
          Object.assign(t.style, { left: (dir + 8) + 'px', top: cy + 'px' });
          t.className = 'mk-texto' + a; camadaHtml(c.pag).append(t);
          MK.formas[MK.formas.length - 1].w = dir + 14 + t.offsetWidth - c.x;
        }
        else if (tipo === 'check') traco(s, `M${dir + 5},${cy} L${dir + 11},${cy + 7} L${dir + 24},${cy - 10}`);
      }
    }
    new ResizeObserver(() => { clearTimeout(desenharMarcas.t); desenharMarcas.t = setTimeout(() => desenharMarcas(), 60); })
      .observe(document.querySelector('.apostila'));

    // ---------- modo edição: criar e alterar marcações ----------
    // Ao escolher os termos, cada fórmula é desenhada de novo com cada pedaço do LaTeX
    // rotulado (\class{tk-N}{...}); o retângulo arrastado diz quais pedaços foram
    // escolhidos, e o trecho correspondente do LaTeX ganha um \mk{nome}{...}.
    const NAO_TAG = new Set(['pm', 'mp', 'cdot', 'times', 'Imp', 'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'iff', 'implies', 'to', 'le', 'ge', 'leq', 'geq', 'ne', 'neq',
      'approx', 'equiv', 'sim', 'in', 'quad', 'qquad', ',', ';', ':', '!', ' ', '\\', 'displaystyle', 'textstyle', 'scriptstyle', 'phantom', 'hphantom', 'vphantom',
      'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr', 'right', 'nonumber', 'notag', 'label', 'tag', 'hline']);
    const ARGS = { frac: 2, dfrac: 2, tfrac: 2, binom: 2, sqrt: 1, mk: 2, class: 2, textcolor: 2, red: 1, blue: 1, mt: 1, text: 1, mbox: 1, operatorname: 1,
      mathrm: 1, mathbf: 1, mathit: 1, phantom: 1, hphantom: 1, vphantom: 1, hat: 1, bar: 1, overline: 1, underline: 1, vec: 1, dot: 1, ddot: 1, tilde: 1, boxed: 1,
      underbrace: 1, overbrace: 1, label: 1, tag: 1 };
    const SEM_FILHOS = { mt: [0], text: [0], mbox: [0], operatorname: [0], mathrm: [0], mk: [0], class: [0], textcolor: [0], label: [0], tag: [0],
      phantom: [0], hphantom: [0], vphantom: [0] };
    function fechar(tex, i) {   // i aponta para '{'; devolve o índice do '}' correspondente
      let d = 0;
      for (let k = i; k < tex.length; k++) { const c = tex[k]; if (c === '\\') { k++; continue; } if (c === '{') d++; else if (c === '}' && --d === 0) return k; }
      return tex.length - 1;
    }
    function pularEsp(tex, i, e) { while (i < e && /\s/.test(tex[i])) i++; return i; }
    function lerArg(tex, i, e) {
      i = pularEsp(tex, i, e);
      if (tex[i] === '{') { const b = fechar(tex, i); return { a: i + 1, b, fim: b + 1 }; }
      if (tex[i] === '\\') { const m = /^\\([A-Za-z]+|.)/.exec(tex.slice(i)); return { a: i, b: i + m[0].length, fim: i + m[0].length, solto: true }; }
      return { a: i, b: i + 1, fim: Math.min(i + 1, e), solto: true };
    }
    function tokenizar(tex, s, e, pai) {
      const seq = { s, e, nos: [], pai };
      let i = s;
      while (i < e) {
        const c = tex[i];
        if (/\s/.test(c) || c === '&') { i++; continue; }
        const no = { s: i, e: i, tag: true, filhos: [], seq };
        if (c === '\\') {
          const m = /^\\([A-Za-z]+|.)/.exec(tex.slice(i, e)); const nome = m[1]; i += m[0].length;
          if (nome === 'left') {   // \left( ... \right) vira um termo só (com o conteúdo como filho)
            const d0 = lerArg(tex, i, e); let d = 1, k = e, ini = d0.fim, fimInt = e;
            const re = /\\(left|right)(?![A-Za-z])/g; re.lastIndex = ini; let r;
            while ((r = re.exec(tex)) && r.index < e) { if (r[1] === 'left') d++; else if (--d === 0) { fimInt = r.index; k = r.index + r[0].length; break; } }
            no.filhos.push(tokenizar(tex, ini, fimInt, no));
            i = lerArg(tex, k, e).fim;
          } else if (nome === 'begin') {
            const env = lerArg(tex, i, e); const nomeEnv = tex.slice(env.a, env.b);
            const fimEnv = tex.indexOf('\\end{' + nomeEnv + '}', env.fim);
            i = fimEnv < 0 ? e : fimEnv + ('\\end{' + nomeEnv + '}').length; no.tag = false;
          } else {
            if (nome === 'sqrt') { const j = pularEsp(tex, i, e); if (tex[j] === '[') i = tex.indexOf(']', j) + 1; }
            const n = ARGS[nome] || 0;
            for (let k = 0; k < n; k++) {
              const a = lerArg(tex, i, e);
              if (!a.solto && !(SEM_FILHOS[nome] || []).includes(k)) no.filhos.push(tokenizar(tex, a.a, a.b, no));
              i = a.fim;
            }
            if (NAO_TAG.has(nome)) no.tag = false;
          }
        } else if (c === '{') { const b = fechar(tex, i); no.filhos.push(tokenizar(tex, i + 1, b, no)); i = b + 1; }
        else { i++; if ('+-=<>,;:.!|/'.includes(c)) no.tag = false; }
        for (;;) {   // expoentes, índices e linhas ficam com a base
          const j = pularEsp(tex, i, e);
          if (tex[j] === "'") { i = j + 1; continue; }
          if (tex[j] === '^' || tex[j] === '_') {
            const a = lerArg(tex, j + 1, e);
            if (!a.solto) no.filhos.push(tokenizar(tex, a.a, a.b, no));
            i = a.fim; continue;
          }
          break;
        }
        no.e = i; seq.nos.push(no);
      }
      return seq;
    }
    function rotular(tex, seq, reg) {
      let out = '', pos = seq.s;
      for (const no of seq.nos) {
        out += tex.slice(pos, no.s);
        let dentro = '', p = no.s;
        for (const f of no.filhos) { dentro += tex.slice(p, f.s) + rotular(tex, f, reg); p = f.e; }
        dentro += tex.slice(p, no.e);
        if (no.tag) { no.id = reg.push(no) - 1; out += '\\class{tk-' + no.id + '}{' + dentro + '}'; } else out += dentro;
        pos = no.e;
      }
      return out + tex.slice(pos, seq.e);
    }
    async function rotularFormula(atual, tex, original) {
      const seq = tokenizar(tex, 0, tex.length, null), reg = [];
      let novo;
      try { novo = await MathJax.tex2svgPromise(rotular(tex, seq, reg), { display: atual.dataset.display === '1' }); } catch (e) { return false; }
      if (novo.querySelector('[data-mjx-error], merror')) return false;
      novo.dataset.tex = tex; novo.dataset.display = atual.dataset.display;
      novo.setAttribute('contenteditable', 'false'); novo.classList.add('rotulado');
      atual.replaceWith(novo);
      MK.esc.push({ el: novo, original, tex, reg });
      return true;
    }
    async function prepararEscolha() {
      MK.esc = [];
      for (const c of [...document.querySelectorAll('.apostila mjx-container')]) if (c.dataset.tex != null) await rotularFormula(c, c.dataset.tex, c);
    }
    function encerrarEscolha() {
      MK.esc.forEach(it => { if (it.el.isConnected) it.el.replaceWith(it.original); });
      MK.esc = [];
    }
    function nomesUsados() {
      const s = new Set();
      document.querySelectorAll('.apostila mjx-container').forEach(c => { for (const m of (c.dataset.tex || '').matchAll(/\\mk\{([\w-]+)\}/g)) s.add(m[1]); });
      document.querySelectorAll('.apostila [data-mk]').forEach(e => s.add(e.dataset.mk));
      return s;
    }
    function novoNome() { const u = nomesUsados(); let k = 1; while (u.has('m' + k)) k++; return 'm' + k; }
    // pedaços do LaTeX dentro do retângulo R (ou sob o ponto, se foi só um clique)
    function escolherNaFormula(it, R, ponto) {
      const cx = b => (b.left + b.right) / 2, cy = b => (b.top + b.bottom) / 2;
      const caixas = it.reg.map(no => { const g = it.el.querySelector('svg .tk-' + no.id); return g ? g.getBoundingClientRect() : null; });
      let sel = [];
      if (ponto) {
        let melhor = -1, area = Infinity;
        caixas.forEach((b, i) => { if (b && b.left - 2 <= R.left && R.left <= b.right + 2 && b.top - 2 <= R.top && R.top <= b.bottom + 2 && b.width * b.height < area) { area = b.width * b.height; melhor = i; } });
        if (melhor >= 0) sel = [it.reg[melhor]];
      } else {
        caixas.forEach((b, i) => { if (b && b.width && cx(b) >= R.left && cx(b) <= R.right && cy(b) >= R.top && cy(b) <= R.bottom) sel.push(it.reg[i]); });
        const S = new Set(sel);
        sel = sel.filter(no => { for (let p = no.seq.pai; p; p = p.seq.pai) if (S.has(p)) return false; return true; });
      }
      if (!sel.length) return null;
      const caminho = no => { const c = []; for (let n = no; n; n = n.seq.pai) c.unshift(n.seq); return c; };
      const cs = sel.map(caminho);
      let k = 0; while (cs.every(c => k < c.length && c[k] === cs[0][k])) k++;
      const S0 = cs[0][k - 1];
      const idx = sel.map(no => { let n = no; while (n.seq !== S0) n = n.seq.pai; return S0.nos.indexOf(n); });
      const i0 = Math.min(...idx), i1 = Math.max(...idx);
      return { s: S0.nos[i0].s, e: S0.nos[i1].e, S0, i0, i1 };
    }
    function nomeExistente(tex, x) {
      const m = /^\\mk\{([\w-]+)\}\s*\{/.exec(tex.slice(x.s, x.e));
      if (m && fechar(tex, x.s + m[0].length - 1) === x.e - 1) return m[1];
      const pai = x.S0.pai;
      if (pai && x.i0 === 0 && x.i1 === x.S0.nos.length - 1 && pai.filhos[0] === x.S0) { const m2 = /^\\mk\{([\w-]+)\}/.exec(tex.slice(pai.s, pai.e)); if (m2) return m2[1]; }
      return null;
    }
    async function escolherRetangulo(R, ponto) {
      for (const it of [...MK.esc]) {
        const B = it.el.getBoundingClientRect();
        if (B.right < R.left || B.left > R.right || B.bottom < R.top || B.top > R.bottom) continue;
        const x = escolherNaFormula(it, R, ponto); if (!x) continue;
        let nome = nomeExistente(it.tex, x);
        if (!nome) {
          nome = novoNome();
          const tex = it.tex.slice(0, x.s) + '\\mk{' + nome + '}{' + it.tex.slice(x.s, x.e) + '}' + it.tex.slice(x.e);
          const original = await renderTex(tex, it.el.dataset.display === '1');
          MK.esc.splice(MK.esc.indexOf(it), 1);
          if (!(await rotularFormula(it.el, tex, original))) it.el.replaceWith(original);
          sujo(true);
        }
        adicionarAlvo(nome);
        return;
      }
      avisar('Nenhum termo aí');
    }
    function escolherTexto() {
      const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) return;
      const r = sel.getRangeAt(0);
      const n = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
      if (!n.closest('section.pagina') || n.closest('mjx-container')) return;
      if (r.cloneContents().querySelector('mjx-container, .marca')) return avisar('Para fórmulas, arraste sobre os termos');
      const ja = n.closest('[data-mk]');
      if (ja && ja.textContent.trim() === r.toString().trim()) { adicionarAlvo(ja.dataset.mk); sel.removeAllRanges(); return; }
      const s = document.createElement('span'); s.dataset.mk = novoNome();
      s.append(r.extractContents()); r.insertNode(s); sel.removeAllRanges();
      sujo(true); adicionarAlvo(s.dataset.mk);
    }
    function adicionarAlvo(nome) {
      const l = (MK.rascunho.dataset.marca || '').split(/\s+/).filter(Boolean);
      if (!l.includes(nome)) l.push(nome);
      MK.rascunho.dataset.marca = l.join(' ');
      atualizarPainel(); desenharMarcas();
    }
    function rotuloDe(nome) {
      for (const c of document.querySelectorAll('.apostila mjx-container')) {
        const t = c.dataset.tex || '', i = t.indexOf('\\mk{' + nome + '}');
        if (i < 0) continue;
        const a = t.indexOf('{', i + 4 + nome.length + 1);
        return t.slice(a + 1, fechar(t, a)).replace(/\\mk\{[\w-]+\}/g, '').trim();
      }
      const e = document.querySelector('.apostila [data-mk="' + nome + '"]');
      return e ? '“' + e.textContent.trim() + '”' : nome;
    }
    function atualizarPainel() {
      const r = MK.rascunho;
      $('pm-linha-texto').hidden = r.dataset.tipo !== 'texto';
      $('pm-cores-texto').hidden = r.dataset.tipo !== 'texto'; $('pm-cores-marca').hidden = r.dataset.tipo === 'texto';
      if (document.activeElement !== $('pm-texto')) $('pm-texto').value = r.dataset.texto || '';
      document.querySelectorAll('#painel-marca [data-tipo]').forEach(b => b.classList.toggle('ativo', b.dataset.tipo === r.dataset.tipo));
      document.querySelectorAll('#painel-marca [data-cor]').forEach(b => b.classList.toggle('ativo', b.dataset.cor === r.dataset.cor));
      const box = $('pm-termos'); box.innerHTML = '';
      const nomes = (r.dataset.marca || '').split(/\s+/).filter(Boolean);
      if (!nomes.length) box.innerHTML = '<span class="pm-dica">nenhum ainda</span>';
      nomes.forEach(n => {
        const t = document.createElement('span'); t.className = 'pm-termo'; t.textContent = rotuloDe(n);
        const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.title = 'Tirar este termo';
        x.onclick = () => { r.dataset.marca = nomes.filter(k => k !== n).join(' '); atualizarPainel(); desenharMarcas(); };
        t.append(x); box.append(t);
      });
    }
    function prepararIcone(m) {
      m.setAttribute('contenteditable', 'false'); m.setAttribute('draggable', 'true');
      m.title = 'Marcação: clique para alterar; arraste para mudar o momento em que ela aparece';
      m.innerHTML = MK_ICONES[m.dataset.tipo] || MK_ICONES.destaque;
    }
    async function abrirPainel(existente, tipo) {
      if (document.body.classList.contains('escolhendo')) return;
      if (MK.limpeza) await MK.limpeza;
      MK.existente = existente || null;
      if (existente) { MK.rascunho = existente.cloneNode(false); existente.classList.add('editando-agora'); MK.range = null; }
      else {
        if (!ED.range) return avisar('Clique no texto, no ponto em que a marcação deve aparecer');
        MK.range = ED.range.cloneRange();
        MK.rascunho = document.createElement('span');
        tipo = MK_PADRAO[tipo] ? tipo : 'destaque';
        Object.assign(MK.rascunho.dataset, { marca: '', tipo, cor: MK_PADRAO[tipo] });
      }
      document.body.classList.add('escolhendo');
      document.querySelectorAll('section.pagina').forEach(s => s.setAttribute('contenteditable', 'false'));
      $('editor-eq').hidden = true;
      $('pm-apagar').style.display = existente ? '' : 'none';
      $('painel-marca').hidden = false; atualizarPainel();
      await prepararEscolha(); desenharMarcas();
    }
    // tira os rótulos (\mk e data-mk) que nenhuma marcação usa mais
    async function limparRotulos() {
      const usados = new Set();
      document.querySelectorAll('.apostila .marca').forEach(m => (m.dataset.marca || '').split(/\s+/).forEach(n => n && usados.add(n)));
      document.querySelectorAll('.apostila [data-mk]').forEach(e => { if (!usados.has(e.dataset.mk)) { e.replaceWith(...e.childNodes); sujo(true); } });
      for (const c of [...document.querySelectorAll('.apostila mjx-container')]) {
        let t = c.dataset.tex; if (t == null || !t.includes('\\mk{')) continue;
        const t0 = t;
        for (const m of [...t0.matchAll(/\\mk\{([\w-]+)\}/g)]) {
          if (usados.has(m[1])) continue;
          const i = t.indexOf('\\mk{' + m[1] + '}'); if (i < 0) continue;
          const a = t.indexOf('{', i + 4 + m[1].length + 1), b = fechar(t, a);
          t = t.slice(0, i) + t.slice(a + 1, b) + t.slice(b + 1);
        }
        if (t !== t0) { c.replaceWith(await renderTex(t, c.dataset.display === '1')); sujo(true); }
      }
      desenharMarcas();
    }
    function fecharPainel() {
      encerrarEscolha();
      if (MK.existente) MK.existente.classList.remove('editando-agora');
      MK.rascunho = null; MK.existente = null; MK.range = null;
      document.body.classList.remove('escolhendo'); $('painel-marca').hidden = true;
      if (document.body.classList.contains('editando')) document.querySelectorAll('section.pagina').forEach(s => s.setAttribute('contenteditable', 'true'));
      desenharMarcas(); MK.limpeza = limparRotulos(); histAgendar();
    }
    function concluirMarca() {
      const r = MK.rascunho;
      if (!(r.dataset.marca || '').trim()) return avisar('Escolha ao menos um termo');
      let m = MK.existente;
      if (!m) { m = document.createElement('span'); m.className = 'fragment marca'; prepararIcone(m); MK.range.collapse(false); MK.range.insertNode(m); escolherUltimo(r.dataset.tipo, r.dataset.cor || ''); }
      ['marca', 'tipo', 'cor'].forEach(k => { m.dataset[k] = r.dataset[k]; });
      if (r.dataset.tipo === 'texto' && r.dataset.texto) m.dataset.texto = r.dataset.texto; else m.removeAttribute('data-texto');
      m.innerHTML = MK_ICONES[m.dataset.tipo] || MK_ICONES.destaque;
      sujo(true); fecharPainel();
    }
    // botão Marcar: abre com o último tipo usado; a setinha escolhe outro tipo
    MK.ultimo = MK_PADRAO[lembrar('apostila-marca')] ? lembrar('apostila-marca') : 'destaque';
    MK.ultimaCor = lembrar('strata-marca-cor') || '';
    function corDaMarca(t, c) {
      const pal = t === 'destaque' ? MK_CORES : t === 'texto' ? (Strata.temaEscuro() ? MK_CORES_TEXTO_ESCURO : MK_CORES_TEXTO) : MK_TRACOS;
      return pal[c] || pal[MK_PADRAO[t]] || '';
    }
    function escolherUltimo(t, cor) {
      MK.ultimo = t; lembrar('apostila-marca', t);
      if (cor !== undefined) { MK.ultimaCor = cor || ''; lembrar('strata-marca-cor', MK.ultimaCor); }
      const hex = corDaMarca(t, MK.ultimaCor), b = $('b-marcar');
      // destaque: a cor vai na faixa do marca-texto; nos outros, no traço
      b.innerHTML = (t === 'destaque' ? MK_ICONES[t].replace('#f0c000', hex) : MK_ICONES[t]) + emblema(EMB_MARCADOR); b.dataset.tipo = t;
      if (t === 'destaque') b.style.removeProperty('color'); else b.style.color = hex;
      document.querySelectorAll('#c-marcar .combo-menu button').forEach(b => b.classList.toggle('ativo', b.dataset.tipo === t));
    }
    document.querySelectorAll('#c-marcar .combo-menu button').forEach(b => { b.querySelector('.ci').innerHTML = MK_ICONES[b.dataset.tipo]; });
    escolherUltimo(MK.ultimo);
    $('b-marcar').onclick = () => abrirPainel(null, MK.ultimo);
    combo('c-marcar', b => { escolherUltimo(b.dataset.tipo, b.dataset.tipo === MK.ultimo ? undefined : ''); abrirPainel(null, b.dataset.tipo); });
    document.querySelectorAll('#painel-marca [data-tipo]').forEach(b => { b.innerHTML = MK_ICONES[b.dataset.tipo]; });
    // pairar sobre uma marcação (ou sua âncora) destaca a âncora e as marcações da mesma camada
    function pairar(m) {
      if (m === MK.foco) return;
      MK.foco = m;
      const p = m && passoDe(m);
      MK.pairadas = new Set(p ? p.els.filter(e => e.classList.contains('marca')) : m ? [m] : []);
      if (!MK.rascunho) desenharMarcas();
    }
    document.addEventListener('mousemove', ev => {
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo') || MK.drag) return;
      if (document.body.classList.contains('desenhando')) return pairar(null);   // desenhando: nada da página reage ao mouse
      let m = ev.target.closest && ev.target.closest('.apostila .marca');
      if (!m) {
        const pag = ev.target.closest && ev.target.closest('section.pagina');
        if (pag) {
          const P = pag.getBoundingClientRect(), x = ev.clientX - P.left, y = ev.clientY - P.top;
          const f = MK.formas.find(f => f.pag === pag && x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
          m = f ? f.m : null;
        }
      }
      pairar(m || null);
    });
    document.querySelectorAll('#painel-marca button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    document.querySelectorAll('#painel-marca [data-tipo]').forEach(b => b.onclick = () => {
      const r = MK.rascunho, antes = r.dataset.tipo;
      r.dataset.tipo = b.dataset.tipo;
      const paletaDe = t => t === 'texto' ? MK_CORES_TEXTO : MK_CORES;
      if (r.dataset.cor === MK_PADRAO[antes] || !paletaDe(b.dataset.tipo)[r.dataset.cor]) r.dataset.cor = MK_PADRAO[b.dataset.tipo];
      atualizarPainel(); desenharMarcas();
      if (b.dataset.tipo === 'texto') $('pm-texto').focus();
    });
    document.querySelectorAll('#painel-marca [data-cor]').forEach(b => b.onclick = () => { MK.rascunho.dataset.cor = b.dataset.cor; atualizarPainel(); desenharMarcas(); });
    $('pm-ok').onclick = concluirMarca;
    $('pm-texto').addEventListener('input', () => { MK.rascunho.dataset.texto = $('pm-texto').value; clearTimeout(desenharMarcas.t); desenharMarcas.t = setTimeout(() => desenharMarcas(), 200); });
    $('pm-cancelar').onclick = fecharPainel;
    $('pm-apagar').onclick = () => { const m = MK.existente; m.remove(); fecharPainel(); sujo(true); };

    // ---------- desenho: camada de traços livres na página ----------
    // <span class="fragment marca" data-tipo="desenho" data-tracos="..."> no ponto do texto em que aparece.
    // Cada traço: "ferramenta cor espessura: x,y x,y ...", separados por ";". x é medido a partir da
    // esquerda da página e y a partir do alto do bloco em que está a âncora, em px de uma página de 860 px:
    // se o texto de cima muda, o desenho acompanha o parágrafo.
    const DS_CORES = { preto: '#111111', azul: '#3333cc', laranja: '#ff8000', vermelho: '#d01c1c', verde: '#1b8a3a', roxo: '#8e24aa', amarelo: '#ffe600' };
    const DS_CORES_ESCURO = Object.assign({}, MK_CORES_TEXTO_ESCURO, { amarelo: '#ffe600' });
    const DS_FERR = ['livre', 'marca', 'linha', 'seta', 'ret', 'elipse'];
    function lerTracos(t) {
      return (t || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
        const k = x.indexOf(':'); if (k < 0) return null;
        const [ferr, cor, esp] = x.slice(0, k).trim().split(/\s+/);
        const pts = x.slice(k + 1).trim().split(/\s+/).map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(isFinite));
        return DS_FERR.includes(ferr) && pts.length ? { ferr, cor: cor || 'vermelho', esp: +esp || 2.6, pts } : null;
      }).filter(Boolean);
    }
    const escreverTracos = l => l.map(t => `${t.ferr} ${t.cor} ${t.esp}: ` + t.pts.map(p => p.map(v => Math.round(v * 10) / 10).join(',')).join(' ')).join('; ');
    function simplificar(pts, eps) {   // Ramer-Douglas-Peucker
      if (pts.length < 3) return pts;
      const [a, b] = [pts[0], pts[pts.length - 1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      let im = 0, dm = 0;
      for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L; if (d > dm) { dm = d; im = i; } }
      if (dm <= eps) return [a, b];
      return simplificar(pts.slice(0, im + 1), eps).slice(0, -1).concat(simplificar(pts.slice(im), eps));
    }
    // referência do desenho: página, esquerda da página e alto do bloco da âncora (em px da tela) e escala
    function refDesenho(m) {
      const ancora = m.isConnected ? m : null;
      const bloco = ancora ? (ancora.closest(BLOCOS_L) || ancora.closest('section.pagina')) : DS.bloco;
      const pag = bloco && bloco.closest('section.pagina'); if (!pag) return null;
      const P = pag.getBoundingClientRect(), B = bloco.getBoundingClientRect();
      return { pag, P, x0: 0, y0: B.top - P.top, k: P.width / 860 };
    }
    // geometria de um traço, em px da página
    function formaDoTraco(t, R) {
      const q = t.pts.map(([x, y]) => [R.x0 + x * R.k, R.y0 + y * R.k]), e = t.esp * Math.max(R.k, .5);
      const f = n => n.toFixed(1);
      let d;
      if (t.ferr === 'livre' || t.ferr === 'marca') {
        if (q.length === 1) d = `M${f(q[0][0])},${f(q[0][1])} l0.01,0`;
        else { d = `M${f(q[0][0])},${f(q[0][1])}`; for (let i = 1; i < q.length - 1; i++) d += ` Q${f(q[i][0])},${f(q[i][1])} ${f((q[i][0] + q[i + 1][0]) / 2)},${f((q[i][1] + q[i + 1][1]) / 2)}`; const z = q[q.length - 1]; d += ` L${f(z[0])},${f(z[1])}`; }
      } else {
        const [a, b] = [q[0], q[q.length - 1]];
        if (t.ferr === 'linha') d = `M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}`;
        else if (t.ferr === 'seta') {
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = 7 + 2.2 * e, p = k => f(b[0] - c * Math.cos(ang + k)) + ',' + f(b[1] - c * Math.sin(ang + k));
          d = `M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])} M${p(.45)} L${f(b[0])},${f(b[1])} L${p(-.45)}`;
        } else if (t.ferr === 'ret') { const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]); d = `M${f(x)},${f(y)} h${f(w)} v${f(h)} h${f(-w)} Z`; }
        else { const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2 || .5, ry = Math.abs(b[1] - a[1]) / 2 || .5; d = `M${f(cx - rx)},${f(cy)} A${f(rx)},${f(ry)} 0 1 0 ${f(cx + rx)},${f(cy)} A${f(rx)},${f(ry)} 0 1 0 ${f(cx - rx)},${f(cy)}`; }
      }
      return { d, e: t.ferr === 'marca' ? Math.max(12, e * 4) : e, q };
    }
    function pontosDaForma(t, R) {   // pontos para medir a distância (borracha) e a caixa
      const { q } = formaDoTraco(t, R);
      if (t.ferr === 'ret' || t.ferr === 'elipse') {
        const [a, b] = [q[0], q[q.length - 1]], l = [];
        if (t.ferr === 'ret') return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]];
        const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
        for (let i = 0; i <= 36; i++) l.push([cx + rx * Math.cos(i / 36 * 2 * Math.PI), cy + ry * Math.sin(i / 36 * 2 * Math.PI)]);
        return l;
      }
      return q;
    }
    function desenharDesenho(m, anima, estado) {
      const R = refDesenho(m); if (!R) return;
      const s = tinta(R.pag), paleta = Strata.temaEscuro() ? DS_CORES_ESCURO : DS_CORES;
      const tracos = lerTracos(m.dataset.tracos); if (!tracos.length) return;
      let atraso = 0;
      tracos.forEach(t => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const { d, e } = formaDoTraco(t, R);
        const el = svgEl('path', { d, class: 'traco' + (t.ferr === 'marca' ? ' marca-livre' : '') + (anima ? ' anima' : '') + (estado === 'apagada' ? ' apagada' : ''), stroke: paleta[t.cor] || paleta.vermelho, pathLength: 1 }, s);
        el.style.strokeWidth = e;
        const pts = pontosDaForma(t, R);
        let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (anima) { const dur = Math.min(1.2, Math.max(.25, L / 700)); el.style.animationDuration = dur + 's'; el.style.animationDelay = atraso + 's'; atraso += dur * .8; }
        pts.forEach(([x, y]) => { x0 = Math.min(x0, x - e); y0 = Math.min(y0, y - e); x1 = Math.max(x1, x + e); y1 = Math.max(y1, y + e); });
        // cada traço tem a sua área (pairar) e a sua moldura (destaque), como as marcações
        MK.formas.push({ m, pag: R.pag, x: x0 - 4, y: y0 - 4, w: x1 - x0 + 8, h: y1 - y0 + 8 });
        if (estado === 'foco' && m !== DS.rascunho) svgEl('rect', { x: x0 - 6, y: y0 - 6, width: x1 - x0 + 12, height: y1 - y0 + 12, rx: 4, class: 'moldura' }, s);
      });
    }

    // modo desenho: a página deixa de ser editável e o mouse (caneta, dedo) desenha
    function abrirDesenho(existente) {
      if (document.body.classList.contains('escolhendo') || DS.rascunho) return;
      lerCursor();
      if (!existente && !ED.range) return avisar('Clique no texto, no ponto em que o desenho deve aparecer');
      DS.existente = existente || null; DS.desfeitos = [];
      DS.rascunho = document.createElement('span'); DS.rascunho.dataset.tipo = 'desenho';
      if (existente) { DS.rascunho.dataset.tracos = existente.dataset.tracos || ''; DS.bloco = existente.closest(BLOCOS_L) || existente.closest('section.pagina'); existente.classList.add('editando-agora'); }
      else { DS.range = ED.range.cloneRange(); DS.rascunho.dataset.tracos = ''; const n = noDe(DS.range.startContainer); DS.bloco = n.closest(BLOCOS_L) || n.closest('section.pagina'); }
      document.body.classList.add('desenhando'); pairar(null);
      document.querySelectorAll('section.pagina').forEach(s => s.setAttribute('contenteditable', 'false'));
      getSelection().removeAllRanges();
      $('editor-eq').hidden = true; $('pd-apagar').style.display = existente ? '' : 'none';
      $('painel-desenho').hidden = false; mostrarDesenho(); desenharMarcas();
    }
    function fecharDesenho() {
      if (DS.existente) DS.existente.classList.remove('editando-agora');
      DS.rascunho = null; DS.existente = null; DS.range = null; DS.bloco = null; DS.vivo = null;
      document.body.classList.remove('desenhando'); $('painel-desenho').hidden = true;
      if (document.body.classList.contains('editando')) document.querySelectorAll('section.pagina').forEach(s => s.setAttribute('contenteditable', 'true'));
      desenharMarcas(); histAgendar();
    }
    function concluirDesenho() {
      const t = DS.rascunho.dataset.tracos;
      if (!t.trim()) { if (DS.existente) { DS.existente.remove(); sujo(true); iconesCamada(); } return fecharDesenho(); }
      let m = DS.existente;
      if (!m) {
        m = document.createElement('span'); m.className = 'fragment marca'; m.dataset.tipo = 'desenho';
        prepararIcone(m); const r = DS.range; r.collapse(false);
        // depois do <br> que fecha o bloco, a âncora cairia numa linha vazia: entra antes dele
        let ant = r.startContainer.nodeType === 1 ? r.startContainer.childNodes[r.startOffset - 1] : (r.startOffset === 0 ? r.startContainer.previousSibling : null);
        while (ant && ant.nodeType === 3 && !ant.data.replace(/\u200B/g, '')) ant = ant.previousSibling;
        if (ant && ant.nodeName === 'BR' && !(ant.nextSibling && ant.nextSibling.textContent.replace(/[\s\u200B]/g, ''))) r.setStartBefore(ant);
        r.insertNode(m);
      }
      m.dataset.tracos = t;
      iconesCamada(); sujo(true); fecharDesenho();
      const r = document.createRange(); r.setStartAfter(m); r.collapse(true); const sec = m.closest('section.pagina'); if (sec) { sec.focus({ preventScroll: true }); getSelection().removeAllRanges(); getSelection().addRange(r); lerCursor(); }
    }
    function mostrarDesenho() {
      document.querySelectorAll('#painel-desenho [data-ferr]').forEach(b => b.classList.toggle('ativo', b.dataset.ferr === DS.ferr));
      document.querySelectorAll('#painel-desenho [data-dcor]').forEach(b => b.classList.toggle('ativo', b.dataset.dcor === DS.cor));
      document.querySelectorAll('#painel-desenho [data-esp]').forEach(b => b.classList.toggle('ativo', b.dataset.esp === DS.esp));
      $('pd-desfazer').disabled = !lerTracos(DS.rascunho && DS.rascunho.dataset.tracos).length;
    }
    try { const g = JSON.parse(lembrar('strata-desenho') || '{}'); if (DS_FERR.includes(g.ferr) || g.ferr === 'borracha') DS.ferr = g.ferr; if (DS_CORES[g.cor]) DS.cor = g.cor; if (['1.6', '2.6', '4.5'].includes(g.esp)) DS.esp = g.esp; } catch (e) {}
    const guardarEscolha = () => { lembrar('strata-desenho', JSON.stringify({ ferr: DS.ferr, cor: DS.cor, esp: DS.esp })); mostrarBotaoDesenho(); };
    // botão Desenhar: a última ferramenta, na última cor, com a pena como emblema
    function ferrBotao() { return DS_FERR.includes(DS.ferr) ? DS.ferr : 'livre'; }
    function mostrarBotaoDesenho() {
      const f = ferrBotao(), hex = (Strata.temaEscuro() ? DS_CORES_ESCURO : DS_CORES)[DS.cor] || '', b = $('b-desenho');
      const ic = document.querySelector('#painel-desenho [data-ferr="' + f + '"]').innerHTML;
      b.innerHTML = (f === 'marca' ? ic.replace('#f0c000', hex) : ic) + emblema(EMB_PENA);
      if (f === 'marca') b.style.removeProperty('color'); else b.style.color = hex;
      b.title = b.title.replace(/ Agora: .*$/, '') + ' Agora: ' + document.querySelector('#painel-desenho [data-ferr="' + f + '"]').title.toLowerCase() + ', ' + DS.cor + '.';
      document.querySelectorAll('#c-desenho .combo-menu button').forEach(x => x.classList.toggle('ativo', x.dataset.ferr === f));
    }
    document.querySelectorAll('#c-desenho .combo-menu button').forEach(x => { x.querySelector('.ci').innerHTML = document.querySelector('#painel-desenho [data-ferr="' + x.dataset.ferr + '"]').innerHTML; });
    function escolherFerr(f) {
      DS.ferr = f;
      if (DS.ferr === 'marca' && !['amarelo', 'verde', 'azul', 'laranja'].includes(DS.cor)) DS.cor = 'amarelo';   // marca-texto: cor clara
      else if (DS.ferr !== 'marca' && DS.ferr !== 'borracha' && DS.cor === 'amarelo') DS.cor = 'vermelho';
      guardarEscolha(); mostrarDesenho();
    }
    combo('c-desenho', x => { escolherFerr(x.dataset.ferr); abrirDesenho(null); });
    // a cor do botão muda com o tema
    new MutationObserver(() => { mostrarBotaoDesenho(); escolherUltimo(MK.ultimo); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('#painel-desenho [data-ferr]').forEach(b => b.onclick = () => escolherFerr(b.dataset.ferr));
    mostrarBotaoDesenho();
    document.querySelectorAll('#painel-desenho [data-dcor]').forEach(b => b.onclick = () => { DS.cor = b.dataset.dcor; if (DS.ferr === 'borracha') DS.ferr = 'livre'; guardarEscolha(); mostrarDesenho(); });
    document.querySelectorAll('#painel-desenho [data-esp]').forEach(b => b.onclick = () => { DS.esp = b.dataset.esp; if (DS.ferr === 'borracha') DS.ferr = 'livre'; guardarEscolha(); mostrarDesenho(); });
    document.querySelectorAll('#painel-desenho button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    function desfazerTraco() {
      const l = lerTracos(DS.rascunho.dataset.tracos); if (!l.length) return;
      l.pop(); DS.rascunho.dataset.tracos = escreverTracos(l); mostrarDesenho(); desenharMarcas();
    }
    $('b-desenho').onclick = () => abrirDesenho(null);
    $('pd-ok').onclick = concluirDesenho;
    $('pd-cancelar').onclick = fecharDesenho;
    $('pd-desfazer').onclick = desfazerTraco;
    $('pd-apagar').onclick = () => { const m = DS.existente; fecharDesenho(); if (m) { m.remove(); sujo(true); iconesCamada(); desenharMarcas(); } };
    // traçar
    function pontoDe(ev) {
      const R = refDesenho(DS.rascunho); if (!R) return null;
      return { R, x: (ev.clientX - R.P.left - R.x0) / R.k, y: (ev.clientY - R.P.top - R.y0) / R.k };
    }
    function apagarEm(ev) {
      const R = refDesenho(DS.rascunho); if (!R) return;
      const X = ev.clientX - R.P.left, Y = ev.clientY - R.P.top, l = lerTracos(DS.rascunho.dataset.tracos);
      const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let u = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; u = Math.max(0, Math.min(1, u)); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); };
      const resto = l.filter(t => { const q = pontosDaForma(t, R), e = formaDoTraco(t, R).e / 2 + 6; if (q.length === 1) return Math.hypot(X - q[0][0], Y - q[0][1]) > e; for (let i = 1; i < q.length; i++) if (dist([X, Y], q[i - 1], q[i]) <= e) return false; return true; });
      if (resto.length !== l.length) { DS.rascunho.dataset.tracos = escreverTracos(resto); mostrarDesenho(); desenharMarcas(); }
    }
    function desenharVivo() {
      const v = DS.vivo; if (!v) return;
      const R = refDesenho(DS.rascunho); if (!R) return;
      if (!v.el || !v.el.isConnected) { v.el = svgEl('path', { class: 'traco' + (v.t.ferr === 'marca' ? ' marca-livre' : '') }, tinta(R.pag)); }
      const { d, e } = formaDoTraco(v.t, R);
      v.el.setAttribute('d', d); v.el.setAttribute('stroke', (Strata.temaEscuro() ? DS_CORES_ESCURO : DS_CORES)[v.t.cor]); v.el.style.strokeWidth = e;
    }
    const naPagina = ev => DS.rascunho && document.body.classList.contains('desenhando') && ev.target.closest && ev.target.closest('section.pagina');
    addEventListener('pointerdown', ev => {
      const pag = naPagina(ev); if (!pag) return;
      ev.preventDefault(); ev.stopPropagation();
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      const R = refDesenho(DS.rascunho);
      if (!R || R.pag !== pag) return avisar('Desenhe na mesma página da âncora');
      try { pag.setPointerCapture(ev.pointerId); } catch (e) {}
      if (DS.ferr === 'borracha') { DS.vivo = { borracha: true, id: ev.pointerId }; apagarEm(ev); return; }
      const p = pontoDe(ev);
      DS.vivo = { id: ev.pointerId, t: { ferr: DS.ferr, cor: DS.cor, esp: +DS.esp, pts: [[p.x, p.y]] } };
      desenharVivo();
    }, true);
    addEventListener('pointermove', ev => {
      const v = DS.vivo; if (!v || ev.pointerId !== v.id) return;
      ev.preventDefault();
      if (v.borracha) return apagarEm(ev);
      const p = pontoDe(ev); if (!p) return;
      if (v.t.ferr === 'livre' || v.t.ferr === 'marca') { const u = v.t.pts[v.t.pts.length - 1]; if (Math.hypot(p.x - u[0], p.y - u[1]) < 1) return; v.t.pts.push([p.x, p.y]); }
      else v.t.pts[1] = [p.x, p.y];
      desenharVivo();
    }, true);
    const soltarTraco = ev => {
      const v = DS.vivo; if (!v || ev.pointerId !== v.id) return;
      DS.vivo = null; if (v.borracha) return;
      const t = v.t;
      if (t.ferr === 'livre' || t.ferr === 'marca') t.pts = simplificar(t.pts, .6);
      else if (t.pts.length < 2 || Math.hypot(t.pts[1][0] - t.pts[0][0], t.pts[1][1] - t.pts[0][1]) < 3) { if (v.el) v.el.remove(); return; }   // clique sem arrastar
      const l = lerTracos(DS.rascunho.dataset.tracos); l.push(t);
      DS.rascunho.dataset.tracos = escreverTracos(l); mostrarDesenho(); desenharMarcas();
    };
    addEventListener('pointerup', soltarTraco, true); addEventListener('pointercancel', soltarTraco, true);
    // enquanto desenha, os cliques na página não chegam ao editor
    ['mousedown', 'mouseup', 'click', 'dblclick', 'dragstart', 'contextmenu'].forEach(k => addEventListener(k, ev => { if (naPagina(ev)) { ev.preventDefault(); ev.stopPropagation(); } }, true));
    addEventListener('keydown', ev => {
      if (!DS.rascunho) return;
      const k = ev.key.toLowerCase(), mod = ev.ctrlKey || ev.metaKey;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fecharDesenho(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); concluirDesenho(); }
      else if (mod && k === 'z') { ev.preventDefault(); ev.stopPropagation(); desfazerTraco(); }
      else if (!(mod && k === 's')) { ev.stopPropagation(); if (!mod) ev.preventDefault(); }
    }, true);
    // Escolher termos numa fórmula: arrastar de um termo a outro, como numa seleção de texto (um clique
    // escolhe o termo sob o mouse). A seleção segue a estrutura do LaTeX: sair de um expoente leva a base junto.
    function caixaTermo(it, no) { const g = it.el.querySelector('svg .tk-' + no.id); return g ? g.getBoundingClientRect() : null; }
    function termoEm(it, X, Y) {
      let melhor = null, dist = Infinity, area = Infinity;
      for (const no of it.reg) {
        const b = caixaTermo(it, no); if (!b || !b.width) continue;
        const dx = Math.max(b.left - X, 0, X - b.right), dy = Math.max(b.top - Y, 0, Y - b.bottom), d = dx + dy * 2, ar = b.width * b.height;
        if (d < dist - 0.5 || (Math.abs(d - dist) <= 0.5 && ar < area)) { melhor = no; dist = d; area = ar; }
      }
      return melhor;
    }
    function intervalo(sel) {
      const caminho = no => { const c = []; for (let n = no; n; n = n.seq.pai) c.unshift(n.seq); return c; };
      const cs = sel.map(caminho);
      let k = 0; while (cs.every(c => k < c.length && c[k] === cs[0][k])) k++;
      const S0 = cs[0][k - 1];
      const idx = sel.map(no => { let n = no; while (n.seq !== S0) n = n.seq.pai; return S0.nos.indexOf(n); });
      const i0 = Math.min(...idx), i1 = Math.max(...idx);
      return { s: S0.nos[i0].s, e: S0.nos[i1].e, S0, i0, i1 };
    }
    // sinais (+, -, ±) não são termos; o arrasto que começa sobre o sinal, à esquerda do 1º termo, leva o sinal junto
    function comSinal(it, x, X) {
      if (!x || x.i0 < 1) return x;
      const cx = caixaIntervalo(it, x); if (!cx || X >= cx.left - 1) return x;
      const ant = x.S0.nos[x.i0 - 1];
      if (ant.tag || !/^(\+|-|\\pm|\\mp)$/.test(it.tex.slice(ant.s, ant.e).trim())) return x;
      return Object.assign({}, x, { s: ant.s, i0: x.i0 - 1, opL: X });
    }
    function caixaIntervalo(it, x) {
      let L = x.opL != null ? x.opL : Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      for (const no of it.reg) { if (no.s < x.s || no.e > x.e) continue; const b = caixaTermo(it, no); if (!b || !b.width) continue; L = Math.min(L, b.left); T = Math.min(T, b.top); R = Math.max(R, b.right); B = Math.max(B, b.bottom); }
      return L < R ? { left: L, top: T, width: R - L, height: B - T } : null;
    }
    function mostrarFaixa(q) {
      const R = $('retangulo'); R.hidden = !q; if (!q) return;
      Object.assign(R.style, { left: q.left - 1 + 'px', top: q.top - 1 + 'px', width: q.width + 2 + 'px', height: q.height + 2 + 'px' });
    }
    function formulaDoPonto(ev) {
      const c = ev.target.closest('.apostila mjx-container');
      let it = c && MK.esc.find(i => i.el === c);
      if (!it && ev.target.matches('.apostila .eq')) {   // espaço vazio da linha: a fórmula mais próxima nela
        let d = Infinity;
        for (const i of MK.esc) { if (!ev.target.contains(i.el)) continue; const b = i.el.getBoundingClientRect(); const dd = Math.max(b.left - ev.clientX, 0, ev.clientX - b.right); if (dd < d) { d = dd; it = i; } }
      }
      return it || null;
    }
    async function aplicarIntervalo(it, x) {
      let nome = nomeExistente(it.tex, x);
      if (!nome) {
        nome = novoNome();
        await trocarTex(it, it.tex.slice(0, x.s) + '\\mk{' + nome + '}{' + it.tex.slice(x.s, x.e) + '}' + it.tex.slice(x.e));
      }
      adicionarAlvo(nome);
    }
    async function trocarTex(it, tex) {
      const original = await renderTex(tex, it.el.dataset.display === '1');
      MK.esc.splice(MK.esc.indexOf(it), 1);
      if (!(await rotularFormula(it.el, tex, original))) it.el.replaceWith(original);
      sujo(true);
    }
    document.addEventListener('mousedown', ev => {
      if (!document.body.classList.contains('escolhendo') || ev.button !== 0) return;
      if (ev.target.closest('#painel-marca, #barra, #modos, #b-sumario, #sumario, .alca-marca')) return;
      if (ev.target.closest('.marca, .ancora-camada')) return;
      // na fórmula (ou no espaço vazio de uma linha de equação); no texto, seleção normal
      const it = formulaDoPonto(ev); if (!it) return;
      ev.preventDefault();
      MK.drag = { it, x: ev.clientX, y: ev.clientY, a: termoEm(it, ev.clientX, ev.clientY), sel: null };
    }, true);
    document.addEventListener('mousemove', ev => {
      const d = MK.drag; if (!d || !d.a) return;
      if (Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) < 4) return;
      const b = termoEm(d.it, ev.clientX, ev.clientY); if (!b) return;
      d.sel = comSinal(d.it, intervalo([d.a, b]), Math.min(d.x, ev.clientX)); mostrarFaixa(caixaIntervalo(d.it, d.sel));
    });
    document.addEventListener('mouseup', ev => {
      if (!document.body.classList.contains('escolhendo')) return;
      if (ev.target.closest && ev.target.closest('#painel-marca')) return;
      if (!MK.drag) { setTimeout(escolherTexto, 0); return; }
      const d = MK.drag; MK.drag = null; mostrarFaixa(null);
      if (d.sel) return aplicarIntervalo(d.it, d.sel);
      const x = escolherNaFormula(d.it, { left: ev.clientX, right: ev.clientX, top: ev.clientY, bottom: ev.clientY }, true);
      if (x) aplicarIntervalo(d.it, x); else avisar('Nenhum termo aí');
    });

    // ---------- alças: redimensionar o termo marcado (fórmula ou texto) ----------
    function desenharAlcas() {
      document.querySelectorAll('.alca-marca').forEach(a => a.remove());
      if (!document.body.classList.contains('escolhendo') || !MK.rascunho || MK.alca) return;
      const nomes = (MK.rascunho.dataset.marca || '').split(/\s+/).filter(Boolean);
      const alca = (q, lado, info) => {
        const a = document.createElement('div'); a.className = 'alca-marca ' + lado; a.title = 'Arraste para aumentar ou diminuir o termo marcado';
        Object.assign(a.style, { left: (lado === 'esq' ? q.left : q.right) + scrollX + 'px', top: q.top + scrollY + 'px', height: q.height + 'px' });
        Object.assign(a, { _info: Object.assign({ lado }, info) }); document.body.append(a);
      };
      for (const nome of nomes) {
        for (const it of MK.esc) {
          const g = it.el.querySelector('svg .mk-' + nome); if (!g) continue;
          const q = g.getBoundingClientRect(); if (!q.width) continue;
          alca(q, 'esq', { nome, it }); alca(q, 'dir', { nome, it });
        }
        document.querySelectorAll('.apostila [data-mk="' + nome + '"]').forEach(sp => {
          const rs = [...sp.getClientRects()].filter(r => r.width); if (!rs.length) return;
          alca(rs[0], 'esq', { nome, sp }); alca(rs[rs.length - 1], 'dir', { nome, sp });
        });
      }
    }
    function nodoMk(it, nome) { return it.reg.find(no => it.tex.startsWith('\\mk{' + nome + '}', no.s)) || null; }
    function cursorNoPonto(X, Y) {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(X, Y);
      const p = document.caretPositionFromPoint && document.caretPositionFromPoint(X, Y); if (!p) return null;
      const r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); return r;
    }
    function faixaTexto(A, sp, lado) {   // trecho do texto: do ponto A até a ponta fixa do termo
      const r = document.createRange();
      if (lado === 'dir') { r.setStartBefore(sp); if (A.compareBoundaryPoints(Range.START_TO_START, r) < 0) { r.setStart(A.startContainer, A.startOffset); r.setEndAfter(sp.firstChild || sp); } else r.setEnd(A.startContainer, A.startOffset); }
      else { r.setEndAfter(sp); if (A.compareBoundaryPoints(Range.START_TO_END, r) > 0) { r.setEnd(A.startContainer, A.startOffset); r.setStartBefore(sp.lastChild || sp); } else r.setStart(A.startContainer, A.startOffset); }
      return r;
    }
    document.addEventListener('mousedown', ev => {
      const a = ev.target.closest && ev.target.closest('.alca-marca'); if (!a || ev.button !== 0) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const i = a._info;
      if (i.it) {
        const no = nodoMk(i.it, i.nome), c = no && no.filhos[0];
        if (!c || !c.nos.length) return avisar('Não deu para redimensionar este termo');
        i.fixo = i.lado === 'esq' ? c.nos[c.nos.length - 1] : c.nos[0];
      }
      MK.alca = i; desenharAlcas();
    }, true);
    document.addEventListener('mousemove', ev => {
      const i = MK.alca; if (!i) return;
      if (i.it) {
        const b = termoEm(i.it, ev.clientX, ev.clientY); if (!b) return;
        i.sel = intervalo([i.fixo, b]); mostrarFaixa(caixaIntervalo(i.it, i.sel));
      } else {
        const A = cursorNoPonto(ev.clientX, ev.clientY); if (!A || !i.sp.parentElement || !i.sp.parentElement.contains(A.startContainer)) return;
        i.A = A; const r = faixaTexto(A, i.sp, i.lado); const q = r.getBoundingClientRect(); mostrarFaixa(q.width ? q : null);
      }
    }, true);
    document.addEventListener('mouseup', async ev => {
      const i = MK.alca; if (!i) return;
      ev.stopImmediatePropagation(); MK.alca = null; mostrarFaixa(null);
      if (i.it && i.sel) await redimensionarFormula(i.it, i.nome, i.sel);
      else if (i.sp && i.A) redimensionarTexto(i.sp, i.A, i.lado);
      desenharMarcas();
    }, true);
    async function redimensionarFormula(it, nome, x) {
      const t = it.tex, p0 = t.indexOf('\\mk{' + nome + '}'); if (p0 < 0) return;
      const a = t.indexOf('{', p0 + 5 + nome.length), b = fechar(t, a), tira = a + 1 - p0;
      const m = pos => pos - (pos > a ? tira : 0) - (pos > b ? 1 : 0);
      const u = t.slice(0, p0) + t.slice(a + 1, b) + t.slice(b + 1), s1 = m(x.s), e1 = m(x.e);
      const novo = u.slice(0, s1) + '\\mk{' + nome + '}{' + u.slice(s1, e1) + '}' + u.slice(e1);
      if (novo !== t) await trocarTex(it, novo);
    }
    function redimensionarTexto(sp, A, lado) {
      const r = faixaTexto(A, sp, lado);
      if (!r.toString().replace(/[\s\u200B]/g, '') || r.cloneContents().querySelector('mjx-container, .marca, .ancora-camada')) return avisar('O termo marcado no texto só pode ter texto');
      // marcadores nas pontas, para refazer o trecho depois de desfazer o antigo
      const m0 = document.createTextNode(''), m1 = document.createTextNode('');
      r.insertNode(m0); r.collapse(false); r.insertNode(m1);
      const nome = sp.dataset.mk; sp.replaceWith(...sp.childNodes);
      const n = document.createRange(); n.setStartAfter(m0); n.setEndBefore(m1);
      const novo = document.createElement('span'); novo.dataset.mk = nome;
      novo.append(n.extractContents()); n.insertNode(novo);
      m0.remove(); m1.remove(); novo.parentElement.normalize();
      sujo(true);
    }

    document.addEventListener('keydown', ev => {
      if (!document.body.classList.contains('escolhendo')) return;
      if (ev.key === 'Escape') { ev.preventDefault(); fecharPainel(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); concluirMarca(); }
    });
    // clicar no ícone de uma marcação abre o painel; arrastar muda o momento em que ela aparece
    // fecha o painel guardando o que foi feito (se não houver termos, só fecha)
    function sairDoPainel() {
      if (!MK.rascunho) return;
      if ((MK.rascunho.dataset.marca || '').trim()) concluirMarca(); else fecharPainel();
    }
    document.addEventListener('click', ev => {
      if (!document.body.classList.contains('editando')) return;
      const m = ev.target.closest && ev.target.closest('.apostila .marca');
      if (!m) return;
      ev.preventDefault();
      const mesma = m === MK.existente;
      if (document.body.classList.contains('escolhendo')) fecharPainel();
      $('editor-eq').hidden = true;
      desselecionarCamada();
      if (!mesma) { if (m.dataset.tipo === 'desenho') abrirDesenho(m); else abrirPainel(m); }
    });
    document.addEventListener('dragstart', ev => {
      const m = ev.target.closest && ev.target.closest('.apostila .marca');
      if (!m || !document.body.classList.contains('editando')) return;
      MK.arrasto = m; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', ' ');
    });
    document.addEventListener('dragover', ev => { if (MK.arrasto && ev.target.closest && ev.target.closest('section.pagina')) ev.preventDefault(); });
    document.addEventListener('drop', ev => {
      if (!MK.arrasto) return;
      ev.preventDefault();
      let r = null;
      if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(ev.clientX, ev.clientY);
      else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(ev.clientX, ev.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
      const n = r && (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement);
      if (n && n.closest('section.pagina') && !MK.arrasto.contains(n)) {
        const f = n.closest('mjx-container');
        if (f) f.after(MK.arrasto); else r.insertNode(MK.arrasto);
        sujo(true); desenharMarcas();
      }
      MK.arrasto = null;
    });
    document.addEventListener('dragend', () => { MK.arrasto = null; });

    // ---------- modo edição: âncoras de camada (em qualquer ponto da linha) ----------
    // Uma camada que começa no meio da linha é um <span class="fragment"> que vai do ponto
    // escolhido até o fim do parágrafo (ou da camada em que ele está). No modo edição,
    // cada camada mostra uma âncora no seu início; elas não são salvas.
    const ICONE_CAMADA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>';
    const SEL_CAMADA = '.apostila .fragment:not(.marca)';
    function noDe(c) { return c.nodeType === 1 ? c : c.parentElement; }
    function semConteudo(r) { return !r.toString().replace(/[\s\u200B]/g, '') && !r.cloneContents().querySelector('mjx-container, img, svg:not([aria-hidden])'); }
    function iconesCamada() {
      document.querySelectorAll(SEL_CAMADA).forEach(f => {
        if (!(f instanceof HTMLElement)) return;
        const a0 = f.querySelector(':scope > .ancora-camada');
        if (a0 && a0 === f.firstChild) return;
        if (a0) a0.remove();
        const a = document.createElement('span');
        a.className = 'ancora-camada'; a.setAttribute('contenteditable', 'false');
        if (f.tagName === 'SPAN') a.setAttribute('draggable', 'true');
        a.title = 'Camada: clique para selecionar (o botão Camada remove); arraste para mudar onde ela começa';
        a.innerHTML = ICONE_CAMADA;
        f.prepend(a);
      });
    }
    function tirarIconesCamada() {
      document.querySelectorAll('.ancora-camada').forEach(a => a.remove());
      document.querySelectorAll('.camada-foco').forEach(f => f.classList.remove('camada-foco'));
      pintarCamada([]);
    }
    // camada cujo início é exatamente o ponto do cursor (só a âncora antes dele)
    function camadaNoCursor(r) {
      if (!r) return null;
      for (let f = noDe(r.startContainer).closest(SEL_CAMADA); f; f = f.parentElement && f.parentElement.closest(SEL_CAMADA)) {
        const pre = document.createRange(); pre.setStart(f, 0); pre.setEnd(r.startContainer, r.startOffset);
        if (semConteudo(pre)) return f;
      }
      return null;
    }
    function criarCamada(r) {
      const n = noDe(r.startContainer);
      if (n.closest('mjx-container')) return avisar('Clique fora da fórmula');
      const cont = n.closest('span.fragment:not(.marca), ' + BLOCOS_L);
      if (!cont || !cont.closest('section.pagina')) return avisar('Clique no texto');
      const pre = document.createRange(); pre.setStart(cont, 0); pre.setEnd(r.startContainer, r.startOffset);
      if (cont.matches(BLOCOS_L) && semConteudo(pre)) { cont.classList.add('fragment'); return cont; }
      const pos = document.createRange(); pos.setStart(r.startContainer, r.startOffset); pos.setEnd(cont, cont.childNodes.length);
      // nada depois do cursor: a camada nasce vazia, para receber o que for escrito
      const s = document.createElement('span'); s.className = 'fragment';
      s.append(pos.extractContents()); cont.append(s);
      if (!s.firstChild) s.append(ZW);
      encaixarCamada(s);
      return s;
    }
    // camada nova no meio de um passo com data-junto: o que vem depois dela, nesse passo, vai junto com ela
    function encaixarCamada(nova) {
      const todos = [...document.querySelectorAll('.apostila .fragment')], i = todos.indexOf(nova), ant = todos[i - 1];
      const j = ant && ant.dataset.junto; if (!j) return;
      const seguintes = [];
      for (let k = i + 1; k < todos.length; k++) {
        const t = todos[k];
        if (t.dataset.junto === j) seguintes.push(t);
        else if (!nova.contains(t)) break;
      }
      if (!seguintes.length) return;
      const nj = novoJunto(); nova.dataset.junto = nj;
      seguintes.forEach(t => { t.dataset.junto = nj; });
    }
    // passos (camadas) do modo apresentação; elementos com o mesmo data-junto formam um passo só
    function passos() { contarCamadas(); return AULA.passos; }
    function passoDe(f) { return passos().find(p => p.els.includes(f)); }
    function cabeca(f) { const p = passoDe(f); return !!p && p.els[0] === f; }
    // Enter que divide um bloco: o navegador copia a classe fragment para a linha nova, que viraria
    // uma camada nova. A linha nova (e os trechos de camada divididos) entram junto com a camada de onde saíram.
    document.addEventListener('input', ev => {
      if (ev.inputType !== 'insertParagraph' || !document.body.classList.contains('editando')) return;
      const sel = getSelection(); if (!sel.rangeCount) return;
      const n = sel.getRangeAt(0).startContainer, B = (n.nodeType === 1 ? n : n.parentElement).closest('.duas-colunas > *, .ambiente > *, section.pagina > *, li');
      const A = B && B.previousElementSibling; if (!A) return;
      if (ED.enterCamada && !B.matches('.rodape')) {   // opção "Enter cria camada": a linha de baixo é uma camada nova
        B.classList.add('fragment'); B.removeAttribute('data-junto');
        B.querySelectorAll('span.fragment:not(.marca)').forEach(x => { if (!x.querySelector('.ancora-camada')) { x.classList.remove('fragment'); x.removeAttribute('data-junto'); if (!x.classList.length) x.removeAttribute('class'); } });
        iconesCamada(); return;
      }
      const par = (a, b) => { if (!a || !b || !b.classList.contains('fragment')) return; const j = a.dataset.junto || b.dataset.junto || novoJunto(); a.dataset.junto = j; b.dataset.junto = j; };
      const semAncora = e => !e.querySelector(':scope > .ancora-camada');
      // Enter no fim de uma camada em linha (span.fragment): o navegador leva para a linha nova uma cópia vazia
      // do trecho. Ela sai, e a linha nova entra junto com essa camada (é onde o cursor estava).
      const vazio = e => !e.textContent.replace(/[\s\u200B]/g, '') && !e.querySelector('mjx-container, img, .marca, table');
      const sB0 = [...B.querySelectorAll('span.fragment:not(.marca)')].find(semAncora), sA0 = [...A.querySelectorAll('span.fragment:not(.marca)')].pop();
      if (sB0 && sA0 && vazio(sB0)) {
        sB0.replaceWith(...sB0.childNodes);
        B.classList.add('fragment'); const j = sA0.dataset.junto || novoJunto(); sA0.dataset.junto = j; B.dataset.junto = j;
        iconesCamada(); return;
      }
      if (B.classList.contains('fragment') && A.classList.contains('fragment')) {
        if (semAncora(B)) par(A, B); else if (semAncora(A)) par(B, A);   // Enter no começo: a linha vazia fica em cima
      }
      // camada em linha (span.fragment) cortada ao meio: a parte que desceu entra junto com a de cima
      const sB = [...B.querySelectorAll('span.fragment:not(.marca)')].find(semAncora), sA = [...A.querySelectorAll('span.fragment:not(.marca)')].pop();
      if (sB && sA) par(sA, sB);
      iconesCamada();
    });
    function novoJunto() { const u = new Set([...document.querySelectorAll('[data-junto]')].map(e => e.dataset.junto)); let k = 1; while (u.has('j' + k)) k++; return 'j' + k; }
    function juntar(els, j) { els.forEach(e => { if (j) e.dataset.junto = j; else e.removeAttribute('data-junto'); }); }
    // tirar a âncora: a camada passa a fazer parte da camada anterior
    function removerCamada(f) {
      const ps = passos(), k = ps.findIndex(p => p.els[0] === f);
      if (k < 0) return;
      if (k === 0) {   // não há camada anterior: vai para o fundo
        ps[0].els.forEach(e => {
          const a = e.querySelector(':scope > .ancora-camada'); if (a) a.remove();
          e.classList.remove('fragment', 'camada-foco', 'visivel'); e.removeAttribute('data-junto');
          if (e.tagName === 'SPAN' && !e.classList.length && [...e.attributes].every(x => x.name === 'class')) e.replaceWith(...e.childNodes);
        });
        return;
      }
      juntar([...ps[k - 1].els, ...ps[k].els], ps[k - 1].junto || novoJunto());
    }
    // separar: o elemento f (que estava junto da camada anterior) volta a ser o início de uma camada
    function separarCamada(f) {
      const p = passoDe(f), i = p.els.indexOf(f);
      const antes = p.els.slice(0, i), depois = p.els.slice(i);
      juntar(antes, antes.length > 1 ? p.junto : null);
      juntar(depois, depois.length > 1 ? novoJunto() : null);
    }
    function iconesCamada() {
      document.querySelectorAll('.ancora-camada').forEach(a => a.remove());
      passos().forEach(p => {
        const f = p.els[0];
        if (!(f instanceof HTMLElement) || f.classList.contains('marca')) return;
        const a = document.createElement('span');
        a.className = 'ancora-camada'; a.setAttribute('contenteditable', 'false');
        if (f.tagName === 'SPAN') a.setAttribute('draggable', 'true');
        a.title = 'Camada: clique para selecionar (o botão Camada a junta à camada anterior); arraste para mudar onde ela começa';
        a.innerHTML = ICONE_CAMADA;
        f.prepend(a);
      });
    }
    function cursorDepois(a) {
      // dentro do texto que vem logo depois da âncora (depois do espaço invisível): o que for digitado
      // fica na camada dela, e não antes da âncora
      garantirPontos();
      const r = document.createRange(), n = a.nextSibling;
      if (n && n.nodeType === 3) r.setStart(n, n.data[0] === ZW ? 1 : 0); else r.setStartAfter(a);
      r.collapse(true);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    let CAMADA_SEL = null;
    function focarCamada(f) {
      const p = f && passoDe(f);
      CAMADA_SEL = p ? f : null;
      const els = p ? p.els.filter(e => !e.classList.contains('marca')) : [];
      document.querySelectorAll('.camada-foco').forEach(x => { if (!els.includes(x)) x.classList.remove('camada-foco'); });
      els.forEach(e => e.classList.add('camada-foco'));
      pintarCamada(els);
      $('b-camada').classList.toggle('ligada', !!p);
    }
    // o fundo da fórmula cobre só o que aparece (um \phantom no começo não ganha fundo)
    function faixaVisivel(c) {
      const v = c.querySelector(':scope > svg'); if (!v) return;
      const R = v.getBoundingClientRect(); let a = Infinity, b = -Infinity;
      v.querySelectorAll('use, path, rect, text').forEach(g => {
        if (g.closest('[data-mml-node="mphantom"], defs')) return;
        const q = g.getBoundingClientRect(); if (!q.width && !q.height) return;
        a = Math.min(a, q.left); b = Math.max(b, q.right);
      });
      if (a < b) { v.style.backgroundPosition = (a - R.left - 2) + 'px 0'; v.style.backgroundSize = (b - a + 4) + 'px 100%'; }
    }
    // pinta o texto e as fórmulas que pertencem à camada (não os de camadas que começam dentro dela)
    function pintarCamada(els) {
      document.querySelectorAll('.na-camada').forEach(e => { e.classList.remove('na-camada'); const v = e.querySelector(':scope > svg'); if (v) { v.style.removeProperty('background-position'); v.style.removeProperty('background-size'); } });
      const tem = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
      if (tem) CSS.highlights.delete('camada-foco');
      if (!els.length) return;
      const dela = n => { const f = (n.nodeType === 1 ? n : n.parentElement).closest('.apostila .fragment:not(.marca)'); return f && els.includes(f); };
      const FORA = '.ancora-camada, .marca, mjx-container, .tinta-html, svg.tinta, aside.nota, .rodape';
      const ranges = [];
      for (const el of els) {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t; (t = w.nextNode());) {
          if (t.parentElement.closest(FORA) || !dela(t)) continue;
          const txt = t.data.replace(/\u200B/g, '');
          if (!txt.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(t); ranges.push(r);
        }
        el.querySelectorAll('mjx-container').forEach(c => { if (!c.parentElement.closest('mjx-container') && dela(c.parentElement)) { c.classList.add('na-camada'); faixaVisivel(c); } });
      }
      if (tem && ranges.length) CSS.highlights.set('camada-foco', new Highlight(...ranges));
    }
    function desselecionarCamada() {
      if (!CAMADA_SEL) return;
      getSelection().removeAllRanges(); ED.range = null; focarCamada(null);
    }
    $('b-camada').onclick = () => {
      const r = ED.range; if (!r) return avisar('Clique no texto, no ponto em que a camada deve começar');
      const f = CAMADA_SEL || camadaNoCursor(r);
      let a = null;
      if (f && cabeca(f)) { removerCamada(f); iconesCamada(); focarCamada(null); }
      else {
        if (f) separarCamada(f);
        const nova = f || criarCamada(r); if (!nova) return;
        iconesCamada(); a = nova.querySelector(':scope > .ancora-camada');
        if (a) cursorDepois(a);
      }
      sujo(true); desenharMarcas();
    };
    document.addEventListener('click', ev => {
      if (!document.body.classList.contains('editando')) return;
      const a = ev.target.closest && ev.target.closest('.ancora-camada');
      if (!a) return;
      ev.preventDefault();
      if (document.body.classList.contains('escolhendo')) fecharPainel();
      $('editor-eq').hidden = true;
      if (CAMADA_SEL === a.parentElement) desselecionarCamada();
      else { cursorDepois(a); focarCamada(a.parentElement); }
    });
    document.addEventListener('dragstart', ev => {
      const a = ev.target.closest && ev.target.closest('.ancora-camada');
      if (!a || !document.body.classList.contains('editando')) return;
      MK.arrastoCamada = a.parentElement; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', ' ');
    });
    document.addEventListener('dragover', ev => { if (MK.arrastoCamada && ev.target.closest && ev.target.closest('section.pagina')) ev.preventDefault(); });
    document.addEventListener('drop', ev => {
      const f = MK.arrastoCamada; if (!f) return;
      ev.preventDefault(); MK.arrastoCamada = null;
      let r = null;
      if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(ev.clientX, ev.clientY);
      else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(ev.clientX, ev.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
      if (!r || !noDe(r.startContainer).closest('section.pagina')) return;
      const n = noDe(r.startContainer), mj = n.closest('mjx-container');
      if (mj) { r = document.createRange(); r.setStartAfter(mj); r.collapse(true); }
      // mover = tirar a camada daqui (o conteúdo fica na camada em que estava) e começar uma no novo ponto
      const a = f.querySelector(':scope > .ancora-camada'); if (a) a.remove();
      f.classList.remove('fragment', 'camada-foco', 'visivel'); f.removeAttribute('data-junto');
      if (f.tagName === 'SPAN' && !f.classList.length && [...f.attributes].every(x => x.name === 'class')) f.replaceWith(...f.childNodes);
      const nova = criarCamada(r);
      iconesCamada(); if (nova) cursorDepois(nova.querySelector(':scope > .ancora-camada'));
      sujo(true); desenharMarcas();
    });
    document.addEventListener('dragend', () => { MK.arrastoCamada = null; });

    // ---------- desfazer / refazer (Ctrl+Z, Ctrl+Y ou Ctrl+Shift+Z) ----------
    // O desfazer do navegador não vê o que o script muda (âncoras, marcações, fórmulas),
    // então a apostila guarda o próprio histórico: uma cópia das páginas a cada alteração.
    // Digitação seguida vira um passo só; o que uma mesma ação muda (mesmo clique/tecla) também.
    const HIST = { pilha: [], refazer: [], atual: null, t: 0, texto: false, gesto: 0, ultimo: null, selAntes: null, restaurando: false };
    const TRANSITORIAS = ['eq-sel', 'na-selecao', 'camada-foco', 'na-camada', 'pairada', 'editando-agora', 'ligada'];
    function histTexto() { HIST.texto = true; }
    function caminhoDe(no, off) {
      const raiz = document.querySelector('main.apostila'), c = [];
      if (!raiz.contains(no)) return null;
      for (let n = no; n !== raiz; n = n.parentNode) c.unshift([...n.parentNode.childNodes].indexOf(n));
      return { c, off };
    }
    function noDoCaminho(p) {
      let n = document.querySelector('main.apostila');
      for (const i of p.c) { n = n.childNodes[i]; if (!n) return null; }
      return n;
    }
    function selAtual() {
      const s = getSelection(); if (!s.rangeCount) return null;
      const r = s.getRangeAt(0), a = caminhoDe(r.startContainer, r.startOffset), b = caminhoDe(r.endContainer, r.endOffset);
      return a && b ? { a, b } : null;
    }
    function porSel(x) {
      if (!x) return;
      const a = noDoCaminho(x.a), b = noDoCaminho(x.b); if (!a || !b) return;
      try { const r = document.createRange(); r.setStart(a, x.a.off); r.setEnd(b, x.b.off); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    }
    function foto() {
      const nos = [...document.querySelector('main.apostila').childNodes].map(n => {
        const c = n.cloneNode(true);
        if (c.nodeType === 1) {
          c.querySelectorAll('svg.tinta, .tinta-html').forEach(t => t.replaceChildren());
          tirarFimDeLinha(c);
          TRANSITORIAS.forEach(k => c.querySelectorAll('.' + k).forEach(e => { e.classList.remove(k); if (!e.classList.length) e.removeAttribute('class'); }));
        }
        return c;
      });
      return { nos, html: nos.map(n => n.nodeType === 1 ? n.outerHTML : n.textContent).join('') };
    }
    function editandoTexto() { return document.body.classList.contains('editando'); }
    function histAgendar() {
      if (HIST.restaurando || !editandoTexto() || document.body.classList.contains('escolhendo')) { HIST.texto = false; return; }
      clearTimeout(HIST.t);
      HIST.t = setTimeout(histGuardar, HIST.texto ? 400 : 0);
    }
    function histGuardar() {
      clearTimeout(HIST.t); HIST.t = 0;
      const texto = HIST.texto; HIST.texto = false;
      if (!HIST.atual || !editandoTexto()) return;
      const novo = foto();
      if (novo.html === HIST.atual.html) return;
      novo.selDepois = selAtual();
      const u = HIST.ultimo;
      // junta com o passo anterior: digitação seguida, ou efeitos da mesma ação
      const juntar = u && (texto ? u.texto && Date.now() - u.quando < 2000 : !u.texto && u.gesto === HIST.gesto);
      if (juntar) novo.selAntes = HIST.atual.selAntes;
      else {
        novo.selAntes = HIST.selAntes;
        HIST.pilha.push(HIST.atual); if (HIST.pilha.length > 80) HIST.pilha.shift();
      }
      HIST.refazer = [];
      HIST.atual = novo;
      HIST.ultimo = { texto, gesto: HIST.gesto, quando: Date.now() };
    }
    function histRestaurar(e, sel) {
      HIST.restaurando = true;
      if (document.body.classList.contains('escolhendo')) { encerrarEscolha(); MK.rascunho = null; MK.existente = null; MK.range = null; document.body.classList.remove('escolhendo'); $('painel-marca').hidden = true; document.querySelectorAll('section.pagina').forEach(s => s.setAttribute('contenteditable', 'true')); }
      $('editor-eq').hidden = true;
      document.querySelector('main.apostila').replaceChildren(...e.nos.map(n => n.cloneNode(true)));
      CAMADA_SEL = null; MK.pairadas = new Set(); MK.formas = []; MK.arrastoCamada = null; ED.alvo = null;
      document.querySelectorAll('.apostila .marca').forEach(prepararIcone);
      iconesCamada(); focarCamada(null);
      contarCamadas(); desenharMarcas(); montarSumario();
      porSel(sel);
      sujo(true);
      HIST.restaurando = false; HIST.ultimo = null;
    }
    function desfazer() {
      if (HIST.t) histGuardar();
      if (!HIST.pilha.length) return avisar('Nada a desfazer');
      const e = HIST.pilha.pop(), agora = HIST.atual;
      HIST.refazer.push(agora); HIST.atual = e;
      histRestaurar(e, agora.selAntes || e.selDepois);
    }
    function refazer() {
      if (HIST.t) histGuardar();
      if (!HIST.refazer.length) return avisar('Nada a refazer');
      const e = HIST.refazer.pop();
      HIST.pilha.push(HIST.atual); HIST.atual = e;
      histRestaurar(e, e.selDepois);
    }
    // cada tecla ou clique é um gesto novo; guarda onde estava o cursor antes dele
    function novoGesto(ev) {
      if (!editandoTexto()) return;
      if (ev.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return;
      if (!HIST.atual && !document.body.classList.contains('escolhendo')) HIST.atual = foto();
      HIST.gesto++;
      if (!HIST.t) HIST.selAntes = selAtual();
    }
    document.addEventListener('mousedown', novoGesto, true);
    document.addEventListener('keydown', ev => {
      if (!editandoTexto()) return;
      const k = ev.key.toLowerCase(), mod = ev.ctrlKey || ev.metaKey;
      const des = mod && k === 'z' && !ev.shiftKey, ref = mod && (k === 'y' || (k === 'z' && ev.shiftKey));
      if (!des && !ref) return novoGesto(ev);
      if (ev.target.closest && ev.target.closest('input, textarea')) return;   // campos dos diálogos: desfazer do navegador
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (!HIST.atual) HIST.atual = foto();
      des ? desfazer() : refazer();
    }, true);
    document.addEventListener('beforeinput', ev => {
      if (!editandoTexto() || !(ev.target.closest && ev.target.closest('section.pagina'))) return;
      if (ev.inputType === 'historyUndo' || ev.inputType === 'historyRedo') { ev.preventDefault(); ev.inputType === 'historyUndo' ? desfazer() : refazer(); }
    }, true);

    // olho: mostra ou recolhe as âncoras (a escolha fica guardada neste navegador)
    document.body.classList.toggle('ancoras-recolhidas', lembrar('apostila-ancoras') === 'recolhidas');
    $('b-olho').onclick = () => {
      const r = document.body.classList.toggle('ancoras-recolhidas');
      lembrar('apostila-ancoras', r ? 'recolhidas' : 'abertas');
      desenharMarcas();
    };

    // ---------- ferramentas de texto: estilo do parágrafo, negrito, itálico, link, alinhamento, recuo, listas ----------
    // altura da barra (só quando visível: escondida ela mede 0, e isso deslocaria a página ao voltar à edição)
    new ResizeObserver(() => { const h = $('barra').offsetHeight; if (h) document.body.style.setProperty('--barra', h + 'px'); }).observe($('barra'));
    const ICONES_ESTILO = { li: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none"/><path d="M9 6h11M9 12h11M9 18h11"/></svg>', eq: '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="5" y="18.5" font-family="Times New Roman, serif" font-style="italic" font-weight="bold" font-size="17">x</text><text x="14" y="10.5" font-family="Times New Roman, serif" font-weight="bold" font-size="10">2</text></svg>' };
    const ESTILOS = { p: 'Parágrafo', h1: 'Título 1', subtitulo: 'Subtítulo', h2: 'Título 2', h3: 'Título 3', h4: 'Título 4', eq: 'Equação', h5: 'Título 5', h6: 'Título 6', pre: 'Pré-formatado', blockquote: 'Bloco de citação' };
    const TEXTUAIS = 'p, h1, h2, h3, h4, h5, h6, pre, blockquote, .subtitulo';
    function faixaAtual() { lerCursor(); return ED.range && ED.range.startContainer.isConnected ? ED.range : null; }
    function blocosDa(r, sel) {
      if (!r) return [];
      const ini = noDe(r.startContainer).closest(sel), lista = [];
      if (r.collapsed) return ini && ini.closest('section.pagina') ? [ini] : [];
      document.querySelectorAll('section.pagina').forEach(sec => sec.querySelectorAll(sel).forEach(b => {
        if (b.closest('mjx-container, .tinta-html, aside.nota') && !b.matches('aside.nota')) return;
        if (r.intersectsNode(b) && !lista.some(x => x.contains(b))) lista.push(b);
      }));
      if (ini && !lista.includes(ini) && !lista.some(x => x.contains(ini))) lista.unshift(ini);
      return lista;
    }
    function trocarTag(el, tag) {
      if (el.tagName.toLowerCase() === tag) return el;
      const n = document.createElement(tag);
      for (const a of el.attributes) n.setAttribute(a.name, a.value);
      n.append(...el.childNodes); el.replaceWith(n);
      return n;
    }
    function depoisDe(f) {   // aplica uma mudança na estrutura e devolve o cursor para onde estava
      // guarda as pontas da seleção pelos nós de texto (eles continuam os mesmos quando o bloco muda de tag)
      const sl = getSelection(), r0 = sl.rangeCount ? sl.getRangeAt(0) : null;
      const pontas = r0 ? [r0.startContainer, r0.startOffset, r0.endContainer, r0.endOffset] : null, x = selAtual();
      f();
      if (pontas && pontas[0].isConnected && pontas[2].isConnected && (pontas[0].nodeType === 3 || pontas[1] <= pontas[0].childNodes.length) && (pontas[2].nodeType === 3 || pontas[3] <= pontas[2].childNodes.length)) {
        try { const r = document.createRange(); const L = n => n.nodeType === 3 ? n.length : n.childNodes.length; r.setStart(pontas[0], Math.min(pontas[1], L(pontas[0]))); r.setEnd(pontas[2], Math.min(pontas[3], L(pontas[2]))); sl.removeAllRanges(); sl.addRange(r); } catch (e) { porSel(x); }
      } else porSel(x);
      lerCursor();
      iconesCamada(); sujo(true); desenharMarcas(); montarSumario(); mostrarFormatos();
    }
    // estilo do parágrafo
    (() => {
      const c = $('c-estilo'), menu = c.querySelector('.combo-menu');
      c.querySelector('.combo-seta').onclick = $('b-estilo').onclick = () => { const ab = menu.hidden; document.querySelectorAll('.combo-menu').forEach(m => m.hidden = true); menu.hidden = !ab; };
      menu.querySelectorAll('button[data-estilo]').forEach(b => b.onclick = () => {
        menu.hidden = true;
        const bl = blocosDa(faixaAtual(), BLOCOS).filter(e => e.matches(TEXTUAIS + ', div.eq'));
        if (!bl.length) return avisar('Clique num parágrafo de texto (em listas, o estilo não muda)');
        depoisDe(() => bl.forEach(e => { const st = b.dataset.estilo, n = trocarTag(e, st === 'subtitulo' ? 'p' : st === 'eq' ? 'div' : st); n.classList.toggle('subtitulo', st === 'subtitulo'); n.classList.toggle('eq', st === 'eq'); if (st !== 'eq') n.classList.remove('passo'); n.classList.remove('sem-recuo'); if (!n.classList.length) n.removeAttribute('class'); }));
      });
    })();
    // negrito, itálico, remover formatação
    $('b-negrito').onclick = () => { document.execCommand('bold'); mostrarFormatos(); };
    $('b-italico').onclick = () => { document.execCommand('italic'); mostrarFormatos(); };
    $('b-limpar').onclick = () => {
      const r = faixaAtual(); if (!r || r.collapsed) return avisar('Selecione o texto');
      document.execCommand('removeFormat');
      const r2 = faixaAtual(); if (!r2) return;
      // cores do texto (span.cor-*, .rotulo) e negrito/itálico que sobraram dentro da seleção
      depoisDe(() => {
        [...document.querySelectorAll('section.pagina span[class], section.pagina b, section.pagina strong, section.pagina i, section.pagina em')].forEach(e => {
          if (!r2.intersectsNode(e) || e.closest('mjx-container, .tinta-html')) return;
          if (e.matches('span') && !([...e.classList].every(k => /^cor-|^rotulo$/.test(k)))) return;
          if (e.matches('span.eq-cor')) return;
          const q = document.createRange(); q.selectNodeContents(e);
          if (r2.compareBoundaryPoints(Range.START_TO_START, q) <= 0 && r2.compareBoundaryPoints(Range.END_TO_END, q) >= 0) e.replaceWith(...e.childNodes);
        });
      });
    };
    // link
    const LINK = { r: null, a: null };
    function abrirLink() {
      const r = faixaAtual(); if (!r) return avisar('Clique no texto');
      LINK.r = r.cloneRange(); LINK.a = noDe(r.startContainer).closest('section.pagina a');
      $('pl-url').value = LINK.a ? LINK.a.getAttribute('href') || '' : '';
      $('pl-remover').style.display = LINK.a ? '' : 'none';
      DESTINOS.rot = ''; DESTINOS.ref = false; preencherDestinos();
      const b = $('b-link').getBoundingClientRect(), P = $('painel-link');
      P.hidden = false; P.style.left = Math.max(8, Math.min(b.left, innerWidth - P.offsetWidth - 8)) + 'px'; P.style.top = b.bottom + 8 + 'px';
      $('pl-url').focus(); $('pl-url').select();
    }
    function fecharLink(voltar) {
      $('painel-link').hidden = true;
      if (voltar && LINK.r) { const sec = noDe(LINK.r.startContainer).closest('section.pagina'); if (sec) sec.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(LINK.r); }
    }
    function aplicarLink() {
      let url = $('pl-url').value.trim(); if (!url) return fecharLink(true);
      if (!/^[a-z][\w+.-]*:|^[#\/.]/i.test(url)) url = 'https://' + url;
      fecharLink(true);
      depoisDe(() => {
        if (LINK.a) { LINK.a.setAttribute('href', url); if (url[0] === '#') { LINK.a.removeAttribute('target'); LINK.a.removeAttribute('rel'); } else { LINK.a.target = '_blank'; LINK.a.rel = 'noopener'; } return; }
        const r = LINK.r;
        if (r.collapsed) { const a = document.createElement('a'); a.href = url; a.textContent = url[0] === '#' && DESTINOS.rot ? DESTINOS.rot : url; if (url[0] === '#' && DESTINOS.ref) a.className = 'ref'; if (url[0] !== '#') { a.target = '_blank'; a.rel = 'noopener'; } r.insertNode(a); r.setStartAfter(a); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
        document.execCommand('createLink', false, url);
        if (url[0] !== '#') document.querySelectorAll('section.pagina a[href="' + CSS.escape(url) + '"]:not([target])').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
      });
    }
    $('b-link').onclick = abrirLink;
    $('pl-ok').onclick = aplicarLink;
    $('pl-cancelar').onclick = () => fecharLink(true);
    $('pl-remover').onclick = () => { const a = LINK.a; fecharLink(true); if (a) depoisDe(() => a.replaceWith(...a.childNodes)); };
    $('pl-url').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); aplicarLink(); } else if (e.key === 'Escape') { e.preventDefault(); fecharLink(true); } });

    // ---------- imagens: colar, arrastar, arquivo ou link ----------
    // a imagem entra no ponto do cursor como <img>; colada/arrastada/arquivo vira data: (o HTML continua um arquivo só)
    const IMG = { r: null };
    const IMG_MAX = 1600;   // lado maior, em pixels; acima disso a imagem é reduzida
    function lerImagem(f) {
      return new Promise((ok, falha) => {
        const fr = new FileReader();
        fr.onerror = () => falha(new Error('não foi possível ler o arquivo'));
        fr.onload = () => {
          const url = fr.result;
          if (/^image\/(svg|gif)/.test(f.type)) return ok(url);   // vetor e animação ficam como estão
          const im = new Image();
          im.onerror = () => falha(new Error('formato de imagem não reconhecido'));
          im.onload = () => {
            const k = Math.min(1, IMG_MAX / Math.max(im.naturalWidth, im.naturalHeight));
            if (k === 1 && f.size < 1.5e6) return ok(url);
            const c = document.createElement('canvas');
            c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            const png = f.type === 'image/png' || f.type === 'image/webp';
            let u = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
            if (png && u.length > 3e6) u = c.toDataURL('image/webp', 0.92);   // foto colada como PNG: fica bem menor
            ok(u.length < url.length ? u : url);
          };
          im.src = url;
        };
        fr.readAsDataURL(f);
      });
    }
    function inserirImagem(src, r) {
      if (!r || !r.startContainer.isConnected || !noDe(r.startContainer).closest('section.pagina')) return avisar('Clique no texto');
      const im = document.createElement('img'); im.src = src; im.alt = '';
      const f = noDe(r.startContainer).closest('mjx-container');   // nunca dentro de uma fórmula
      if (!r.collapsed) r.deleteContents();
      if (f) f.after(im); else r.insertNode(im);
      const sec = im.closest('section.pagina'); sec.focus({ preventScroll: true });
      const q = document.createRange(); q.setStartAfter(im); q.collapse(true);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(q);
      lerCursor(); sujo(true); iconesCamada(); desenharMarcas();
      const conf = () => { desenharMarcas(); posImagem(); }; if (!im.complete) im.addEventListener('load', conf, { once: true });
      ISEL.img = im; posImagem();   // a altura muda quando carrega
      return im;
    }
    const arquivoDeImagem = dt => {
      if (!dt) return null;
      for (const f of dt.files || []) if (/^image\//.test(f.type)) return f;
      for (const it of dt.items || []) if (it.kind === 'file' && /^image\//.test(it.type)) return it.getAsFile();
      return null;
    };
    async function imagemDeArquivo(f, r) {
      try { const u = await lerImagem(f); fecharImagem(); inserirImagem(u, r); }
      catch (e) { if (!$('painel-imagem').hidden) $('pi-erro').textContent = 'Erro: ' + e.message; else avisar('Imagem: ' + e.message); }
    }
    function abrirImagem() {
      const r = faixaAtual(); if (!r) return avisar('Clique no texto');
      IMG.r = r.cloneRange();
      $('pi-url').value = ''; $('pi-erro').textContent = '';
      const b = $('c-midia').getBoundingClientRect(), P = $('painel-imagem');
      P.hidden = false; P.style.left = Math.max(8, Math.min(b.left, innerWidth - P.offsetWidth - 8)) + 'px'; P.style.top = b.bottom + 8 + 'px';
      $('pi-zona').focus();
    }
    function fecharImagem(voltar) {
      $('painel-imagem').hidden = true; $('pi-zona').classList.remove('sobre');
      if (voltar && IMG.r && IMG.r.startContainer.isConnected) { const sec = noDe(IMG.r.startContainer).closest('section.pagina'); if (sec) sec.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(IMG.r); }
    }
    function imagemDoLink() {
      let url = $('pi-url').value.trim(); if (!url) return;
      if (!/^[a-z][\w+.-]*:|^[#\/.]/i.test(url)) url = 'https://' + url;
      const t = new Image();
      t.onload = () => { fecharImagem(); inserirImagem(url, IMG.r); };
      t.onerror = () => { $('pi-erro').textContent = 'Não consegui abrir uma imagem nesse link.'; };
      $('pi-erro').textContent = 'Carregando…'; t.src = url;
    }
    $('b-imagem').onclick = () => $('painel-imagem').hidden ? abrirImagem() : fecharImagem(true);
    $('pi-cancelar').onclick = () => fecharImagem(true);
    $('pi-ok').onclick = imagemDoLink;
    $('pi-arquivo-b').onclick = () => $('pi-arquivo').click();
    $('pi-arquivo').onchange = () => { const f = $('pi-arquivo').files[0]; $('pi-arquivo').value = ''; if (f) imagemDeArquivo(f, IMG.r); };
    $('pi-url').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); imagemDoLink(); } else if (e.key === 'Escape') { e.preventDefault(); fecharImagem(true); } });
    $('pi-zona').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); fecharImagem(true); } });
    const zona = $('pi-zona');
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('sobre'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
    zona.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation(); zona.classList.remove('sobre');
      const f = arquivoDeImagem(e.dataTransfer); if (f) return imagemDeArquivo(f, IMG.r);
      const u = (e.dataTransfer.getData('text/uri-list') || '').split('\n').find(l => l && l[0] !== '#');   // imagem arrastada de outra página
      if (u) { $('pi-url').value = u.trim(); imagemDoLink(); } else $('pi-erro').textContent = 'Isso não é uma imagem.';
    });
    document.querySelectorAll('#painel-imagem button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    // fecha ao clicar fora (sem inserir nada)
    document.addEventListener('mousedown', e => { const P = $('painel-imagem'); if (!P.hidden && !P.contains(e.target) && !e.target.closest('#c-midia')) fecharImagem(false); }, true);
    // colar: no painel, ou direto no texto (modo edição) quando a área de transferência tem só imagem
    document.addEventListener('paste', e => {
      const dt = e.clipboardData, f = arquivoDeImagem(dt); if (!f) return;
      if (!$('painel-imagem').hidden) { e.preventDefault(); return imagemDeArquivo(f, IMG.r); }
      if (!document.body.classList.contains('editando')) return;
      const t = e.target.closest ? e.target : e.target.parentElement;
      if (!t || !t.closest('section.pagina') || t.closest('#editor-eq')) return;
      if ((dt.getData('text/plain') || '').trim()) return;   // texto copiado (de um editor de texto, p. ex.) cola como texto
      e.preventDefault();
      const r = faixaAtual(); if (r) imagemDeArquivo(f, r.cloneRange());
    });
    // ---------- tabelas: <table class="tabela"> ----------
    // grade: posição de cada célula levando em conta rowspan/colspan
    function grade(t) {
      const L = [...t.rows], G = L.map(() => []), pos = new Map();
      L.forEach((tr, r) => {
        let c = 0;
        for (const cel of tr.cells) {
          while (G[r][c]) c++;
          const rs = Math.max(1, cel.rowSpan), cs = Math.max(1, cel.colSpan);
          pos.set(cel, { r, c, rs, cs });
          for (let i = 0; i < rs && r + i < L.length; i++) for (let j = 0; j < cs; j++) G[r + i][c + j] = cel;
          c += cs;
        }
      });
      const nc = Math.max(0, ...G.map(l => l.length));
      return { L, G, pos, nl: L.length, nc };
    }
    const celulaVazia = tag => { const c = document.createElement(tag || 'td'); c.innerHTML = '<br>'; return c; };
    // põe a célula na linha tr, antes da primeira célula que começa numa coluna >= c
    function porNaLinha(g, tr, cel, c) {
      const dep = [...tr.cells].find(x => x !== cel && g.pos.get(x) && g.pos.get(x).c >= c);
      tr.insertBefore(cel, dep || null);
    }
    function celulaDoCursor() {
      const r = faixaAtual(); if (!r) return null;
      return noDe(r.startContainer).closest('section.pagina table td, section.pagina table th');
    }
    // células escolhidas: o retângulo entre a célula do início e a do fim da seleção (inclui as mescladas inteiras)
    function celulasDaSelecao() {
      const sel = getSelection(); if (!sel.rangeCount) return null;
      const cels = [];
      for (let i = 0; i < sel.rangeCount; i++) { const r = sel.getRangeAt(i); [r.startContainer, r.endContainer].forEach(n => { const c = noDe(n).closest('td, th'); if (c) cels.push(c); }); }
      if (!cels.length) return null;
      const t = cels[0].closest('table'); if (cels.some(c => c.closest('table') !== t)) return null;
      const g = grade(t);
      let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
      const cobre = c => { const p = g.pos.get(c); r0 = Math.min(r0, p.r); c0 = Math.min(c0, p.c); r1 = Math.max(r1, p.r + p.rs - 1); c1 = Math.max(c1, p.c + p.cs - 1); };
      cels.forEach(cobre);
      for (let mudou = true; mudou;) {   // cresce até não cortar nenhuma célula mesclada
        mudou = false; const a = [r0, c0, r1, c1];
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const x = g.G[r] && g.G[r][c]; if (x) cobre(x); }
        if (a.join() !== [r0, c0, r1, c1].join()) mudou = true;
      }
      const lista = []; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const x = g.G[r][c]; if (x && !lista.includes(x)) lista.push(x); }
      return { t, g, r0, c0, r1, c1, lista };
    }
    function abrirTabela() {
      if (!faixaAtual()) return avisar('Clique no texto');
      if (noDe(ED.range.startContainer).closest('table')) return avisar('O cursor já está numa tabela');
      ED.rangeTabela = ED.range.cloneRange();
      const b = $('b-tabela').getBoundingClientRect(), P = $('painel-tabela');
      P.hidden = false; P.style.left = Math.max(8, Math.min(b.left, innerWidth - P.offsetWidth - 8)) + 'px'; P.style.top = b.bottom + 8 + 'px';
      $('pt-linhas').focus(); $('pt-linhas').select();
    }
    function fecharTabela(voltar) {
      $('painel-tabela').hidden = true;
      const r = ED.rangeTabela;
      if (voltar && r && r.startContainer.isConnected) { const sec = noDe(r.startContainer).closest('section.pagina'); if (sec) sec.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    }
    function inserirTabela() {
      const nl = Math.max(1, Math.min(60, parseInt($('pt-linhas').value, 10) || 1)), nc = Math.max(1, Math.min(20, parseInt($('pt-colunas').value, 10) || 1));
      const cab = $('pt-cab').checked, r = ED.rangeTabela;
      fecharTabela(true);
      if (!r || !r.startContainer.isConnected) return;
      const n = noDe(r.startContainer), sec = n.closest('section.pagina'); if (!sec) return;
      let b = n.closest(BLOCOS_L); if (b && b.closest('li')) b = b.closest('ul, ol');
      while (b && b.parentElement !== sec && !b.parentElement.matches('.duas-colunas')) b = b.parentElement;
      const t = document.createElement('table'); t.className = 'tabela'; if (cab && TAB.cabCor) t.dataset.cabCor = TAB.cabCor;
      const tb = document.createElement('tbody'); t.append(tb);
      for (let i = 0; i < nl; i++) { const tr = document.createElement('tr'); for (let j = 0; j < nc; j++) tr.append(celulaVazia(cab && i === 0 ? 'th' : 'td')); tb.append(tr); }
      const L = document.createElement('div'); L.className = 'linha-objeto'; L.append(t);
      const vazio = b && b.matches('p') && !b.textContent.replace(/[\s​]/g, '') && !b.querySelector('mjx-container, img, .marca');
      if (vazio) { if (b.classList.contains('fragment')) L.classList.add('fragment'); b.replaceWith(L); }
      else if (b) b.after(L); else sec.append(L);
      if (!L.nextElementSibling || L.nextElementSibling.matches('.rodape')) { const p = document.createElement('p'); p.innerHTML = '<br>'; L.after(p); }   // para o cursor sair da tabela
      garantirPontos();
      sec.focus({ preventScroll: true }); cursorEm(t.rows[0].cells[0]);
      lerCursor(); sujo(true); iconesCamada(); desenharMarcas(); montarSumario();
    }
    $('b-tabela').onclick = () => $('painel-tabela').hidden ? abrirTabela() : fecharTabela(true);
    const TAB = { cabCor: CORES.includes(lembrar('strata-cab-cor')) ? lembrar('strata-cab-cor') : '' };
    const mostrarCabCor = () => document.querySelectorAll('#pt-cores .pt-cor').forEach(b => b.classList.toggle('ativo', b.dataset.cabCor === TAB.cabCor));
    document.querySelectorAll('#pt-cores .pt-cor').forEach(b => b.onclick = () => { TAB.cabCor = b.dataset.cabCor; lembrar('strata-cab-cor', TAB.cabCor); mostrarCabCor(); });
    mostrarCabCor();
    $('pt-cab').onchange = () => { $('pt-cores').hidden = !$('pt-cab').checked; };
    $('pt-ok').onclick = inserirTabela;
    $('pt-cancelar').onclick = () => fecharTabela(true);
    ['pt-linhas', 'pt-colunas'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inserirTabela(); } else if (e.key === 'Escape') { e.preventDefault(); fecharTabela(true); } }));
    document.querySelectorAll('#painel-tabela button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    document.addEventListener('mousedown', e => { const P = $('painel-tabela'); if (!P.hidden && !P.contains(e.target) && !e.target.closest('#b-tabela')) fecharTabela(false); }, true);

    function opTabela(op) {
      const x = celulasDaSelecao();
      if (!x || !x.t.closest('section.pagina')) return avisar('Clique numa célula da tabela');
      const { t } = x; let g = x.g, foco = null;
      const tagViz = (r, c) => { const v = g.G[r] && g.G[r][c]; return v ? v.tagName.toLowerCase() : 'td'; };
      if (op === 'linha-acima' || op === 'linha-abaixo') {
        const R = op === 'linha-acima' ? x.r0 : x.r1 + 1, ref = g.L[Math.min(R, g.nl - 1)], tr = document.createElement('tr');
        const base = op === 'linha-acima' ? R : R - 1;
        const tag = c => (op === 'linha-acima' && tagViz(base, c) === 'th') ? 'th' : (op === 'linha-abaixo' && tagViz(base, c) === 'th' && R < g.nl) ? 'th' : 'td';
        const feitos = new Set();
        for (let c = 0; c < g.nc; c++) {
          const a = R > 0 ? g.G[R - 1][c] : null, b = R < g.nl ? g.G[R][c] : null;
          if (a && a === b) { if (!feitos.has(a)) { a.rowSpan = a.rowSpan + 1; feitos.add(a); } continue; }   // mesclada atravessando: só cresce
          tr.append(celulaVazia(op === 'linha-abaixo' && R === g.nl ? 'td' : tag(c)));
        }
        if (R < g.nl) ref.before(tr); else ref.after(tr);
        foco = tr.cells[0];
      } else if (op === 'col-esq' || op === 'col-dir') {
        const C = op === 'col-esq' ? x.c0 : x.c1 + 1, feitos = new Set();
        g.L.forEach((tr, r) => {
          const a = C > 0 ? g.G[r][C - 1] : null, b = g.G[r][C];
          if (a && a === b) { if (!feitos.has(a)) { a.colSpan = a.colSpan + 1; feitos.add(a); } return; }
          const nova = celulaVazia(tagViz(r, op === 'col-esq' ? C : C - 1));
          porNaLinha(g, tr, nova, C);
          if (r === x.r0) foco = nova;
        });
      } else if (op === 'del-linha') {
        for (let R = x.r1; R >= x.r0; R--) {
          g = grade(t); const tr = g.L[R]; if (!tr) continue;
          const feitos = new Set();
          for (let c = 0; c < g.nc; c++) {
            const cel = g.G[R][c]; if (!cel || feitos.has(cel)) continue; feitos.add(cel);
            const p = g.pos.get(cel);
            if (p.rs > 1) {
              if (p.r === R) { cel.rowSpan = p.rs - 1; porNaLinha(g, g.L[R + 1], cel, p.c); }   // desce para a linha de baixo
              else cel.rowSpan = p.rs - 1;
            }
          }
          tr.remove();
        }
        g = grade(t); foco = g.L[Math.min(x.r0, g.nl - 1)] && g.L[Math.min(x.r0, g.nl - 1)].cells[0];
      } else if (op === 'del-col') {
        const feitos = new Set();
        for (let r = 0; r < g.nl; r++) for (let c = x.c0; c <= x.c1; c++) {
          const cel = g.G[r][c]; if (!cel || feitos.has(cel)) continue; feitos.add(cel);
          const p = g.pos.get(cel), dentro = Math.min(p.c + p.cs - 1, x.c1) - Math.max(p.c, x.c0) + 1;
          if (dentro >= p.cs) cel.remove(); else cel.colSpan = p.cs - dentro;
        }
        g = grade(t); const tr = g.L[Math.min(x.r0, g.nl - 1)]; foco = tr && (tr.cells[Math.min(x.c0, tr.cells.length - 1)] || tr.cells[0]);
      } else if (op === 'mesclar') {
        if (x.lista.length < 2) return avisar('Selecione duas ou mais células para mesclar');
        const [alvo, ...resto] = x.lista;
        const limpo = c => !c.textContent.replace(/[\s​]/g, '') && !c.querySelector('mjx-container, img, .marca');
        if (limpo(alvo)) alvo.innerHTML = '';
        resto.forEach(c => { if (!limpo(c)) { if (alvo.childNodes.length) alvo.append(' '); alvo.append(...c.childNodes); } c.remove(); });
        if (!alvo.childNodes.length) alvo.innerHTML = '<br>';
        alvo.rowSpan = x.r1 - x.r0 + 1; alvo.colSpan = x.c1 - x.c0 + 1;
        foco = alvo;
      } else if (op === 'separar') {
        const alvos = x.lista.filter(c => c.rowSpan > 1 || c.colSpan > 1);
        if (!alvos.length) return avisar('Essa célula não está mesclada');
        alvos.forEach(cel => {
          g = grade(t); const p = g.pos.get(cel), tag = cel.tagName.toLowerCase();
          cel.removeAttribute('rowspan'); cel.removeAttribute('colspan');
          for (let i = 0; i < p.rs; i++) {
            const tr = g.L[p.r + i]; if (!tr) continue;
            for (let j = p.cs - 1; j >= 0; j--) { if (i === 0 && j === 0) continue; const nova = celulaVazia(tag); if (i === 0) cel.after(nova); else porNaLinha(g, tr, nova, p.c + j); }
          }
        });
        foco = alvos[0];
      } else if (op === 'cabecalho') {
        const tr = g.L[0], th = [...tr.cells].every(c => c.tagName === 'TH');
        [...tr.cells].forEach(c => { const n = document.createElement(th ? 'td' : 'th'); [...c.attributes].forEach(a => n.setAttribute(a.name, a.value)); n.append(...c.childNodes); c.replaceWith(n); });
        foco = tr.cells[0];
      } else if (op === 'tab-pos') {   // a tabela inteira à esquerda, no centro ou à direita da página (ou da coluna)
        t.classList.remove('tab-esq', 'tab-dir'); if (OPPOS === 'esq' || OPPOS === 'dir') t.classList.add('tab-' + OPPOS);
        sujo(true); posBotaoRotulo(); return mostrarFormatos();
      } else if (op === 'cab-cor') {
        if (OPCOR) t.dataset.cabCor = OPCOR; else delete t.dataset.cabCor;
        if (![...g.L[0].cells].some(c => c.tagName === 'TH')) avisar('A cor vale para o cabeçalho: ligue 1ª linha como cabeçalho');
        return sujo(true);
      } else if (op === 'sel-linha' || op === 'sel-col') {
        const a = op === 'sel-linha' ? g.G[x.r0][0] : g.G[0][x.c0], b = op === 'sel-linha' ? g.G[x.r1][g.nc - 1] : g.G[g.nl - 1][x.c1];
        selecionarCelulas(a, b); return;
      } else if (op === 'del-tabela') {
        const p = document.createElement('p'); p.innerHTML = '<br>'; (t.closest(LINHA_OBJ) || t).replaceWith(p); foco = p;
      }
      if (!t.isConnected || !t.rows.length || !t.querySelector('td, th')) { if (t.isConnected) { const p = document.createElement('p'); p.innerHTML = '<br>'; (t.closest(LINHA_OBJ) || t).replaceWith(p); foco = p; } }
      else [...t.rows].forEach(tr => { if (!tr.cells.length) tr.remove(); });   // linha que ficou sem células (mesclagem de linhas inteiras)
      if (foco && foco.isConnected) { const sec = foco.closest('section.pagina'); sec.focus({ preventScroll: true }); cursorEm(foco); }
      lerCursor(); sujo(true); iconesCamada(); desenharMarcas(); mostrarFormatos();
    }
    let OPCOR = '';
    let OPPOS = '';
    combo('c-tabela', b => { OPCOR = b.dataset.cabCor || ''; OPPOS = b.dataset.pos || ''; opTabela(b.dataset.tab); });
    // ---------- seleção de células em retângulo (como numa planilha) ----------
    // Arrastar de uma célula a outra (ou Selecionar linha/coluna) marca o retângulo com .cel-sel;
    // a seleção do navegador continua indo da primeira à última célula, e as operações usam o retângulo.
    function selecionarCelulas(a, b) {
      const sec = a.closest('section.pagina'); if (sec) sec.focus({ preventScroll: true });
      const r = document.createRange(); r.setStart(a, 0); r.setEnd(b, b.childNodes.length);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); lerCursor(); marcarCelulas();
    }
    function marcarCelulas() {
      const x = celulasDaSelecao(), varias = x && x.lista.length > 1 && x.t.closest('section.pagina');
      document.querySelectorAll('.apostila .cel-sel').forEach(c => { if (!varias || !x.lista.includes(c)) c.classList.remove('cel-sel'); });
      document.querySelectorAll('.apostila table.com-sel').forEach(t => { if (!varias || t !== x.t) t.classList.remove('com-sel'); });
      if (varias) { x.lista.forEach(c => c.classList.add('cel-sel')); x.t.classList.add('com-sel'); }
    }
    document.addEventListener('selectionchange', () => { if (document.body.classList.contains('editando')) marcarCelulas(); });
    // clicar dentro de células já selecionadas começa uma seleção nova (e não arrasta o texto selecionado)
    document.addEventListener('mousedown', e => { if (e.button === 0 && !e.shiftKey && e.target.closest && e.target.closest('.apostila table.com-sel')) getSelection().removeAllRanges(); }, true);
    document.querySelectorAll('#c-tabela button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    // dentro da célula: Enter quebra a linha; Tab/Shift+Tab andam entre as células (Tab na última cria uma linha)
    document.addEventListener('keydown', ev => {
      if (!document.body.classList.contains('editando') || (ev.key !== 'Enter' && ev.key !== 'Tab') || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const sel = getSelection(); if (!sel.rangeCount) return;
      const cel = noDe(sel.getRangeAt(0).startContainer).closest('section.pagina td, section.pagina th'); if (!cel) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (ev.key === 'Enter') {
        if (!cel.textContent.replace(/[\s\u200B]/g, '') && !cel.querySelector('mjx-container, img, .marca')) cel.innerHTML = '';   // só o <br> de célula vazia
        const r = cel.innerHTML ? sel.getRangeAt(0) : (() => { const q = document.createRange(); q.setStart(cel, 0); return q; })(); r.deleteContents();
        const br = document.createElement('br'); r.insertNode(br);
        if (!br.nextSibling || (br.nextSibling.nodeType === 3 && !br.nextSibling.data && !br.nextSibling.nextSibling)) br.after(document.createElement('br'));   // no fim, o navegador precisa de dois
        const q = document.createRange(); q.setStartAfter(br); q.collapse(true); sel.removeAllRanges(); sel.addRange(q); sujo(true); return;
      }
      const todas = [...cel.closest('table').querySelectorAll('td, th')], i = todas.indexOf(cel);
      let alvo = todas[i + (ev.shiftKey ? -1 : 1)];
      if (!alvo && !ev.shiftKey) { opTabela('linha-abaixo'); return; }
      if (alvo) { const q = document.createRange(); q.selectNodeContents(alvo); sel.removeAllRanges(); sel.addRange(q); lerCursor(); }
    }, true);
    // ---------- redimensionar imagem: clicar seleciona, alças nos cantos ----------
    // a largura fica em % do bloco (style="width: 48%"), então acompanha a página ou a coluna
    const ISEL = { img: null };
    try { document.execCommand('enableObjectResizing', false, false); } catch (e) {}   // Firefox: sem as alças nativas
    function larguraDoPai(img) {
      const p = img.parentElement, cs = getComputedStyle(p);
      return p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }
    function posImagem() {
      const P = $('img-sel'), im = ISEL.img;
      if (!im || !im.isConnected || !document.body.classList.contains('editando')) { P.hidden = true; ISEL.img = null; return; }
      const b = im.getBoundingClientRect();
      P.hidden = false; Object.assign(P.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
      const L = $('img-legenda'); L.hidden = !im.matches('img'); L.title = figuraDe(im) ? 'Editar a legenda e o label da figura' : 'Pôr legenda na figura (Figura n: ...)';
    }
    function selecionarImagem(im) { ISEL.img = im; posImagem(); }
    document.addEventListener('mousedown', e => {
      if (e.target.closest && e.target.closest('#img-sel')) return;
      const im = document.body.classList.contains('editando') && e.target.closest && e.target.closest('section.pagina img, section.pagina .video');
      if (im) {
        e.preventDefault(); selecionarImagem(im);
        const sec = im.closest('section.pagina'); sec.focus({ preventScroll: true });
        const r = document.createRange(); r.setStartAfter(figuraDe(im) || im); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); lerCursor();
      } else if (ISEL.img) { ISEL.img = null; posImagem(); }
    }, true);
    addEventListener('scroll', posImagem, true); addEventListener('resize', posImagem);
    document.addEventListener('input', () => { if (ISEL.img) posImagem(); });
    // apagar a imagem selecionada; outra tecla tira a seleção
    document.addEventListener('keydown', e => {
      if (!ISEL.img) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); const im = ISEL.img; ISEL.img = null; posImagem(); const L = im.closest(LINHA_OBJ); (figuraDe(im) || im).remove(); if (L && !L.querySelector('table, div.video')) { const p = document.createElement('p'); p.innerHTML = '<br>'; L.replaceWith(p); cursorEm(p); } sujo(true); iconesCamada(); desenharMarcas(); }
      else if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) { ISEL.img = null; posImagem(); }
    }, true);
    document.querySelectorAll('#img-sel .img-alca').forEach(a => {
      a.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        const im0 = ISEL.img; if (!im0) return;
        const im = figuraDe(im0) || im0;   // figura com legenda: a largura é a da caixa
        const x0 = e.clientX, w0 = im.getBoundingClientRect().width, W = larguraDoPai(im), esq = /w/.test(a.dataset.canto);
        const tam = $('img-tam');
        const mover = ev => {
          const w = Math.max(24, Math.min(W, w0 + (esq ? x0 - ev.clientX : ev.clientX - x0)));
          let pc = Math.round(w / W * 1000) / 10;
          for (const m of [25, 33.3, 50, 66.7, 75, 100]) if (Math.abs(pc - m) < 1.2) pc = m;   // encaixa nas frações comuns
          im.style.width = pc + '%'; tam.textContent = (pc === 100 ? 100 : pc) + '%'; posImagem(); desenharMarcas();
        };
        const soltar = () => { removeEventListener('mousemove', mover); removeEventListener('mouseup', soltar); tam.textContent = ''; $('img-sel').classList.remove('mexendo'); sujo(true); desenharMarcas(); posImagem(); };
        $('img-sel').classList.add('mexendo');
        addEventListener('mousemove', mover); addEventListener('mouseup', soltar);
      });
      // dois cliques numa alça: volta ao tamanho natural (limitado à largura do bloco)
      a.addEventListener('dblclick', e => { e.preventDefault(); const im = ISEL.img; if (!im) return; const f = figuraDe(im); if (f && im.naturalWidth) f.style.width = Math.min(100, Math.round(im.naturalWidth / larguraDoPai(f) * 1000) / 10) + '%'; im.style.removeProperty('width'); if (!im.getAttribute('style')) im.removeAttribute('style'); sujo(true); desenharMarcas(); posImagem(); });
    });
    // ---------- colar: só o que faz parte do documento ----------
    // Texto vindo do Word, de PDF ou da web traz fontes, cores e estilos de fora. Fica só a estrutura
    // (parágrafos, títulos, listas, tabelas, negrito, itálico, links) e as fórmulas do próprio Strata.
    // Ctrl+Shift+V cola como texto puro.
    let colarPuro = false;
    document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') { colarPuro = true; setTimeout(() => { colarPuro = false; }, 400); } }, true);
    const COLAR_TAGS = { P: 'p', DIV: 'p', H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h4', H6: 'h4', UL: 'ul', OL: 'ol', LI: 'li', BR: 'br', B: 'b', STRONG: 'b', I: 'i', EM: 'i', A: 'a',
      SUP: 'sup', SUB: 'sub', TABLE: 'table', TBODY: 'tbody', THEAD: 'tbody', TR: 'tr', TD: 'td', TH: 'th', BLOCKQUOTE: 'blockquote', PRE: 'pre', IMG: 'img' };
    function limparColado(html) {
      const t = document.createElement('template'); t.innerHTML = html;
      const tex = [];
      const limpar = (de, para) => {
        for (const n of [...de.childNodes]) {
          if (n.nodeType === 3) { para.append(n.data.replace(/ /g, ' ').replace(/​/g, '')); continue; }
          if (n.nodeType !== 1) continue;
          if (/^(STYLE|SCRIPT|META|LINK|TITLE|HEAD|svg|SVG|O:P|XML)$/i.test(n.tagName) && !n.matches('mjx-container')) continue;
          if (n.matches('.ancora-camada, .marca, .alca-marca, svg.tinta, .tinta-html, .rodape')) continue;
          if (n.matches('mjx-container')) {   // fórmula do Strata: volta como LaTeX e é desenhada de novo
            const x = n.getAttribute('data-tex'); if (x == null) continue;
            const ph = document.createElement('span'); ph.className = 'colar-tex'; ph.dataset.i = tex.length; tex.push({ tex: x, display: n.getAttribute('data-display') === '1' || n.getAttribute('display') === 'true' }); para.append(ph); continue;
          }
          // Word e Google Docs marcam negrito e itálico por estilo
          const st = n.getAttribute('style') || '';
          let tag = COLAR_TAGS[n.tagName];
          if (!tag && n.tagName === 'SPAN') { if (/font-weight:\s*(bold|[6-9]00)/.test(st)) tag = 'b'; else if (/font-style:\s*italic/.test(st)) tag = 'i'; }
          if (tag === 'b' && /font-weight:\s*(normal|[1-4]00)/.test(st)) tag = null;   // Google Docs: <b style="font-weight:normal">
          if (!tag) { limpar(n, para); continue; }
          const e = document.createElement(tag);
          if (tag === 'a') { const h = n.getAttribute('href') || ''; if (!/^(https?:|mailto:|#)/i.test(h)) { limpar(n, para); continue; } e.setAttribute('href', h); if (h[0] !== '#') { e.target = '_blank'; e.rel = 'noopener'; } }
          if (tag === 'img') { const src = n.getAttribute('src') || ''; if (!/^(data:image\/|https?:)/.test(src)) continue; e.src = src; e.alt = n.getAttribute('alt') || ''; const w = n.style.width || (n.parentElement && n.parentElement.matches('span.figura') ? n.parentElement.style.width : ''); if (/^[\d.]+%$/.test(w)) e.style.width = w; para.append(e); continue; }
          if (tag === 'table') e.className = 'tabela';
          if ((tag === 'td' || tag === 'th') && n.getAttribute('colspan')) e.setAttribute('colspan', n.getAttribute('colspan'));
          if ((tag === 'td' || tag === 'th') && n.getAttribute('rowspan')) e.setAttribute('rowspan', n.getAttribute('rowspan'));
          limpar(n, e);
          if (/^(b|i|a|sup|sub)$/.test(tag) && !e.textContent.trim() && !e.querySelector('img, .colar-tex')) { e.childNodes.length && para.append(...e.childNodes); continue; }
          para.append(e);
        }
      };
      const out = document.createElement('div'); limpar(t.content, out);
      out.querySelectorAll('p').forEach(p => { if (p.querySelector('p, ul, ol, table, h2, h3, h4, pre, blockquote')) p.replaceWith(...p.childNodes); });   // <div> que só agrupava
      out.querySelectorAll('p, h2, h3, h4, li').forEach(p => { if (!p.textContent.trim() && !p.querySelector('img, .colar-tex, br')) p.remove(); });
      return { html: out.innerHTML, tex };
    }
    document.addEventListener('paste', async e => {
      if (e.defaultPrevented || !document.body.classList.contains('editando') || document.body.classList.contains('escolhendo')) return;
      const t = e.target.closest ? e.target : e.target.parentElement;
      if (!t || !t.closest('section.pagina') || t.closest('#editor-eq, input, textarea')) return;
      const dt = e.clipboardData; if (!dt) return;
      const html = dt.getData('text/html'), txt = dt.getData('text/plain');
      if (!html && !txt) return;
      e.preventDefault();
      const celula = t.closest('td, th');
      if (colarPuro || !html || celula) {   // texto puro (numa célula, sempre: sem parágrafos dentro da tabela)
        const linhas = txt.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
        if (celula) { document.execCommand('insertText', false, linhas.replace(/\n+/g, ' ')); return; }
        const partes = linhas.split('\n');
        partes.forEach((l, i) => { if (i) document.execCommand('insertParagraph'); if (l) document.execCommand('insertText', false, l); });
        return;
      }
      const { html: limpo, tex } = limparColado(html);
      if (!limpo.replace(/<[^>]+>/g, '').trim() && !/<img|colar-tex/.test(limpo)) { document.execCommand('insertText', false, txt); return; }
      document.execCommand('insertHTML', false, limpo);
      // o navegador às vezes põe estilos por conta própria ao inserir
      document.querySelectorAll('section.pagina span[style]:not([class]), section.pagina font').forEach(x => x.replaceWith(...x.childNodes));
      document.querySelectorAll('section.pagina b[style], section.pagina i[style], section.pagina a[style], section.pagina li[style], section.pagina ul[style], section.pagina ol[style], section.pagina h2[style], section.pagina h3[style], section.pagina h4[style], section.pagina p[style]:not(.no-fim)').forEach(x => x.removeAttribute('style'));
      for (const ph of [...document.querySelectorAll('section.pagina span.colar-tex')]) {
        const x = tex[+ph.dataset.i]; if (!x) { ph.remove(); continue; }
        const c = await renderTex(x.tex, x.display); ph.replaceWith(c);
      }
      sujo(true); iconesCamada(); desenharMarcas(); montarSumario();
    });
    // arrastar um arquivo de imagem direto para o texto
    const temArquivo = dt => dt && [...(dt.types || [])].includes('Files');
    document.addEventListener('dragover', ev => { if (document.body.classList.contains('editando') && !MK.arrasto && !MK.arrastoCamada && temArquivo(ev.dataTransfer) && ev.target.closest && ev.target.closest('section.pagina')) ev.preventDefault(); });
    document.addEventListener('drop', ev => {
      if (MK.arrasto || MK.arrastoCamada || !document.body.classList.contains('editando')) return;
      const f = arquivoDeImagem(ev.dataTransfer); if (!f) return;
      let r = null;
      if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(ev.clientX, ev.clientY);
      else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(ev.clientX, ev.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
      if (!r || !noDe(r.startContainer).closest('section.pagina')) return;
      ev.preventDefault(); imagemDeArquivo(f, r);
    });
    // alinhamento: clicar de novo no alinhamento atual volta ao padrão
    const ALINHAS = ['alinha-esq', 'alinha-centro', 'alinha-dir', 'alinha-just'];
    document.querySelectorAll('#barra [data-alinha]').forEach(b => b.onclick = () => {
      const tc = faixaAtual() && noDe(ED.range.startContainer).closest('section.pagina td, section.pagina th');
      if (tc) {   // na tabela: alinha o conteúdo das células escolhidas
        const x = celulasDaSelecao(), cels = x ? x.lista : [tc], k = b.dataset.alinha, tira = cels.every(c => c.classList.contains(k));
        return depoisDe(() => cels.forEach(c => { c.classList.remove(...ALINHAS); if (!tira) c.classList.add(k); if (!c.classList.length) c.removeAttribute('class'); }));
      }
      const bl = blocosDa(faixaAtual(), BLOCOS); if (!bl.length) return avisar('Clique num parágrafo');
      // equação alinhada à esquerda = linha de um desenvolvimento (classe passo: à esquerda e com pouco espaço entre as linhas)
      const k = b.dataset.alinha, cl = e => e.matches('div.eq') && k === 'alinha-esq' ? 'passo' : k, tira = bl.every(e => e.classList.contains(cl(e)));
      depoisDe(() => bl.forEach(e => { e.classList.remove(...ALINHAS); if (e.matches('div.eq')) e.classList.remove('passo'); if (!tira) e.classList.add(cl(e)); if (!e.classList.length) e.removeAttribute('class'); }));
    });
    // duas colunas: os blocos ficam dentro de um <div class="duas-colunas">; clicar de novo dentro dele desfaz
    $('b-colunas').onclick = () => {
      const r0 = faixaAtual(), bl = blocosDa(r0, 'table, ' + BLOCOS).map(e => e.closest('table') || e).filter((e, i, a) => a.indexOf(e) === i);   // a tabela vai inteira
      if (!bl.length) return avisar('Clique num parágrafo');
      const caixa = bl[0].closest('.duas-colunas');
      depoisDe(() => {
        if (caixa) { caixa.replaceWith(...caixa.childNodes); return; }
        const sec = bl[0].closest('section.pagina'); if (!sec) return;
        const topo = e => { while (e && e.parentElement !== sec) e = e.parentElement; return e; };
        const tops = bl.filter(e => sec.contains(e)).map(topo).filter(Boolean);
        const ini = tops[0], fim = tops[tops.length - 1];
        const d = document.createElement('div'); d.className = 'duas-colunas';
        ini.before(d);
        for (let e = ini; e; ) { const prox = e.nextSibling; if (!(e.nodeType === 1 && e.matches('.rodape, svg.tinta, .tinta-html'))) d.append(e); if (e === fim) break; e = prox; }
      });
      montarSumario();
    };
    // recuo: em listas, aninha (ou desaninha) o item; nos demais blocos, recuo-1..4
    function recuar(d) {
      const r = faixaAtual(); const bl = blocosDa(r, BLOCOS); if (!bl.length) return avisar('Clique num parágrafo');
      if (bl.every(e => e.matches('li'))) { document.execCommand(d > 0 ? 'indent' : 'outdent'); iconesCamada(); sujo(true); desenharMarcas(); return; }
      depoisDe(() => bl.forEach(e => {
        if (e.matches('li')) return;
        const n0 = +((e.className.match(/\brecuo-(\d)\b/) || [])[1] || 0);
        // parágrafo: antes do recuo do bloco, o recuo da 1ª linha (diminuir no nível 0 tira; aumentar devolve)
        if (e.matches('p:not(.subtitulo)')) {
          if (d < 0 && !n0 && !e.classList.contains('sem-recuo')) { e.classList.add('sem-recuo'); return; }
          if (d > 0 && e.classList.contains('sem-recuo')) { e.classList.remove('sem-recuo'); if (!e.classList.length) e.removeAttribute('class'); return; }
        }
        const n = Math.max(0, Math.min(4, n0 + d));
        e.classList.remove('recuo-1', 'recuo-2', 'recuo-3', 'recuo-4'); if (n) e.classList.add('recuo-' + n);
        if (!e.classList.length) e.removeAttribute('class');
      }));
    }
    $('b-mais-recuo').onclick = () => recuar(1);
    $('b-menos-recuo').onclick = () => recuar(-1);
    // listas
    function tirarDaLista(li) {
      const L = li.parentElement, depois = [...L.children].slice([...L.children].indexOf(li) + 1);
      if (depois.length) { const L2 = L.cloneNode(false); L2.append(...depois); L.after(L2); }
      const p = trocarTag(li, 'p'); p.classList.add('sem-recuo'); L.after(p);
      if (!L.children.length) L.remove();
    }
    // Lista numerada separada da anterior (do mesmo tipo) só por equações destacadas continua a numeração.
    // marcador (1., •, i)) na cor do começo do texto do item: data-cor-marca = classe da cor
    function corDosMarcadores() {
      const SEL = CORES.map(c => 'span.' + c).join(', ');
      document.querySelectorAll('.apostila section.pagina li').forEach(li => {
        const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); let t, cor = '';
        while ((t = w.nextNode())) {
          if (!t.data.replace(/[\s\u200B]/g, '') || t.parentElement.closest('.ancora-camada, .marca, mjx-container')) continue;
          if (t.parentElement.closest('ul, ol') !== li.parentElement) break;
          const sp = t.parentElement.closest(SEL); cor = sp && li.contains(sp) ? CORES.find(k => sp.classList.contains(k)) : ''; break;
        }
        if ((li.dataset.corMarca || '') !== cor) { if (cor) li.dataset.corMarca = cor; else delete li.dataset.corMarca; }
      });
    }
    function numerarListas() {
      corDosMarcadores();
      document.querySelectorAll('.apostila section.pagina ol').forEach(L => {
        let a = L.previousElementSibling;
        while (a && (a.matches('div.eq, span.marca, aside.nota') || a.matches('svg.tinta, .tinta-html'))) a = a.previousElementSibling;
        let ini = 1;
        if (a && a.matches('ol') && tipoDaLista(a) === tipoDaLista(L)) ini = (+a.getAttribute('start') || 1) + a.querySelectorAll(':scope > li').length;
        if (ini > 1) { L.setAttribute('start', ini); L.style.setProperty('--inicio', ini); }
        else { L.removeAttribute('start'); L.style.removeProperty('--inicio'); if (!L.getAttribute('style')) L.removeAttribute('style'); }
      });
    }
    // tipo: 'ul', 'ol', 'ol:i' (romanos) ou 'ol:a' (letras)
    function tipoDaLista(L) { const t = L.tagName.toLowerCase(); return t === 'ol' && L.getAttribute('type') ? 'ol:' + L.getAttribute('type') : t; }
    function novaLista(tipo) { const [tag, t] = tipo.split(':'); const L = document.createElement(tag); if (t) L.setAttribute('type', t); return L; }
    function lista(tipo) {
      const bl = blocosDa(faixaAtual(), BLOCOS);
      if (!bl.length) return avisar('Clique num parágrafo');
      const lis = bl.filter(e => e.matches('li'));
      // só itens de lista (equações e outros blocos no meio não contam): troca o tipo ou desfaz a lista
      if (lis.length && !bl.some(e => e.matches('p'))) {
        if (lis.every(li => tipoDaLista(li.parentElement) === tipo)) return depoisDe(() => lis.forEach(tirarDaLista));
        depoisDe(() => [...new Set(lis.map(li => li.parentElement))].forEach(L => {
          const N = novaLista(tipo); for (const at of L.attributes) if (at.name !== 'type') N.setAttribute(at.name, at.value);
          N.append(...L.childNodes); L.replaceWith(N);
        }));
        return selecionarItens(lis);
      }
      const ps = bl.filter(e => e.matches('p'));
      if (!ps.length) return avisar('Listas só com parágrafos de texto');
      const novos = [];
      depoisDe(() => {
        let L = null;
        for (const p of ps) {
          if (!L || p.previousElementSibling !== L) { L = novaLista(tipo); p.before(L); }
          const li = trocarTag(p, 'li'); li.classList.remove('sem-recuo', 'recuo-1', 'recuo-2', 'recuo-3', 'recuo-4'); if (!li.classList.length) li.removeAttribute('class');
          L.append(li); novos.push(li);
        }
      });
      selecionarItens(novos);
    }
    // depois de mexer na lista, a seleção cobre os itens (para trocar o tipo em seguida)
    function selecionarItens(lis) {
      lis = lis.filter(li => li.isConnected); if (!lis.length) return;
      const r = document.createRange(), u = lis[lis.length - 1];
      r.setStart(lis[0], 0); r.setEnd(u, u.childNodes.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); lerCursor(); mostrarFormatos();
    }
    $('b-lista').onclick = () => lista('ul');
    $('b-lista-num').onclick = () => lista('ol');
    $('b-lista-rom').onclick = () => lista('ol:i');
    $('b-lista-alfa').onclick = () => lista('ol:a');
    // botões mostram o que vale no ponto do cursor
    function mostrarFormatos() {
      if (!document.body.classList.contains('editando')) return;
      const r = ED.range, b = r && r.startContainer.isConnected ? noDe(r.startContainer).closest(BLOCOS) : null;
      const tcel = r && r.startContainer.isConnected ? noDe(r.startContainer).closest('td, th') : null;
      let q = (k) => { try { return document.queryCommandState(k); } catch (e) { return false; } };
      $('b-negrito').classList.toggle('ativo-fmt', !!r && q('bold'));
      $('b-italico').classList.toggle('ativo-fmt', !!r && q('italic'));
      document.querySelectorAll('#barra [data-alinha]').forEach(x => x.classList.toggle('ativo-fmt', tcel ? tcel.classList.contains(x.dataset.alinha) : !!b && (b.classList.contains(x.dataset.alinha) || (x.dataset.alinha === 'alinha-esq' && b.matches('div.eq.passo')))));
      $('b-colunas').classList.toggle('ativo-fmt', !!(b || tcel) && !!(b || tcel).closest('.duas-colunas'));
      const tab = tcel && tcel.closest('table'), pos = tab ? (tab.classList.contains('tab-esq') ? 'esq' : tab.classList.contains('tab-dir') ? 'dir' : 'centro') : '';
      document.querySelectorAll('#c-tabela .pt-pos').forEach(x => x.classList.toggle('ativo', x.dataset.pos === pos));
      const li = b && b.matches('li') ? tipoDaLista(b.parentElement) : '';
      [['b-lista', 'ul'], ['b-lista-num', 'ol'], ['b-lista-rom', 'ol:i'], ['b-lista-alfa', 'ol:a']].forEach(([id, t]) => $(id).classList.toggle('ativo-fmt', li === t));
      const tag = b ? (b.matches('.subtitulo') ? 'subtitulo' : b.matches('div.eq') ? 'eq' : b.tagName.toLowerCase()) : 'p';
      const chave = b && b.matches('li') ? 'li' : b && b.matches('div.eq') ? 'eq' : document.querySelector('#c-estilo [data-estilo="' + tag + '"]') ? tag : 'p';
      const item = document.querySelector('#c-estilo [data-estilo="' + chave + '"] .ci');
      $('b-estilo').innerHTML = item ? item.innerHTML : ICONES_ESTILO[chave];
      $('b-estilo').title = 'Estilo do parágrafo: ' + (chave === 'li' ? 'Lista' : chave === 'eq' ? 'Equação' : ESTILOS[tag] || 'Parágrafo');
      document.querySelectorAll('#c-estilo [data-estilo]').forEach(x => x.classList.toggle('ativo', x.dataset.estilo === tag));
      document.querySelectorAll('#barra .combo.grupo').forEach(c => c._mostrar && c._mostrar());
    }
    document.addEventListener('selectionchange', () => { clearTimeout(mostrarFormatos.t); mostrarFormatos.t = setTimeout(mostrarFormatos, 60); });

    // ---------- localizar e substituir (no texto e, se marcado, no LaTeX das fórmulas) ----------
    const BUSCA = { achados: [], i: -1 };
    const FORA_BUSCA = '.ancora-camada, .marca, .tinta-html, svg.tinta, mjx-container, .rodape';
    function textoBuscavel(n) { return !n.parentElement.closest(FORA_BUSCA); }
    function procurar() {
      const q = $('pb-busca').value, caixa = $('pb-caixa').checked, latex = $('pb-latex').checked;
      const ant = BUSCA.achados[BUSCA.i];
      BUSCA.achados = [];
      if (q) {
        const norm = t => caixa ? t : t.toLocaleLowerCase('pt-BR'), qq = norm(q);
        document.querySelectorAll('section.pagina').forEach(sec => {
          let corrida = [];   // pedaços de texto seguidos (entre fórmulas)
          const fechar = () => {
            if (!corrida.length) return;
            let txt = '', mapa = [];
            for (const t of corrida) for (let k = 0; k < t.data.length; k++) if (t.data[k] !== ZW) { txt += t.data[k]; mapa.push([t, k]); }
            const T = norm(txt);
            for (let i = T.indexOf(qq); i >= 0 && qq; i = T.indexOf(qq, i + qq.length)) {
              const [n0, k0] = mapa[i], [n1, k1] = mapa[i + qq.length - 1];
              const r = document.createRange(); r.setStart(n0, k0); r.setEnd(n1, k1 + 1);
              BUSCA.achados.push({ r });
            }
            corrida = [];
          };
          const fila = [];   // fórmulas achadas pelo caminho (o filtro é chamado na ordem do documento)
          const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => {
            if (n.nodeType === 3) return NodeFilter.FILTER_ACCEPT;
            if (n.matches('mjx-container')) { fila.push(n); return NodeFilter.FILTER_REJECT; }
            if (n.matches('.ancora-camada, .marca, .tinta-html, svg.tinta, .rodape')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_SKIP; } });
          const formulas = () => {
            while (fila.length) {
              const c = fila.shift(); fechar();
              if (latex && c.dataset.tex != null) { const T = norm(c.dataset.tex); for (let i = T.indexOf(qq); i >= 0; i = T.indexOf(qq, i + qq.length)) BUSCA.achados.push({ eq: c, i, n: q.length }); }
            }
          };
          let blocoAtual = null;
          for (let n; (n = w.nextNode());) {
            formulas();
            const b = n.parentElement.closest(BLOCOS);
            if (b !== blocoAtual) { fechar(); blocoAtual = b; }
            corrida.push(n);
          }
          formulas();
          fechar();
        });
      }
      // continua perto do achado anterior
      BUSCA.i = BUSCA.achados.length ? 0 : -1;
      if (ant && BUSCA.achados.length) {
        const pos = ant.r ? ant.r : (() => { const r = document.createRange(); if (ant.eq.isConnected) r.selectNode(ant.eq); return r; })();
        const k = BUSCA.achados.findIndex(a => { const r = a.r || (() => { const x = document.createRange(); x.selectNode(a.eq); return x; })(); try { return r.compareBoundaryPoints(Range.START_TO_START, pos) >= 0; } catch (e) { return false; } });
        if (k >= 0) BUSCA.i = k;
      }
      pintarBusca();
    }
    function pintarBusca(rolar) {
      document.querySelectorAll('.busca-eq, .busca-eq-atual').forEach(e => { e.classList.remove('busca-eq', 'busca-eq-atual'); const v = e.querySelector(':scope > svg'); if (v && !e.classList.contains('na-camada')) { v.style.removeProperty('background-position'); v.style.removeProperty('background-size'); } });
      const tem = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
      if (tem) { CSS.highlights.delete('busca'); CSS.highlights.delete('busca-atual'); }
      const A = BUSCA.achados, atual = A[BUSCA.i];
      $('pb-conta').textContent = $('pb-busca').value ? (A.length ? (BUSCA.i + 1) + ' de ' + A.length : 'nenhum') : '';
      if ($('painel-busca').hidden || !A.length) return;
      if (tem) {
        const rs = A.filter(a => a.r && a !== atual).map(a => a.r);
        if (rs.length) CSS.highlights.set('busca', new Highlight(...rs));
        if (atual && atual.r) CSS.highlights.set('busca-atual', new Highlight(atual.r));
      }
      A.forEach(a => { if (a.eq) { a.eq.classList.add(a === atual ? 'busca-eq-atual' : 'busca-eq'); faixaVisivel(a.eq); } });
      if (rolar && atual) {
        const q = atual.r ? atual.r.getBoundingClientRect() : atual.eq.getBoundingClientRect();
        if (q.top < 90 || q.bottom > innerHeight - 200) scrollBy({ top: q.top - innerHeight / 3, behavior: 'smooth' });
      }
    }
    function irBusca(d) { const n = BUSCA.achados.length; if (!n) return; BUSCA.i = (BUSCA.i + d + n) % n; pintarBusca(true); }
    async function trocarNaFormula(c, trocas) {   // trocas: [{i, n}] em ordem crescente
      let t = c.dataset.tex; const rep = $('pb-troca').value;
      for (const x of [...trocas].reverse()) t = t.slice(0, x.i) + rep + t.slice(x.i + x.n);
      let novo;
      try { novo = await renderTex(t, c.dataset.display === '1'); } catch (e) { avisar('O LaTeX ficou com erro'); return false; }
      c.replaceWith(novo); return true;
    }
    async function substituirAtual() {
      const a = BUSCA.achados[BUSCA.i]; if (!a) return;
      if (a.r) { a.r.deleteContents(); const rep = $('pb-troca').value; if (rep) a.r.insertNode(document.createTextNode(rep)); a.r.startContainer.parentElement && a.r.startContainer.parentElement.normalize(); }
      else await trocarNaFormula(a.eq, [a]);
      sujo(true); garantirPontos(); desenharMarcas(); procurar(); pintarBusca(true);
    }
    async function substituirTudo() {
      const A = BUSCA.achados; if (!A.length) return;
      const n = A.length, rep = $('pb-troca').value, eqs = new Map();
      for (const a of [...A].reverse()) {
        if (a.r) { a.r.deleteContents(); if (rep) a.r.insertNode(document.createTextNode(rep)); }
        else { if (!eqs.has(a.eq)) eqs.set(a.eq, []); eqs.get(a.eq).unshift(a); }
      }
      for (const [c, l] of eqs) await trocarNaFormula(c, l);
      document.querySelectorAll('section.pagina').forEach(s => s.normalize());
      sujo(true); garantirPontos(); desenharMarcas(); montarSumario(); procurar();
      avisar(n + (n === 1 ? ' substituição' : ' substituições'));
    }
    function abrirBusca() {
      const P = $('painel-busca'); P.hidden = false;
      P.style.top = $('barra').offsetHeight + 8 + 'px';
      const s = getSelection(); if (s.rangeCount && !s.isCollapsed && s.toString().length < 80 && !s.toString().includes('\n')) $('pb-busca').value = s.toString().replace(/\u200B/g, '');
      $('pb-busca').focus(); $('pb-busca').select(); procurar(); pintarBusca(true);
    }
    function fecharBusca() { $('painel-busca').hidden = true; BUSCA.achados = []; BUSCA.i = -1; pintarBusca(); }
    $('b-busca').onclick = () => $('painel-busca').hidden ? abrirBusca() : fecharBusca();
    $('pb-fechar').onclick = fecharBusca;
    $('pb-prox').onclick = () => irBusca(1);
    $('pb-ant').onclick = () => irBusca(-1);
    $('pb-um').onclick = substituirAtual;
    $('pb-todos').onclick = substituirTudo;
    $('pb-busca').addEventListener('input', () => { BUSCA.achados = []; procurar(); pintarBusca(true); });
    ['pb-caixa', 'pb-latex'].forEach(id => $(id).addEventListener('change', () => { procurar(); pintarBusca(true); }));
    ['pb-busca', 'pb-troca'].forEach(id => $(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (id === 'pb-troca' && (e.ctrlKey || e.metaKey)) substituirTudo(); else if (id === 'pb-troca') substituirAtual(); else irBusca(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); fecharBusca(); }
    }));
    // as marcas da busca acompanham a edição do texto
    document.addEventListener('input', e => { if (!$('painel-busca').hidden && e.target.closest && e.target.closest('section.pagina')) { clearTimeout(procurar.t); procurar.t = setTimeout(procurar, 300); } });
    document.querySelectorAll('#painel-link button, #painel-busca button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));

    // botões agrupados (formatação, alinhamento, listas, equações): o botão principal repete a última opção usada
    document.querySelectorAll('#barra .combo.grupo').forEach(c => {
      const prin = c.querySelector(':scope > .b-icone'), menu = c.querySelector('.combo-menu'), ops = [...menu.querySelectorAll('button')];
      const chave = 'apostila-' + c.id;
      const mostrar = b => { prin.innerHTML = b.querySelector('.ci').innerHTML; prin.title = b.title || b.textContent; prin.dataset.op = b.id; prin.classList.toggle('ativo-fmt', b.classList.contains('ativo-fmt')); };
      mostrar(ops.find(b => b.id === lembrar(chave)) || ops[0]);
      prin.onclick = () => $(prin.dataset.op).click();
      c.querySelector('.combo-seta').onclick = () => { const ab = menu.hidden; document.querySelectorAll('.combo-menu').forEach(m => m.hidden = true); menu.hidden = !ab; };
      ops.forEach(b => b.addEventListener('click', () => { menu.hidden = true; lembrar(chave, b.id); mostrar(b); }));
      c._mostrar = () => mostrar($(prin.dataset.op));
    });
    // atalhos: Ctrl+\ liga/desliga a edição; na edição, Alt+X fórmula em linha, Alt+C camada, Ctrl+Q olho
    document.addEventListener('keydown', ev => {
      if (ev.target.closest && ev.target.closest('input, textarea')) return;
      // AltGr (Alt da direita, no Windows) chega como Ctrl+Alt: vale como Alt
      const altgr = !!(ev.getModifierState && ev.getModifierState('AltGraph')), alt = ev.altKey || altgr;
      const mod = (ev.ctrlKey || ev.metaKey) && !altgr, ed = document.body.classList.contains('editando');
      const tecla = l => ev.code === 'Key' + l || ev.key.toLowerCase() === l.toLowerCase();
      let f = null;
      if (mod && !ev.altKey && (ev.key === '\\' || ev.code === 'Backslash' || ev.code === 'IntlBackslash')) f = () => $('m-edicao').click();
      else if (ed && mod && !alt && !ev.shiftKey && tecla('Q')) f = () => $('b-olho').click();
      else if (ed && alt && !mod && !ev.shiftKey && (tecla('X') || ev.key === '≈')) f = () => $('b-inline').click();
      else if (ed && alt && !mod && !ev.shiftKey && (tecla('C') || ev.key === 'ç' || ev.key === 'Ç' || ev.key === '₢')) f = () => $('b-camada').click();
      else if (ed && mod && !alt && !ev.shiftKey && tecla('K')) f = () => abrirLink();
      else if (ed && mod && !alt && !ev.shiftKey && tecla('H')) f = () => abrirBusca();
      if (!f) return;
      ev.preventDefault(); ev.stopPropagation();
      if (document.body.classList.contains('escolhendo') && f !== null && !mod) return;
      lerCursor(); f();
    });

    // ---------- tema e menu ----------
    const tituloTema = () => $('b-tema').title = Strata.temaEscuro()
      ? 'Tema escuro (clique para o claro; só nesta tela, o arquivo não muda)'
      : 'Tema claro (clique para o escuro; só nesta tela, o arquivo não muda)';
    tituloTema();
    $('b-tema').onclick = () => {
      const escuro = document.documentElement.classList.toggle('strata-escuro');
      try { localStorage.setItem('strata-tema', escuro ? 'escuro' : 'claro'); } catch (e) {}
      tituloTema(); desenharMarcas();
    };

    // ---------- notas de rodapé ----------
    // No texto: <sup class="ref-nota" data-nota="nr-1">1</sup>; no pé da página:
    // <div class="notas-rodape"><p class="nota-rodape" id="nr-1" data-n="1">texto</p></div>.
    // A numeração segue a ordem das chamadas no documento; na apresentação, a nota aparece com a chamada.
    function novoIdNota() { let k = 1; while (document.getElementById('nr-' + k)) k++; return 'nr-' + k; }
    function sincronizarNotas() {
      const refs = [...document.querySelectorAll('.apostila sup.ref-nota')];
      const aula = document.body.classList.contains('aula'), edicao = document.body.classList.contains('editando');
      const usadas = new Set();
      refs.forEach((ref, i) => {
        const n = String(i + 1); if (ref.textContent !== n) ref.textContent = n;
        ref.setAttribute('contenteditable', 'false');
        const pag = ref.closest('section.pagina'); if (!pag) return;
        let nota = ref.dataset.nota && document.getElementById(ref.dataset.nota);
        if (!nota || usadas.has(nota)) { nota = document.createElement('p'); nota.className = 'nota-rodape'; nota.id = ref.dataset.nota = (ref.dataset.nota && !document.getElementById(ref.dataset.nota)) ? ref.dataset.nota : novoIdNota(); nota.innerHTML = '<br>'; }
        usadas.add(nota);
        if (nota.dataset.n !== n) nota.dataset.n = n;
        let caixa = pag.querySelector(':scope > .notas-rodape');
        if (!caixa) { caixa = document.createElement('div'); caixa.className = 'notas-rodape'; const rod = pag.querySelector(':scope > .rodape'); if (rod) rod.before(caixa); else pag.append(caixa); }
        if (nota.parentElement !== caixa || (nota.previousElementSibling && !usadas.has(nota.previousElementSibling))) caixa.append(nota);
        else { const ant = refs[i - 1]; if (ant && ant.closest('section.pagina') === pag && nota.previousElementSibling !== document.getElementById(ant.dataset.nota)) caixa.append(nota); }
        nota.classList.toggle('oculta', aula && !!ref.closest('.fragment:not(.visivel)'));
      });
      document.querySelectorAll('.apostila .notas-rodape').forEach(c => {
        if (edicao) [...c.querySelectorAll('.nota-rodape')].forEach(x => { if (!usadas.has(x)) x.remove(); });   // chamada apagada: a nota sai junto
        if (!c.querySelector('.nota-rodape')) { c.remove(); return; }
      });
      document.querySelectorAll('.apostila section.pagina').forEach(pag => {
        const c = pag.querySelector(':scope > .notas-rodape');
        pag.style.paddingBottom = c ? (parseFloat(getComputedStyle(pag, null).getPropertyValue('--pe') || 72) + c.offsetHeight + 12) + 'px' : '';
        if (!pag.getAttribute('style')) pag.removeAttribute('style');
      });
    }
    $('b-nota-rodape').onclick = () => {
      const r = faixaAtual(); if (!r) return avisar('Clique no texto, no ponto da chamada da nota');
      if (noDe(r.startContainer).closest('.notas-rodape')) return avisar('Clique no texto, fora das notas');
      const ref = document.createElement('sup'); ref.className = 'ref-nota'; ref.dataset.nota = novoIdNota(); ref.setAttribute('contenteditable', 'false');
      const q = r.cloneRange(); q.collapse(false); q.insertNode(ref);
      sincronizarNotas();
      const nota = document.getElementById(ref.dataset.nota);
      if (nota) { const sec = nota.closest('section.pagina'); sec.focus({ preventScroll: true }); cursorEm(nota); nota.scrollIntoView({ block: 'nearest' }); }
      lerCursor(); sujo(true); desenharMarcas();
    };
    // dentro da nota, Enter não cria outra nota (Shift+Enter quebra a linha)
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.shiftKey || !document.body.classList.contains('editando')) return;
      const s = getSelection(); if (!s.rangeCount) return;
      if (noDe(s.getRangeAt(0).startContainer).closest('.nota-rodape')) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
    // clicar na chamada (fora da edição) leva à nota
    document.addEventListener('click', ev => {
      const ref = ev.target.closest && ev.target.closest('.apostila sup.ref-nota');
      if (!ref || document.body.classList.contains('editando')) return;
      const n = document.getElementById(ref.dataset.nota); if (n) { n.scrollIntoView({ block: 'center', behavior: 'smooth' }); n.classList.add('piscando'); setTimeout(() => n.classList.remove('piscando'), 1200); }
    });

    // ---------- numeração automática (como no LaTeX) ----------
    // Capítulos, seções, subseções, ambientes, equações numeradas, figuras e tabelas com legenda recebem
    // número na ordem do documento, de novo a cada desenho da página (mudou de lugar, muda o número).
    // Cada um tem um label (o id), sorteado e editável; um link interno para ele (a.ref) mostra o número
    // atual: (3), Figura 2, Teorema 1. Label que não existe mais vira ??, como no LaTeX.
    //   <h2 class="secao" id="sec:k3x9p">        <span class="eq-num" id="eq:..."> (fórmula destacada)
    //   <div class="ambiente" data-tipo="teorema" id="teo:..." data-nome="Pitágoras">
    //   <span class="figura" id="fig:..." style="width: 48%"><img><span class="legenda">texto</span></span>
    //   <table class="tabela" id="tab:..."><caption>texto</caption> ...
    const NUM = {
      capitulo: { nome: 'Capítulo', pref: 'cap' }, secao: { nome: 'Seção', pref: 'sec' }, subsecao: { nome: 'Subseção', pref: 'subsec' },
      definicao: { nome: 'Definição', pref: 'def' }, teorema: { nome: 'Teorema', pref: 'teo' }, exemplo: { nome: 'Exemplo', pref: 'ex' }, observacao: { nome: 'Observação', pref: 'obs' },
      equacao: { nome: 'Equação', pref: 'eq' }, figura: { nome: 'Figura', pref: 'fig' }, tabela: { nome: 'Tabela', pref: 'tab' }
    };
    const TITULOS_NUM = { capitulo: 'h1', secao: 'h2', subsecao: 'h3' };
    const AMBIENTES = ['definicao', 'teorema', 'exemplo', 'observacao'];
    const SEL_NUM = '.apostila h1.capitulo, .apostila h2.secao, .apostila h3.subsecao, .apostila .ambiente, .apostila span.eq-num, .apostila span.figura, .apostila table.tabela';
    function tipoNum(e) {
      if (!e || e.nodeType !== 1) return null;
      if (e.matches('span.eq-num')) return 'equacao';
      if (e.matches('span.figura')) return 'figura';
      if (e.matches('table')) return e.querySelector(':scope > caption') ? 'tabela' : null;
      if (e.matches('.ambiente')) return AMBIENTES.includes(e.dataset.tipo) ? e.dataset.tipo : null;
      for (const k in TITULOS_NUM) if (e.matches(TITULOS_NUM[k] + '.' + k)) return k;
      return null;
    }
    function labelAleatorio(pref) {
      const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let id;
      do { id = pref + ':'; for (let i = 0; i < 5; i++) id += a[Math.floor(Math.random() * a.length)]; } while (document.getElementById(id));
      return id;
    }
    const limparLabel = t => (t || '').trim().replace(/\s+/g, '-').replace(/[^\w:.-]/g, '');
    function erroLabel(lab, dono) {
      if (!lab) return 'Dê um label (letras, números e : . - _)';
      const ja = document.getElementById(lab); if (ja && ja !== dono) return 'O label ' + lab + ' já está em uso';
      return '';
    }
    // troca o label e leva junto os links que apontavam para o antigo
    function trocarLabel(el, novo) {
      const velho = el.id; if (velho === novo) return;
      if (velho) document.querySelectorAll('.apostila a[href="#' + CSS.escape(velho) + '"]').forEach(a => a.setAttribute('href', '#' + novo));
      el.id = novo;
    }
    const textoLimpo = el => { const c = el.cloneNode(true); c.querySelectorAll('.ancora-camada, .amb-titulo').forEach(x => x.remove()); c.querySelectorAll('mjx-container').forEach(m => m.replaceWith(m.dataset.tex || '')); return c.textContent.replace(/[\s​]+/g, ' ').trim(); };
    function textoRef(el) {
      const t = tipoNum(el), n = el && el.dataset.num; if (!t || !n) return '??';
      return t === 'equacao' ? '(' + n + ')' : NUM[t].nome + ' ' + n;
    }
    function naoEditavel(e) { if (e.getAttribute('contenteditable') !== 'false') e.setAttribute('contenteditable', 'false'); }
    // título do ambiente: no começo do primeiro bloco de texto, gerado aqui (Teorema 1 (Nome):)
    function tituloAmbiente(a) {
      let t = a.querySelector('.amb-titulo');
      if (!t) {
        const alvo = a.querySelector('p, h2, h3, h4, li') || a.firstElementChild; if (!alvo) return null;
        t = document.createElement('span'); t.className = 'rotulo amb-titulo';
        let pos = alvo.firstChild; while (pos && pos.nodeType === 1 && pos.matches('.ancora-camada')) pos = pos.nextSibling;
        alvo.insertBefore(t, pos); t.after(' ');
      }
      return t;
    }
    function numerar() {
      const els = [...document.querySelectorAll(SEL_NUM)], temCap = els.some(e => e.matches('h1.capitulo'));
      const cont = {}, vistos = new Set(); let cap = 0, sec = 0, sub = 0;
      for (const e of els) {
        const t = tipoNum(e); if (!t) { if (e.dataset.num) delete e.dataset.num; continue; }
        if (!e.id || vistos.has(e.id)) e.id = labelAleatorio(NUM[t].pref);   // sem label, ou cópia (colar repete o id)
        vistos.add(e.id);
        const pre = temCap ? cap + '.' : '';
        let n;
        if (t === 'capitulo') { cap++; sec = sub = 0; for (const k in cont) cont[k] = 0; n = String(cap); }
        else if (t === 'secao') { sec++; sub = 0; n = pre + sec; }
        else if (t === 'subsecao') { sub++; n = pre + sec + '.' + sub; }
        else { cont[t] = (cont[t] || 0) + 1; n = pre + cont[t]; }
        if (e.dataset.num !== n) e.dataset.num = n;
        if (t === 'figura') {
          naoEditavel(e); const l = e.querySelector(':scope > .legenda'); if (l && l.dataset.num !== n) l.dataset.num = n;
        } else if (t === 'tabela') {
          const c = e.querySelector(':scope > caption'); if (c) { naoEditavel(c); if (c.dataset.num !== n) c.dataset.num = n; }
        } else if (AMBIENTES.includes(t)) {
          const ti = tituloAmbiente(e);
          if (ti) { naoEditavel(ti); const txt = NUM[t].nome + ' ' + n + (e.dataset.nome ? ' (' + e.dataset.nome + ')' : '') + ':'; if (ti.textContent !== txt) ti.textContent = txt; }
        }
      }
      document.querySelectorAll('.apostila a.ref').forEach(a => {
        const alvo = document.getElementById((a.getAttribute('href') || '').slice(1)), t = textoRef(alvo);
        if (a.textContent !== t) a.textContent = t;
        naoEditavel(a);
      });
      document.querySelectorAll('.apostila .video').forEach(naoEditavel);
    }

    // ---------- diálogo de legenda / título / nome + label ----------
    const ROT = { o: null, r: null };
    function abrirRotulo(o) {
      const s = getSelection(); ROT.r = s.rangeCount ? s.getRangeAt(0).cloneRange() : null; ROT.o = o;
      $('pr-titulo').textContent = o.titulo; $('pr-texto-rot').textContent = o.rotTexto;
      $('pr-texto').value = o.texto || ''; $('pr-texto').placeholder = o.dica || ''; $('pr-label').value = o.label;
      $('pr-remover').style.display = o.remover ? '' : 'none'; $('pr-erro').textContent = '';
      ROT.cor = o.cor || ''; mostrarCorRotulo();
      const P = $('painel-rotulo'); P.hidden = false;
      const b = o.perto.getBoundingClientRect();
      let top = b.bottom + 8; if (top + P.offsetHeight > innerHeight - 8) top = Math.max(8, b.top - P.offsetHeight - 8);
      P.style.left = Math.max(8, Math.min(b.left, innerWidth - P.offsetWidth - 8)) + 'px'; P.style.top = top + 'px';
      $('b-rotulo').hidden = true;
      $('pr-texto').focus(); $('pr-texto').select();
    }
    // cor do item: '' = a do estilo; senão uma das cores do texto (classe), como na barra
    function mostrarCorRotulo() { document.querySelectorAll('#pr-cores .pr-cor').forEach(b => b.classList.toggle('ativo', b.dataset.cor === ROT.cor)); }
    document.querySelectorAll('#pr-cores .pr-cor').forEach(b => b.onclick = () => { ROT.cor = b.dataset.cor; mostrarCorRotulo(); });
    const corDe = el => (el && CORES.find(k => el.classList.contains(k))) || '';
    function pintar(el, cor) { CORES.forEach(k => el.classList.remove(k)); if (cor) el.classList.add(cor); if (!el.classList.length) el.removeAttribute('class'); }
    const corPadrao = tipo => { const c = lembrar('strata-cor-' + tipo); return CORES.includes(c) ? c : ''; };
    function fecharRotulo(voltar) {
      $('painel-rotulo').hidden = true; ROT.o = null;
      const r = ROT.r; if (!voltar || !r || !r.startContainer.isConnected) return;
      const sec = noDe(r.startContainer).closest('section.pagina'); if (!sec) return;
      sec.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    function depoisRotulo() { numerar(); contarCamadas(); iconesCamada(); sujo(true); desenharMarcas(); montarSumario(); posImagem(); posBotaoRotulo(); }
    function salvarRotulo() {
      const o = ROT.o; if (!o) return;
      const texto = $('pr-texto').value.trim(), lab = limparLabel($('pr-label').value);
      if (o.obrig && !texto) { $('pr-erro').textContent = o.rotTexto + ': não pode ficar vazio'; return $('pr-texto').focus(); }
      const erro = erroLabel(lab, o.dono); if (erro) { $('pr-erro').textContent = erro; return $('pr-label').focus(); }
      const cor = ROT.cor; if (o.tipo) lembrar('strata-cor-' + o.tipo, cor);
      fecharRotulo(true); depoisDe(() => o.salvar(texto, lab, cor)); depoisRotulo();
    }
    $('pr-salvar').onclick = salvarRotulo;
    $('pr-cancelar').onclick = () => fecharRotulo(true);
    $('pr-remover').onclick = () => { const o = ROT.o; fecharRotulo(true); if (o && o.apagar) { depoisDe(o.apagar); depoisRotulo(); } };
    ['pr-texto', 'pr-label'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvarRotulo(); } else if (e.key === 'Escape') { e.preventDefault(); fecharRotulo(true); } }));
    document.querySelectorAll('#painel-rotulo button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    document.addEventListener('mousedown', e => { const P = $('painel-rotulo'); if (!P.hidden && !P.contains(e.target)) fecharRotulo(false); }, true);

    // ---------- legenda de figura e de tabela ----------
    // A figura é um <span> (pode ficar dentro do parágrafo, ao lado de outra); a largura passa da imagem para ele.
    function figuraDe(im) { return im && im.parentElement && im.parentElement.matches('span.figura') ? im.parentElement : null; }
    function editarLegenda(alvo) {
      const ehFig = alvo.matches('img'), caixa = ehFig ? figuraDe(alvo) : (alvo.querySelector(':scope > caption') ? alvo : null);
      const leg = caixa && caixa.querySelector(ehFig ? ':scope > .legenda' : ':scope > caption');
      abrirRotulo({
        perto: alvo, titulo: ehFig ? 'Legenda da figura' : 'Legenda da tabela', rotTexto: 'Legenda', dica: ehFig ? 'Figura n: ...' : 'Tabela n: ...',
        texto: leg ? leg.textContent : '', label: caixa ? caixa.id : labelAleatorio(ehFig ? 'fig' : 'tab'), dono: caixa, remover: !!caixa,
        cor: leg ? corDe(leg) : COR.atual,   // legenda nova: a cor da barra
        salvar: (texto, lab, cor) => {
          if (ehFig) {
            let f = caixa;
            if (!f) {
              const W = larguraDoPai(alvo), w = alvo.style.width || (Math.min(100, Math.round(alvo.getBoundingClientRect().width / W * 1000) / 10) + '%');
              f = document.createElement('span'); f.className = 'figura'; alvo.replaceWith(f); f.append(alvo);
              alvo.style.removeProperty('width'); if (!alvo.getAttribute('style')) alvo.removeAttribute('style');
              f.style.width = w;
              const l = document.createElement('span'); l.className = 'legenda'; f.append(l);
            }
            const l = f.querySelector(':scope > .legenda'); l.textContent = texto; l.className = 'legenda'; pintar(l, cor); trocarLabel(f, lab);
          } else {
            alvo.classList.add('tabela');
            let c = alvo.querySelector(':scope > caption'); if (!c) { c = document.createElement('caption'); alvo.prepend(c); }
            c.textContent = texto; pintar(c, cor); trocarLabel(alvo, lab);
          }
        },
        apagar: () => {
          if (ehFig) { const w = caixa.style.width; caixa.replaceWith(alvo); if (w) alvo.style.width = w; }
          else { if (leg) leg.remove(); alvo.removeAttribute('id'); delete alvo.dataset.num; }
        }
      });
    }
    $('img-legenda').addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
    $('img-legenda').onclick = () => { const im = ISEL.img; if (im && im.matches('img')) editarLegenda(im); };

    // ---------- título de capítulo/seção e nome de ambiente ----------
    function editarNumerado(el) {
      const t = tipoNum(el); if (!t) return;
      if (TITULOS_NUM[t]) return abrirRotulo({
        perto: el, titulo: NUM[t].nome, rotTexto: 'Título', texto: textoLimpo(el), label: el.id, dono: el, obrig: true, remover: true, tipo: t, cor: corDe(el),
        salvar: (texto, lab, cor) => { if (texto !== textoLimpo(el)) el.textContent = texto; pintar(el, cor); trocarLabel(el, lab); },
        apagar: () => { el.classList.remove(t); delete el.dataset.num; if (!el.classList.length) el.removeAttribute('class'); }
      });
      abrirRotulo({
        perto: el, titulo: NUM[t].nome, rotTexto: 'Nome', dica: 'opcional: ' + NUM[t].nome + ' n (nome)', texto: el.dataset.nome || '', label: el.id, dono: el, remover: true, tipo: t, cor: el.dataset.cor || '',
        salvar: (texto, lab, cor) => { if (texto) el.dataset.nome = texto; else delete el.dataset.nome; if (cor) el.dataset.cor = cor; else delete el.dataset.cor; trocarLabel(el, lab); },
        apagar: () => {
          const ti = el.querySelector('.amb-titulo');
          if (ti) { const nx = ti.nextSibling; if (nx && nx.nodeType === 3) nx.data = nx.data.replace(/^[\s ]+/, ''); ti.remove(); }
          el.replaceWith(...el.childNodes);
        }
      });
    }
    // caixa do ambiente em volta dos blocos selecionados
    function envolverAmbiente(bl, tipo) {
      const sec = bl[0].closest('section.pagina'); if (!sec) return null;
      const pai = bl[0].closest('.duas-colunas') || sec;
      const topo = e => { while (e && e.parentElement !== pai) e = e.parentElement; return e; };
      const tops = bl.filter(e => pai.contains(e)).map(topo).filter(Boolean);
      const ini = tops[0], fim = tops[tops.length - 1]; if (!ini) return null;
      const d = document.createElement('div'); d.className = 'ambiente'; d.dataset.tipo = tipo;
      ini.before(d);
      for (let e = ini; e; ) { const prox = e.nextSibling; if (!(e.nodeType === 1 && e.matches('.rodape, svg.tinta, .tinta-html, .notas-rodape'))) d.append(e); if (e === fim) break; e = prox; }
      return d;
    }
    function inserirNumerado(tipo) {
      const bl = blocosDa(faixaAtual(), BLOCOS).filter(e => !e.closest('.notas-rodape, td, th'));
      if (!bl.length) return avisar('Clique num parágrafo');
      if (TITULOS_NUM[tipo]) {
        const b0 = bl[0], ja = b0.closest('h1.capitulo, h2.secao, h3.subsecao');
        if (ja && tipoNum(ja) === tipo) return editarNumerado(ja);
        if (!b0.matches(TEXTUAIS)) return avisar('Clique num parágrafo de texto');
        return abrirRotulo({
          perto: b0, titulo: NUM[tipo].nome, rotTexto: 'Título', texto: textoLimpo(b0), label: ja ? ja.id : labelAleatorio(NUM[tipo].pref), dono: ja || b0, obrig: true, tipo, cor: corPadrao(tipo),
          salvar: (texto, lab, cor) => {
            if (!b0.isConnected) return;
            if (texto !== textoLimpo(b0)) b0.textContent = texto;
            const n = trocarTag(b0, TITULOS_NUM[tipo]);
            ['capitulo', 'secao', 'subsecao', 'subtitulo', 'sem-recuo'].forEach(k => n.classList.remove(k)); n.classList.add(tipo); pintar(n, cor);
            delete n.dataset.num; trocarLabel(n, lab);
          }
        });
      }
      const caixa = bl[0].closest('.ambiente');
      if (caixa) { if (caixa.dataset.tipo !== tipo) { caixa.dataset.tipo = tipo; depoisRotulo(); } return editarNumerado(caixa); }
      abrirRotulo({
        perto: bl[0], titulo: NUM[tipo].nome, rotTexto: 'Nome', dica: 'opcional: ' + NUM[tipo].nome + ' n (nome)', texto: '', label: labelAleatorio(NUM[tipo].pref), dono: null, tipo, cor: corPadrao(tipo),
        salvar: (texto, lab, cor) => { const d = envolverAmbiente(bl.filter(e => e.isConnected), tipo); if (!d) return; d.id = lab; if (texto) d.dataset.nome = texto; if (cor) d.dataset.cor = cor; }
      });
    }
    document.querySelectorAll('#c-num [data-numerado]').forEach(b => b.onclick = () => inserirNumerado(b.dataset.numerado));
    document.querySelectorAll('#c-num button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    // clicar na legenda ou no título do ambiente abre o diálogo
    document.addEventListener('mousedown', e => {
      if (!document.body.classList.contains('editando') || !e.target.closest) return;
      const l = e.target.closest('.apostila span.figura > .legenda, .apostila table.tabela > caption, .apostila .ambiente .amb-titulo');
      if (!l) return;
      e.preventDefault();
      if (l.matches('.legenda')) { const im = l.parentElement.querySelector(':scope > img'); if (im) editarLegenda(im); }
      else if (l.matches('caption')) editarLegenda(l.parentElement);
      else editarNumerado(l.closest('.ambiente'));
    });
    // botão flutuante: cursor numa tabela, num título numerado ou num ambiente
    function alvoDoBotaoRotulo() {
      if (!document.body.classList.contains('editando') || !$('painel-rotulo').hidden) return null;
      const s = getSelection(); if (!s.rangeCount) return null;
      const n = noDe(s.getRangeAt(0).startContainer); if (!n || !n.closest || !n.closest('section.pagina')) return null;
      return n.closest('.apostila table') || n.closest('.apostila h1.capitulo, .apostila h2.secao, .apostila h3.subsecao') || n.closest('.apostila .ambiente');
    }
    function posBotaoRotulo() {
      const B = $('b-rotulo'), el = alvoDoBotaoRotulo(); B._el = el;
      if (!el) { B.hidden = true; return; }
      const t = el.matches('table') ? 'tabela' : tipoNum(el);
      B.textContent = t === 'tabela' ? 'Legenda' : TITULOS_NUM[t] ? 'Título e label' : 'Nome e label';
      B.title = t === 'tabela' ? 'Legenda e label da tabela (Tabela n: ...)' : TITULOS_NUM[t] ? 'Título e label do(a) ' + NUM[t].nome.toLowerCase() : 'Nome e label do ambiente (' + NUM[t].nome + ' n (nome):)';
      B.hidden = false;
      const b = el.getBoundingClientRect(), topo = $('barra').getBoundingClientRect().bottom;
      if (el.matches('table') && b.right + B.offsetWidth + 10 < innerWidth) { B.style.left = b.right + 6 + 'px'; B.style.top = Math.max(topo + 2, b.top) + 'px'; }   // tabela: ao lado, em cima
      else { B.style.left = Math.max(4, b.right - B.offsetWidth) + 'px'; B.style.top = Math.max(topo + 2, b.top - B.offsetHeight - 3) + 'px'; }
    }
    $('b-rotulo').addEventListener('mousedown', e => e.preventDefault());
    $('b-rotulo').onclick = () => { const el = $('b-rotulo')._el; if (!el || !el.isConnected) return; if (el.matches('table')) editarLegenda(el); else editarNumerado(el); };
    document.addEventListener('selectionchange', () => { cancelAnimationFrame(posBotaoRotulo.q); posBotaoRotulo.q = requestAnimationFrame(posBotaoRotulo); });
    addEventListener('scroll', () => { if (!$('b-rotulo').hidden) posBotaoRotulo(); }, true); addEventListener('resize', () => { if (!$('b-rotulo').hidden) posBotaoRotulo(); });
    // fórmula destacada: numerada = dentro de <span class="eq-num" id="eq:...">
    function numerarFormula(c, lab) {
      const w = c.parentElement && c.parentElement.matches('span.eq-cor') ? c.parentElement : c;
      const en = w.parentElement && w.parentElement.matches('span.eq-num') ? w.parentElement : null;
      if (lab == null) { if (en) en.replaceWith(...en.childNodes); return; }
      if (en) { trocarLabel(en, lab); return; }
      const s = document.createElement('span'); s.className = 'eq-num'; s.id = lab; w.replaceWith(s); s.append(w);
    }
    NUM_OK = true; numerar();
    // Enter numa linha vazia no fim do ambiente: a linha sai da caixa
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.altKey || !document.body.classList.contains('editando')) return;
      const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return;
      const b = noDe(s.getRangeAt(0).startContainer).closest(BLOCOS), caixa = b && b.parentElement && b.parentElement.matches('.ambiente') ? b.parentElement : null;
      if (!caixa || b !== caixa.lastElementChild || b.textContent.replace(/[\s​]/g, '') || b.querySelector('mjx-container, img, .marca')) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      caixa.after(b); if (!caixa.children.length) caixa.remove(); cursorEm(b); lerCursor(); sujo(true); desenharMarcas();
    }, true);
    // ---------- mover o bloco do cursor: Alt+↑ / Alt+↓ ----------
    // O bloco leva junto as notas laterais que vêm antes dele (e as camadas e marcações de dentro dele).
    // Na ponta de uma página passa para a página vizinha; na ponta de uma caixa (colunas, ambiente) sai dela.
    const PULAR = 'svg.tinta, .tinta-html, .rodape, .notas-rodape';
    function unidadeDoCursor() {
      const r = faixaAtual(); if (!r) return null;
      const n = noDe(r.startContainer); if (!n.closest('section.pagina')) return null;
      const li = n.closest('section.pagina li'); if (li) return li;
      let u = n.closest('section.pagina table') || n.closest(BLOCOS) || n;
      while (u.parentElement && !u.parentElement.matches('section.pagina, .duas-colunas, .ambiente')) u = u.parentElement;
      return u.parentElement && !u.matches('section.pagina') ? u : null;
    }
    const ehNota = e => e && e.matches('aside.nota');
    function grupoDe(u) { const g = [u]; for (let a = u.previousElementSibling; ehNota(a); a = a.previousElementSibling) g.unshift(a); return g; }
    function vizinho(u, passo) {   // próximo bloco (não nota, não interface) na direção
      let e = passo < 0 ? grupoDe(u)[0].previousElementSibling : u.nextElementSibling;
      while (e && (e.matches(PULAR) || ehNota(e))) e = passo < 0 ? e.previousElementSibling : e.nextElementSibling;
      return e;
    }
    function moverBloco(passo) {
      const u = unidadeDoCursor(); if (!u) return avisar('Clique num parágrafo');
      const g = grupoDe(u), cont = u.parentElement, v = vizinho(u, passo);
      if (u.matches('li') && !v) return;   // item de lista fica na lista
      // o cursor está dentro do bloco, que se move inteiro: guarda os nós (não os caminhos) e volta para eles
      const sl = getSelection(), r0 = sl.rangeCount ? sl.getRangeAt(0) : null;
      const pontas = r0 ? [r0.startContainer, r0.startOffset, r0.endContainer, r0.endOffset] : null;
      const mover = f => {
        f();
        if (pontas && g.some(e => e.contains(pontas[0]))) { try { const r = document.createRange(); r.setStart(pontas[0], pontas[1]); r.setEnd(pontas[2], pontas[3]); sl.removeAllRanges(); sl.addRange(r); } catch (e) {} }
        lerCursor(); iconesCamada(); sujo(true); desenharMarcas(); montarSumario(); mostrarFormatos();
      };
      mover(() => {
        if (v) { if (passo < 0) grupoDe(v)[0].before(...g); else v.after(...g); return; }
        if (!cont.matches('section.pagina')) { if (passo < 0) cont.before(...g); else cont.after(...g); return; }
        const pags = [...document.querySelectorAll('section.pagina')], k = pags.indexOf(cont), outra = pags[k + passo];
        if (!outra) return;
        if (passo < 0) { const fim = [...outra.children].find(e => e.matches('.notas-rodape, .rodape, svg.tinta, .tinta-html')); if (fim) fim.before(...g); else outra.append(...g); }
        else { const ini = [...outra.children].find(e => !e.matches(PULAR)); if (ini) ini.before(...g); else outra.prepend(...g); }
      });
      u.scrollIntoView({ block: 'nearest' });
    }
    document.addEventListener('keydown', ev => {
      if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
      if (!document.body.classList.contains('editando') || document.body.classList.contains('escolhendo') || DS.rascunho) return;
      if (!(ev.target.closest && ev.target.closest('section.pagina'))) return;
      ev.preventDefault(); moverBloco(ev.key === 'ArrowUp' ? -1 : 1);
    });
    // ---------- vídeo e conteúdo embutido ----------
    // <div class="video"><iframe src="..." allowfullscreen></iframe></div>; largura em % como as imagens
    function urlEmbutido(t) {
      t = (t || '').trim();
      const ifr = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(t); if (ifr) t = ifr[1];
      if (!/^https?:\/\//i.test(t)) { if (/^[\w-]+(\.[\w-]+)+\//.test(t)) t = 'https://' + t; else return null; }
      let u; try { u = new URL(t); } catch (e) { return null; }
      const h = u.hostname.replace(/^www\.|^m\./, '');
      const seg = (u.searchParams.get('t') || u.searchParams.get('start') || '').replace(/s$/, '');
      const ini = /^\d+$/.test(seg) ? '?start=' + seg : '';
      if (h === 'youtu.be') return 'https://www.youtube-nocookie.com/embed/' + u.pathname.slice(1) + ini;
      if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
        const id = u.searchParams.get('v') || (/^\/(embed|shorts|live)\/([\w-]+)/.exec(u.pathname) || [])[2];
        return id ? 'https://www.youtube-nocookie.com/embed/' + id + ini : null;
      }
      if (h === 'vimeo.com') { const id = (/^\/(\d+)/.exec(u.pathname) || [])[1]; return id ? 'https://player.vimeo.com/video/' + id : null; }
      if (h === 'geogebra.org') { const id = (/^\/(?:m|classic|calculator|graphing|geometry|3d|material\/iframe\/id)\/([\w-]+)/.exec(u.pathname) || [])[1]; return id ? 'https://www.geogebra.org/material/iframe/id/' + id : u.href; }
      return u.href;
    }
    const VID = { r: null };
    function abrirVideo() {
      const r = faixaAtual(); if (!r) return avisar('Clique no texto');
      VID.r = r.cloneRange(); $('pv-url').value = ''; $('pv-erro').textContent = '';
      const b = $('c-midia').getBoundingClientRect(), P = $('painel-video');
      P.hidden = false; P.style.left = Math.max(8, Math.min(b.left, innerWidth - P.offsetWidth - 8)) + 'px'; P.style.top = b.bottom + 8 + 'px';
      $('pv-url').focus();
    }
    function fecharVideo(voltar) {
      $('painel-video').hidden = true;
      if (voltar && VID.r && VID.r.startContainer.isConnected) { const sec = noDe(VID.r.startContainer).closest('section.pagina'); if (sec) sec.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(VID.r); }
    }
    // bloco novo no lugar de um parágrafo vazio, ou depois do bloco do cursor
    function inserirBloco(el, r) {
      const n = noDe(r.startContainer), sec = n.closest('section.pagina'); if (!sec) return false;
      let b = n.closest(BLOCOS_L); if (b && b.closest('li')) b = b.closest('ul, ol');
      while (b && b.parentElement !== sec && !b.parentElement.matches('.duas-colunas, .ambiente')) b = b.parentElement;
      const vazio = b && b.matches('p') && !b.textContent.replace(/[\s​]/g, '') && !b.querySelector('mjx-container, img, .marca, sup');
      if (vazio) { if (b.classList.contains('fragment')) el.classList.add('fragment'); b.replaceWith(el); }
      else if (b) b.after(el); else sec.append(el);
      if (!el.nextElementSibling || el.nextElementSibling.matches('.rodape, .notas-rodape')) { const p = document.createElement('p'); p.innerHTML = '<br>'; el.after(p); }
      return true;
    }
    function inserirVideo() {
      const src = urlEmbutido($('pv-url').value); if (!src) { $('pv-erro').textContent = 'Não reconheci esse link. Cole o endereço do vídeo ou o código <iframe> de incorporação.'; return; }
      const r = VID.r; fecharVideo(true); if (!r || !r.startContainer.isConnected) return;
      const d = document.createElement('div'); d.className = 'video'; d.setAttribute('contenteditable', 'false');
      const f = document.createElement('iframe'); f.src = src; f.setAttribute('allowfullscreen', ''); f.setAttribute('loading', 'lazy');
      f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'); f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      d.append(f);
      if (!inserirBloco(d, r)) return;
      const nx = d.nextElementSibling; if (nx) { d.closest('section.pagina').focus({ preventScroll: true }); cursorEm(nx); }
      lerCursor(); sujo(true); iconesCamada(); desenharMarcas();
    }
    $('b-video').onclick = () => $('painel-video').hidden ? abrirVideo() : fecharVideo(true);
    $('pv-ok').onclick = inserirVideo;
    $('pv-cancelar').onclick = () => fecharVideo(true);
    $('pv-url').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inserirVideo(); } else if (e.key === 'Escape') { e.preventDefault(); fecharVideo(true); } });
    document.querySelectorAll('#painel-video button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    document.addEventListener('mousedown', e => { const P = $('painel-video'); if (!P.hidden && !P.contains(e.target) && !e.target.closest('#c-midia')) fecharVideo(false); }, true);

    // ---------- símbolos ----------
    function fecharSimbolos() { $('painel-simbolos').hidden = true; }
    $('b-simbolos').onclick = () => {
      const P = $('painel-simbolos'); if (!P.hidden) return fecharSimbolos();
      if (!faixaAtual()) return avisar('Clique no texto');
      const b = $('c-midia').getBoundingClientRect();
      P.hidden = false; P.style.left = Math.max(8, Math.min(b.left, innerWidth - P.offsetWidth - 8)) + 'px'; P.style.top = b.bottom + 8 + 'px';
    };
    $('ps-fechar').onclick = fecharSimbolos;
    // uma seção por vez; a última escolhida volta na próxima abertura
    function mostrarSecao(k) { document.querySelectorAll('#painel-simbolos .ps-grupo').forEach(gr => gr.hidden = gr.dataset.secao !== String(k)); $('ps-secao').value = String(k); }
    $('ps-secao').onchange = () => { mostrarSecao($('ps-secao').value); lembrar('strata-simbolos', $('ps-secao').value); };
    mostrarSecao(document.querySelector('#painel-simbolos .ps-grupo[data-secao="' + lembrar('strata-simbolos') + '"]') ? lembrar('strata-simbolos') : 0);
    document.querySelectorAll('#painel-simbolos button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    document.querySelectorAll('#painel-simbolos [data-s]').forEach(b => b.onclick = () => {
      const s = getSelection(); if (!s.rangeCount || !noDe(s.getRangeAt(0).startContainer).closest('section.pagina')) { if (ED.range && ED.range.startContainer.isConnected) { s.removeAllRanges(); s.addRange(ED.range); } else return avisar('Clique no texto'); }
      document.execCommand('insertText', false, b.dataset.s); lerCursor();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('painel-simbolos').hidden) fecharSimbolos(); });
    document.addEventListener('mousedown', e => { const P = $('painel-simbolos'); if (!P.hidden && !P.contains(e.target) && !e.target.closest('#c-midia, section.pagina')) fecharSimbolos(); }, true);

    // ---------- links internos: títulos, ambientes e equações numeradas ----------
    const slug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
    function idPara(el, pref, nome) {
      if (el.id) return el.id;
      let base = pref + '-' + slug(nome), id = base, k = 2; while (document.getElementById(id)) id = base + '-' + k++;
      el.id = id; return id;
    }
    function destinosInternos() {
      numerar();
      const l = [];
      document.querySelectorAll(SEL_NUM + ', .apostila section.pagina h1, .apostila section.pagina h2, .apostila section.pagina h3, .apostila section.pagina h4').forEach(e => {
        const t = tipoNum(e);
        if (t) {
          let extra = '';
          if (t === 'figura' || t === 'tabela') { const c = e.querySelector(':scope > .legenda, :scope > caption'); extra = c && c.textContent.trim() ? ': ' + c.textContent.trim() : ''; }
          else if (TITULOS_NUM[t]) extra = ' ' + textoLimpo(e);
          else if (t !== 'equacao') extra = e.dataset.nome ? ' (' + e.dataset.nome + ')' : '';
          l.push({ el: e, ref: true, rot: (t === 'equacao' ? 'Equação ' : '') + textoRef(e) + extra.slice(0, 60) });
        } else { const x = textoLimpo(e); if (x) l.push({ el: e, pref: 'sec', nome: x, rot: '§ ' + x.slice(0, 60) }); }
      });
      return l;
    }
    const DESTINOS = { lista: [] };
    function preencherDestinos() {
      const sel = $('pl-destino'); DESTINOS.lista = destinosInternos();
      sel.innerHTML = '<option value="">(um ponto deste documento)</option>' + DESTINOS.lista.map((d, i) => '<option value="' + i + '"></option>').join('');
      DESTINOS.lista.forEach((d, i) => { sel.options[i + 1].textContent = d.rot; });
      const atual = ($('pl-url').value || '').startsWith('#') ? $('pl-url').value.slice(1) : '';
      if (atual) { const k = DESTINOS.lista.findIndex(d => d.el.id === atual); if (k >= 0) sel.value = String(k); }
    }
    $('pl-destino').onchange = () => {
      const d = DESTINOS.lista[+$('pl-destino').value]; if (!d) return;
      $('pl-url').value = '#' + (d.ref ? d.el.id : idPara(d.el, d.pref, d.nome)); DESTINOS.rot = d.ref ? textoRef(d.el) : d.rot.replace(/^§ /, ''); DESTINOS.ref = !!d.ref;
    };
    $('pl-url').oninput = () => { DESTINOS.ref = false; DESTINOS.rot = ''; $('pl-destino').value = '';
    };

    // ---------- exportar PDF: impressão com páginas do tamanho das da tela ----------
    function exportarPDF() {
      const modo = modoAtual(), escuro = document.documentElement.classList.contains('strata-escuro');
      if (modo !== 'leitura') mudarModo('leitura');
      document.documentElement.classList.remove('strata-escuro'); desenharMarcas();
      const voltar = () => {
        removeEventListener('afterprint', voltar);
        if (escuro) document.documentElement.classList.add('strata-escuro');
        if (modo !== 'leitura') mudarModo(modo); else desenharMarcas();
      };
      addEventListener('afterprint', voltar);
      setTimeout(() => { window.print(); }, 60);
    }
    $('mi-pdf').onclick = exportarPDF;
    // ---------- rascunho automático ----------
    // Com alterações não salvas, uma cópia do documento vai para o navegador (localStorage) a cada 20 s
    // e ao fechar a aba. Ao abrir de novo o mesmo arquivo, o Strata oferece recuperar. Salvar apaga a cópia.
    const RASC = { chave: 'strata-rascunho:' + location.pathname, ultimo: '', avisado: false };
    const lerRascunho = () => { try { return JSON.parse(localStorage.getItem(RASC.chave) || 'null'); } catch (e) { return null; } };
    function apagarRascunho() { RASC.ultimo = ''; try { localStorage.removeItem(RASC.chave); } catch (e) {} }
    function guardarRascunho() {
      if (!ED.sujo || DS.rascunho || document.body.classList.contains('escolhendo')) return;
      let html; try { html = gerarHTML(); } catch (e) { return; }
      if (html === RASC.ultimo) return;
      try { localStorage.setItem(RASC.chave, JSON.stringify({ t: Date.now(), html })); RASC.ultimo = html; }
      catch (e) { if (!RASC.avisado) { RASC.avisado = true; avisar('Rascunho automático: sem espaço no navegador'); } }
    }
    setInterval(guardarRascunho, 20000);
    addEventListener('pagehide', guardarRascunho);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarRascunho(); });
    const conteudoDe = html => { const d = new DOMParser().parseFromString(html, 'text/html'); const m = d.querySelector('main.apostila'); return { d, m, txt: m ? m.innerHTML.replace(/\s+/g, ' ') : '' }; };
    function oferecerRascunho() {
      const r = lerRascunho(); if (!r || !r.html) return;
      if (conteudoDe(r.html).txt === conteudoDe(gerarHTML()).txt) { apagarRascunho(); return; }   // igual ao arquivo: nada a recuperar
      const q = new Date(r.t);
      $('ar-texto').textContent = 'Há alterações não salvas deste documento, de ' + q.toLocaleDateString() + ' às ' + q.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.';
      $('aviso-rascunho').hidden = false;
    }
    $('ar-descartar').onclick = () => { apagarRascunho(); $('aviso-rascunho').hidden = true; };
    $('ar-baixar').onclick = () => { const r = lerRascunho(); if (r) baixar(r.html, 'rascunho_' + ((decodeURIComponent(location.pathname.split('/').pop() || '') || 'apostila.html'))); };
    $('ar-recuperar').onclick = async () => {
      const r = lerRascunho(); $('aviso-rascunho').hidden = true; if (!r) return;
      const { d, m } = conteudoDe(r.html); if (!m) return avisar('Rascunho ilegível');
      const modo = modoAtual(); if (modo !== 'leitura') mudarModo('leitura');
      const mac = d.querySelector('script[type="text/x-tex-macros"]');
      if (mac && mac.textContent.trim()) {   // macros do rascunho
        let b = blocoMacros(); if (!b) { b = document.createElement('script'); b.type = 'text/x-tex-macros'; document.head.append(b); }
        if (b.textContent !== mac.textContent) { b.textContent = mac.textContent; try { await MathJax.tex2svgPromise(mac.textContent, { display: false }); } catch (e) {} }
      }
      const main = document.querySelector('main.apostila');
      try { MathJax.typesetClear([main]); } catch (e) {}
      main.replaceChildren(...[...m.childNodes].map(n => document.importNode(n, true)));
      await MathJax.typesetPromise([main]); guardarTex();
      HIST.pilha = []; HIST.refazer = []; HIST.atual = null; HIST.ultimo = null;
      contarCamadas(); montarSumario(); desenharMarcas();
      if (modo === 'edicao') mudarModo('edicao');
      sujo(true); avisar('Rascunho recuperado (salve para gravar no arquivo)');
      // conteúdo trocado: o foco e a seleção antigos apontavam para nós que saíram; põe o cursor de novo
      getSelection().removeAllRanges(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (modo === 'edicao') requestAnimationFrame(() => { const b = document.querySelector('.apostila section.pagina p, .apostila section.pagina h1'); if (!b) return; b.closest('section').focus({ preventScroll: true }); cursorEm(b); lerCursor(); });
    };
    document.querySelectorAll('#aviso-rascunho button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    // ---------- macros LaTeX do documento (menu ☰) ----------
    // ficam num <script type="text/x-tex-macros"> do <head>, que vai para o arquivo salvo
    const blocoMacros = () => document.querySelector('script[type="text/x-tex-macros"]');
    function abrirMacros() {
      $('pmc-tex').value = '';
      $('pmc-erro').textContent = '';
      $('painel-macros').hidden = false; $('pmc-tex').focus();
    }
    const fecharMacros = () => { $('painel-macros').hidden = true; };
    async function aplicarMacros() {
      const t = $('pmc-tex').value.trim();
      if (t) {   // define (e confere) antes de gravar
        let n; try { n = await MathJax.tex2svgPromise(t, { display: false }); } catch (e) { $('pmc-erro').textContent = 'Erro: ' + e.message; return; }
        const er = n && n.querySelector('[data-mjx-error]');
        if (er) { $('pmc-erro').textContent = 'Erro: ' + er.getAttribute('data-mjx-error'); return; }
      }
      if (!t) { fecharMacros(); return; }
      let b = blocoMacros();
      {
        if (!b) {
          b = document.createElement('script'); b.type = 'text/x-tex-macros';
          const s = document.querySelector('head script[src*="strata.js"]');
          if (s) s.after(b); else document.head.append(b);
          b.before(document.createTextNode('\n'));
        }
        const ant = b.textContent.replace(/^\n+|\s+$/g, '');   // só acrescenta: as macros que já estavam continuam
        b.textContent = '\n' + (ant ? ant + '\n' : '') + t + '\n';
      }
      fecharMacros();
      // fórmulas desenhadas de novo com as macros novas
      for (const c of [...document.querySelectorAll('.apostila mjx-container[data-tex]')]) {
        try {
          const n = await renderTex(c.dataset.tex, c.dataset.display === '1');
          if (c.classList.contains('eq-sel')) n.classList.add('eq-sel');
          c.replaceWith(n);
        } catch (e) {}
      }
      sujo(true); montarSumario(); desenharMarcas();
      avisar('Macros aplicadas');
    }
    $('mi-macros').onclick = abrirMacros;
    // preferência de quem edita: cada Enter no texto começa uma camada nova
    const marcarEnterCamada = () => $('mi-enter-camada').setAttribute('aria-checked', String(ED.enterCamada));
    try { ED.enterCamada = localStorage.getItem('strata-enter-camada') === '1'; } catch (e) { ED.enterCamada = false; }
    marcarEnterCamada();
    $('mi-enter-camada').onclick = () => {
      ED.enterCamada = !ED.enterCamada; marcarEnterCamada();
      try { localStorage.setItem('strata-enter-camada', ED.enterCamada ? '1' : '0'); } catch (e) {}
      avisar(ED.enterCamada ? 'Enter cria camada: ligado' : 'Enter cria camada: desligado');
    };
    $('pmc-cancelar').onclick = fecharMacros;
    $('pmc-ok').onclick = aplicarMacros;
    $('pmc-tex').addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); fecharMacros(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); aplicarMacros(); }
    });
    const fecharMenu = () => { $('menu-strata').hidden = true; $('b-menu').setAttribute('aria-expanded', 'false'); };
    $('b-menu').onclick = e => { e.stopPropagation(); const abrir = $('menu-strata').hidden; $('menu-strata').hidden = !abrir; $('b-menu').setAttribute('aria-expanded', String(abrir)); };
    document.addEventListener('click', e => { if (!e.target.closest('.menu-strata')) fecharMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMenu(); });
    $('menu-strata').addEventListener('click', fecharMenu);
    ['b-tema', 'b-menu'].forEach(id => $(id).addEventListener('mousedown', e => e.preventDefault()));

    if (MODO_AULA) mudarModo('aula', true);
    else if (new URLSearchParams(location.search).has('editar') || new URLSearchParams(location.search).has('novo')) mudarModo('edicao', true);
    else mudarModo('leitura', true);

    mathjaxCarregado.then(() => MathJax.startup.promise).then(() => MathJax.typesetPromise()).then(guardarTex).then(montarSumario).then(() => desenharMarcas()).then(() => setTimeout(oferecerRascunho, 300));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
