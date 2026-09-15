import { useState, useEffect, useMemo } from 'react';
import {
  fetchCrmProspectas, createCrmProspectasBulk, updateCrmProspecta, deleteCrmProspecta,
  createCrmLead, updateCrmLead, createCrmEvento,
} from './lib/db';
import { parseHurmaCsv, readCsvFile, phoneDigits, firstPhoneDigits } from './lib/hurmaCsv';
import {
  PhoneCall, Upload as UploadIcon, FileSpreadsheet, Search, X, Trash2,
  CalendarClock, CalendarDays, Check, ChevronRight, Phone, MapPin, Building2, PartyPopper,
  SlidersHorizontal,
} from 'lucide-react';

const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// ── Status dos leads de prospecção ──────────────────────────────────────────
const STATUS = {
  novo:          { label: 'A contatar',      color: '#64748B', bg: '#F1F5F9' },
  interessado:   { label: 'Interessado',     color: '#059669', bg: '#ECFDF5' },
  sem_interesse: { label: 'Sem interesse',   color: '#DC2626', bg: '#FEF2F2' },
  nao_atendeu:   { label: 'Não atendeu',     color: '#D97706', bg: '#FFFBEB' },
  retornar:      { label: 'Retornar em',     color: '#7C3AED', bg: '#F5F3FF' },
  reuniao:       { label: 'Reunião agendada', color: '#0891B2', bg: '#ECFEFF' },
};
const statusInfo = (s) => STATUS[s] || STATUS.novo;

// Contatos na fila de prospecção: novos, "retornar em" vencido e "não atendeu" de dias
// anteriores — quem não atendeu hoje volta automaticamente para a fila no dia seguinte
const naFila = (p) =>
  p.status === 'novo'
  || (p.status === 'retornar' && (!p.retornoEm || p.retornoEm <= TODAY_ISO))
  || (p.status === 'nao_atendeu' && p.ultimoContato && p.ultimoContato < TODAY_ISO);

function fmtDDMM(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function isoAddDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Lead que atendeu e demonstrou interesse vira um lead no Pipeline (CRM)
// `extra` sobrescreve campos — usado quando a reunião é agendada direto no fluxo (etapa 'reuniao' + data/hora)
async function moverParaPipeline(lead, empresaAtiva, extra = {}) {
  const obs = [`Origem: Prospecção${lead.lista ? ` (${lead.lista})` : ''}`];
  if (lead.nicho) obs.push(`Nicho: ${lead.nicho}`);
  if (lead.obs)   obs.push(lead.obs);
  return createCrmLead({
    nomeEmpresa:   lead.empresa,
    contato:       '',
    telefone:      lead.telefone,
    cidade:        lead.cidade,
    quantidade:    0,
    etapa:         'novo',
    tipo:          'diaria',
    ultimoContato: TODAY_ISO,
    observacoes:   obs.join(' · '),
    empresa:       empresaAtiva || 'Farilog',
    ...extra,
  });
}

// ── Gráficos do dashboard (SVG/CSS puros, sem dependências) ────────────────
function BarChartLigacoes({ prospectas }) {
  const days = useMemo(() => {
    const counts = {};
    for (const p of prospectas) if (p.ultimoContato) counts[p.ultimoContato] = (counts[p.ultimoContato] || 0) + 1;
    return Array.from({ length: 14 }, (_, i) => {
      const iso = isoAddDays(TODAY_ISO, i - 13);
      return { iso, count: counts[iso] || 0 };
    });
  }, [prospectas]);
  const max = Math.max(1, ...days.map(d => d.count));
  return (
    <div className="prosp-bars">
      {days.map(d => (
        <div key={d.iso} className="prosp-bar-col" title={`${fmtDDMM(d.iso)} — ${d.count} ligação(ões)`}>
          <div className="prosp-bar-track">
            <div className="prosp-bar-fill" style={{ height: `${(d.count / max) * 100}%` }}>
              {d.count > 0 && <span className="prosp-bar-num">{d.count}</span>}
            </div>
          </div>
          <p className="prosp-bar-label">{Number(d.iso.slice(8))}</p>
        </div>
      ))}
    </div>
  );
}

function DonutStatus({ prospectas }) {
  const segs = Object.entries(STATUS).map(([k, v]) => ({
    key: k, label: v.label, color: v.color,
    value: prospectas.filter(p => p.status === k).length,
  }));
  const total = prospectas.length;
  const R = 40, CIRC = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="prosp-donut-wrap">
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg viewBox="0 0 120 120" className="prosp-donut-svg">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#EEF2F7" strokeWidth="20" />
          {total > 0 && segs.filter(s => s.value > 0).map(s => {
            const frac = s.value / total;
            const dash = Math.max(0.5, frac * CIRC - 2.5);
            const el = (
              <circle key={s.key} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="20"
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset={-acc * CIRC} transform="rotate(-90 60 60)" />
            );
            acc += frac;
            return el;
          })}
        </svg>
        <div className="prosp-donut-center">
          <p className="prosp-donut-total">{total}</p>
          <p className="prosp-donut-label">LEADS</p>
        </div>
      </div>
      <div className="prosp-donut-legenda">
        {segs.map(s => {
          const pct = total ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.key} className="prosp-leg-row">
              <div className="prosp-leg-top">
                <span className="prosp-leg-dot" style={{ background: s.color }} />
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{s.label}</span>
                <span className="ml-auto font-bold" style={{ color: s.value > 0 ? s.color : 'var(--faint)' }}>{s.value}</span>
                <span style={{ color: 'var(--faint)', fontSize: 11, width: 36, textAlign: 'right' }}>{pct}%</span>
              </div>
              <div className="prosp-leg-track">
                <div className="prosp-leg-fill" style={{ width: `${pct}%`, background: s.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Card({ icon: Icon, label, value, sub, tone = 'var(--signal)' }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: tone }} />
        <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{label}</p>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: 'var(--faint)' }}>{sub}</p>}
    </div>
  );
}

