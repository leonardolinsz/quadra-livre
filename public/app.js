// ===== SPORTS DATA =====
const sports = [
    { name: "Futsal", emoji: "\u26BD", players: "5 por equipe", time: "2x 20 min", key: "futsal",
      desc: "Agilidade pura. Toque de bola e pensamento rapido ditam o ritmo. 5 de cada lado e a bola ja pode rolar." },
    { name: "Society", emoji: "\uD83E\uDD45", players: "6 por equipe", time: "2x 25 min", key: "society",
      desc: "Uma das modalidades mais populares. 6 de um lado, 6 de outro. Bota a bola no chao que tem gente de proximo." },
    { name: "Futebol Campo", emoji: "\uD83C\uDFDF\uFE0F", players: "11 por equipe", time: "2x 45 min", key: "campo",
      desc: "O jogo que passa todo final de semana na TV. Chama 10 amigos e fecha a sua selecao!" },
    { name: "Basquete", emoji: "\uD83C\uDFC0", players: "5 por equipe", time: "4x 10 min", key: "basquete",
      desc: "Tradicional 5 contra 5 ou 3 contra 3 que esta ficando cada vez mais famoso. Voce escolhe." },
    { name: "Volei", emoji: "\uD83C\uDFD0", players: "6 por equipe", time: "Melhor de 5 sets", key: "volei",
      desc: "O segundo esporte mais praticado no mundo! Na areia ou na quadra, de bracos abertos pra todo mundo." },
    { name: "Tenis", emoji: "\uD83C\uDFBE", players: "1 ou 2", time: "Melhor de 3 sets", key: "tenis",
      desc: "Individual ou duplas, o que voce precisa e da bola e raquete. Referencia Guga nas quadras." },
    { name: "Handebol", emoji: "\uD83E\uDD3E", players: "7 por equipe", time: "2x 30 min", key: "handebol",
      desc: "Rapidez e pensamento coletivo. Mao em mao com placares bem elasticos. Vem pra quadra!" },
    { name: "Futevolei", emoji: "\uD83C\uDFD6\uFE0F", players: "2 ou 4", time: "Melhor de 3 sets", key: "futevolei",
      desc: "100% brasileiro! Mistura de futebol com volei que deu muito certo. Se joga!" }
];

const SPORT_KEYWORDS = {
    futsal: /futsal|soccer|football|multi/i,
    society: /society|soccer|football|multi/i,
    campo: /soccer|football|multi/i,
    basquete: /basketball|multi/i,
    volei: /volleyball|beachvolleyball|multi/i,
    tenis: /tennis|multi/i,
    handebol: /handball|multi/i,
    futevolei: /beachvolleyball|futnet|multi/i
};

// Estado global
let allPlaces = [];
let bairroPlaces = []; // quadras da busca por bairro
let currentBairro = ''; // bairro selecionado atualmente
let bairroLoading = false;

// ===== INIT =====
async function init() {
    renderSports();
    renderCadastradas();
    setupBairroAutocomplete();
    initScrollObserver();
    setupFilters();
    await loadInitialQuadras();
}

// ===== CARREGAR QUADRAS =====
async function loadQuadras(lat, lon, radius) {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set('lat', lat);
    if (lon !== undefined) params.set('lon', lon);
    if (radius !== undefined) params.set('radius', radius);
    const url = '/api/quadras' + (params.toString() ? '?' + params : '');

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        return data.places || [];
    } catch (err) {
        throw err;
    }
}

async function loadInitialQuadras() {
    try {
        document.getElementById('resultsContent').innerHTML = `
            <div class="results-loading">
                <div class="spinner"></div>
                <p>Carregando quadras de Sao Paulo...</p>
            </div>`;

        allPlaces = await loadQuadras();

        // Stats
        const bairros = extractBairros(allPlaces);
        document.getElementById('statQuadras').textContent = allPlaces.length + '+';
        document.getElementById('statBairros').textContent = bairros.length + '+';

        // Popular filtro de bairros
        populateBairroFilter(bairros);

        // Renderizar
        applyFilters();
    } catch (err) {
        document.getElementById('resultsContent').innerHTML = `
            <div class="no-results">
                <div class="icon">&#9888;&#65039;</div>
                <h3>Erro ao carregar</h3>
                <p>${esc(err.message)}</p>
                <button class="btn-submit" style="max-width:200px;margin:20px auto 0" onclick="loadInitialQuadras()">Tentar novamente</button>
            </div>`;
        document.getElementById('resultsTitle').textContent = 'Erro ao carregar quadras';
    }
}

