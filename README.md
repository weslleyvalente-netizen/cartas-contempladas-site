# cartas-contempladas-site

Site público de cotas de consórcio contempladas (Moto e Trilha). Site
estático puro — sem build, sem backend, sem dependências. Substitui
`cartascontempladasmt.manus.space`.

## Como funciona

`app.js` busca os dados direto de uma planilha Google Sheets publicada
como CSV (a mesma URL que o site no Manus já usava) e renderiza tudo no
navegador. Quem mantém essa planilha atualizada é o robô do repositório
`cartas-sync` (GitHub Actions), não este site.

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
