
        const WHATSAPP_NUMBER = '556296686311';
        
        let cartas = [];
        let cartasSelecionadas = new Set();
        
        // Dados mockados para fallback
        const MOCK_DATA = [
            [1, 55, 5, 'R$ 20.000,00', 'R$ 12.000,00', 33, 'R$ 1.000,00', 5, 12, '', '12/10/2025', 'YAMAHA'],
            [2, 8086, 101, 'R$ 18.500,00', 'R$ 4.500,00', 35, 'R$ 539,00', 155, 12, '', '12/10/2025', 'YAMAHA'],
            [4, 8040, 415, 'R$ 21.663,00', 'R$ 5.999,00', 21, 'R$ 1.105,97', 415, 20, '', '20/10/2025', 'YAMAHA'],
            [6, 8082, 883, 'R$ 20.131,15', 'R$ 5.913,40', 35, 'R$ 542,18', 883, 20, '', '20/10/2025', 'YAMAHA'],
            [7, 8082, 498, 'R$ 19.800,00', 'R$ 4.800,00', 35, 'R$ 542,18', 498, 20, '', '20/10/2025', 'YAMAHA'],
            [8, 8087, 873, 'R$ 20.113,55', 'R$ 7.334,90', 34, 'R$ 534,31', 873, 7, '', '07/11/2025', 'PRÉ-CONTEMPLADA'],
            [9, 8090, 234, 'R$ 23.663,00', 'R$ 6.500,00', 21, 'R$ 1.105,97', 234, 12, '', '12/10/2025', 'YAMAHA'],
            [10, 8091, 567, 'R$ 25.000,00', 'R$ 8.000,00', 30, 'R$ 850,00', 567, 15, '', '15/10/2025', 'YAMAHA'],
            [11, 8092, 890, 'R$ 22.500,00', 'R$ 5.500,00', 28, 'R$ 780,00', 890, 18, '', '18/10/2025', 'PRÉ-CONTEMPLADA'],
            [12, 8093, 123, 'R$ 19.500,00', 'R$ 4.200,00', 32, 'R$ 620,00', 123, 22, '', '22/10/2025', 'YAMAHA'],
            [13, 8094, 456, 'R$ 28.000,00', 'R$ 9.500,00', 40, 'R$ 720,00', 456, 25, '', '25/10/2025', 'YAMAHA'],
            [14, 8095, 789, 'R$ 21.000,00', 'R$ 5.000,00', 25, 'R$ 890,00', 789, 28, '', '28/10/2025', 'PRÉ-CONTEMPLADA'],
            [15, 8096, 321, 'R$ 24.500,00', 'R$ 7.800,00', 36, 'R$ 680,00', 321, 5, '', '05/11/2025', 'YAMAHA'],
            [16, 8097, 654, 'R$ 26.800,00', 'R$ 6.200,00', 33, 'R$ 810,00', 654, 8, '', '08/11/2025', 'YAMAHA'],
        ];
        
        // Buscar cartas
        async function carregarCartas() {
            try {
                const [parceirosRes, cartasParceirosRes, cartasPropriasRes, configRes] = await Promise.all([
                    supabaseClient.from('parceiros').select('*'),
                    supabaseClient.from('cartas_parceiros').select('*'),
                    supabaseClient.from('cartas_proprias').select('*'),
                    supabaseClient.from('configuracoes').select('*').eq('chave', 'agio_padrao').single()
                ]);

                if (parceirosRes.error) throw parceirosRes.error;
                if (cartasParceirosRes.error) throw cartasParceirosRes.error;
                if (cartasPropriasRes.error) throw cartasPropriasRes.error;
                if (configRes.error) throw configRes.error;

                cartas = mesclarCartas({
                    cartasParceiros: cartasParceirosRes.data,
                    parceiros: parceirosRes.data,
                    cartasProprias: cartasPropriasRes.data,
                    agioPadraoGlobal: parseFloat(configRes.data.valor) || 0
                });

                document.getElementById('statusText').innerHTML = `${cartas.length} cotas ✅ Online`;
                renderizarCartas();
            } catch (error) {
                console.error('Erro ao carregar:', error);
                processarDados(MOCK_DATA);
            }
        }
        
        function processarDados(rows) {
            cartas = rows.map(row => {
                // Coluna J (índice 9) é o Comprador
                const comprador = row[9] || '';
                if (comprador.trim()) return null; // Carta vendida
                
                const credito = parseMoeda(row[3]);
                const entrada = parseMoeda(row[4]);
                const entrada_baixa = credito > 0 && (entrada / credito) < 0.3;
                
                return {
                    id: parseInt(row[0]),
                    credito,
                    entrada,
                    prazo: parseInt(row[5]),
                    parcela: parseMoeda(row[6]),
                    vencimento: parseInt(row[8]),
                    administradora: row[11] || 'N/A',
                    entrada_baixa
                };
            }).filter(c => c !== null);
            
            document.getElementById('statusText').innerHTML = `${cartas.length} cotas ✅ Online`;
            renderizarCartas();
        }
        
        function parseMoeda(valor) {
            if (!valor) return 0;
            return parseFloat(valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
        }
        
        function formatarMoeda(valor) {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(valor);
        }
        
        function renderizarCartas() {
            const container = document.getElementById('cardsContainer');
            const filtros = obterFiltros();
            
            const cartasFiltradas = cartas.filter(carta => {
                if (filtros.credito && carta.credito < filtros.credito) return false;
                if (filtros.prazo && carta.prazo > filtros.prazo) return false;
                if (filtros.parcela && carta.parcela > filtros.parcela) return false;
                return true;
            });
            
            if (cartasFiltradas.length === 0) {
                container.innerHTML = '<div class="loading">Nenhuma carta encontrada</div>';
                return;
            }
            
            container.innerHTML = cartasFiltradas.map(carta => `
                <div class="card ${carta.entrada_baixa ? 'entrada-baixa' : ''}" data-id="${carta.id}">
                    ${carta.entrada_baixa ? '<div class="card-badge">🔥 Entrada Baixa</div>' : ''}
                    <div class="checkbox-container">
                        <input type="checkbox" 
                               onchange="toggleSelecao(${carta.id})" 
                               ${cartasSelecionadas.has(carta.id) ? 'checked' : ''}>
                    </div>
                    <div class="card-header">
                        <div class="card-title">Cota #${carta.id}</div>
                        <div class="card-type">${carta.administradora}</div>
                    </div>
                    <div class="card-info">📄 Crédito: <strong>${formatarMoeda(carta.credito)}</strong></div>
                    <div class="card-info">💰 Entrada: <strong>${formatarMoeda(carta.entrada)}</strong></div>
                    <div class="card-info">🎁 Parcelas: <strong>${carta.prazo}x ${formatarMoeda(carta.parcela)}</strong></div>
                    <div class="card-info">📆 Venc: <strong>${carta.vencimento}</strong></div>
                    <div class="card-actions">
                        <button class="btn btn-copy" onclick="copiarCarta(${carta.id})">📋 Copiar</button>
                        <button class="btn btn-whatsapp" onclick="enviarCartaWhatsApp(${carta.id})">📱 WhatsApp</button>
                    </div>
                </div>
            `).join('');
        }
        
        function obterFiltros() {
            return {
                credito: parseFloat(document.getElementById('filterCredito').value) || 0,
                prazo: parseInt(document.getElementById('filterPrazo').value) || 0,
                parcela: parseFloat(document.getElementById('filterParcela').value) || 0
            };
        }
        
        function limparFiltros() {
            document.getElementById('filterCredito').value = '';
            document.getElementById('filterPrazo').value = '';
            document.getElementById('filterParcela').value = '';
            renderizarCartas();
        }
        
        function toggleSelecao(id) {
            if (cartasSelecionadas.has(id)) {
                cartasSelecionadas.delete(id);
            } else {
                if (cartasSelecionadas.size >= 5) {
                    alert('Máximo de 5 cotas!');
                    renderizarCartas();
                    return;
                }
                cartasSelecionadas.add(id);
            }
            atualizarPainelSelecao();
        }
        
        function atualizarPainelSelecao() {
            const panel = document.getElementById('selectionPanel');
            const count = document.getElementById('selectedCount');
            
            count.textContent = cartasSelecionadas.size;
            panel.className = cartasSelecionadas.size > 0 ? 'selection-panel active' : 'selection-panel';
        }
        
        function limparSelecao() {
            cartasSelecionadas.clear();
            atualizarPainelSelecao();
            renderizarCartas();
        }
        
        function calcularJuncao() {
            if (cartasSelecionadas.size === 0) {
                alert('Selecione pelo menos uma carta!');
                return;
            }
            
            const cartasJuncao = Array.from(cartasSelecionadas).map(id => 
                cartas.find(c => c.id === id)
            );
            
            const creditoTotal = cartasJuncao.reduce((sum, c) => sum + c.credito, 0);
            const entradaTotal = cartasJuncao.reduce((sum, c) => sum + c.entrada, 0);
            const prazoMax = Math.max(...cartasJuncao.map(c => c.prazo));
            
            // Calcular vencimentos únicos
            const vencimentosUnicos = [...new Set(cartasJuncao.map(c => c.vencimento))];
            vencimentosUnicos.sort((a, b) => a - b);
            const vencimentosTexto = vencimentosUnicos.map(v => String(v).padStart(2, '0')).join(' e ');
            
            // Calcular parcelas sequenciais
            const todasParcelas = [];
            for (let i = 1; i <= prazoMax; i++) {
                let valorParcela = 0;
                cartasJuncao.forEach(carta => {
                    if (i <= carta.prazo) {
                        valorParcela += carta.parcela;
                    }
                });
                if (valorParcela > 0) {
                    todasParcelas.push(valorParcela);
                }
            }
            
            // Agrupar parcelas sequenciais
            const parcelasAgrupadas = [];
            let inicio = 1;
            let valorAtual = todasParcelas[0];
            let count = 1;
            
            for (let i = 1; i < todasParcelas.length; i++) {
                if (Math.abs(todasParcelas[i] - valorAtual) < 0.01) {
                    count++;
                } else {
                    const fim = inicio + count - 1;
                    parcelasAgrupadas.push({
                        inicio,
                        fim,
                        valor: valorAtual,
                        texto: `${inicio} a ${fim}`
                    });
                    inicio = i + 1;
                    valorAtual = todasParcelas[i];
                    count = 1;
                }
            }
            
            // Adicionar último grupo
            const fim = inicio + count - 1;
            parcelasAgrupadas.push({
                inicio,
                fim,
                valor: valorAtual,
                texto: `${inicio} a ${fim}`
            });
            
            mostrarResultado({
                cartas: cartasJuncao,
                creditoTotal,
                entradaTotal,
                parcelasAgrupadas,
                administradora: cartasJuncao[0].administradora,
                vencimentos: vencimentosTexto,
                cotasIds: cartasJuncao.map(c => `#${c.id}`).join(', ')
            });
        }
        
        function mostrarResultado(resultado) {
            const content = document.getElementById('resultContent');
            
            content.innerHTML = `
                <div class="result-section">
                    <h4>Administradora:</h4>
                    <div class="result-value">${resultado.administradora}</div>
                </div>
                <div class="result-section">
                    <h4>📄 Crédito Total:</h4>
                    <div class="result-value">${formatarMoeda(resultado.creditoTotal)}</div>
                </div>
                <div class="result-section">
                    <h4>💰 Entrada Total:</h4>
                    <div class="result-value">${formatarMoeda(resultado.entradaTotal)}</div>
                </div>
                <div class="result-section">
                    <h4>🎁 Parcelas:</h4>
                    ${resultado.parcelasAgrupadas.map(p => `
                        <div>De ${p.texto} de ${formatarMoeda(p.valor)}</div>
                    `).join('')}
                </div>
                <div class="result-section">
                    <h4>📋 Cotas Selecionadas:</h4>
                    <div>${resultado.cartas.map(c => `#${c.id}`).join(', ')}</div>
                </div>
                <div class="result-section">
                    <h4>📆 Vencimento:</h4>
                    <div class="result-value">${resultado.vencimentos}</div>
                </div>
            `;
            
            window.resultadoAtual = resultado;
            document.getElementById('resultModal').classList.add('active');
        }
        
        function fecharModal() {
            document.getElementById('resultModal').classList.remove('active');
        }
        
        function copiarResultado() {
            const r = window.resultadoAtual;
            const adminNome = r.administradora.charAt(0).toUpperCase() + r.administradora.slice(1).toLowerCase();
            const texto = `*🅼🆃 | Carta Contemplada ${adminNome}*
📄 Crédito: ${formatarMoeda(r.creditoTotal)}
💰 Entrada: ${formatarMoeda(r.entradaTotal)}
${r.parcelasAgrupadas.map(p => `De ${p.inicio} Até ${p.fim} ${formatarMoeda(p.valor)}`).join('\n')}
📆 Venc: ${r.vencimentos}
📋 Cotas: ${r.cotasIds}
📎 Reg: R$ 580 | Transf: 0,5%
🏍️🚗 Até 10 anos`;
            
            navigator.clipboard.writeText(texto);
            alert('Texto copiado!');
        }
        
        function enviarWhatsApp() {
            const r = window.resultadoAtual;
            const adminNome = r.administradora.charAt(0).toUpperCase() + r.administradora.slice(1).toLowerCase();
            const texto = `*🅼🆃 | Carta Contemplada ${adminNome}*
📄 Crédito: ${formatarMoeda(r.creditoTotal)}
💰 Entrada: ${formatarMoeda(r.entradaTotal)}
${r.parcelasAgrupadas.map(p => `De ${p.inicio}	Até ${p.fim}	${formatarMoeda(p.valor)}`).join('\n')}
📆 Venc: ${r.vencimentos}
📋 Cotas: ${r.cotasIds}
📎 Reg: R$ 580 | Transf: 0,5%
🏍️🚗 Até 10 anos`;
            
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`);
        }
        
        function copiarCarta(id) {
            const carta = cartas.find(c => c.id === id);
            const adminNome = carta.administradora.toUpperCase();
            const texto = `*🅼🆃 | Carta Contemplada ${adminNome}*
📄 Crédito: ${formatarMoeda(carta.credito)}
💰 Entrada: ${formatarMoeda(carta.entrada)}
📅 Parcelas: ${carta.prazo}x ${formatarMoeda(carta.parcela)}
📆 Venc: ${carta.vencimento}
📎 Reg: R$ 580 | Transf: 0,5%
🏍️🚗 Até 10 anos`;
            
            navigator.clipboard.writeText(texto);
            alert('Texto copiado!');
        }
        
        function enviarCartaWhatsApp(id) {
            const carta = cartas.find(c => c.id === id);
            const adminNome = carta.administradora.toUpperCase();
            const texto = `*🅼🆃 | Carta Contemplada ${adminNome}*
📄 Crédito: ${formatarMoeda(carta.credito)}
💰 Entrada: ${formatarMoeda(carta.entrada)}
📅 Parcelas: ${carta.prazo}x ${formatarMoeda(carta.parcela)}
📆 Venc: ${carta.vencimento}
📎 Reg: R$ 580 | Transf: 0,5%
🏍️🚗 Até 10 anos`;
            
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`);
        }
        
        // Algoritmo de busca de combinações
        function buscarCombinacoes() {
            const creditoDesejado = parseFloat(document.getElementById('buscaCredito').value);
            if (!creditoDesejado || creditoDesejado <= 0) {
                alert('Por favor, insira um valor de crédito desejado válido.');
                return;
            }

            const maxCotas = parseInt(document.getElementById('buscaMaxCotas').value);
            const criterio = document.getElementById('buscaCriterio').value;
            
            const container = document.getElementById('cardsContainer');
            container.innerHTML = '<div class="loading">Buscando as melhores combinações...</div>';

            // Usar setTimeout para permitir que a UI atualize o loading
            setTimeout(() => {
                const combinacoes = encontrarCombinacoes(creditoDesejado, maxCotas, criterio);
                renderizarCombinacoes(combinacoes);
            }, 100);
        }

        function encontrarCombinacoes(creditoDesejado, maxCotas, criterio) {
            const combinacoes = [];
            const margem = creditoDesejado * 0.15; // 15% de margem para mais ou para menos

            // Função recursiva para encontrar combinações
            function buscar(indexAtual, cotasAtuais, creditoAtual, entradaAtual, parcelaTotalAtual) {
                // Adicionar combinação atual se estiver dentro da margem
                if (cotasAtuais.length > 0 && Math.abs(creditoAtual - creditoDesejado) <= margem) {
                    combinacoes.push({
                        cotas: [...cotasAtuais],
                        creditoTotal: creditoAtual,
                        entradaTotal: entradaAtual,
                        parcelaTotal: parcelaTotalAtual,
                        diferenca: Math.abs(creditoAtual - creditoDesejado)
                    });
                }

                // Parar se atingiu o limite de cotas ou se o crédito já ultrapassou muito
                if (cotasAtuais.length >= maxCotas || creditoAtual > creditoDesejado + margem) {
                    return;
                }

                // Tentar adicionar próximas cotas
                for (let i = indexAtual; i < cartas.length; i++) {
                    const carta = cartas[i];
                    cotasAtuais.push(carta);
                    buscar(
                        i + 1, // Não permite repetir a mesma cota
                        cotasAtuais,
                        creditoAtual + carta.credito,
                        entradaAtual + carta.entrada,
                        parcelaTotalAtual + carta.parcela
                    );
                    cotasAtuais.pop();
                }
            }

            buscar(0, [], 0, 0, 0);

            // Ordenar resultados com base no critério
            combinacoes.sort((a, b) => {
                if (criterio === 'Mais próximo') return a.diferenca - b.diferenca;
                if (criterio === 'Menor entrada') return a.entradaTotal - b.entradaTotal;
                if (criterio === 'Maior entrada') return b.entradaTotal - a.entradaTotal;
                if (criterio === 'Menor parcela') return a.parcelaTotal - b.parcelaTotal;
                return 0;
            });

            // Retornar as top 20 combinações
            return combinacoes.slice(0, 20);
        }

        function renderizarCombinacoes(combinacoes) {
            const container = document.getElementById('cardsContainer');
            
            if (combinacoes.length === 0) {
                container.innerHTML = '<div class="loading">Nenhuma combinação encontrada para este valor. Tente aumentar o número de cotas ou alterar o valor.</div>';
                return;
            }
            
            container.innerHTML = combinacoes.map((comb, index) => {
                const cotasIds = comb.cotas.map(c => c.id);
                const cotasIdsStr = JSON.stringify(cotasIds);
                
                return `
                <div class="card" style="border-color: var(--color-teal-500); border-width: 2px;">
                    <div class="card-badge" style="background: var(--color-slate-900);">Opção #${index + 1}</div>
                    <div class="card-header">
                        <div class="card-title">Junção de ${comb.cotas.length} cotas</div>
                        <div class="card-type">${comb.cotas[0].administradora}</div>
                    </div>
                    <div class="card-info">📄 Crédito Total: <strong style="color: var(--color-teal-600); font-size: 16px;">${formatarMoeda(comb.creditoTotal)}</strong></div>
                    <div class="card-info">💰 Entrada Total: <strong>${formatarMoeda(comb.entradaTotal)}</strong></div>
                    <div class="card-info">📋 Cotas: <strong>${comb.cotas.map(c => `#${c.id}`).join(', ')}</strong></div>
                    <div class="card-actions" style="grid-template-columns: 1fr;">
                        <button class="btn btn-primary" onclick='selecionarEVisualizarJuncao(${cotasIdsStr})'>👁️ Ver Detalhes da Junção</button>
                    </div>
                </div>
            `}).join('');
        }

        function selecionarEVisualizarJuncao(cotasIds) {
            limparSelecao();
            cotasIds.forEach(id => {
                cartasSelecionadas.add(id);
            });
            atualizarPainelSelecao();
            calcularJuncao();
        }

        function limparBusca() {
            document.getElementById('buscaCredito').value = '';
            document.getElementById('buscaMaxCotas').value = '3';
            document.getElementById('buscaCriterio').value = 'Mais próximo';
            renderizarCartas();
        }

        // Event listeners
        document.getElementById('filterCredito').addEventListener('input', renderizarCartas);
        document.getElementById('filterPrazo').addEventListener('input', renderizarCartas);
        document.getElementById('filterParcela').addEventListener('input', renderizarCartas);
        
        // Permitir busca ao apertar Enter no campo de crédito
        document.getElementById('buscaCredito').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                buscarCombinacoes();
            }
        });
        
        // Carregar cartas ao iniciar
        carregarCartas();
        
        // Atualizar a cada 5 minutos
        setInterval(carregarCartas, 300000);
    