// Busca quadras ampliada para um bairro específico
async function loadBairroQuadras(bairroName) {
    if (bairroLoading) return;
    bairroLoading = true;

    try {
        document.getElementById('resultsContent').innerHTML = `
            <div class="results-loading">
                <div class="spinner"></div>
                <p>Buscando quadras na regiao de ${esc(bairroName)}...</p>
            </div>`;
        document.getElementById('resultsTitle').innerHTML = `Buscando na regiao de ${esc(bairroName)}...`;

        // Geocodificar o bairro
        const geoResp = await fetch(`/api/search?q=${encodeURIComponent(bairroName + ' Sao Paulo Brasil')}`);
        const geoData = await geoResp.json();

        if (!geoData.length) {
            // Fallback: filtrar só com os dados que já temos
            bairroPlaces = [];
            currentBairro = bairroName;
            applyFilters();
            return;
        }

        const { lat, lon } = geoData[0];

        // Buscar quadras num raio de 15km centrado no bairro
        const places = await loadQuadras(parseFloat(lat), parseFloat(lon), 15000);
        bairroPlaces = places;
        currentBairro = bairroName;

        // Atualizar filtro de bairros com os novos dados
        const mergedBairros = extractBairros([...allPlaces, ...bairroPlaces]);
        populateBairroFilter(mergedBairros);

        applyFilters();
    } catch (err) {
        // Em caso de erro, usa apenas dados locais
        bairroPlaces = [];
        currentBairro = bairroName;
        applyFilters();
    } finally {
        bairroLoading = false;
    }
}

// ===== BAIRROS =====
function extractBairros(places) {
    const set = {};
    places.forEach(p => {
        if (p.bairro) {
            const key = p.bairro.trim().toLowerCase();
            if (!set[key]) set[key] = { name: p.bairro.trim(), count: 0 };
            set[key].count++;
        }
    });
    return Object.values(set).sort((a, b) => b.count - a.count);
}

function populateBairroFilter(bairros) {
    const datalist = document.getElementById('bairrosList');
    datalist.innerHTML = '';
    bairros.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = `${b.name} (${b.count})`;
        datalist.appendChild(opt);
    });
}

// ===== FILTROS =====

function setupFilters() {
    document.getElementById('filterSport').addEventListener('change', applyFilters);

    const bairroInput = document.getElementById('filterBairro');
    // Só busca ao selecionar do datalist (change) ou pressionar Enter — nunca enquanto digita
    bairroInput.addEventListener('change', () => handleBairroChange());
    bairroInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleBairroChange();
        }
    });
    bairroInput.addEventListener('input', () => {
        // Se limpou o campo, volta pro dataset original
        if (!bairroInput.value.trim()) {
            currentBairro = '';
            bairroPlaces = [];
            applyFilters();
        }
    });

    document.getElementById('filterNome').addEventListener('input', applyFilters);
}

async function handleBairroChange() {
    const bairroName = document.getElementById('filterBairro').value.trim();

    if (!bairroName) {
        currentBairro = '';
        bairroPlaces = [];
        applyFilters();
        return;
    }

    if (bairroName.toLowerCase() === currentBairro.toLowerCase()) {
        // Já buscou esse bairro
        applyFilters();
        return;
    }

    // Bairro selecionado — busca quadras ampliadas na região
    await loadBairroQuadras(bairroName);
}

