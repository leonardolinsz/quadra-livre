<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/express-4.21-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenStreetMap-Overpass_API-7EBC6F?style=flat-square&logo=openstreetmap&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
</p>

<h1 align="center">🏐 Quadra Livre</h1>

<p align="center">
  <strong>Encontre quadras esportivas perto de você — sem cadastro, sem API key, 100% gratuito.</strong>
</p>

<p align="center">
  Buscador de quadras esportivas que utiliza dados abertos do OpenStreetMap<br/>
  para localizar campos, quadras e arenas em qualquer região de São Paulo.
</p>

---

## 🎯 O que é

**Quadra Livre** é um site que resolve um problema simples: _"onde eu jogo hoje?"_

Ele busca automaticamente quadras esportivas cadastradas no OpenStreetMap num raio de **15km**, mostrando endereço, esporte, horários, telefone e links diretos para o Google Maps. Sem necessidade de API key — tudo funciona com dados abertos.

## ✨ Funcionalidades

| Feature | Descrição |
|---|---|
| 🔍 **Busca automática** | Carrega quadras de SP automaticamente ao abrir o site |
| 📍 **Busca por bairro** | Digita o bairro → geocodifica → busca 15km ao redor dele |
| 🏀 **Filtro por esporte** | Futebol, Basquete, Vôlei, Tênis, Society, Futsal e mais |
| 🔤 **Busca por nome** | Filtra quadras pelo nome em tempo real |
| 🗺️ **Google Maps** | Links diretos para rotas e visualização no mapa |
| 📋 **Cadastro comunitário** | Cadastre quadras que não estão no OpenStreetMap |
| ⚡ **Cache inteligente** | Resultados ficam em cache por 10 min no servidor |
| 🪞 **3 mirrors Overpass** | Fallback automático entre servidores da Overpass API |
| 📱 **Responsivo** | Funciona em desktop e mobile |

## 🖼️ Preview

```
┌──────────────────────────────────────────────────────┐
│  🏐 Quadra Livre                                     │
│                                                      │
│  "Encontre quadras esportivas perto de você"         │
│                                                      │
│  [Esporte ▼]  [Bairro...]  [Buscar por nome...]      │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Campo    │ │ Quadra   │ │ Arena    │              │
│  │ Colorado │ │ Society  │ │ EZTC     │              │
│  │ 📍Brooklin│ │ 📍Moema  │ │ 📍Brooklin│              │
│  │ Futebol  │ │ Society  │ │ Futsal   │              │
│  │ [Rotas]  │ │ [Rotas]  │ │ [Rotas]  │              │
│  └──────────┘ └──────────┘ └──────────┘              │
└──────────────────────────────────────────────────────┘
```

## 🏗️ Arquitetura

```
Cliente (browser)                     Servidor (Express)
┌─────────────┐                      ┌─────────────────┐
│  index.html │  GET /api/quadras    │   server.js     │
│  app.js     │ ──────────────────►  │                 │
│  styles.css │                      │  ┌────────────┐ │
│             │  ◄──────────────────  │  │ Cache 10m  │ │
│  Filtros:   │      JSON response   │  └────────────┘ │
│  - Esporte  │                      │        │        │
│  - Bairro   │                      │        ▼        │
│  - Nome     │                      │  Overpass API   │
└─────────────┘                      │  (3 mirrors)    │
                                     │        │        │
                                     │  Nominatim API  │
                                     │  (geocoding)    │
                                     └─────────────────┘
```

**Fluxo da busca por bairro:**

1. Usuário digita "Brooklin" no filtro
2. `app.js` envia `GET /api/quadras?bairro=Brooklin`
3. `server.js` geocodifica "Brooklin" via Nominatim → `(-23.62, -46.68)`
4. Busca quadras no Overpass API num raio de 15km centrado nessas coordenadas
5. Retorna JSON com nome, endereço, esporte, horário, telefone, coordenadas
6. `app.js` renderiza cards com links Google Maps

## 🚀 Como rodar

```bash
# Clone o repositório
git clone <repo-url>
cd quadra-livre

# Instale dependências
npm install

# Inicie o servidor
npm start
```

Acesse **http://localhost:3000**

> Não precisa de API key — o projeto usa exclusivamente APIs abertas (OpenStreetMap, Nominatim, Overpass).

## 📁 Estrutura

```
quadra-livre/
├── server.js          # Servidor Express — proxy Overpass + Nominatim + cache
├── package.json
├── public/
│   ├── index.html     # Página principal
│   ├── app.js         # Lógica do frontend — filtros, renderização, geocoding
│   └── styles.css     # Estilos — tema verde escuro, cards, responsivo
└── README.md
```

## 🔧 Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML + CSS + JavaScript (vanilla, sem framework)
- **Dados:** OpenStreetMap via Overpass API (POST, 3 mirrors com fallback)
- **Geocoding:** Nominatim + fallback hardcoded de bairros de SP
- **Mapas:** Google Maps (links externos para rotas e visualização)

## 📝 Notas

- Os dados vêm do OpenStreetMap — a cobertura depende de quanto foi mapeado na região
- O cache do servidor dura 10 minutos por região (chave = coordenadas arredondadas)
- A Overpass API tem rate limiting — o cache e os 3 mirrors ajudam a evitar bloqueios
- Bairros de SP têm coordenadas hardcoded como fallback caso o Nominatim esteja lento

---

<p align="center">
  Feito com ☕ para quem só quer encontrar uma quadra e jogar.
</p>
