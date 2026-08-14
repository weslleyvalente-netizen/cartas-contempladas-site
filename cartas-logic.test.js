const { resolverAgio, formatarDataISOParaBR, mesclarCartas, mesclarVendidas, ID_OFFSET_PROPRIAS } = require('./cartas-logic.js');

describe('resolverAgio', () => {
  it('usa o ágio da própria carta quando definido', () => {
    const carta = { agio: 300 };
    const parceiro = { agio_padrao: 100 };
    expect(resolverAgio(carta, parceiro, 50)).toBe(300);
  });

  it('usa o ágio padrão do parceiro quando a carta não tem override', () => {
    const carta = { agio: null };
    const parceiro = { agio_padrao: 100 };
    expect(resolverAgio(carta, parceiro, 50)).toBe(100);
  });

  it('usa o ágio global quando nem a carta nem o parceiro têm valor', () => {
    const carta = { agio: null };
    const parceiro = { agio_padrao: null };
    expect(resolverAgio(carta, parceiro, 50)).toBe(50);
  });
});

describe('formatarDataISOParaBR', () => {
  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatarDataISOParaBR('2026-09-12')).toBe('12/09/2026');
  });
});

describe('mesclarCartas', () => {
  const parceiros = [
    { id: 1, nome: 'Parceiro Principal', ativo: true, agio_padrao: null },
    { id: 2, nome: 'Jorge Consórcios', ativo: false, agio_padrao: 200 }
  ];

  it('aplica o ágio à entrada das cartas de parceiros ativos, com id único e numero de exibição separado', () => {
    const cartasParceiros = [
      { id: 10, numero_sequencial: 307, parceiro_id: 1, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA', reservada_por: null, vendida_em: null }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias: [], agioPadraoGlobal: 400 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].entrada).toBe(9400);
    expect(resultado[0].id).toBe(10);
    expect(resultado[0].numero).toBe(307);
    expect(resultado[0].origem).toBe('parceiro');
    expect(resultado[0].vencimento).toBe(20);
  });

  it('omite cartas de parceiros desligados (ativo=false)', () => {
    const cartasParceiros = [
      { id: 11, numero_sequencial: 200, parceiro_id: 2, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA', reservada_por: null, vendida_em: null }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias: [], agioPadraoGlobal: 400 });
    expect(resultado).toHaveLength(0);
  });

  it('inclui cartas próprias sem ágio, com id deslocado, numero de exibição e data formatada', () => {
    const cartasProprias = [
      { id: 5, numero_sequencial: 3, credito: 30000, entrada: 15000, prazo: 24, parcela: 1200, vencimento: '2026-09-12', administradora: 'HONDA', reservada_por: null, vendida_em: null }
    ];
    const resultado = mesclarCartas({ cartasParceiros: [], parceiros, cartasProprias, agioPadraoGlobal: 400 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].entrada).toBe(15000);
    expect(resultado[0].id).toBe(5 + ID_OFFSET_PROPRIAS);
    expect(resultado[0].numero).toBe(3);
    expect(resultado[0].origem).toBe('propria');
    expect(resultado[0].vencimento).toBe(12);
  });

  it('marca entrada_baixa quando entrada/credito < 0.3', () => {
    const cartasProprias = [
      { id: 1, numero_sequencial: 1, credito: 20000, entrada: 5000, prazo: 24, parcela: 800, vencimento: '2026-01-01', administradora: 'HONDA', reservada_por: null, vendida_em: null }
    ];
    const resultado = mesclarCartas({ cartasParceiros: [], parceiros, cartasProprias, agioPadraoGlobal: 0 });
    expect(resultado[0].entrada_baixa).toBe(true);
  });

  it('retorna cartas próprias antes das cartas de parceiros', () => {
    const cartasParceiros = [
      { id: 20, numero_sequencial: 300, parceiro_id: 1, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA', reservada_por: null, vendida_em: null }
    ];
    const cartasProprias = [
      { id: 9, numero_sequencial: 2, credito: 30000, entrada: 15000, prazo: 24, parcela: 1200, vencimento: '2026-09-12', administradora: 'HONDA', reservada_por: null, vendida_em: null }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias, agioPadraoGlobal: 0 });
    expect(resultado).toHaveLength(2);
    expect(resultado[0].id).toBe(9 + ID_OFFSET_PROPRIAS);
    expect(resultado[0].numero).toBe(2);
    expect(resultado[0].origem).toBe('propria');
    expect(resultado[1].id).toBe(20);
    expect(resultado[1].numero).toBe(300);
    expect(resultado[1].origem).toBe('parceiro');
  });

  it('gera ids diferentes para cartas de origens diferentes que compartilham o mesmo numero_sequencial (regressão do bug de colisão)', () => {
    const cartasParceiros = [
      { id: 30, numero_sequencial: 1, parceiro_id: 1, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA', reservada_por: null, vendida_em: null }
    ];
    const cartasProprias = [
      { id: 1, numero_sequencial: 1, credito: 30000, entrada: 15000, prazo: 24, parcela: 1200, vencimento: '2026-09-12', administradora: 'HONDA', reservada_por: null, vendida_em: null }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias, agioPadraoGlobal: 0 });
    expect(resultado[0].numero).toBe(1);
    expect(resultado[1].numero).toBe(1);
    expect(resultado[0].id).not.toBe(resultado[1].id);
  });

  it('omite carta própria reservada (reservada_por preenchido)', () => {
    const cartasProprias = [
      { id: 2, numero_sequencial: 4, credito: 20000, entrada: 8000, prazo: 24, parcela: 900, vencimento: '2026-05-01', administradora: 'HONDA', reservada_por: 'João', vendida_em: null }
    ];
    const resultado = mesclarCartas({ cartasParceiros: [], parceiros, cartasProprias, agioPadraoGlobal: 0 });
    expect(resultado).toHaveLength(0);
  });

  it('omite carta própria vendida (vendida_em preenchido)', () => {
    const cartasProprias = [
      { id: 3, numero_sequencial: 5, credito: 20000, entrada: 8000, prazo: 24, parcela: 900, vencimento: '2026-05-01', administradora: 'HONDA', reservada_por: null, vendida_em: '2026-08-01T12:00:00.000Z' }
    ];
    const resultado = mesclarCartas({ cartasParceiros: [], parceiros, cartasProprias, agioPadraoGlobal: 0 });
    expect(resultado).toHaveLength(0);
  });

  it('omite carta de parceiro reservada ou vendida mesmo com parceiro ativo', () => {
    const cartasParceiros = [
      { id: 40, numero_sequencial: 301, parceiro_id: 1, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA', reservada_por: 'Maria', vendida_em: null },
      { id: 41, numero_sequencial: 302, parceiro_id: 1, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA', reservada_por: null, vendida_em: '2026-08-01T12:00:00.000Z' }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias: [], agioPadraoGlobal: 0 });
    expect(resultado).toHaveLength(0);
  });
});

describe('mesclarVendidas', () => {
  const parceiros = [
    { id: 1, nome: 'Parceiro Principal', ativo: true, agio_padrao: null }
  ];

  it('inclui só cartas próprias vendidas, com identificacao grupo/cota e data formatada', () => {
    const cartasProprias = [
      { id: 5, numero_sequencial: 2, grupo: '009554', cota: '0661-00', tipo: 'carro', credito: 34496.46, entrada: 18218.51, prazo: 25, parcela: 829.14, vencimento: '2026-08-20', administradora: 'YAMAHA', reservada_por: 'Carlos', vendida_em: '2026-08-10T10:00:00.000Z' },
      { id: 6, numero_sequencial: 1, grupo: '008097', cota: '0091-00', tipo: 'moto', credito: 18148.35, entrada: 9185.01, prazo: 29, parcela: 474.74, vencimento: '2026-09-08', administradora: 'YAMAHA', reservada_por: null, vendida_em: null }
    ];
    const resultado = mesclarVendidas({ cartasProprias, cartasParceiros: [], parceiros });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(2);
    expect(resultado[0].dbId).toBe(5);
    expect(resultado[0].tabela).toBe('cartas_proprias');
    expect(resultado[0].origem).toBe('propria');
    expect(resultado[0].identificacao).toBe('009554 / 0661-00');
    expect(resultado[0].vencimento).toBe('20/08/2026');
    expect(resultado[0].compradoPor).toBe('Carlos');
  });

  it('inclui cartas de parceiros vendidas, com identificacao código e nome do parceiro', () => {
    const cartasParceiros = [
      { id: 30, numero_sequencial: 300, parceiro_id: 1, codigo: '260607', tipo: 'moto', credito: 18164, entrada: 7810, prazo: 27, parcela: 602.23, vencimento: '12/09/2026', administradora: 'YAMAHA', reservada_por: null, vendida_em: '2026-08-11T10:00:00.000Z' }
    ];
    const resultado = mesclarVendidas({ cartasProprias: [], cartasParceiros, parceiros });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(300);
    expect(resultado[0].dbId).toBe(30);
    expect(resultado[0].tabela).toBe('cartas_parceiros');
    expect(resultado[0].origem).toBe('Parceiro Principal');
    expect(resultado[0].identificacao).toBe('260607');
    expect(resultado[0].vencimento).toBe('12/09/2026');
    expect(resultado[0].compradoPor).toBe(null);
  });

  it('ordena por vendida_em decrescente (venda mais recente primeiro), misturando origens', () => {
    const cartasProprias = [
      { id: 1, numero_sequencial: 1, grupo: 'G1', cota: 'C1', tipo: 'moto', credito: 1, entrada: 1, prazo: 1, parcela: 1, vencimento: '2026-01-01', administradora: 'YAMAHA', reservada_por: null, vendida_em: '2026-08-01T00:00:00.000Z' }
    ];
    const cartasParceiros = [
      { id: 2, numero_sequencial: 2, parceiro_id: 1, codigo: 'C2', tipo: 'moto', credito: 1, entrada: 1, prazo: 1, parcela: 1, vencimento: '01/01/2026', administradora: 'YAMAHA', reservada_por: null, vendida_em: '2026-08-15T00:00:00.000Z' }
    ];
    const resultado = mesclarVendidas({ cartasProprias, cartasParceiros, parceiros });
    expect(resultado).toHaveLength(2);
    expect(resultado[0].dbId).toBe(2);
    expect(resultado[1].dbId).toBe(1);
  });
});
