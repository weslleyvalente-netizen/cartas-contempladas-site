function paraNumero(strMoeda) {
  if (!strMoeda) return null;
  return parseFloat(strMoeda.replace(/\./g, '').replace(',', '.'));
}

function extrairPrimeiro(texto, regex) {
  const m = texto.match(regex);
  return m ? m[1] : null;
}

function extrairSecao(texto, tituloInicio, tituloFim) {
  const i = texto.indexOf(tituloInicio);
  if (i === -1) return '';
  const depois = texto.slice(i + tituloInicio.length);
  if (!tituloFim) return depois;
  const j = depois.indexOf(tituloFim);
  return j === -1 ? depois : depois.slice(0, j);
}

function encontrarValorLinhaLance(secaoTexto, tipo, diluido) {
  const palavra = diluido
    ? `${tipo}\\s*LANCE\\s*DILUIDO`
    : `${tipo}\\s*LANCE(?!\\s*DILUIDO)`;
  const regex = new RegExp(palavra + '[^\\n]*?R\\$\\s*[\\d.,]+\\s*R\\$\\s*([\\d.,]+)', 'i');
  const m = secaoTexto.match(regex);
  return m ? paraNumero(m[1]) : null;
}

function arredondar2(n) {
  return Math.round(n * 100) / 100;
}

function parsearExtrato(texto) {
  const dtContemplacao = extrairPrimeiro(texto, /Dt\.\s*Contempla[cç][aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!dtContemplacao) {
    return { contemplada: false };
  }

  const grupo = extrairPrimeiro(texto, /^Grupo:\s*(\S+)/im);
  const cota = extrairPrimeiro(texto, /Cota:\s*(\S+)/i);
  const vencimento = extrairPrimeiro(texto, /Assembleia Atual:[^\n]*?Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const liquido = paraNumero(extrairPrimeiro(texto, /Liquido\s*[àa]\s*Pagar:\s*R\$\s*([\d.,]+)/i));

  let prazo = parseInt(extrairPrimeiro(texto, /Qtde Total:\s*([\d.,]+)\s*Qtde Furo/i), 10);
  let parcela = paraNumero(extrairPrimeiro(texto, /Valor Contrib\.\s*Mensal:\s*R\$\s*([\d.,]+)/i));

  const temLance = /Tipo Contempl\.:\s*Lance/i.test(texto);

  const secaoContaCorrente = extrairSecao(texto, 'Conta Corrente', 'Pendência');
  const secaoPendencia = extrairSecao(texto, 'Pendência', 'Valores / Percentuais Pagos');

  const totaisContaCorrenteVlPago = paraNumero(
    extrairPrimeiro(secaoContaCorrente, /\bTOTAIS\s+R\$\s*[\d.,]+\s+R\$\s*([\d.,]+)/i)
  );

  let statusLance = 'sem_lance';
  let credito = liquido;
  let custoDaCarta = totaisContaCorrenteVlPago;
  let avisoLance = null;

  if (temLance) {
    const diluidoPago = encontrarValorLinhaLance(secaoContaCorrente, 'RECBTO', true) !== null;
    const naoDiluidoPago = encontrarValorLinhaLance(secaoContaCorrente, 'RECBTO', false) !== null;

    const recbtoDiluidoPendente = encontrarValorLinhaLance(secaoPendencia, 'RECBTO', true);
    const debitoDiluidoPendente = encontrarValorLinhaLance(secaoPendencia, 'DEBITO', true);
    const recbtoNaoDiluidoPendente = encontrarValorLinhaLance(secaoPendencia, 'RECBTO', false);
    const debitoNaoDiluidoPendente = encontrarValorLinhaLance(secaoPendencia, 'DEBITO', false);

    if (diluidoPago || naoDiluidoPago) {
      statusLance = 'pago';
      avisoLance = '✅ Lance já pago, nenhum ajuste necessário.';
    } else if (debitoDiluidoPendente !== null) {
      statusLance = 'diluido_pendente';
      const recbto = recbtoDiluidoPendente || 0;
      credito = arredondar2(liquido - debitoDiluidoPendente);
      parcela = arredondar2(parcela - (recbto + debitoDiluidoPendente) / prazo);
      custoDaCarta = arredondar2((custoDaCarta || 0) + recbto);
      avisoLance = '⚠️ Lance diluído pendente, valores já ajustados.';
    } else if (debitoNaoDiluidoPendente !== null) {
      statusLance = 'nao_diluido_pendente';
      const recbto = recbtoNaoDiluidoPendente || 0;
      credito = arredondar2(liquido - debitoNaoDiluidoPendente);
      prazo = Math.round(prazo - debitoNaoDiluidoPendente / parcela);
      custoDaCarta = arredondar2((custoDaCarta || 0) + recbto);
      avisoLance = '⚠️ Lance à vista pendente, valores já ajustados.';
    } else {
      statusLance = 'indeterminado';
      avisoLance = '⚠️ Lance detectado mas não identificado nas tabelas — confira os valores manualmente.';
    }
  }

  if (!Number.isFinite(prazo) || !Number.isFinite(parcela)) {
    prazo = Number.isFinite(prazo) ? prazo : null;
    parcela = Number.isFinite(parcela) ? parcela : null;
    statusLance = 'indeterminado';
    avisoLance = '⚠️ Não foi possível ler prazo/parcela do extrato — preencha à mão e confira os demais valores.';
  }

  return {
    contemplada: true,
    grupo,
    cota,
    vencimento,
    administradora: 'YAMAHA',
    credito,
    prazo,
    parcela,
    custoDaCarta,
    statusLance,
    avisoLance
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parsearExtrato };
}
