# Quadra Livre

Buscador de quadras esportivas do Brasil. Busca via Google Places API, cadastro comunitário e contato.

## Setup local

```bash
npm install
npm start
```

Acesse `http://localhost:3000`

## Deploy no Render

1. Crie um **Web Service** no [Render](https://render.com)
2. Conecte este repositório
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node

## Google Places API Key

Para busca real de quadras, configure a variável `GOOGLE_API_KEY` no arquivo `public/index.html` ou use o modal de configuração no próprio site.
