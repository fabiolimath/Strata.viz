# Mudanças

## Próxima versão

- Site do Strata (pasta `site/`), publicado com o exemplo no GitHub Pages.
- Painel de marcação: a dica fala em arrastar de termo a termo (o retângulo
  já não existia).
- Tema escuro: botão de sol e lua ao lado dos modos. Papel, texto, fórmulas,
  marcações e interface se adaptam; a escolha fica no navegador (`localStorage`,
  `strata-tema`) e não vai para o arquivo salvo nem para a impressão.
- Menu ☰ ao lado dos modos, por enquanto com "Sobre o Strata.viz".
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
