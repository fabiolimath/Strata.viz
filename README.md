# Strata.viz
Strata: a visual HTML text editor for documents intended to be presented. Build a single self-contained HTML document, which can be read as regular text, but in show mode it reveals itself step by step like a presentation.

Site: https://fabiolimath.github.io/Strata.viz/

O Strata é um editor visual de HTML para textos técnicos que também serão
apresentados: notas, demonstrações, exemplos resolvidos. A ideia vem da sala de
aula, onde uma conta é escrita no quadro linha por linha e, depois, fica inteira
no caderno. Aqui é o mesmo documento: quem lê vê o texto corrido, e quem
apresenta o revela em camadas.

O motor é um `strata.js` e um `strata.css`. O documento é um HTML só com
conteúdo (texto, fórmulas LaTeX e camadas). O mesmo arquivo tem três modos,
trocados pela coluna de ícones à direita da tela (de cima para baixo: leitura,
apresentação, edição), sem recarregar:

- **Leitura** (padrão): páginas A4 em rolagem, tudo visível. O zoom do
  navegador funciona normalmente.
- **Apresentação** (`?aula` no endereço): as camadas aparecem uma a uma, como
  uma explicação no quadro. `→`, Espaço, PageDown avançam; `←`, PageUp voltam
  (funciona com passador de slides).
- **Edição** (`?editar`, ou Ctrl+\\): edita o texto no próprio navegador. O
  disquete (ou Ctrl+S) grava o arquivo.

No canto superior direito ficam o botão de **tema** (o ícone mostra o tema
atual, sol no claro e lua no escuro; na 1ª vez segue o sistema; vale só na tela
de quem lê, o arquivo não muda) e o **menu** ☰, no canto. No modo edição, o
botão **Novo documento** aparece à esquerda do tema. O menu tem, em todos os modos, **Salvar para usar offline**
e o link para o site; na edição, também **Adicionar macros LaTeX** e a opção
**Enter cria camada** (cada Enter no texto começa uma camada nova; preferência
de quem edita, guardada no navegador).

Exemplo: [`exemplos/exemplo3.html`](exemplos/exemplo3.html) (um exemplo
resolvido de EDOs de 2ª ordem: camadas, marcações sobre termos já escritos,
linhas de igualdades e Q.E.D.).

