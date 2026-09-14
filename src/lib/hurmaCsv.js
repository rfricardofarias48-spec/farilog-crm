// ── Parser do formato EXATO das listas de prospecção (padrão Hurma) ─────────
// Estrutura do arquivo (sempre igual):
//   linha 1: cabeçalho     → ,Empresa,Cidade,Nicho,Telefone,OBS:,Contato em:
//   linha 2: sub-cabeçalho → ,Empresa,Cidade,Segmento,Telefone,,
//   dados:                 → [nº, Empresa, Cidade, Nicho, Telefone, OBS, Contato em]
// Peculiaridades tratadas:
//   • Campos com vírgula entre aspas ("Sulacres Indústria, Comércio e ...")
//   • Linhas sem cidade (nicho/telefone deslocados uma coluna para a esquerda)
//   • Telefones com observação: "(51) 3470-9000 (Gravataí)", múltiplos números, 0800
//   • Codificação UTF-8 ou Windows-1252 (Excel BR) e separador vírgula/ponto-e-vírgula

function parseCsvText(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const looksPhone = (s) => !!s && (/\(\d{2}\)/.test(s) || /\b0800\b/.test(s) || /\d{4,5}-\d{4}/.test(s));

function mapHurmaRow(cols) {
  const clean = (v) => (v || '').trim();
  let empresa = clean(cols[1]), cidade = clean(cols[2]), nicho = clean(cols[3]);
  let telefone = clean(cols[4]), obs = clean(cols[5]), contatoEm = clean(cols[6]);
  if (!empresa || /^empresa$/i.test(empresa)) return null; // cabeçalho / linha vazia
  // Linha desalinhada (sem cidade): o telefone caiu uma coluna para a esquerda
  if (!telefone && looksPhone(nicho)) { telefone = nicho; nicho = cidade; cidade = ''; }
  else if (!telefone && looksPhone(cidade)) { telefone = cidade; cidade = ''; }
  return { empresa, cidade, nicho, telefone, obs, contatoEm };
}

export const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
export const phoneDigits = (s) => (s || '').replace(/\D/g, '').slice(0, 11);
export const dedupKey = (empresa, telefone) => `${norm(empresa)}|${phoneDigits(telefone)}`;

export function parseHurmaCsv(text) {
  const firstLine = text.split('\n', 1)[0];
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = parseCsvText(text, delim);
  const out = [], seen = new Set();
  let dupBatch = 0, skipped = 0;
  for (const cols of rows) {
    const rec = mapHurmaRow(cols);
    if (!rec) { skipped++; continue; }
    const key = dedupKey(rec.empresa, rec.telefone);
    if (seen.has(key)) { dupBatch++; continue; }
    seen.add(key);
    out.push(rec);
  }
  return { records: out, dupBatch, skipped };
}

// Leitura do File (browser): UTF-8 com fallback para Windows-1252 (Excel BR)
export async function readCsvFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return text;
}
