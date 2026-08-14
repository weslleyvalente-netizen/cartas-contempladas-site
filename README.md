# cartas-contempladas-site

Site público de cotas de consórcio contempladas (Moto e Trilha). Site
estático puro — sem build, sem backend, sem dependências. Substitui
`cartascontempladasmt.manus.space`.

## Como funciona

`app.js` busca dados de duas tabelas Supabase (`cartas_parceiros` e
`cartas_proprias`), mescla-as no navegador e renderiza tudo. A tabela
`cartas_parceiros` é mantida pelo robô do repositório `cartas-sync`
(GitHub Actions); `cartas_proprias` é gerenciada à mão via painel
`/admin`. Uma terceira tabela, `parceiros`, armazena padrões de ágio por
parceiro; `configuracoes` armazena o ágio padrão global.

As credenciais Supabase (URL do projeto e chave anon pública) estão em
`supabase-config.js`. É seguro commitar — o Row Level Security no banco
é o verdadeiro limite de acesso, não o segredo da chave.

### Painel admin

O painel admin está em `/admin` (servido por `admin.html`, resolvido via
`cleanUrls` em `vercel.json`). Requer login com Supabase Auth — usa a
mesma conta que o admin do `catalogo-motos-site` (mesmo projeto Supabase,
mesma função `is_admin()`).

### Testes

```bash
npm test
```

Roda a suite Vitest para `cartas-logic.js` (lógica pura de resolução de
ágio e merge). É tooling apenas de desenvolvimento — o site deployado
continua sem build step.

## Rodar localmente

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000/`.

## Deploy

Sem build step — qualquer hospedagem de site estático serve (Vercel,
Netlify, GitHub Pages, etc.). Ao conectar este repositório na Vercel ou
Netlify, não é necessário configurar nenhum "build command": é só apontar
para a raiz do repositório.

Domínio: `cartas.motoetrilha.com.br` (configurado à parte, via DNS no
registro.br apontando para a hospedagem escolhida).
