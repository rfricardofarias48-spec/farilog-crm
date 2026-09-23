// ── Cliente da API Apify ────────────────────────────────────────────────────
// Geração de leads qualificados por nicho + cidade via scrapers de Google Maps.
// Fluxo: dispara a execução do actor → acompanha até terminar → baixa os lugares
// encontrados → mapeia para o formato das listas de prospecção (crm_prospectas).
//
// A API do Apify responde com Access-Control-Allow-Origin: *, então o navegador
// pode chamá-la diretamente, sem backend.

const APIFY_API = 'https://api.apify.com/v2';

// Token da conta Apify. Lido da variável de ambiente VITE_APIFY_TOKEN (arquivo
// .env local, que não é versionado — o GitHub bloqueia pushs com tokens na ação
// de secret scanning). Pode ser trocado a qualquer momento nas configurações da
// aba Apify; nesse caso passa a valer o salvo no navegador, sem redeploy.
const LS_TOKEN = 'apify_token';
const LS_ACTOR = 'apify_actor';

const ENV_TOKEN = import.meta.env.VITE_APIFY_TOKEN || '';

// Scrapers de Google Maps disponíveis na conta. Os dois do catálogo "compass"
// compartilham o formato de entrada (searchStringsArray + locationQuery) e de
// saída (title, city, categoryName, phone...), verificado em execuções reais.
export const ACTORS = [
  { id: 'nwua9Gu5YrADL7ZDj', name: 'crawler-google-places',  label: 'Google Maps Scraper' },
  { id: '2Mdma1N6Fd0y3QEjR', name: 'google-maps-extractor',  label: 'Google Maps Extractor' },
];
const DEFAULT_ACTOR = ACTORS[0].id;

export function getToken() {
  return localStorage.getItem(LS_TOKEN) || ENV_TOKEN;
}
export function setToken(token) {
  if (token && token.trim()) localStorage.setItem(LS_TOKEN, token.trim());
  else localStorage.removeItem(LS_TOKEN);
}
export function getActorId() {
  const id = localStorage.getItem(LS_ACTOR);
  return ACTORS.some(a => a.id === id) ? id : DEFAULT_ACTOR;
}
export function setActorId(id) {
  localStorage.setItem(LS_ACTOR, id);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function erroResposta(res, fallback) {
  let detalhe = '';
  try {
    const j = await res.json();
    detalhe = j?.error?.message || j?.message || '';
  } catch { /* resposta sem corpo JSON */ }
  return detalhe ? `${fallback} (${detalhe})` : fallback;
}

// Confere se o token é válido listando os actors usados pela conta.
export async function testarToken(token = getToken()) {
  try {
    const res = await fetch(`${APIFY_API}/actors?token=${encodeURIComponent(token)}&limit=1`);
    if (!res.ok) return { ok: false, erro: await erroResposta(res, 'Token recusado pelo Apify') };
    const j = await res.json();
    return { ok: true, total: j?.data?.total ?? null };
  } catch (e) {
    return { ok: false, erro: `Sem conexão com o Apify: ${e.message}` };
  }
}

// Telefones chegam no formato internacional ("+55 51 3469-2433" / "+555134692433").
// Normaliza para o padrão BR usado nas listas: "(51) 3469-2433". Vazio se não for discável.
export function normApifyPhone(raw) {
  if (!raw) return '';
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2); // tira o +55
  d = d.slice(0, 11);
  if (d.length !== 10 && d.length !== 11) return '';
  const ddd = d.slice(0, 2);
  const num = d.slice(2);
  return num.length === 9
    ? `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
    : `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
}

// Um lugar do Google Maps → registro no formato das listas de prospecção.
export function mapPlaceToProspect(p) {
  const nicho = p.categoryName
    || (Array.isArray(p.categories) && p.categories[0])
    || (Array.isArray(p.categories) && p.categories.join(', '))
    || '';
  const pedacos = [];
  if (p.website)   pedacos.push(`Site: ${p.website}`);
  if (p.address)   pedacos.push(`Endereço: ${p.address}`);
  if (p.totalScore) pedacos.push(`Avaliação: ${p.totalScore}${p.reviewsCount ? ` (${p.reviewsCount} avaliações)` : ''}`);
  return {
    empresa:   (p.title || '').trim(),
    cidade:    (p.city || '').trim(),
    nicho:     String(nicho).trim(),
    telefone:  normApifyPhone(p.phoneUnformatted || p.phone),
    telefone2: '',
    obs:       pedacos.join(' · '),
    contatoEm: '',
    fonte:     'apify',
  };
}

