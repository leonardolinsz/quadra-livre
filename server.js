const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OVERPASS_MIRRORS = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
];

const EXCLUDE_SPORTS = /swimming|fitness|gymnastics|climbing|equestrian|golf|skating|athletics|cycling|running/i;

async function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
}

// Cache em memória pra não bater no Overpass toda hora
let cachedPlaces = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 min

app.get('/api/quadras', async (req, res) => {
    const now = Date.now();
    if (cachedPlaces && (now - cacheTime) < CACHE_TTL) {
        return res.json({ places: cachedPlaces, total: cachedPlaces.length, cached: true });
    }

    // Busca quadras de São Paulo inteiro (raio 15km do centro)
    const lat = -23.5505;
    const lon = -46.6333;
    const r = 15000;
    const query = `[out:json][timeout:25];(node["leisure"="pitch"](around:${r},${lat},${lon});way["leisure"="pitch"](around:${r},${lat},${lon});node["leisure"="sports_centre"](around:${r},${lat},${lon});way["leisure"="sports_centre"](around:${r},${lat},${lon}););out center 200;`;

    let lastError = null;

    for (const mirror of OVERPASS_MIRRORS) {
        try {
            const url = `${mirror}?data=${encodeURIComponent(query)}`;
            console.log(`Carregando quadras SP via ${mirror.split('//')[1].split('/')[0]}...`);
            const resp = await fetchWithTimeout(url, { headers: { 'User-Agent': 'QuadraLivre/1.0' } }, 20000);
            if (!resp.ok) { lastError = `HTTP ${resp.status}`; continue; }

            const data = await resp.json();

            const places = (data.elements || []).map(el => {
                const tags = el.tags || {};
                const sport = tags.sport || '';
                if (sport && EXCLUDE_SPORTS.test(sport)) return null;

                return {
                    name: tags.name || tags['name:pt'] || tags.description || '',
                    sport,
                    surface: tags.surface || '',
                    leisure: tags.leisure || '',
                    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', '),
                    bairro: tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district'] || '',
                    city: tags['addr:city'] || '',
                    lat: el.lat || el.center?.lat,
                    lon: el.lon || el.center?.lon,
                    openingHours: tags.opening_hours || '',
                    phone: tags.phone || '',
                    access: tags.access || '',
                    fee: tags.fee || ''
                };
            }).filter(p => p && p.lat && p.lon);

            cachedPlaces = places;
            cacheTime = now;
            console.log(`${places.length} quadras carregadas e cacheadas.`);
            return res.json({ places, total: places.length, cached: false });
        } catch (err) {
            lastError = err.name === 'AbortError' ? 'timeout' : err.message;
            continue;
        }
    }
    res.status(502).json({ error: `Servidores indisponiveis. ${lastError}` });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

process.on('uncaughtException', err => console.error('Uncaught:', err.message));
process.on('unhandledRejection', err => console.error('Unhandled:', err));

app.listen(PORT, () => console.log(`Quadra Livre rodando na porta ${PORT}`));