function ProspDashboard({ prospectas }) {
  const hoje = TODAY_ISO;
  const contatadasHoje = prospectas.filter(p => p.ultimoContato === hoje);
  const porStatus = (s) => prospectas.filter(p => p.status === s).length;
  const atendentes = contatadasHoje.filter(p => p.status === 'interessado' || p.status === 'sem_interesse' || p.status === 'retornar' || p.status === 'reuniao').length;

  return (
    <div className="page-fill space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Dashboard de Prospecção</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Resumo das ligações e do funil de contatos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card icon={Building2}       label="Base de leads"     value={prospectas.length} sub="total importado" />
        <Card icon={PhoneCall}       label="Ligados hoje"      value={contatadasHoje.length} sub={`${atendentes} atenderam`} tone="#0891B2" />
        <Card icon={Check}           label="Interessados"      value={porStatus('interessado')} sub="para levar ao pipeline" tone="#059669" />
        <Card icon={X}               label="Sem interesse"     value={porStatus('sem_interesse')} sub="descartados" tone="#DC2626" />
        <Card icon={Phone}           label="Não atendeu"       value={porStatus('nao_atendeu')} sub="tentar de novo depois" tone="#D97706" />
        <Card icon={CalendarClock}   label="A contatar"        value={porStatus('novo')} sub="nunca ligados" tone="#64748B" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ flex: 1, minHeight: 0, maxHeight: 430 }}>
        <div className="card prosp-chart-card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Ligações — últimos 14 dias</p>
            <span className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>
              {prospectas.filter(p => p.ultimoContato >= isoAddDays(TODAY_ISO, -13)).length} no período
            </span>
          </div>
          <BarChartLigacoes prospectas={prospectas} />
        </div>
        <div className="card prosp-chart-card">
          <p className="text-sm font-bold mb-4" style={{ color: 'var(--text)' }}>Distribuição por status</p>
          <DonutStatus prospectas={prospectas} />
        </div>
      </div>
    </div>
  );
}

