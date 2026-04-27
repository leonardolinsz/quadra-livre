const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const EXCLUDE_SPORTS = /swimming|fitness|gymnastics|climbing|equestrian|golf|skating|athletics|cycling|running/i;

async function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
}

// Cache por região (chave = "lat,lon,radius")
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function cacheKey(lat, lon, radius) {
    return `${lat.toFixed(3)},${lon.toFixed(3)},${radius}`;
}

async function fetchQuadras(lat, lon, radius) {
    const key = cacheKey(lat, lon, radius);
    const cached = cache.get(key);
    if (cached && (Date.now() - cached.time) < CACHE_TTL) {
        return { places: cached.places, cached: true };
    }

    const r = radius;
    const query = `[out:json][timeout:20];(node["leisure"="pitch"](around:${r},${lat},${lon});way["leisure"="pitch"](around:${r},${lat},${lon});node["leisure"="sports_centre"](around:${r},${lat},${lon});way["leisure"="sports_centre"](around:${r},${lat},${lon}););out center 300;`;

    let lastError = null;

    for (const mirror of OVERPASS_MIRRORS) {
        try {
            console.log(`Buscando quadras (${lat.toFixed(3)},${lon.toFixed(3)} r=${r}) via ${mirror.split('//')[1].split('/')[0]}...`);
            const resp = await fetchWithTimeout(mirror, {
                method: 'POST',
                headers: { 'User-Agent': 'QuadraLivre/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(query)}`
            }, 25000);
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

            cache.set(key, { places, time: Date.now() });
            console.log(`${places.length} quadras encontradas e cacheadas (key=${key}).`);
            return { places, cached: false };
        } catch (err) {
            lastError = err.name === 'AbortError' ? 'timeout' : err.message;
            continue;
        }
    }
    throw new Error(`Servidores indisponiveis. ${lastError}`);
}

// Geocoder local de bairros SP (fallback quando Nominatim falha)
const BAIRROS_SP = {
    'brooklin': { lat: -23.6247, lon: -46.6952 },
    'moema': { lat: -23.6008, lon: -46.6640 },
    'pinheiros': { lat: -23.5630, lon: -46.6930 },
    'vila mariana': { lat: -23.5890, lon: -46.6370 },
    'itaim bibi': { lat: -23.5850, lon: -46.6760 },
    'perdizes': { lat: -23.5340, lon: -46.6860 },
    'santana': { lat: -23.5050, lon: -46.6260 },
    'tatuape': { lat: -23.5410, lon: -46.5760 },
    'vila olimpia': { lat: -23.5970, lon: -46.6860 },
    'campo belo': { lat: -23.6190, lon: -46.6650 },
    'lapa': { lat: -23.5240, lon: -46.7090 },
    'butanta': { lat: -23.5690, lon: -46.7280 },
    'jabaquara': { lat: -23.6400, lon: -46.6380 },
    'santo amaro': { lat: -23.6540, lon: -46.6990 },
    'saude': { lat: -23.6240, lon: -46.6260 },
    'consolacao': { lat: -23.5530, lon: -46.6560 },
    'bela vista': { lat: -23.5570, lon: -46.6460 },
    'liberdade': { lat: -23.5600, lon: -46.6330 },
    'paraiso': { lat: -23.5740, lon: -46.6430 },
    'vila madalena': { lat: -23.5530, lon: -46.6950 },
    'morumbi': { lat: -23.6020, lon: -46.7200 },
    'barra funda': { lat: -23.5200, lon: -46.6760 },
    'penha': { lat: -23.5320, lon: -46.5350 },
    'pirituba': { lat: -23.4840, lon: -46.7400 },
    'cambuci': { lat: -23.5700, lon: -46.6230 },
    'ipiranga': { lat: -23.5890, lon: -46.6060 },
    'aclimacao': { lat: -23.5720, lon: -46.6350 },
    'jardim paulista': { lat: -23.5710, lon: -46.6680 },
    'vila prudente': { lat: -23.5830, lon: -46.5800 },
    'interlagos': { lat: -23.6830, lon: -46.6840 },
    'capao redondo': { lat: -23.6680, lon: -46.7710 },
    'cidade dutra': { lat: -23.7060, lon: -46.6750 },
    'grajaú': { lat: -23.7410, lon: -46.6800 },
    'tucuruvi': { lat: -23.4780, lon: -46.6060 },
    'casa verde': { lat: -23.5030, lon: -46.6570 },
    'vila sonia': { lat: -23.5950, lon: -46.7370 },
    'jardins': { lat: -23.5670, lon: -46.6660 },
    'higienopolis': { lat: -23.5440, lon: -46.6590 },
    'pompeia': { lat: -23.5310, lon: -46.6860 },
    'agua rasa': { lat: -23.5590, lon: -46.5720 },
    'brás': { lat: -23.5430, lon: -46.6110 },
};

function localGeocode(query) {
    const q = query.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+sao\s+paulo.*$/i, '').trim();
    for (const [name, coords] of Object.entries(BAIRROS_SP)) {
        const nameNorm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (q.includes(nameNorm) || nameNorm.includes(q)) {
            return [{ lat: String(coords.lat), lon: String(coords.lon), display_name: name }];
        }
    }
    return null;
}

// Geocoding via Nominatim (com fallback local)
app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&countrycodes=br`;
        const resp = await fetchWithTimeout(url, { headers: { 'User-Agent': 'QuadraLivre/1.0' } }, 8000);
        const data = await resp.json();
        if (data.length) return res.json(data);
        // Nominatim retornou vazio, tentar local
        const local = localGeocode(q);
        return res.json(local || []);
    } catch (err) {
        // Nominatim falhou, tentar geocoder local
        const local = localGeocode(q);
        if (local) return res.json(local);
        res.status(500).json({ error: err.message });
    }
});

// Quadras - aceita lat/lon/radius opcionais (default: SP centro, 15km)
app.get('/api/quadras', async (req, res) => {
    const lat = parseFloat(req.query.lat) || -23.5505;
    const lon = parseFloat(req.query.lon) || -46.6333;
    const radius = parseInt(req.query.radius) || 15000;

    try {
        const result = await fetchQuadras(lat, lon, radius);
        res.json({ places: result.places, total: result.places.length, cached: result.cached });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

process.on('uncaughtException', err => console.error('Uncaught:', err.message));
process.on('unhandledRejection', err => console.error('Unhandled:', err));

app.listen(PORT, () => console.log(`Quadra Livre rodando na porta ${PORT}`));
