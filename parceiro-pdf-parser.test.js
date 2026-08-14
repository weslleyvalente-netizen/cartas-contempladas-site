const fs = require('fs');
const path = require('path');
const { parsearTabelaParceiro } = require('./parceiro-pdf-parser.js');

const textoElo = fs.readFileSync(path.join(__dirname, 'fixtures/tabela-elo-13-08-2026.txt'), 'utf8');

describe('parsearTabelaParceiro — PDF real do Elo (44 linhas de dados)', () => {
  const dataReferencia = new Date(2026, 7, 14); // 14/08/2026
  const resultado = parsearTabelaParceiro(textoElo, dataReferencia, 'ts1');

  it('extrai exatamente as 44 linhas de dados, ignorando cabeçalho/rodapé/endereço', () => {
    expect(resultado).toHaveLength(44);
  });

  it('extrai a primeira linha corretamente (N° 1)', () => {
    const linha = resultado[0];
    expect(linha.numeroPdf).toBe(1);
    expect(linha.administradora).toBe('YAMAHA');
    expect(linha.credito).toBeCloseTo(11430.00, 2);
    expect(linha.entrada).toBeCloseTo(7465.75, 2);
    expect(linha.prazo).toBe(34);
    expect(linha.parcela).toBeCloseTo(228.00, 2);
    expect(linha.tipo).toBe('moto');
  });

  it('extrai um valor de milhar com ponto corretamente (N° 73, crédito R$79.253,00)', () => {
    const linha = resultado.find((l) => l.numeroPdf === 73);
    expect(linha.credito).toBeCloseTo(79253.00, 2);
    expect(linha.entrada).toBeCloseTo(42865.11, 2);
    expect(linha.parcela).toBeCloseTo(1400.00, 2);
    expect(linha.tipo).toBe('carro');
  });

  it('extrai as linhas da segunda página (após o cabeçalho repetido)', () => {
    const linha159 = resultado.find((l) => l.numeroPdf === 159);
    const linha160 = resultado.find((l) => l.numeroPdf === 160);
    expect(linha159.credito).toBeCloseTo(12131.09, 2);
    expect(linha160.credito).toBeCloseTo(23558.56, 2);
  });

  it('gera codigo único combinando N° do PDF e timestamp da importação', () => {
    expect(resultado[0].codigo).toBe('1-ts1');
    const resultado2 = parsearTabelaParceiro(textoElo, dataReferencia, 'ts2');
    expect(resultado2[0].codigo).toBe('1-ts2');
    expect(resultado[0].codigo).not.toBe(resultado2[0].codigo);
  });
});

describe('parsearTabelaParceiro — estimativa de tipo pelo limite de R$34.000,00', () => {
  const dataReferencia = new Date(2026, 7, 14);
  const linha = (credito) =>
    `1 YAMAHA R$ ${credito} R$ 1.000,00 12 R$ 100,00 10`;

  it('crédito exatamente R$34.000,00 é moto', () => {
    const [resultado] = parsearTabelaParceiro(linha('34.000,00'), dataReferencia, 't');
    expect(resultado.tipo).toBe('moto');
  });

  it('crédito R$34.000,01 é carro', () => {
    const [resultado] = parsearTabelaParceiro(linha('34.000,01'), dataReferencia, 't');
    expect(resultado.tipo).toBe('carro');
  });
});

describe('parsearTabelaParceiro — cálculo de vencimento (próxima ocorrência do dia)', () => {
  const linha = (vctoDia) =>
    `1 YAMAHA R$ 20.000,00 R$ 10.000,00 30 R$ 500,00 ${vctoDia}`;

  it('dia já passou este mês (referência 14/08/2026, dia 7) → mês seguinte', () => {
    const dataReferencia = new Date(2026, 7, 14);
    const [resultado] = parsearTabelaParceiro(linha(7), dataReferencia, 't');
    expect(resultado.vencimento).toBe('07/09/2026');
  });

  it('dia ainda não chegou este mês (referência 14/08/2026, dia 20) → mês atual', () => {
    const dataReferencia = new Date(2026, 7, 14);
    const [resultado] = parsearTabelaParceiro(linha(20), dataReferencia, 't');
    expect(resultado.vencimento).toBe('20/08/2026');
  });

  it('dia igual ao dia de hoje → mês atual (não conta como "já passou")', () => {
    const dataReferencia = new Date(2026, 7, 14);
    const [resultado] = parsearTabelaParceiro(linha(14), dataReferencia, 't');
    expect(resultado.vencimento).toBe('14/08/2026');
  });

  it('mês seguinte vira o ano (referência dezembro) → ano avança', () => {
    const dataReferencia = new Date(2026, 11, 20); // 20/12/2026
    const [resultado] = parsearTabelaParceiro(linha(5), dataReferencia, 't');
    expect(resultado.vencimento).toBe('05/01/2027');
  });
});