// ── Edição de um lead ────────────────────────────────────────────────────────
function LeadEditModal({ lead, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.empresa.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>Editar Lead</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)' }}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Empresa *</label>
            <input className="input-field" value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Cidade</label>
              <input className="input-field" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Nicho</label>
              <input className="input-field" value={form.nicho} onChange={e => setForm(f => ({ ...f, nicho: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Telefone</label>
              <input className="input-field" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Lista</label>
              <input className="input-field" value={form.lista} onChange={e => setForm(f => ({ ...f, lista: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Status</label>
              <select className="input-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Últ. contato</label>
              <input type="date" className="input-field" value={form.ultimoContato} onChange={e => setForm(f => ({ ...f, ultimoContato: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Retornar em</label>
              <input type="date" className="input-field" value={form.retornoEm} onChange={e => setForm(f => ({ ...f, retornoEm: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Observações</label>
            <textarea className="input-field" rows={2} value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button className="btn-danger flex items-center gap-1.5" onClick={() => onDelete(lead.id)}>
              <Trash2 size={13} /> Excluir
            </button>
            <div className="flex-1" />
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={saving || !form.empresa.trim()} onClick={handleSave}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leads (lista de contatos feitos, filtro único discreto) ─────────────────
function ProspLeads({ prospectas, setProspectas, empresaAtiva }) {
  const [busca, setBusca]   = useState('');
  const [fCidade, setFCidade] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fLista, setFLista]   = useState('');
  const [somenteContatados, setSomenteContatados] = useState(true);
  const [popAberto, setPopAberto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cidades = useMemo(() => [...new Set(prospectas.map(p => p.cidade).filter(Boolean))].sort(), [prospectas]);
  const listas  = useMemo(() => [...new Set(prospectas.map(p => p.lista).filter(Boolean))].sort(), [prospectas]);

  const nFiltros = (busca ? 1 : 0) + (fCidade ? 1 : 0) + (fStatus ? 1 : 0) + (fLista ? 1 : 0);
  const limparFiltros = () => { setBusca(''); setFCidade(''); setFStatus(''); setFLista(''); };

  const filtrados = prospectas.filter(p =>
    (!somenteContatados || p.status !== 'novo') &&
    (!busca   || `${p.empresa} ${p.nicho} ${p.telefone}`.toLowerCase().includes(busca.toLowerCase())) &&
    (!fCidade || p.cidade === fCidade) &&
    (!fStatus || p.status === fStatus) &&
    (!fLista  || p.lista === fLista)
  );

  const handleSave = async (form) => {
    const original = editando;
    setProspectas(prev => prev.map(p => p.id === form.id ? { ...p, ...form } : p));
    setEditando(null);
    await updateCrmProspecta(form.id, form);
    if (form.status === 'interessado' && original && original.status !== 'interessado') {
      await moverParaPipeline(form, empresaAtiva);
    }
  };
  const handleDelete = async (id) => {
    setProspectas(prev => prev.filter(p => p.id !== id));
    setEditando(null);
    await deleteCrmProspecta(id);
  };

  const selStyle = { fontSize: 12, padding: '8px 10px' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Leads</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {filtrados.length} {somenteContatados ? 'contatos feitos' : 'leads'} — clique para editar status e contato
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <button className="prosp-filter-btn" onClick={() => setPopAberto(v => !v)}>
            <SlidersHorizontal size={13} /> Filtros
            {nFiltros > 0 && <span className="prosp-filter-badge">{nFiltros}</span>}
          </button>
          {popAberto && (
            <>
              <div className="prosp-filter-backdrop" onClick={() => setPopAberto(false)} />
              <div className="prosp-filter-pop">
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
                  <input className="input-field" style={{ ...selStyle, paddingLeft: 30 }} placeholder="Buscar empresa, nicho, telefone..." value={busca} onChange={e => setBusca(e.target.value)} />
                </div>
                <select className="input-field" style={selStyle} value={fCidade} onChange={e => setFCidade(e.target.value)}>
                  <option value="">Todas as cidades</option>
                  {cidades.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="input-field" style={selStyle} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="input-field" style={selStyle} value={fLista} onChange={e => setFLista(e.target.value)}>
                  <option value="">Todas as listas</option>
                  {listas.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <label className="prosp-filter-toggle">
                  <input type="checkbox" checked={somenteContatados} onChange={e => setSomenteContatados(e.target.checked)} />
                  Mostrar apenas já contatados
                </label>
                {nFiltros > 0 && (
                  <button className="prosp-filter-clear" onClick={limparFiltros}>Limpar filtros</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="card py-14 text-center">
          <Building2 size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {prospectas.length === 0
              ? 'Nenhum lead importado ainda — use a sub-aba "Upload de Listas".'
              : somenteContatados && !prospectas.some(p => p.status !== 'novo')
                ? 'Nenhum contato feito ainda — comece em "Prospecção Ativa".'
                : 'Nenhum lead com esses filtros.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden scroll-x">
          <div style={{ minWidth: 860 }}>
            <div className="meta-thead prosp-leads-thead px-5 py-3 grid text-xs font-semibold" style={{ gridTemplateColumns: '1.6fr 110px 1fr 190px 90px 130px 110px', gap: '8px' }}>
              <span>Empresa</span><span>Cidade</span><span>Nicho</span><span>Telefone</span><span>Últ. contato</span><span>Status</span><span>Lista</span>
            </div>
            {filtrados.map((p, idx) => {
              const st = statusInfo(p.status);
              const venc = p.status === 'retornar' && (!p.retornoEm || p.retornoEm <= TODAY_ISO);
              return (
                <div key={p.id} className={`meta-row prosp-leads-row ${idx % 2 === 1 ? 'alt' : ''}`}
                  style={{ gridTemplateColumns: '1.6fr 110px 1fr 190px 90px 130px 110px', gap: '8px', borderBottom: idx < filtrados.length - 1 ? '1px solid var(--line)' : 'none' }}
                  onClick={() => setEditando(p)}>
                  <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{p.empresa}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.cidade || '—'}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{p.nicho || '—'}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--signalDeep)' }}>{p.telefone || '—'}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.ultimoContato ? fmtDDMM(p.ultimoContato) : '—'}</span>
                  <span>
                    <span className="prosp-pill" style={{ background: st.bg, color: venc ? '#DC2626' : st.color }}>
                      {st.label}{p.status === 'retornar' && p.retornoEm ? ` ${fmtDDMM(p.retornoEm)}` : ''}
                    </span>
                  </span>
                  <span className="text-xs truncate" style={{ color: 'var(--faint)' }}>{p.lista || '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editando && (
        <LeadEditModal lead={editando} onClose={() => setEditando(null)} onSave={handleSave} onDelete={handleDelete} />
      )}
    </div>
  );
}

// ── Upload de listas (formato Hurma) ─────────────────────────────────────────
function ProspUpload({ prospectas, setProspectas }) {
  const [fileName, setFileName]     = useState('');
  const [listaNome, setListaNome]   = useState('');
  const [preview, setPreview]       = useState(null); // { records, dupBatch, dupDb, skipped, erros }
  const [importando, setImportando] = useState(false);
  const [msg, setMsg]               = useState('');
  const [erro, setErro]             = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setErro(''); setMsg(''); setPreview(null);
    setFileName(file.name);
    const nomePadrao = file.name.replace(/\.(csv|txt)$/i, '').replace(/^Lista\s+/i, '');
    setListaNome(nomePadrao);
    try {
      const text = await readCsvFile(file);
      const { records, dupBatch, skipped } = parseHurmaCsv(text);
      // Análise de todos os contatos: número inválido, repetido no arquivo ou já passado pelo sistema
      const digitosNoApp = new Set(prospectas.map(p => firstPhoneDigits(p.telefone)).filter(Boolean));
      const vistosNoArquivo = new Set();
      const novos = [];
      const invalidos = [];
      let dupDb = 0, dupFile = 0;
      for (const r of records) {
        const d = firstPhoneDigits(r.telefone);
        if (!d) { invalidos.push(r); continue; }                 // sem número discável
        if (digitosNoApp.has(d)) { dupDb++; continue; }           // já passou pelo sistema
        if (vistosNoArquivo.has(d)) { dupFile++; continue; }      // repetido dentro do arquivo
        vistosNoArquivo.add(d);
        novos.push(r);
      }
      if (novos.length === 0 && records.length === 0) {
        setErro('Nenhuma linha de dados encontrada. O arquivo precisa estar no formato da lista padrão (Empresa, Cidade, Nicho, Telefone, OBS, Contato em).');
        return;
      }
      setPreview({ records: novos, dupBatch: dupBatch + dupFile, dupDb, skipped, invalidos });
    } catch (e) {
      setErro(`Não foi possível ler o arquivo: ${e.message}`);
    }
  };

  const handleImport = async () => {
    if (!preview || !listaNome.trim()) return;
    setImportando(true); setErro('');
    const ok = await createCrmProspectasBulk(preview.records.map(r => ({ ...r, lista: listaNome.trim() })));
    setImportando(false);
    if (!ok) { setErro('Falha ao importar. Verifique sua conexão e se a tabela crm_prospectas foi criada no Supabase.'); return; }
    const atualizadas = await fetchCrmProspectas();
    setProspectas(atualizadas);
    setMsg(`${preview.records.length} leads importados da lista "${listaNome.trim()}".`);
    setPreview(null); setFileName(''); setListaNome('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Upload de Listas</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Formato padrão: Empresa · Cidade · Nicho · Telefone · OBS · Contato em (planilha Hurma exportada em CSV)</p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <label className="prosp-drop">
          <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          {fileName
            ? <><FileSpreadsheet size={26} style={{ color: 'var(--signal)' }} /><span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{fileName}</span><span className="text-xs" style={{ color: 'var(--muted)' }}>clique para trocar o arquivo</span></>
            : <><UploadIcon size={26} style={{ color: 'var(--faint)' }} /><span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Selecionar arquivo CSV</span><span className="text-xs" style={{ color: 'var(--muted)' }}>A lista será lida no formato padrão da Hurma</span></>}
        </label>

        {erro && <p className="text-xs font-semibold mt-3" style={{ color: '#DC2626' }}>{erro}</p>}
        {msg && <p className="text-xs font-semibold mt-3" style={{ color: 'var(--ok)' }}>{msg}</p>}

        {preview && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="prosp-stat" style={{ borderColor: 'var(--signal)' }}>
                <p className="prosp-stat-num" style={{ color: 'var(--signalDeep)' }}>{preview.records.length}</p>
                <p className="prosp-stat-label">novos para importar</p>
              </div>
              <div className="prosp-stat"><p className="prosp-stat-num" style={{ color: '#D97706' }}>{preview.dupBatch}</p><p className="prosp-stat-label">repetidos no arquivo</p></div>
              <div className="prosp-stat"><p className="prosp-stat-num" style={{ color: '#7C3AED' }}>{preview.dupDb}</p><p className="prosp-stat-label">já passaram pelo sistema</p></div>
              <div className="prosp-stat"><p className="prosp-stat-num" style={{ color: '#DC2626' }}>{preview.invalidos.length}</p><p className="prosp-stat-label">números inválidos</p></div>
              <div className="prosp-stat"><p className="prosp-stat-num" style={{ color: 'var(--faint)' }}>{preview.skipped}</p><p className="prosp-stat-label">linhas ignoradas</p></div>
            </div>

            {preview.invalidos.length > 0 && (
              <div className="card" style={{ background: '#FEF2F2', border: '1px solid #FECACA', boxShadow: 'none', padding: '10px 14px' }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#DC2626' }}>
                  {preview.invalidos.length} contato(s) sem número discável (foram descartados):
                </p>
                <p className="text-xs" style={{ color: '#B91C1C' }}>
                  {preview.invalidos.slice(0, 6).map(r => r.empresa).join(' · ')}
                  {preview.invalidos.length > 6 && ` · +${preview.invalidos.length - 6} outros`}
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Nome da lista *</label>
              <input className="input-field" value={listaNome} onChange={e => setListaNome(e.target.value)} placeholder="Ex.: Hurma Página 1" style={{ maxWidth: 360 }} />
            </div>

            <div className="card" style={{ background: '#F8FAFC', boxShadow: 'none', padding: 0, overflow: 'hidden' }}>
              <div className="meta-thead px-4 py-2.5 grid text-xs font-semibold" style={{ gridTemplateColumns: '1.6fr 100px 1fr 170px', gap: '8px' }}>
                <span>Empresa</span><span>Cidade</span><span>Nicho</span><span>Telefone</span>
              </div>
              {preview.records.slice(0, 8).map((r, i) => (
                <div key={i} className="grid items-center px-4 py-2 text-xs" style={{ gridTemplateColumns: '1.6fr 100px 1fr 170px', gap: '8px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                  <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{r.empresa}</span>
                  <span style={{ color: 'var(--muted)' }}>{r.cidade || '—'}</span>
                  <span className="truncate" style={{ color: 'var(--muted)' }}>{r.nicho || '—'}</span>
                  <span className="font-semibold" style={{ color: 'var(--signalDeep)' }}>{r.telefone || '—'}</span>
                </div>
              ))}
              {preview.records.length > 8 && (
                <p className="text-xs px-4 py-2" style={{ color: 'var(--faint)' }}>+ {preview.records.length - 8} outros...</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1" />
              <button className="btn-ghost" onClick={() => { setPreview(null); setFileName(''); }}>Cancelar</button>
              <button className="btn-primary flex items-center gap-1.5" disabled={importando || !listaNome.trim() || preview.records.length === 0} onClick={handleImport}>
                <UploadIcon size={14} /> {importando ? 'Importando...' : `Importar ${preview.records.length} leads`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Prospecção Ativa (um contato por vez) ────────────────────────────────────

// Caixa de detalhes do agendamento: confirma data/hora/local antes de criar o
// compromisso na Agenda e mandar o lead quente para o Pipeline (etapa Reunião)
function ReuniaoModal({ lead, onClose, onConfirm }) {
  const [data, setData]   = useState('');
  const [hora, setHora]   = useState('09:00');
  const [local, setLocal] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!data || !hora) { setError('Informe a data e o horário da reunião.'); return; }
    setSaving(true);
    await onConfirm({ data, hora, local });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 430 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <CalendarDays size={17} style={{ color: '#0891B2' }} /> Agendar Reunião
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)' }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          <b style={{ color: 'var(--text)' }}>{lead.empresa}</b>{lead.cidade ? ` · ${lead.cidade}` : ''} — a reunião será criada na <b>Agenda</b> e o lead enviado ao <b>Pipeline</b> na etapa "Reunião".
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Data *</label>
            <input type="date" className="input-field" value={data} min={TODAY_ISO} onChange={e => { setData(e.target.value); setError(''); }} autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Horário *</label>
            <input type="time" className="input-field" value={hora} onChange={e => { setHora(e.target.value); setError(''); }} />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Local / link (opcional)</label>
          <input className="input-field" value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Google Meet, visita presencial..." />
        </div>
        {error && <p className="text-xs font-semibold mt-3" style={{ color: 'var(--danger, #DC2626)' }}>{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Agendando...' : 'Agendar reunião'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProspFluxo({ prospectas, setProspectas, empresaAtiva }) {
  const [cidade, setCidade]   = useState('');
  const [obs, setObs]         = useState('');
  const [retornoData, setRetornoData] = useState('');
  const [aviso, setAviso]     = useState('');
  const [reuniaoAberta, setReuniaoAberta] = useState(false);

  const cidades = useMemo(() => {
    const map = {};
    for (const p of prospectas) {
      const c = p.cidade || 'Sem cidade';
      map[c] ||= { total: 0, fila: 0 };
      map[c].total++;
      if (naFila(p)) map[c].fila++;
    }
    return Object.entries(map).sort((a, b) => b[1].fila - a[1].fila);
  }, [prospectas]);

  const fila = useMemo(() => {
    if (!cidade) return [];
    return prospectas
      .filter(p => (p.cidade || 'Sem cidade') === cidade)
      .filter(naFila);
  }, [cidade, prospectas]);

  const totalCidade = prospectas.filter(p => (p.cidade || 'Sem cidade') === cidade).length;
  const atual = fila[0];
  const feitos = totalCidade - fila.length;

  const registrar = async (status) => {
    if (!atual) return;
    const patch = { status, ultimoContato: TODAY_ISO, retornoEm: status === 'retornar' ? (retornoData || TODAY_ISO) : '', obs: obs || atual.obs };
    setProspectas(prev => prev.map(p => p.id === atual.id ? { ...p, ...patch } : p));
    setObs(''); setRetornoData('');
    await updateCrmProspecta(atual.id, patch);
    if (status === 'interessado' && atual.status !== 'interessado') {
      const criado = await moverParaPipeline({ ...atual, ...patch }, empresaAtiva);
      setAviso(criado ? `"${atual.empresa}" foi enviado ao Pipeline (CRM)` : 'Lead marcado, mas falhou ao criar no Pipeline — confira a empresa ativa');
    } else {
      setAviso('');
    }
  };

  // Reunião agendada no fluxo: lead quente vai para o Pipeline na etapa "Reunião"
  // e um compromisso é criado na Agenda, vinculado ao lead pelo eventoId
  const agendarReuniao = async ({ data, hora, local }) => {
    if (!atual) return;
    const patch = { status: 'reuniao', ultimoContato: TODAY_ISO, retornoEm: '', obs: obs || atual.obs };
    setProspectas(prev => prev.map(p => p.id === atual.id ? { ...p, ...patch } : p));
    setReuniaoAberta(false);
    setObs(''); setRetornoData('');
    await updateCrmProspecta(atual.id, patch);

    const obsLead = [`Origem: Prospecção${atual.lista ? ` (${atual.lista})` : ''}`];
    if (atual.nicho) obsLead.push(`Nicho: ${atual.nicho}`);
    if (local)       obsLead.push(`Local: ${local}`);
    if (obs)         obsLead.push(obs);

    const lead = await moverParaPipeline({ ...atual, ...patch }, empresaAtiva, {
      etapa: 'reuniao', reuniaoData: data, reuniaoHora: hora, observacoes: obsLead.join(' · '),
    });
    const evento = await createCrmEvento({
      titulo:    `Reunião — ${atual.empresa}`,
      data, hora,
      descricao: [atual.cidade && `Cidade: ${atual.cidade}`, atual.telefone && `Tel: ${atual.telefone}`, local && `Local: ${local}`, obs].filter(Boolean).join(' · '),
      cor:       '#7C3AED',
      empresa:   empresaAtiva || 'Farilog',
    });
    if (lead && evento) await updateCrmLead(lead.id, { eventoId: evento.id });

    setAviso(lead && evento
      ? `"${atual.empresa}" — reunião ${fmtDDMM(data)} às ${hora}: no Pipeline (etapa Reunião) e na Agenda`
      : 'Reunião registrada na prospecção, mas falhou ao enviar para o Pipeline/Agenda — confira a empresa ativa');
  };

  if (!cidade) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Prospecção Ativa</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Escolha a cidade — o app mostra um contato por vez</p>
        </div>
        {cidades.length === 0 ? (
          <div className="card py-14 text-center">
            <MapPin size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum lead na base. Importe uma lista primeiro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cidades.map(([c, v]) => (
              <button key={c} className="prosp-cidade-card" onClick={() => setCidade(c)} disabled={v.fila === 0}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold" style={{ color: v.fila === 0 ? 'var(--faint)' : 'var(--text)' }}>{c}</p>
                  {v.fila > 0 ? <ChevronRight size={15} style={{ color: 'var(--signal)' }} /> : <Check size={15} style={{ color: 'var(--ok)' }} />}
                </div>
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                  <b style={{ color: v.fila > 0 ? 'var(--signalDeep)' : 'var(--ok)' }}>{v.fila}</b> na fila · {v.total} leads
                </p>
                <div className="prosp-bar"><div className="prosp-bar-fill" style={{ width: `${v.total ? (v.total - v.fila) / v.total * 100 : 0}%` }} /></div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!atual) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Prospecção — {cidade}</h2>
          <button className="btn-ghost" onClick={() => setCidade('')}>Trocar cidade</button>
        </div>
        <div className="card py-16 text-center">
          <PartyPopper size={30} className="mx-auto mb-3" style={{ color: 'var(--ok)' }} />
          <p className="text-base font-bold" style={{ color: 'var(--text)' }}>Fila de {cidade} zerada!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{totalCidade} leads sem pendência hoje — quem não atendeu volta automaticamente amanhã.</p>
        </div>
      </div>
    );
  }

  const telLink = `tel:+55${phoneDigits(atual.telefone)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Prospecção — {cidade}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{feitos} de {totalCidade} nesta cidade</p>
        </div>
        <button className="btn-ghost" onClick={() => setCidade('')}>Trocar cidade</button>
      </div>

      <div className="prosp-bar" style={{ height: 8 }}><div className="prosp-bar-fill" style={{ width: `${totalCidade ? feitos / totalCidade * 100 : 0}%` }} /></div>

      {aviso && (
        <div className="card" style={{ padding: '11px 16px', background: '#ECFDF5', border: '1px solid #A7F3D0', boxShadow: 'none' }}>
          <p className="text-xs font-bold" style={{ color: 'var(--ok)' }}>
            <Check size={12} className="inline" style={{ verticalAlign: -2, marginRight: 5 }} />{aviso}
          </p>
        </div>
      )}

      <div className="card prosp-fluxo-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: 'var(--faint)', letterSpacing: '0.08em' }}>Contato {feitos + 1} de {totalCidade}</p>
            <h3 className="text-xl font-extrabold mt-1" style={{ color: 'var(--text)' }}>{atual.empresa}</h3>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {atual.nicho && <span className="prosp-pill" style={{ background: '#EFF6FF', color: 'var(--signalDeep)' }}>{atual.nicho}</span>}
              {atual.cidade && <span className="text-xs" style={{ color: 'var(--muted)' }}><MapPin size={11} className="inline" /> {atual.cidade}</span>}
              {atual.retornoEm && atual.status === 'retornar' && <span className="text-xs font-bold" style={{ color: '#7C3AED' }}>retorno agendado {fmtDDMM(atual.retornoEm)}</span>}
              {atual.status === 'nao_atendeu' && atual.ultimoContato && <span className="text-xs font-bold" style={{ color: '#D97706' }}>não atendeu {fmtDDMM(atual.ultimoContato)} — nova tentativa</span>}
            </div>
          </div>
          {atual.telefone && (
            <a href={telLink} className="prosp-call-btn">
              <PhoneCall size={18} /> {atual.telefone}
            </a>
          )}
        </div>

        {atual.obs && <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}><b>Obs da lista:</b> {atual.obs}</p>}

        <div className="mt-5">
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Anotação do contato (opcional)</label>
          <input className="input-field" value={obs} onChange={e => setObs(e.target.value)} placeholder="Quem atendeu, o que falou..." />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mt-5">
          <button className="prosp-status-btn" style={{ '--c': '#059669' }} onClick={() => registrar('interessado')}>
            <Check size={16} /> Atendeu — Interessado
          </button>
          <button className="prosp-status-btn" style={{ '--c': '#DC2626' }} onClick={() => registrar('sem_interesse')}>
            <X size={16} /> Atendeu — Sem interesse
          </button>
          <button className="prosp-status-btn" style={{ '--c': '#D97706' }} onClick={() => registrar('nao_atendeu')}>
            <Phone size={16} /> Não atendeu
          </button>
          <button className="prosp-status-btn" style={{ '--c': '#7C3AED' }} onClick={() => registrar('retornar')}>
            <CalendarClock size={16} /> Retornar em
          </button>
          <button className="prosp-status-btn" style={{ '--c': '#0891B2' }} onClick={() => setReuniaoAberta(true)}>
            <CalendarDays size={16} /> Agendar Reunião
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Data do retorno:</label>
          <input type="date" className="input-field" style={{ width: 160, padding: '7px 10px', fontSize: 12 }} value={retornoData} onChange={e => setRetornoData(e.target.value)} />
          <span className="text-xs" style={{ color: 'var(--faint)' }}>use "Retornar em" para agendar; vazio = hoje</span>
        </div>
      </div>

      {reuniaoAberta && atual && (
        <ReuniaoModal lead={atual} onClose={() => setReuniaoAberta(false)} onConfirm={agendarReuniao} />
      )}
    </div>
  );
}

// ── Módulo principal ─────────────────────────────────────────────────────────
export default function ProspeccaoModule({ sub = 'dashboard', empresaAtiva = null }) {
  const [prospectas, setProspectas] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetchCrmProspectas().then(p => { setProspectas(p); setLoading(false); });
  }, []);

  if (loading) return <div className="card py-14 text-center text-sm" style={{ color: 'var(--muted)' }}>Carregando...</div>;

  return (
    <>
      {sub === 'dashboard' && <ProspDashboard prospectas={prospectas} />}
      {sub === 'leads'     && <ProspLeads prospectas={prospectas} setProspectas={setProspectas} empresaAtiva={empresaAtiva} />}
      {sub === 'upload'    && <ProspUpload prospectas={prospectas} setProspectas={setProspectas} />}
      {sub === 'fluxo'     && <ProspFluxo prospectas={prospectas} setProspectas={setProspectas} empresaAtiva={empresaAtiva} />}
    </>
  );
}
