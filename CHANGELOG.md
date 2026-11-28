# Mudanças

## Próxima versão

- Caixa nova (Definição, Teorema, ...): o cursor fica dentro dela, depois do título, para
  começar a escrever. O título é seguido de espaço fixo (não some ao digitar).
- Cursor solto entre dois blocos da página: o que se digita vai para um parágrafo novo ali.
- Tabela nova no fim da página não cria mais um parágrafo vazio depois dela (o ponto depois
  da tabela já serve para continuar).
- Clicar abaixo do último bloco põe o cursor no fim dele (ou no ponto depois da tabela ou
  caixa), em vez de criar um parágrafo novo. Numa página vazia, cria o parágrafo.
- Página que fica sem conteúdo (apagando tudo, ou Backspace/Delete numa página vazia) é
  removida, se não for a única; o cursor vai para a página vizinha.
- Números das páginas sempre de 1 em diante (o Exemplo 3 começava em 8).
- Botão Nova página virou um combo: Nova página (depois da atual), Nova página antes e
  Duplicar página (a cópia vem logo depois; marcações, labels e notas da cópia ganham nomes
  novos, para não se misturarem com as do original).
- Caixa vazia: seta para a esquerda a partir do ponto depois dela para depois do título
  (antes o cursor ia para dentro do título e sumia).
- Caixas de ambiente (definição, teorema, exemplo, observação) com ponto de inserção
  antes e depois, como a tabela e a equação destacada: o cursor para logo fora da borda
  (pelas setas ou clicando na margem ao lado da caixa), e digitar ou dar Enter ali cria
  um parágrafo antes ou depois dela. Esses pontos também recebem âncoras de camada,
  marcação e desenho. Na edição, a caixa fica numa linha própria (div.linha-objeto);
  remover a caixa desfaz a linha.
- Backspace no ponto depois (ou Delete no ponto antes) de uma tabela, caixa, vídeo ou
  imagem apaga o objeto inteiro, como na equação destacada; a linha dele vira um parágrafo
  vazio (Ctrl+Z desfaz). Seta a partir do ponto antes da caixa entra no texto depois do
  título. Na edição, a tabela fica com os pontos encostados nela (antes ficavam nas
  bordas da página).
- Setas passam de uma página para a outra: no fim da página (depois da última caixa,
  tabela ou parágrafo), seta para a direita ou para baixo vai para o começo da página
  seguinte; no começo, seta para a esquerda ou para cima volta para o fim da anterior.
- Barra do modo edição reorganizada em grupos: estilo, numerados, formatação e cor |
  alinhamento e listas | recuos, nova página e localizar | link, mídia, tabela,
  desenho, marcação e equações | olho e camada. O botão Camada tem o ícone na cor da âncora
  de camada (laranja), e à direita dele vem "Strata.viz", com link para o site.
- Links internos: a lista "Ou ir para" tem só os elementos numerados; títulos comuns
  saíram (links antigos para eles continuam funcionando).
