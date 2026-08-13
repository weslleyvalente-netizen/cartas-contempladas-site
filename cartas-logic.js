function resolverAgio(carta, parceiro, agioPadraoGlobal) {
  if (carta.agio !== null && carta.agio !== undefined) return carta.agio;
  if (parceiro && parceiro.agio_padrao !== null && parceiro.agio_padrao !== undefined) return parceiro.agio_padrao;
  return agioPadraoGlobal;
}

function formatarDataISOParaBR(isoDate) {
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}/${ano}`;
}

const ID_OFFSET_PROPRIAS = 1000000000;

function mesclarCartas({ cartasParceiros, parceiros, cartasProprias, agioPadraoGlobal }) {
  const parceirosPorId = new Map(parceiros.map((p) => [p.id, p]));

  const doParceiros = cartasParceiros
    .filter((c) => {
      const p = parceirosPorId.get(c.parceiro_id);
      return p && p.ativo;
    })
    .map((c) => {
      const parceiro = parceirosPorId.get(c.parceiro_id);
      const agio = resolverAgio(c, parceiro, agioPadraoGlobal);
      const entrada = c.entrada + agio;
      return {
        id: c.id,
        credito: c.credito,
        entrada,
        prazo: c.prazo,
        parcela: c.parcela,
        vencimento: c.vencimento,
        administradora: c.administradora,
        entrada_baixa: c.credito > 0 && entrada / c.credito < 0.3
      };
    });

  const doProprias = cartasProprias.map((c) => {
    const entrada = c.entrada;
    return {
      id: c.id + ID_OFFSET_PROPRIAS,
      credito: c.credito,
      entrada,
      prazo: c.prazo,
      parcela: c.parcela,
      vencimento: formatarDataISOParaBR(c.vencimento),
      administradora: c.administradora,
      entrada_baixa: c.credito > 0 && entrada / c.credito < 0.3
    };
  });

  return [...doParceiros, ...doProprias];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolverAgio, formatarDataISOParaBR, mesclarCartas, ID_OFFSET_PROPRIAS };
}