function applyFilters() {
    const sportKey = document.getElementById('filterSport').value;
    const bairroName = document.getElementById('filterBairro').value;
    const nome = document.getElementById('filterNome').value.trim().toLowerCase();

    // Se tem bairro selecionado, usa merge de allPlaces + bairroPlaces (sem duplicatas por lat/lon)
    let sourcePlaces;
    if (bairroName && bairroPlaces.length > 0) {
        const seen = new Set();
        sourcePlaces = [];
        [...bairroPlaces, ...allPlaces].forEach(p => {
            const key = `${p.lat},${p.lon}`;
            if (!seen.has(key)) { seen.add(key); sourcePlaces.push(p); }
        });
    } else {
        sourcePlaces = allPlaces;
    }

    let filtered = sourcePlaces.filter(p => {
        // Filtro sport
        if (sportKey && SPORT_KEYWORDS[sportKey]) {
            if (p.sport) {
                if (!SPORT_KEYWORDS[sportKey].test(p.sport)) return false;
            } else {
                return false; // sem tag de sport = exclui quando filtra por sport
            }
        }
        // Filtro bairro — se selecionado, filtra por match no campo bairro OU inclui quadras sem bairro (da região certa)
        if (bairroName) {
            const bLower = bairroName.toLowerCase();
            // Inclui: quadras com bairro igual OU quadras sem bairro (vieram da busca da região)
            if (p.bairro && p.bairro.toLowerCase() !== bLower) return false;
        }
        // Filtro nome
        if (nome && !(p.name && p.name.toLowerCase().includes(nome))) return false;
        return true;
    });

    // Quadras cadastradas pela comunidade
    const cadastradas = JSON.parse(localStorage.getItem('joga_quadras') || '[]');
    let localFiltered = cadastradas;
    if (nome) localFiltered = localFiltered.filter(q => q.nome.toLowerCase().includes(nome));
    if (bairroName) localFiltered = localFiltered.filter(q => q.bairro && q.bairro.toLowerCase() === bairroName.toLowerCase());

    renderResults(filtered, localFiltered, sportKey, bairroName, nome);
}

// ===== TAGS HELPERS =====
function getSurfaceTag(surface) {
    const map = {
        grass: 'Gramado natural', artificial_turf: 'Sintetico', asphalt: 'Concreto',
        concrete: 'Concreto', clay: 'Saibro', sand: 'Areia', wood: 'Salao',
        tartan: 'Salao', acrylic: 'Salao', rubber: 'Salao',
        fine_gravel: 'Areia', earth: 'Gramado natural'
    };
    return map[surface] || null;
}

function getSportTag(sport) {
    if (!sport) return null;
    const map = {
        soccer: 'Society', futsal: 'Futsal', football: 'Society',
        basketball: 'Basquete', volleyball: 'Volei',
        beachvolleyball: 'Futevolei', tennis: 'Tenis',
        handball: 'Handebol', multi: 'Poliesportiva',
        swimming: null, fitness: null, gymnastics: null
    };
    const tags = [];
    sport.split(';').forEach(s => {
        const t = s.trim();
        // Tentar match direto
        if (map[t] !== undefined) {
            if (map[t] && !tags.includes(map[t])) tags.push(map[t]);
        } else {
            // Tentar match parcial (ex: society_soccer -> Society)
            for (const [key, label] of Object.entries(map)) {
                if (label && t.includes(key) && !tags.includes(label)) tags.push(label);
            }
        }
    });
    return tags.length > 0 ? tags : null;
}

function getAccessTag(access, fee) {
    if (access === 'private' || access === 'customers') return 'Privada';
    if (access === 'yes' || access === 'public' || fee === 'no') return 'Publica';
    if (fee === 'yes') return 'Privada';
    return null;
}

function buildTags(place) {
    const tags = [];
    const sportTags = getSportTag(place.sport);
    if (sportTags) tags.push(...sportTags);
    const surfaceTag = getSurfaceTag(place.surface);
    if (surfaceTag) tags.push(surfaceTag);
    const accessTag = getAccessTag(place.access, place.fee);
    if (accessTag) tags.push(accessTag);
    return tags;
}

