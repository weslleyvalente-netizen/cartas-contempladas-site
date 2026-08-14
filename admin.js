const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const adminError = document.getElementById('adminError');
const loginError = document.getElementById('loginError');

function mostrarErro(el, mensagem) {
    el.textContent = mensagem;
    el.style.display = mensagem ? 'block' : 'none';
}

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}

function formatarMoedaAdmin(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarDataAdmin(isoDate) {
    const [ano, mes, dia] = isoDate.split('-');
    return `${dia}/${mes}/${ano}`;
}

async function verificarSessao() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        carregarTudo();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarErro(loginError, '');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        mostrarErro(loginError, 'Login inválido: ' + error.message);
        return;
    }
    verificarSessao();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    verificarSessao();
});

async function carregarTudo() {
    await Promise.all([
        carregarParceiros(),
        carregarCartasProprias(),
        carregarCartasParceiros(),
        carregarConfiguracoes()
    ]);
}

// ---- Cartas Próprias ----

async function carregarCartasProprias() {
    const { data, error } = await supabaseClient
        .from('cartas_proprias')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) {
        mostrarErro(adminError, 'Erro ao carregar cartas próprias: ' + error.message);
        return;
    }
    window._cartasPropriasCache = data;
    const tbody = document.querySelector('#cartasPropriasTable tbody');
    tbody.innerHTML = data.map((c) => `
        <tr>
            <td>${c.administradora}</td>
            <td>${c.grupo ? escaparHtml(c.grupo) : ''}${c.grupo && c.cota ? ' / ' : ''}${c.cota ? escaparHtml(c.cota) : ''}</td>
            <td>${c.tipo}</td>
            <td>${formatarMoedaAdmin(c.credito)}</td>
            <td>${formatarMoedaAdmin(c.entrada)}</td>
            <td>${c.prazo}x ${formatarMoedaAdmin(c.parcela)}</td>
            <td>${formatarDataAdmin(c.vencimento)}</td>
            <td>
                <button class="btn btn-clear" onclick="editarCartaPropria(${c.id})">✏️</button>
                <button class="btn btn-clear" onclick="excluirCartaPropria(${c.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('novaCartaPropriaBtn').addEventListener('click', () => {
    document.getElementById('cartaPropriaForm').reset();
    document.getElementById('cartaPropriaId').value = '';
    document.getElementById('avisoLanceBox').innerHTML = '';
    document.getElementById('agioDesejadoBox').style.display = 'none';
    document.getElementById('cartaPropriaFormBox').style.display = 'block';
});

document.getElementById('importarPdfBtn').addEventListener('click', () => {
    document.getElementById('importarPdfInput').click();
});

document.getElementById('importarPdfInput').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    e.target.value = '';

    let resultado;
    try {
        const texto = await extrairTextoPDF(arquivo);
        resultado = parsearExtrato(texto);
    } catch (err) {
        alert('Erro ao ler o PDF: ' + err.message);
        return;
    }

    if (!resultado.contemplada) {
        alert('⚠️ Esta cota ainda não foi contemplada. Não é possível cadastrar como carta disponível.');
        return;
    }

    document.getElementById('cartaPropriaForm').reset();
    document.getElementById('cartaPropriaId').value = '';
    document.getElementById('cpAdministradora').value = resultado.administradora;
    document.getElementById('cpGrupo').value = resultado.grupo || '';
    document.getElementById('cpCota').value = resultado.cota || '';
    document.getElementById('cpCredito').value = resultado.credito;
    document.getElementById('cpPrazo').value = resultado.prazo;
    document.getElementById('cpParcela').value = resultado.parcela;
    if (resultado.vencimento) {
        const [dia, mes, ano] = resultado.vencimento.split('/');
        document.getElementById('cpVencimento').value = `${ano}-${mes}-${dia}`;
    }

    const avisoBox = document.getElementById('avisoLanceBox');
    const classeAviso = resultado.statusLance === 'pago' ? 'pago'
        : resultado.statusLance === 'indeterminado' ? 'indeterminado'
        : 'pendente';
    avisoBox.innerHTML = resultado.avisoLance
        ? `<div class="aviso-lance ${classeAviso}">${resultado.avisoLance}</div>`
        : '';

    const agioBox = document.getElementById('agioDesejadoBox');
    const agioInput = document.getElementById('agioDesejadoInput');
    const custoDaCarta = resultado.custoDaCarta || 0;
    if (resultado.custoDaCarta !== null) {
        agioBox.style.display = 'block';
        agioInput.value = '';
        agioInput.oninput = () => {
            const agio = parseFloat(agioInput.value) || 0;
            document.getElementById('cpEntrada').value = (custoDaCarta + agio).toFixed(2);
        };
        document.getElementById('cpEntrada').value = custoDaCarta.toFixed(2);
    } else {
        agioBox.style.display = 'none';
    }

    document.getElementById('cartaPropriaFormBox').style.display = 'block';
});

document.getElementById('cancelarCartaPropriaBtn').addEventListener('click', () => {
    document.getElementById('cartaPropriaFormBox').style.display = 'none';
});

function editarCartaPropria(id) {
    const carta = window._cartasPropriasCache.find((c) => c.id === id);
    if (!carta) return;
    document.getElementById('cartaPropriaId').value = carta.id;
    document.getElementById('cpAdministradora').value = carta.administradora;
    document.getElementById('cpGrupo').value = carta.grupo || '';
    document.getElementById('cpCota').value = carta.cota || '';
    document.getElementById('cpTipo').value = carta.tipo;
    document.getElementById('cpCredito').value = carta.credito;
    document.getElementById('cpEntrada').value = carta.entrada;
    document.getElementById('cpPrazo').value = carta.prazo;
    document.getElementById('cpParcela').value = carta.parcela;
    document.getElementById('cpVencimento').value = carta.vencimento;
    document.getElementById('cartaPropriaFormBox').style.display = 'block';
}

async function excluirCartaPropria(id) {
    if (!confirm('Excluir esta carta?')) return;
    const { error } = await supabaseClient.from('cartas_proprias').delete().eq('id', id);
    if (error) {
        mostrarErro(adminError, 'Erro ao excluir: ' + error.message);
        return;
    }
    carregarCartasProprias();
}

document.getElementById('cartaPropriaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cartaPropriaId').value;
    const registro = {
        administradora: document.getElementById('cpAdministradora').value,
        grupo: document.getElementById('cpGrupo').value || null,
        cota: document.getElementById('cpCota').value || null,
        tipo: document.getElementById('cpTipo').value,
        credito: parseFloat(document.getElementById('cpCredito').value),
        entrada: parseFloat(document.getElementById('cpEntrada').value),
        prazo: parseInt(document.getElementById('cpPrazo').value, 10),
        parcela: parseFloat(document.getElementById('cpParcela').value),
        vencimento: document.getElementById('cpVencimento').value
    };
    const query = id
        ? supabaseClient.from('cartas_proprias').update(registro).eq('id', id)
        : supabaseClient.from('cartas_proprias').insert(registro);
    const { error } = await query;
    if (error) {
        mostrarErro(adminError, 'Erro ao salvar: ' + error.message);
        return;
    }
    document.getElementById('cartaPropriaFormBox').style.display = 'none';
    carregarCartasProprias();
});

// ---- Cartas Parceiros (leitura + ágio) ----

async function carregarCartasParceiros() {
    const { data, error } = await supabaseClient
        .from('cartas_parceiros')
        .select('*, parceiros(nome)')
        .order('created_at', { ascending: false });
    if (error) {
        mostrarErro(adminError, 'Erro ao carregar cartas de parceiros: ' + error.message);
        return;
    }
    const tbody = document.querySelector('#cartasParceirosTable tbody');
    tbody.innerHTML = data.map((c) => `
        <tr>
            <td>${c.parceiros ? c.parceiros.nome : ''}</td>
            <td>${escaparHtml(c.codigo)}</td>
            <td>${formatarMoedaAdmin(c.credito)}</td>
            <td>${formatarMoedaAdmin(c.entrada)}</td>
            <td>${c.prazo}x ${formatarMoedaAdmin(c.parcela)}</td>
            <td>${escaparHtml(c.vencimento)}</td>
            <td>
                <input type="number" step="0.01" value="${c.agio ?? ''}" placeholder="padrão"
                       style="width: 100px;"
                       onchange="salvarAgioCarta(${c.id}, this.value)">
            </td>
        </tr>
    `).join('');
}

async function salvarAgioCarta(id, valor) {
    const agio = valor === '' ? null : parseFloat(valor);
    const { error } = await supabaseClient.from('cartas_parceiros').update({ agio }).eq('id', id);
    if (error) mostrarErro(adminError, 'Erro ao salvar ágio: ' + error.message);
}

// ---- Parceiros ----

async function carregarParceiros() {
    const { data, error } = await supabaseClient.from('parceiros').select('*').order('nome');
    if (error) {
        mostrarErro(adminError, 'Erro ao carregar parceiros: ' + error.message);
        return;
    }
    const tbody = document.querySelector('#parceirosTable tbody');
    tbody.innerHTML = data.map((p) => `
        <tr>
            <td>${p.nome}</td>
            <td><input type="text" value="${p.link ?? ''}" placeholder="link"
                       onchange="salvarLinkParceiro(${p.id}, this.value)"></td>
            <td><input type="number" step="0.01" value="${p.agio_padrao ?? ''}" placeholder="padrão global"
                       style="width: 100px;"
                       onchange="salvarAgioPadraoParceiro(${p.id}, this.value)"></td>
            <td>${p.ativo ? '🟢 Ativo' : '🔴 Desligado'}</td>
            <td><button class="btn btn-clear" onclick="alternarParceiroAtivo(${p.id}, ${!p.ativo})">
                ${p.ativo ? 'Desligar todas' : 'Religar'}
            </button></td>
        </tr>
    `).join('');
}

async function salvarLinkParceiro(id, valor) {
    const { error } = await supabaseClient.from('parceiros').update({ link: valor || null }).eq('id', id);
    if (error) mostrarErro(adminError, 'Erro ao salvar link: ' + error.message);
}

async function salvarAgioPadraoParceiro(id, valor) {
    const agio_padrao = valor === '' ? null : parseFloat(valor);
    const { error } = await supabaseClient.from('parceiros').update({ agio_padrao }).eq('id', id);
    if (error) mostrarErro(adminError, 'Erro ao salvar ágio padrão: ' + error.message);
}

async function alternarParceiroAtivo(id, novoValor) {
    if (!novoValor && !confirm('Desligar todas as cartas deste parceiro no site público?')) return;
    const { error } = await supabaseClient.from('parceiros').update({ ativo: novoValor }).eq('id', id);
    if (error) {
        mostrarErro(adminError, 'Erro ao atualizar parceiro: ' + error.message);
        return;
    }
    carregarParceiros();
}

// ---- Configurações ----

async function carregarConfiguracoes() {
    const { data, error } = await supabaseClient
        .from('configuracoes')
        .select('*')
        .eq('chave', 'agio_padrao')
        .single();
    if (error) {
        mostrarErro(adminError, 'Erro ao carregar configurações: ' + error.message);
        return;
    }
    document.getElementById('agioPadraoGlobalInput').value = data.valor;
}

document.getElementById('salvarConfigBtn').addEventListener('click', async () => {
    const valor = document.getElementById('agioPadraoGlobalInput').value;
    if (valor === '' || isNaN(parseFloat(valor))) {
        mostrarErro(adminError, 'Informe um valor numérico para o ágio padrão global.');
        return;
    }
    const { error } = await supabaseClient.from('configuracoes').update({ valor }).eq('chave', 'agio_padrao');
    if (error) {
        mostrarErro(adminError, 'Erro ao salvar configuração: ' + error.message);
        return;
    }
    alert('Configuração salva!');
});

verificarSessao();