- Link: no modo edição, clicar num link abre o diálogo para editá-lo. Link interno:
  o campo mostra o texto como aparece no corpo (Teorema 1), não o destino (#teo:...).
- Tema escuro: a cor preta das fórmulas aparece branca nas opções e na prévia do
  editor de equação (as cores seguem o tema).
- Ícones dos estilos de parágrafo e dos numerados na última cor usada em cada um
  (estilo: a cor de texto aplicada num bloco daquele estilo; numerado: a cor do
  diálogo); sem cor usada, a cor padrão. Seguem o tema escuro.
- Tema escuro: barra de tabela com os botões de posição e o destaque de
  Selecionar linha/coluna legíveis.
- Legendas de figura e tabela editadas em linha, como o resto do texto (a cor pela
  barra); sem diálogo. O label fica interno (some dos diálogos e do editor de
  fórmula). O botão Legenda virou um ícone de adicionar, que some quando o objeto já
  tem legenda; um × no canto da legenda a exclui. O diálogo de inserir tabela ganhou
  a opção Legenda.
- Tabela: as funções do antigo combo ficam numa barra que aparece abaixo da barra
  superior enquanto o cursor estiver numa tabela; o botão de tabela só insere.
  Só ícones (o nome aparece ao pairar). Sem opção de cabeçalho: ele só mudava a cor,
  que agora sai pelo botão Cor do texto (tabelas antigas com `th` continuam iguais).
- Ambientes: o cursor não fica mais antes do título (Teorema 1:), nem ao inserir.
- Cor do texto: com só parte de um trecho colorido selecionada, muda a cor só da
  seleção (antes mudava o trecho todo, às vezes a linha inteira).
- Títulos 3 a 6, texto de caixa e comentários de equação seguem a cor base (preto),
  não mais azul. Exemplo 3 sem os trechos azuis que sobraram.
- Botões Marcar e Desenhar: mostram a última ferramenta usada, na cor usada, com
  um emblema no canto (marcador na marcação, pena no desenho). Desenhar virou
  combo: o ▾ escolhe a ferramenta e já abre o desenho.
- Desenho: ao pairar, cada traço ganha a sua moldura (antes, um retângulo só
  envolvia todos); botão "Apagar desenhos".
- Cor base do texto: preto (branco no tema escuro), em vez de azul. Texto azul
  precisa de cor explícita (`cor-azul`).
- Pontos antes e depois de tabelas, vídeos e imagens (sozinhas no parágrafo), para
  camada, marcação e desenho, como na equação destacada; as âncoras ficam coladas ao
  objeto sem tirá-lo do lugar. Tabela e vídeo ficam numa linha própria
  (`div.linha-objeto`); a camada no ponto de antes é a da linha inteira. Texto ou
  Enter nesses pontos vão para um parágrafo novo; Backspace/Delete não juntam
  parágrafos à linha. Tabelas e vídeos antigos (e os que eram camada) são
  embrulhados ao entrar na edição. A imagem conta como um caractere só para as
  setas e o Backspace/Delete.
- Tabela: → na última célula e ← na primeira levam o cursor para o bloco
  vizinho (antes ele ficava solto na página, fora de qualquer parágrafo, e o
  texto digitado ali saía sem recuo e na cor da página); → e ← a partir do
  bloco vizinho entram na tabela.
- Tema escuro: as ferramentas, cores e espessuras escolhidas no desenho
  voltam a aparecer destacadas; a cor escolhida do cabeçalho da tabela e da
  legenda ganha um anel laranja.
- Menu de equações: "Equação em linha" e "Equação destacada".
- Cursor visível com o QuillBot ativo: a extensão deixava o cursor nativo
  transparente na página editável. Ao salvar, também saem os atributos
  `data-lpop-*` que ela deixa.
- Tabela: posição na página (esquerda, centro, direita) no menu da tabela
  (classes `tab-esq`/`tab-dir`); o botão marca a posição atual.
- Duas colunas também funcionam com o cursor numa tabela, ou com uma seleção
  que inclui tabelas (a tabela vai inteira).
- Colar uma imagem copiada do próprio documento mantém a largura dela.
- Enter no fim de uma camada em linha não cria mais uma linha com duas camadas:
  a linha nova entra junto com a camada do cursor.
- Ao salvar, sai o `<br>` que o navegador deixa no fim de blocos com texto;
  exemplo regravado pela versão atual.
- Tabela: setas e Delete/Backspace tratam a célula como bloco (antes podiam
  pular para o parágrafo seguinte); a âncora de uma tabela-camada não deixa
  mais texto solto dentro da tabela.
- Desenho: a barra fica opaca (só os botões apagados); enquanto a ferramenta
  está ativa, nada da página reage ao mouse; ícone novo (pena de caneta).
- Símbolos: uma seção por vez, escolhida num menu (a última volta na próxima vez).
- Rascunho: a chave não depende mais de ?editar/?aula na URL; ao recuperar,
  o cursor é recolocado no texto.
- Tabela: seleção em retângulo (arrastar de célula a célula), Selecionar
  linha/coluna no menu, cor do texto aplicada célula a célula (antes
  desmontava a tabela) e cor do cabeçalho (ao inserir e no menu).
- Só a tabela com legenda é numerada (antes toda tabela contava).
- Listas: o número/marcador segue a cor do começo do texto do item.
- Menu Numerados lembra a última opção (o botão principal a repete).
- Cor nos diálogos dos numerados (capítulo, seção, subseção, ambientes) e das
  legendas; cada tipo lembra a última cor escolhida. Legenda nova começa com a
  cor da barra.
- Texto digitado num bloco vazio entra com a cor da barra.
- Sublinhado de link na cor do próprio texto (antes, sempre laranja).
- Colar limpo: do Word, PDF ou web ficam só parágrafos, títulos, listas,
  tabelas, negrito, itálico, links e fórmulas do próprio Strata; Ctrl+Shift+V
  cola texto puro.
- Rascunho automático no navegador (a cada 20 s e ao fechar), com aviso para
  recuperar, baixar ou descartar ao abrir o mesmo arquivo; salvar apaga o rascunho.
- Alt+↑ / Alt+↓ movem o bloco do cursor (passa de página e sai de caixas).
- Notas de rodapé (menu de alinhamento, abaixo de Nota lateral).
- Numeração automática, como no LaTeX: menu Numerados (capítulo, seção,
  subseção, definição, teorema, exemplo, observação), equação destacada com
  "numerar" no diálogo da fórmula, legenda de figura e de tabela (botão
  Legenda ao selecionar). Cada item tem label sorteado e editável; mudou de
  lugar, o número muda.
- Referências: Ctrl+K → Ou ir para cria um link que mostra o número atual
  (Teorema 1, (3), Figura 2).
- Imagem, vídeo e símbolos num menu só.
- Vídeo e conteúdo embutido (YouTube, Vimeo, GeoGebra, código `<iframe>`),
  com largura ajustável pelas alças.
- Links internos: o diálogo de link lista títulos e itens numerados.
- Painel de símbolos (gregas, operadores, relações, setas, conjuntos, texto).
- Menu ☰ → Exportar PDF: páginas do PDF no tamanho das da tela (proporção A4),
  sempre no tema claro e com todas as camadas.
- O cursor fica no lugar quando um bloco muda de caixa (colunas, ambiente).
- Desenho: nova camada (botão Desenhar, ao lado de Marcar) com caneta livre,
  marca-texto, linha, seta, retângulo, elipse e borracha; 7 cores e 3
  espessuras. Fica em `span.marca[data-tipo="desenho"]` com `data-tracos`, na
  posição do bloco da âncora. Na apresentação, os traços aparecem sendo
  desenhados, um depois do outro.
- Tabelas: botão Tabela (diálogo com linhas, colunas e cabeçalho) e menu ao lado
  para inserir linha acima/abaixo, coluna à esquerda/direita, excluir linha ou
  coluna, mesclar e separar células, ligar/desligar o cabeçalho e excluir a
  tabela. Os botões de alinhamento alinham as células escolhidas. Enter na célula
  quebra a linha; Tab e Shift+Tab andam entre as células.
- Imagens: botão na barra (ao lado do link) com diálogo para colar, arrastar,
  escolher arquivo ou dar um link. Na edição, colar uma imagem (Ctrl+V) ou
  arrastar um arquivo direto no texto também insere no ponto do cursor. A imagem
  vai dentro do arquivo (`data:`); no tema escuro ganha fundo branco.
- Redimensionar imagem: clicar nela mostra alças nos cantos; a largura fica em %
  do bloco (numa coluna, % da coluna) e encaixa em 25, 33, 50, 67, 75 e 100%.
  Dois cliques na alça voltam ao natural; Delete apaga a imagem selecionada.
- Duas colunas (menu de alinhamento, abaixo de Justificado): `<div class="duas-colunas">`
  em volta dos blocos; clicar de novo dentro dele volta a uma coluna.
- Site do Strata (pasta `site/`), publicado com o exemplo no GitHub Pages.
- Painel de marcação: a dica fala em arrastar de termo a termo (o retângulo
  já não existia).
- Tema escuro: botão de sol e lua ao lado dos modos. Papel, texto, fórmulas,
  marcações e interface se adaptam; a escolha fica no navegador (`localStorage`,
  `strata-tema`) e não vai para o arquivo salvo nem para a impressão.
- Menu ☰ ao lado dos modos, com "Macros LaTeX…" e "Sobre o Strata.viz".
- Menu ☰ → Salvar para usar offline: arquivo único com o Strata e o MathJax
  (`tex-svg-full.js`) dentro. O menu aparece em todos os modos; Adicionar macros
  e Enter cria camada só na edição.
- Pacote `strata-offline.zip` no site (pasta com Strata, MathJax e o exemplo).
- Novo documento: o arquivo salvo aponta para o `strata.js` e o `strata.css` por
  endereço absoluto (antes, partindo do exemplo, ficava `../strata.js` e o
  arquivo salvo em outra pasta abria sem o editor).
- Modos numa coluna flutuante à direita (leitura, apresentação, edição); tema e
  menu ☰ fixos no canto superior direito (☰ no canto), em todos os modos; Novo
  documento à esquerda do tema, só na edição (surge sem mover os outros).
  A opção "Enter cria camada" tem caixa de marcar.
- Diálogo Adicionar macros LaTeX (menu ☰): começa vazio, com link para o
  `fol-MathJax.sty` do Preambulo (arquivo com todas as macros); acrescenta ao `<script type="text/x-tex-macros">` do documento
  (cria se não houver), confere os erros e redesenha as fórmulas.
- Opção "Enter cria camada" (menu ☰, guardada em `localStorage`,
  `strata-enter-camada`): na edição, cada Enter no texto começa uma camada nova.
- Tema: o ícone mostra o tema atual (sol no claro, lua no escuro). Sem escolha
  guardada, segue o sistema. Corrigido: com o sistema em modo escuro, o tema
  claro deixava o papel e o texto escuros (regras `prefers-color-scheme` e
  `data-theme` antigas do CSS, agora tratadas pelo `strata.js`).
- Site e README: o Strata como editor de textos técnicos apresentáveis (a sala
  de aula fica como analogia); animação das camadas e seção das macros LaTeX.

## 0.1.0 (2026-11-22)

- Primeira versão separada das aulas: o editor da aula 3.1 (EDOs de 2ª ordem,
  Exemplo 3) virou `strata.js` + `strata.css`.
- A interface (ícones dos modos, barra, painéis) é criada pelo `strata.js` e
  não é mais gravada no arquivo. Os arquivos antigos, com o editor embutido,
  continuam funcionando sozinhos. Para passar um deles ao Strata, troque o
  `<head>` e apague os `<script>` do editor; se sobrar a interface antiga
  (`#barra`, `#modos`...), o Strata a troca pela atual.
- O `strata.js` configura e carrega o MathJax 3.2.2; a página não precisa mais
  do `window.MathJax = {...}` nem do `<script>` do MathJax.
- Macros da página: `<script type="text/x-tex-macros">` (o antigo
  `<script type="text/plain" id="fol-mathjax">` continua valendo).
- `data-strata-temp` (não gravar) e `data-strata-limpar` (gravar vazio) para
  outros motores e para gráficos desenhados por script.