// ===== RENDER =====
function renderResults(places, localResults, sportKey, bairro, nome) {
    const title = document.getElementById('resultsTitle');
    const content = document.getElementById('resultsContent');
    const totalCount = places.length + localResults.length;

    // Montar titulo descritivo
    let desc = `<span>${totalCount}</span> quadra${totalCount !== 1 ? 's' : ''}`;
    const sportLabel = sportKey ? sports.find(s => s.key === sportKey)?.name : '';
    if (sportLabel) desc += ` de ${sportLabel}`;
    if (bairro) desc += ` em ${bairro}`;
    if (nome) desc += ` com "${esc(nome)}"`;
    if (!sportKey && !bairro && !nome) desc += ' em Sao Paulo';
    title.innerHTML = desc;

    if (totalCount === 0) {
        content.innerHTML = `
            <div class="no-results">
                <div class="icon">\uD83D\uDE14</div>
                <h3>Nenhuma quadra encontrada</h3>
                <p>Tente mudar os filtros ou cadastre uma quadra!</p>
                <a href="#cadastrar" class="btn-submit" style="max-width:280px;margin:20px auto 0;display:block;text-align:center">Cadastrar Quadra</a>
            </div>`;
        return;
    }

    let html = '<div class="results-grid">';

    places.forEach(p => {
        const name = p.name || 'Quadra esportiva';
        const tags = buildTags(p);
        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
        const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;

        html += `
        <div class="court-card">
            <div class="court-photo">
                <div class="no-photo">\uD83C\uDFDF\uFE0F</div>
            </div>
            <div class="court-body">
                <h4>${esc(name)}</h4>
                ${p.bairro ? `<div class="court-bairro"><span class="pin-icon">&#128205;</span>${esc(p.bairro)}</div>` : ''}
                ${p.address ? `<div class="court-address">${esc(p.address)}</div>` : ''}
                ${tags.length ? `<div class="court-types">${tags.map(t => `<span class="court-type-tag">${t}</span>`).join('')}</div>` : ''}
                ${p.openingHours ? `<div class="court-hours">&#128336; ${esc(p.openingHours)}</div>` : ''}
                ${p.phone ? `<div class="court-phone">&#128222; ${esc(p.phone)}</div>` : ''}
                <div class="court-actions">
                    <a href="${routeUrl}" target="_blank" class="btn-maps">Rotas</a>
                    <a href="${gmapsUrl}" target="_blank" class="btn-route">Ver no Mapa</a>
                </div>
            </div>
        </div>`;
    });

    localResults.forEach(q => {
        const addr = q.endereco + (q.bairro ? ' \u2014 ' + q.bairro : '');
        const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
        const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

        html += `
        <div class="court-card">
            <div class="court-photo">
                <div class="no-photo" style="background:linear-gradient(135deg,var(--green-dark),var(--green))">\u2B50</div>
                <span class="court-status unknown">Comunidade</span>
            </div>
            <div class="court-body">
                <h4>${esc(q.nome)}</h4>
                ${q.bairro ? `<div class="court-bairro"><span class="pin-icon">&#128205;</span>${esc(q.bairro)}</div>` : ''}
                <div class="court-address">${esc(q.endereco)}</div>
                ${q.preco ? `<div class="court-price"><strong>${esc(q.preco)}</strong> /hora</div>` : ''}
                <div class="court-types"><span class="court-type-tag">Por ${esc(q.cadastradoPor)}</span></div>
                <div class="court-actions">
                    <a href="${routeUrl}" target="_blank" class="btn-maps">Rotas</a>
                    <a href="${gmapsUrl}" target="_blank" class="btn-route">Ver no Mapa</a>
                </div>
            </div>
        </div>`;
    });

    html += '</div>';
    content.innerHTML = html;
}

// ===== RENDER SPORTS =====
function renderSports() {
    document.getElementById('sportsGrid').innerHTML = sports.map(s => `
        <div class="sport-card fade-in">
            <div class="sport-card-header">
                <span class="sport-emoji">${s.emoji}</span>
                <h3>${s.name}</h3>
            </div>
            <div class="sport-card-body">
                <div class="sport-info">
                    <div class="sport-info-item">
                        <div class="label">Jogadores</div>
                        <div class="value">${s.players}</div>
                    </div>
                    <div class="sport-info-item">
                        <div class="label">Duracao</div>
                        <div class="value">${s.time}</div>
                    </div>
                </div>
                <p>${s.desc}</p>
                <a href="#quadras-section" class="btn-buscar" onclick="prefillFilter('${s.key}')">Buscar quadras</a>
            </div>
        </div>
    `).join('');
}

function prefillFilter(key) {
    document.getElementById('filterSport').value = key;
    applyFilters();
}

// ===== CADASTRO =====
function handleCadastro(e) {
    e.preventDefault();
    const quadra = {
        nome: document.getElementById('quadraNome').value.trim(),
        endereco: document.getElementById('quadraEndereco').value.trim(),
        bairro: document.getElementById('quadraBairro').value.trim(),
        preco: document.getElementById('quadraPreco').value.trim(),
        cadastradoPor: document.getElementById('cadastroNome').value.trim(),
        data: new Date().toISOString()
    };
    const lista = JSON.parse(localStorage.getItem('joga_quadras') || '[]');
    lista.unshift(quadra);
    localStorage.setItem('joga_quadras', JSON.stringify(lista));
    e.target.reset();
    renderCadastradas();
    applyFilters(); // Atualizar listagem
    showToast('Quadra cadastrada com sucesso!', 'success');
}

function renderCadastradas() {
    const lista = JSON.parse(localStorage.getItem('joga_quadras') || '[]');
    const container = document.getElementById('cadastradasList');
    if (lista.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma quadra cadastrada ainda. Seja o primeiro!</div>';
        return;
    }
    container.innerHTML = lista.map(q => {
        const date = new Date(q.data).toLocaleDateString('pt-BR');
        return `
        <div class="cadastrada-item">
            <div class="cadastrada-info">
                <h4>${esc(q.nome)}</h4>
                <p>${esc(q.endereco)}${q.bairro ? ' \u2014 ' + esc(q.bairro) : ''} &middot; por ${esc(q.cadastradoPor)}</p>
            </div>
            <div class="cadastrada-meta">
                ${q.preco ? `<div class="price">${esc(q.preco)}</div>` : ''}
                <div>${date}</div>
            </div>
        </div>`;
    }).join('');
}

function setupBairroAutocomplete() {
    const input = document.getElementById('quadraBairro');
    const box = document.getElementById('bairroSuggestions');
    if (!input || !box) return;
    input.addEventListener('focus', () => showSuggestions(input, box));
    input.addEventListener('input', () => showSuggestions(input, box));
    input.addEventListener('blur', () => setTimeout(() => box.classList.remove('open'), 150));
}

function showSuggestions(input, box) {
    const bairros = extractBairros(allPlaces);
    // Adicionar bairros das cadastradas
    const cadastradas = JSON.parse(localStorage.getItem('joga_quadras') || '[]');
    cadastradas.forEach(q => {
        if (q.bairro) {
            const key = q.bairro.trim().toLowerCase();
            const existing = bairros.find(b => b.name.toLowerCase() === key);
            if (!existing) bairros.push({ name: q.bairro.trim(), count: 1 });
        }
    });

    if (bairros.length === 0) { box.classList.remove('open'); return; }
    const filter = input.value.trim().toLowerCase();
    const filtered = (filter ? bairros.filter(b => b.name.toLowerCase().includes(filter)) : bairros).slice(0, 15);
    if (filtered.length === 0) { box.classList.remove('open'); return; }
    box.innerHTML = `<div class="suggestion-header">Bairros disponiveis</div>` +
        filtered.map(b =>
            `<div class="suggestion" onmousedown="document.getElementById('${input.id}').value='${b.name.replace(/'/g, "\\'")}';this.parentElement.classList.remove('open')">
                <span>${b.name}</span>

            </div>`
        ).join('');
    box.classList.add('open');
}

// ===== UTILS =====
function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast show ${type || ''}`;
    setTimeout(() => t.classList.remove('show'), 3500);
}

function toggleMobile() {
    document.getElementById('mobileMenu').classList.toggle('open');
    document.getElementById('mobileOverlay').classList.toggle('show');
}

window.addEventListener('scroll', () => {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 40);
});

const navLinks = document.querySelectorAll('.desktop-nav a');
window.addEventListener('scroll', () => {
    let current = 'home';
    document.querySelectorAll('section[id]').forEach(s => {
        if (window.scrollY >= s.offsetTop - 200) current = s.id;
    });
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
});

function initScrollObserver() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.08 });
    document.querySelectorAll('.fade-in').forEach(el => obs.observe(el));
    setTimeout(() => document.querySelectorAll('.fade-in').forEach(el => obs.observe(el)), 200);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.getElementById('mobileMenu').classList.remove('open');
        document.getElementById('mobileOverlay').classList.remove('show');
    }
});

init();
