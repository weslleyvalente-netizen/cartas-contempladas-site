const { resolverAgio, formatarDataISOParaBR, mesclarCartas } = require('./cartas-logic.js');

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

  it('aplica o ágio à entrada das cartas de parceiros ativos, com origem parceiro', () => {
    const cartasParceiros = [
      { id: 10, numero_sequencial: 307, parceiro_id: 1, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA' }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias: [], agioPadraoGlobal: 400 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].entrada).toBe(9400);
    expect(resultado[0].id).toBe(307);
    expect(resultado[0].origem).toBe('parceiro');
    expect(resultado[0].vencimento).toBe(20);
  });

  it('omite cartas de parceiros desligados (ativo=false)', () => {
    const cartasParceiros = [
      { id: 11, numero_sequencial: 200, parceiro_id: 2, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA' }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias: [], agioPadraoGlobal: 400 });
    expect(resultado).toHaveLength(0);
  });

  it('inclui cartas próprias sem ágio, com numero_sequencial como id, origem propria e data formatada', () => {
    const cartasProprias = [
      { id: 5, numero_sequencial: 3, credito: 30000, entrada: 15000, prazo: 24, parcela: 1200, vencimento: '2026-09-12', administradora: 'HONDA' }
    ];
    const resultado = mesclarCartas({ cartasParceiros: [], parceiros, cartasProprias, agioPadraoGlobal: 400 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].entrada).toBe(15000);
    expect(resultado[0].id).toBe(3);
    expect(resultado[0].origem).toBe('propria');
    expect(resultado[0].vencimento).toBe(12);
  });

  it('marca entrada_baixa quando entrada/credito < 0.3', () => {
    const cartasProprias = [
      { id: 1, numero_sequencial: 1, credito: 20000, entrada: 5000, prazo: 24, parcela: 800, vencimento: '2026-01-01', administradora: 'HONDA' }
    ];
    const resultado = mesclarCartas({ cartasParceiros: [], parceiros, cartasProprias, agioPadraoGlobal: 0 });
    expect(resultado[0].entrada_baixa).toBe(true);
  });

  it('retorna cartas próprias antes das cartas de parceiros', () => {
    const cartasParceiros = [
      { id: 20, numero_sequencial: 300, parceiro_id: 1, credito: 20000, entrada: 9000, agio: null, prazo: 30, parcela: 500, vencimento: '20/08/2026', administradora: 'YAMAHA' }
    ];
    const cartasProprias = [
      { id: 9, numero_sequencial: 2, credito: 30000, entrada: 15000, prazo: 24, parcela: 1200, vencimento: '2026-09-12', administradora: 'HONDA' }
    ];
    const resultado = mesclarCartas({ cartasParceiros, parceiros, cartasProprias, agioPadraoGlobal: 0 });
    expect(resultado).toHaveLength(2);
    expect(resultado[0].id).toBe(2);
    expect(resultado[0].origem).toBe('propria');
    expect(resultado[1].id).toBe(300);
    expect(resultado[1].origem).toBe('parceiro');
  });
});
