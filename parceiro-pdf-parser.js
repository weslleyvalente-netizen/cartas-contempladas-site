const LIMITE_CREDITO_MOTO = 34000;
const REGEX_LINHA = /^(\d+)\s+(\S+)\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)\s+(\d+)\s+R\$\s*([\d.,]+)\s+(\d+)$/;

function paraNumero(strMoeda) {
  return parseFloat(strMoeda.replace(/\./g, '').replace(',', '.'));
}

function calcularVencimento(dia, dataReferencia) {
  let mes = dataReferencia.getMonth();
  let ano = dataReferencia.getFullYear();
  if (dia < dataReferencia.getDate()) {
    mes += 1;
    if (mes > 11) {
      mes = 0;
      ano += 1;
    }
  }
  const diaStr = String(dia).padStart(2, '0');
  const mesStr = String(mes + 1).padStart(2, '0');
  return `${diaStr}/${mesStr}/${ano}`;
}

function parsearTabelaParceiro(texto, dataReferencia, timestampImportacao) {
  const resultado = [];

  for (const linhaTexto of texto.split('\n')) {
    const m = linhaTexto.trim().match(REGEX_LINHA);
    if (!m) continue;

    const [, numeroPdfStr, administradora, creditoStr, entradaStr, prazoStr, parcelaStr, vctoDiaStr] = m;
    const numeroPdf = parseInt(numeroPdfStr, 10);
    const credito = paraNumero(creditoStr);

    resultado.push({
      numeroPdf,
      codigo: `${numeroPdf}-${timestampImportacao}`,
      administradora,
      credito,
      entrada: paraNumero(entradaStr),
      prazo: parseInt(prazoStr, 10),
      parcela: paraNumero(parcelaStr),
      vencimento: calcularVencimento(parseInt(vctoDiaStr, 10), dataReferencia),
      tipo: credito <= LIMITE_CREDITO_MOTO ? 'moto' : 'carro'
    });
  }

  return resultado;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parsearTabelaParceiro };
}
