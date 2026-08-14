async function extrairTextoPDF(arquivo) {
  const arrayBuffer = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textoCompleto = '';
  for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
    const pagina = await pdf.getPage(numPagina);
    const conteudo = await pagina.getTextContent();
    textoCompleto += reconstruirLinhas(conteudo.items) + '\n';
  }
  return textoCompleto;
}

function reconstruirLinhas(items) {
  const TOLERANCIA_Y = 3;
  const linhas = [];
  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    let linha = linhas.find((l) => Math.abs(l.y - y) <= TOLERANCIA_Y);
    if (!linha) {
      linha = { y, itens: [] };
      linhas.push(linha);
    }
    linha.itens.push({ x, texto: item.str });
  }
  linhas.sort((a, b) => b.y - a.y);
  return linhas
    .map((l) => l.itens.sort((a, b) => a.x - b.x).map((i) => i.texto).join(' '))
    .join('\n');
}
