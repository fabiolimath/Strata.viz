# Mudanças

## Próxima versão

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