## Um documento

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Título</title>
<link rel="stylesheet" href="https://SITE/strata/strata.css">
<script src="https://SITE/strata/strata.js"></script>
</head>
<body>
<main class="apostila">
<section class="pagina">
  <h1>Título</h1>
  <p class="fragment">Texto com fórmula \(y' = ay\).</p>
  <div class="eq fragment">\[ y = c\,e^{at} \]</div>
  <div class="rodape">1</div>
</section>
</main>
</body>
</html>
```

O `strata.js` põe a interface, carrega o MathJax 3.2.2 e liga o editor. Ao
salvar, sai de novo só o conteúdo: a interface não fica gravada no arquivo, então
uma versão nova do Strata vale para todos os documentos que o carregam.

O jeito mais simples de começar um documento é o botão **Novo documento** (modo
edição, à esquerda do tema): abre uma página em branco com o mesmo editor e
o mesmo `<head>` do documento de onde saiu (inclusive o bloco de macros), que se
salva como `novo_documento.html`.

## Convenções do HTML

- **Páginas**: cada `<section class="pagina">` é uma página A4, com
  `<div class="rodape">n</div>` no fim (o botão Nova página numera sozinho).
- **Fórmulas**: LaTeX entre `\( ... \)` (na linha) ou `\[ ... \]` (destacada).
  Bloco de equação: `<div class="eq">`; com `class="eq passo"`, linha de
  igualdades alinhada à esquerda.
- **Camadas**: `class="fragment"` no parágrafo, equação ou trecho
  (`<span class="fragment">`). Aparecem na ordem do texto. Elementos com o mesmo
  `data-junto="nome"`, em sequência, aparecem juntos.
- **Marcações** sobre termos já escritos:
  - na fórmula, `\mk{nome}{termo}` rotula o termo (não muda a aparência); no
    texto, `<span data-mk="nome">trecho</span>`;
  - a camada que marca é
    `<span class="fragment marca" data-marca="nome1 nome2" data-tipo="destaque" data-cor="amarelo"></span>`,
    no ponto do texto em que a marcação aparece no modo apresentação.
  - Tipos: `destaque`, `risca`, `circula`, `caixa`, `seta`, `liga` (seta do 1º
    termo ao 2º), `check` e `texto` (`data-texto="..."`, fórmulas entre `$...$`).
  - Cores: `amarelo`, `verde`, `laranja`, `azul`, `rosa`, `vermelho` (no
    `texto`: `preto`, `azul`, `laranja`, `vermelho`, `verde`, `roxo`).
- **Cores do texto**: `rotulo` (laranja), `cor-azul`, `cor-vermelho`,
  `cor-verde`, `cor-roxo`. Cor de uma fórmula:
  `<span class="eq-cor cor-verde">\(...\)</span>`.
- **Notas laterais** (vermelhas, como as "*:" do Xournal++):
  `<aside class="nota">*: texto</aside>`, logo antes do parágrafo a que se referem.
- **Duas colunas**: `<div class="duas-colunas">` em volta dos blocos (no editor,
  Alinhamento → Duas colunas). O texto passa da 1ª para a 2ª coluna onde o
  navegador equilibrar; as camadas seguem a ordem do texto.
- **Imagens**: `<img src="..." alt="">` no meio do texto (largura máxima = a da
  página). No editor: botão Imagem (colar, arrastar, escolher arquivo ou link),
  ou colar/arrastar direto no texto. Colada, arrastada ou de arquivo, a imagem vai
  dentro do HTML (`data:`), reduzida se passar de 1600 px e ficar menor assim;
  por link, fica só o endereço. Tamanho: `style="width: 48%"` (% do bloco, ou da
  coluna). No editor, clicar na imagem mostra alças nos cantos para arrastar;
  dois cliques numa alça voltam ao tamanho natural; Delete apaga.
- **Tabelas**: `<table class="tabela">` com `<th>` no cabeçalho e `<td>`; mescladas
  com `rowspan`/`colspan`; alinhamento da célula com `alinha-esq|centro|dir`
  (padrão: centro). No editor: botão Tabela (pergunta linhas e colunas) e o menu ▾
  ao lado (inserir/excluir linha e coluna, mesclar, separar, cabeçalho, excluir
  tabela). Na célula, Enter quebra a linha e Tab/Shift+Tab andam entre as células
  (Tab na última cria uma linha).
- **Outros**: `class="caixa"` (caixa de destaque), `p.subtitulo`,
  `class="sem-recuo"`, `alinha-esq|centro|dir|just`, `recuo-1..4`,
  `<span class="fragment fim-exemplo">◼</span>` (Q.E.D.), `table.tabela`,
  `svg.grafico`.
- **Sumário**: montado sozinho com os `<h1>`, `<h2>` e os `<h3>` que começam
  com "Exemplo".

### Macros LaTeX

Já definidas: `\red`, `\blue`, `\Imp`, `\ee`, `\mt`, `\sen`, `\tg` e `\mk`.
Para outras, use o menu ☰ → **Adicionar macros LaTeX…** (um `\newcommand` por
linha, somados aos do documento; as fórmulas são redesenhadas na hora), ou ponha no `<head>` do documento um
bloco com `\newcommand`, que vale antes da primeira fórmula:

```html
<script type="text/x-tex-macros">
\newcommand{\dd}[1]{\frac{d}{d#1}}
</script>
```

(O antigo `<script type="text/plain" id="fol-mathjax">` também vale.) Também se
pode definir `window.MathJax = { tex: { macros: {...} } }` **antes** do
`strata.js`; o Strata junta com a configuração dele. Um motor que mexe no
MathJax (como o `fol.js` do site, que traz as macros do
[Preambulo](https://github.com/fabiolimath/Preambulo)) vem **depois** do
`strata.js`.

### Para quem escreve outros motores

- Elemento com `data-strata-temp` não é gravado (a interface, o MathJax,
  figuras geradas).
- Elemento com `data-strata-limpar` é gravado vazio (um gráfico desenhado por
  um script do próprio documento). Os antigos `svg[data-fourier-quadrada]` e
  `svg[data-tipo]` também.
- Um `<script>` do documento, no `<body>` depois do `<main>`, roda antes do
  editor e é gravado como está.

## Edição visual (resumo)

- Um clique numa fórmula seleciona; dois cliques abrem o LaTeX com prévia
  (Enter aplica, Ctrl+Enter quebra a linha). Alt+X insere fórmula na linha.
- **Camada** (Alt+C): começa no ponto do cursor. Cada camada tem uma âncora
  laranja; clique e use Camada para juntá-la à anterior, ou arraste-a.
- **Marcar**: clique no ponto do texto em que a marcação deve aparecer, escolha
  o tipo e arraste de termo a termo na fórmula (no texto, selecione o trecho).
- Olho (Ctrl+Q): recolhe as âncoras. Ctrl+Z / Ctrl+Y desfazem e refazem.
- Barra de texto: estilos (Parágrafo, Título 1, Subtítulo, Título 2–4,
  Equação, Pré-formatado, Citação), negrito, itálico, cor, link (Ctrl+K),
  alinhamento, Q.E.D., listas, recuo, localizar e substituir (Ctrl+H).
- Salvar: no Chrome/Edge, na 1ª vez pergunta onde salvar (escolha o próprio
  arquivo para sobrescrever); em outros navegadores, ou dentro de um iframe
  (como num ambiente virtual de aprendizagem), baixa uma cópia.

## Sem internet

- Menu ☰ → **Salvar para usar offline**: baixa o documento aberto num arquivo
  único, com o `strata.js`, o `strata.css` e o MathJax completo
  (`tex-svg-full.js`) dentro (`<style id="strata-css">`,
  `<script id="strata-js">`, `<script id="strata-mathjax">`). Abre sem internet
  e pode ser editado e salvo de novo.
- [`strata-offline.zip`](https://fabiolimath.github.io/Strata.viz/strata-offline.zip)
  (montado pelo workflow do Pages): uma pasta com o `strata.js`, o `strata.css`,
  o `mathjax/tex-svg-full.js` e o exemplo apontando para eles. Documentos novos
  salvos nessa pasta usam esses arquivos. Para usar o MathJax local num
  documento, basta um `<script src=".../tex-svg-full.js">` logo depois do
  `strata.js`: o Strata vê que ele já está na página e não busca o da internet.

## Versões

Cada documento carrega o Strata de um endereço fixo. Num site que use o Strata
(como fabiolimath.github.io), ele pode entrar como submodule fixado num commit
e só muda quando um PR atualiza o submodule.
Funções novas mantêm funcionando os arquivos já salvos; mudanças no HTML
salvo ficam no [CHANGELOG](CHANGELOG.md).

## Publicação deste repositório

`.github/workflows/pages.yml` publica no GitHub Pages, a cada push na `main`, o
site do Strata (pasta `site/`: apresentação para quem usa), `strata.js`,
`strata.css` e os exemplos, em https://fabiolimath.github.io/Strata.viz/
(Settings → Pages → Source: GitHub Actions).
