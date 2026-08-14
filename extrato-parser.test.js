// extrato-parser.test.js
const fs = require('fs');
const path = require('path');
const { parsearExtrato } = require('./extrato-parser.js');

const extrato0661 = fs.readFileSync(path.join(__dirname, 'fixtures/extrato-0661.txt'), 'utf8');
const extrato0091 = fs.readFileSync(path.join(__dirname, 'fixtures/extrato-0091.txt'), 'utf8');

describe('parsearExtrato — cota não contemplada', () => {
  it('retorna contemplada:false quando não há Dt. Contemplação', () => {
    const resultado = parsearExtrato('Grupo: 009554 Cota: 0661-00\nsem data de contemplação em lugar nenhum');
    expect(resultado).toEqual({ contemplada: false });
  });
});

describe('parsearExtrato — cota 0661-00 (lance diluído já pago)', () => {
  const resultado = parsearExtrato(extrato0661);

  it('extrai contemplada, grupo, cota, vencimento, administradora', () => {
    expect(resultado.contemplada).toBe(true);
    expect(resultado.grupo).toBe('009554');
    expect(resultado.cota).toBe('0661-00');
    expect(resultado.vencimento).toBe('20/08/2026');
    expect(resultado.administradora).toBe('YAMAHA');
  });

  it('desconta o débito do lance diluído já pago do valor investido', () => {
    expect(resultado.statusLance).toBe('pago');
    expect(resultado.credito).toBeCloseTo(34496.46, 2);
    expect(resultado.prazo).toBe(25);
    expect(resultado.parcela).toBeCloseTo(829.14, 2);
    expect(resultado.custoDaCarta).toBeCloseTo(18218.51, 2);
  });
});

describe('parsearExtrato — cota 0091-00 (lance diluído pendente)', () => {
  const resultado = parsearExtrato(extrato0091);

  it('extrai contemplada, grupo, cota, vencimento', () => {
    expect(resultado.contemplada).toBe(true);
    expect(resultado.grupo).toBe('008097');
    expect(resultado.cota).toBe('0091-00');
    expect(resultado.vencimento).toBe('08/09/2026');
  });

  it('ajusta credito, parcela e custo da carta pelo lance diluído pendente, mantém o prazo', () => {
    expect(resultado.statusLance).toBe('diluido_pendente');
    expect(resultado.credito).toBeCloseTo(18148.35, 2);
    expect(resultado.prazo).toBe(29);
    expect(resultado.parcela).toBeCloseTo(474.74, 2);
    expect(resultado.custoDaCarta).toBeCloseTo(9185.01, 2);
  });
});

describe('parsearExtrato — lance não diluído pendente (fixture sintética)', () => {
  const textoBase = `
Dt. Contemplação: 01/01/2026 Crédito: R$ 10.000,00
Tipo Contempl.: Lance Crédito Corrigido: R$ 10.000,00
Data do Pagamento: Valor Bem Entregue: R$ 0,00
Entrega Docum.: Liquido à Pagar: R$ 30.000,00
TOTAL Valor Contrib. Mensal: R$ 1.000,00
Conta Corrente
Ass. Aviso Histórico Vencto. Pagto. Bem VL. Créd Vl. Devido Vl. Pago Multa Juros Seguro % Pago % Difer
(*) Movimento não apropriado TOTAIS R$ 3.000,00 R$ 3.000,00 R$ 0,00 R$ 0,00 R$ 0,00 10,0000% 0,0000%
Pendência
Ass. Aviso Histórico Vencto. Bem Vl. Crédito Vl. Parcela Multa Juros Seguro % Normal
007 111 130 RECBTO LANCE 18/08/2026 922TX R$ 30.000,00 R$ 3.000,00 R$ 0,00 R$ 0,00 R$ 0,00 0,0000%
007 112 140 DEBITO LANCE 18/08/2026 922TX R$ 30.000,00 R$ 3.000,00 R$ 0,00 R$ 0,00 R$ 0,00 0,0000%
TOTAIS: R$ 6.000,00 0,0000%
Resumo Parcelas a Pagar
Qtde Total: 30,00 Qtde Furo: 0,00
`;

  it('abate o valor do lance das parcelas restantes, mantém o valor de cada parcela', () => {
    const resultado = parsearExtrato(textoBase);
    expect(resultado.statusLance).toBe('nao_diluido_pendente');
    expect(resultado.credito).toBeCloseTo(27000, 2);
    expect(resultado.prazo).toBe(27);
    expect(resultado.parcela).toBeCloseTo(1000, 2);
    expect(resultado.custoDaCarta).toBeCloseTo(6000, 2);
  });
});
