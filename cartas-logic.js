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

  const doProprias = cartasProprias
    .filter((c) => !c.reservada_por && !c.vendida_em)
    .map((c) => {
      const entrada = c.entrada;
      return {
        id: c.id + ID_OFFSET_PROPRIAS,
        numero: c.numero_sequencial,
        origem: 'propria',
        credito: c.credito,
        entrada,
        prazo: c.prazo,
        parcela: c.parcela,
        vencimento: parseInt(c.vencimento.split('-')[2], 10),
        administradora: c.administradora,
        entrada_baixa: c.credito > 0 && entrada / c.credito < 0.3
      };
    });

  const doParceiros = cartasParceiros
    .filter((c) => {
      const p = parceirosPorId.get(c.parceiro_id);
      return p && p.ativo && !c.reservada_por && !c.vendida_em;
    })
    .map((c) => {
      const parceiro = parceirosPorId.get(c.parceiro_id);
      const agio = resolverAgio(c, parceiro, agioPadraoGlobal);
      const entrada = c.entrada + agio;
      return {
        id: c.id,
        numero: c.numero_sequencial,
        origem: 'parceiro',
        credito: c.credito,
        entrada,
        prazo: c.prazo,
        parcela: c.parcela,
        vencimento: parseInt(c.vencimento, 10),
        administradora: c.administradora,
        entrada_baixa: c.credito > 0 && entrada / c.credito < 0.3
      };
    });

  return [...doProprias, ...doParceiros];
}

function mesclarVendidas({ cartasProprias, cartasParceiros, parceiros }) {
  const parceirosPorId = new Map(parceiros.map((p) => [p.id, p]));

  const doProprias = cartasProprias
    .filter((c) => c.vendida_em)
    .map((c) => ({
      numero: c.numero_sequencial,
      dbId: c.id,
      tabela: 'cartas_proprias',
      origem: 'propria',
      administradora: c.administradora,
      identificacao: `${c.grupo || ''}${c.grupo && c.cota ? ' / ' : ''}${c.cota || ''}`,
      tipo: c.tipo,
      credito: c.credito,
      entrada: c.entrada,
      prazo: c.prazo,
      parcela: c.parcela,
      vencimento: formatarDataISOParaBR(c.vencimento),
      compradoPor: c.reservada_por,
      vendidaEm: c.vendida_em
    }));

  const doParceiros = cartasParceiros
    .filter((c) => c.vendida_em)
    .map((c) => {
      const parceiro = parceirosPorId.get(c.parceiro_id);
      return {
        numero: c.numero_sequencial,
        dbId: c.id,
        tabela: 'cartas_parceiros',
        origem: parceiro ? parceiro.nome : 'Parceiro',
        administradora: c.administradora,
        identificacao: c.codigo,
        tipo: c.tipo,
        credito: c.credito,
        entrada: c.entrada,
        prazo: c.prazo,
        parcela: c.parcela,
        vencimento: c.vencimento,
        compradoPor: c.reservada_por,
        vendidaEm: c.vendida_em
      };
    });

  return [...doProprias, ...doParceiros].sort((a, b) => new Date(b.vendidaEm) - new Date(a.vendidaEm));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolverAgio, formatarDataISOParaBR, mesclarCartas, mesclarVendidas, ID_OFFSET_PROPRIAS };
}