const STATUS_PT = {
  READY:        'na fila',
  RUNNING:      'raspando lugares',
  SUCCEEDED:    'concluída',
  FAILED:       'com erro',
  TIMED_OUT:    'no tempo limite',
  ABORTED:      'cancelada',
};

// Dispara o scraper, acompanha a execução e devolve os lugares encontrados.
// `onStatus(status, encontrados)` informa o progresso para a UI; `signal` permite
// cancelar a espera (AbortController).
export async function runScraper({ actorId = getActorId(), token = getToken(), input, onStatus, signal }) {
  const base = `${APIFY_API}/acts/${actorId}`;

  onStatus?.('Iniciando execução no Apify...', 0);
  let res = await fetch(`${base}/runs?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) throw new Error(await erroResposta(res, 'Não foi possível iniciar a execução'));
  const runId = (await res.json()).data.id;

  // Polling até a execução chegar a um estado final (intervalo de 5s — as execuções
  // de Google Maps costumam levar de 1 a 3 min).
  const finais = ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'];
  let status = 'RUNNING', datasetId = null, encontrados = 0, tentativas = 0;
  while (!finais.includes(status)) {
    await sleep(5000);
    tentativas++;
    if (tentativas > 240) throw new Error('Tempo limite (20 min) aguardando a execução');
    res = await fetch(`${base}/runs/${runId}?token=${encodeURIComponent(token)}`, { signal });
    if (!res.ok) throw new Error(await erroResposta(res, 'Não foi possível acompanhar a execução'));
    const run = (await res.json()).data;
    status = run.status;
    datasetId = run.defaultDatasetId;
    if (datasetId && status === 'RUNNING') {
      // o itemCount do dataset cresce conforme os lugares são encontrados
      try {
        const dr = await fetch(`${APIFY_API}/datasets/${datasetId}?token=${encodeURIComponent(token)}`, { signal });
        if (dr.ok) encontrados = (await dr.json()).data.itemCount ?? encontrados;
      } catch { /* ignora: o dataset pode não existir ainda */ }
    }
    onStatus?.(STATUS_PT[status] || status, encontrados);
  }

  if (status !== 'SUCCEEDED') throw new Error(`A execução terminou ${STATUS_PT[status] || status.toLowerCase()}`);

  onStatus?.('Baixando os lugares encontrados...', encontrados);
  res = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=1&limit=1000`, { signal });
  if (!res.ok) throw new Error(await erroResposta(res, 'Não foi possível baixar os resultados'));
  const items = await res.json();

  return { items, runId, datasetId, total: items.length };
}

// Cancela uma execução em andamento (botão "Cancelar" durante a busca).
export async function abortarRun(actorId, runId, token = getToken()) {
  try {
    const res = await fetch(`${APIFY_API}/acts/${actorId}/runs/${runId}/abort?token=${encodeURIComponent(token)}`, { method: 'POST' });
    return res.ok;
  } catch { return false; }
}

// Entrada padrão do scraper — espelha as execuções já usadas na conta
// (busca por termos na cidade, em português, ignorando lugares fechados).
export function inputPadrao({ searchStringsArray, locationQuery, maxCrawledPlacesPerSearch }) {
  return {
    searchStringsArray,
    locationQuery,
    maxCrawledPlacesPerSearch: Number(maxCrawledPlacesPerSearch) || 30,
    language: 'pt-BR',
    countryCode: 'br',
    skipClosedPlaces: true,
    website: 'allPlaces',
    searchMatching: 'all',
    scrapeContacts: false,
    scrapePlaceDetailPage: false,
    scrapeReviewsPersonalData: false,
    scrapeImageAuthors: false,
    maxReviews: 0,
    maxImages: 0,
    maxQuestions: 0,
  };
}
