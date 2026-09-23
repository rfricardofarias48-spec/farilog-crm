import { useState, useEffect, useMemo, useRef } from 'react';
import {
  fetchCrmProspectas, createCrmProspectasBulk, updateCrmProspecta, deleteCrmProspecta,
  createCrmLead, updateCrmLead, createCrmEvento, colunaFonteExiste,
} from './lib/db';
import { parseHurmaCsv, readCsvFile, phoneDigits, firstPhoneDigits } from './lib/hurmaCsv';
import {
  ACTORS, getActorId, getToken, setToken, setActorId,
  testarToken, runScraper, abortarRun, inputPadrao, mapPlaceToProspect,
} from './lib/apify';
import {
  PhoneCall, Upload as UploadIcon, FileSpreadsheet, Search, X, Trash2,
  CalendarClock, CalendarDays, Check, ChevronRight, Phone, MapPin, Building2, PartyPopper,
  SlidersHorizontal, Radar, Loader2, StopCircle, Settings2, Link2, Users,
} from 'lucide-react';

const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// ── Fonte do lead: de onde ele veio ──────────────────────────────────────────
export const FONTES = {
  apify:  { label: 'Apify',  color: '#2563EB', bg: '#EFF6FF' },
  upload: { label: 'Upload', color: '#5C6B84', bg: '#F1F5F9' },
};
export const fonteInfo = (f) => FONTES[f] || FONTES.upload;
export function FontePill({ fonte, size = 10 }) {
  const f = fonteInfo(fonte);
  return (
    <span className="prosp-pill" style={{ background: f.bg, color: f.color, fontSize: size, padding: '2px 8px' }}>
      {f.label}
    </span>
  );
}

// ── Quem está prospectando ───────────────────────────────────────────────────
// Cada lead fica com no máximo UM prospectador. Quem o atende primeiro registra
// o nome; a partir daí ele sai da fila do outro (filtro em naFila) — assim um
// lead nunca é prospectado pela Ana e pelo Ricardo ao mesmo tempo.
export const PROSPECTADORES = [
  { key: 'ana',     label: 'Ana',     color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'ricardo', label: 'Ricardo', color: '#0891B2', bg: '#ECFEFF' },
];
export const prospectadorInfo = (k) => PROSPECTADORES.find(p => p.key === k) || null;
export function ProspectadorPill({ prospectador, size = 10 }) {
  const p = prospectadorInfo(prospectador);
  if (!p) return <span className="text-xs" style={{ color: 'var(--faint)' }}>—</span>;
  return (
    <span className="prosp-pill" style={{ background: p.bg, color: p.color, fontSize: size, padding: '2px 8px' }}>
      {p.label}
    </span>
  );
}

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
// anteriores — quem não atendeu hoje volta automaticamente para a fila no dia seguinte.
// Se `prospectador` for informado, leads que já estão com o OUTRO prospectador são
// removidos da fila: ninguém prospecta o mesmo lead que o colega.
const naFila = (p, prospectador = null) => {
  if (prospectador && p.prospectador && p.prospectador !== prospectador) return false;
  return p.status === 'novo'
    || (p.status === 'retornar' && (!p.retornoEm || p.retornoEm <= TODAY_ISO))
    || (p.status === 'nao_atendeu' && p.ultimoContato && p.ultimoContato < TODAY_ISO);
};

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
  if (lead.telefone2) obs.push(`Tel. 2: ${lead.telefone2}`);
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
    fonte:         lead.fonte || 'upload',
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
function Card({ icon: Icon, label, value, sub, tone = 'var(--signal)', destaque = false, onClick }) {
  return (
    <div className={`card ${onClick ? 'prosp-kpi-card' : ''}`} role={onClick ? 'button' : undefined}
      onClick={onClick} title={onClick ? 'Ver os leads desta classificação' : undefined}
      style={{
        padding: '16px 18px',
        ...(destaque ? { background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F9FF 100%)', borderColor: 'rgba(37,99,235,0.35)' } : {}),
      }}>
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
  // Filtro por prospectador: "geral" mostra todos, ou só os leads de Ana/Ricardo.
  const [visao, setVisao] = useState('geral');
  const base = useMemo(
    () => (visao === 'geral' ? prospectas : prospectas.filter(p => p.prospectador === visao)),
    [prospectas, visao],
  );

  const contatadasHoje = base.filter(p => p.ultimoContato === hoje);
  const porStatus = (s) => base.filter(p => p.status === s).length;
  const atendentes = contatadasHoje.filter(p => p.status === 'interessado' || p.status === 'sem_interesse' || p.status === 'retornar' || p.status === 'reuniao').length;

  // Leads por fonte: quantos vieram do scraper da Apify e quantos de listas enviadas
  const daApify = base.filter(p => p.fonte === 'apify');
  const pctApify = base.length ? Math.round((daApify.length / base.length) * 100) : 0;

  // Caixa aberta ao clicar num card: mostra todos os leads daquela classificação
  const [caixa, setCaixa] = useState(null);

  const KPI = {
    base:        { titulo: 'Base de leads',  leads: base,         cor: 'var(--signal)' },
    apify:       { titulo: 'Leads da Apify', leads: daApify,      cor: '#2563EB' },
    ligadosHoje: { titulo: 'Ligados hoje',   leads: contatadasHoje, cor: '#0891B2' },
    interessado: { titulo: 'Interessados',   leads: base.filter(p => p.status === 'interessado'),  cor: '#059669' },
    sem_interesse: { titulo: 'Sem interesse', leads: base.filter(p => p.status === 'sem_interesse'), cor: '#DC2626' },
    nao_atendeu: { titulo: 'Não atendeu',    leads: base.filter(p => p.status === 'nao_atendeu'),  cor: '#D97706' },
    novo:        { titulo: 'A contatar',     leads: base.filter(p => p.status === 'novo'),        cor: '#64748B' },
  };
  const abrir = (k) => setCaixa({ chave: k, ...KPI[k] });

  return (
    <div className="page-fill space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Dashboard de Prospecção</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {visao === 'geral'
              ? 'Resumo das ligações e do funil de contatos — clique num card para ver os leads'
              : `Números de ${visao === 'ana' ? 'Ana' : 'Ricardo'} — apenas os leads prospectados por ele(a)`}
          </p>
        </div>
        <div className="subtabs">
          <button className={`subtab ${visao === 'geral' ? 'active' : ''}`} onClick={() => setVisao('geral')}>
            <Users size={12} /> Geral
          </button>
          {PROSPECTADORES.map(p => (
            <button key={p.key} className={`subtab ${visao === p.key ? 'active' : ''}`} onClick={() => setVisao(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <Card icon={Building2}     label="Base de leads"  value={base.length} sub={visao === 'geral' ? 'total importado' : `prospectados por ${visao === 'ana' ? 'Ana' : 'Ricardo'}`} onClick={() => abrir('base')} />
        <Card icon={Radar}         label="Leads Apify"    value={daApify.length} sub={`${pctApify}% da base veio da Apify`} tone="#2563EB" destaque onClick={() => abrir('apify')} />
        <Card icon={PhoneCall}     label="Ligados hoje"   value={contatadasHoje.length} sub={`${atendentes} atenderam`} tone="#0891B2" onClick={() => abrir('ligadosHoje')} />
        <Card icon={Check}         label="Interessados"   value={porStatus('interessado')} sub="para levar ao pipeline" tone="#059669" onClick={() => abrir('interessado')} />
        <Card icon={X}             label="Sem interesse"  value={porStatus('sem_interesse')} sub="descartados" tone="#DC2626" onClick={() => abrir('sem_interesse')} />
        <Card icon={Phone}         label="Não atendeu"    value={porStatus('nao_atendeu')} sub="tentar de novo depois" tone="#D97706" onClick={() => abrir('nao_atendeu')} />
        <Card icon={CalendarClock} label="A contatar"     value={porStatus('novo')} sub="nunca ligados" tone="#64748B" onClick={() => abrir('novo')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ flex: 1, minHeight: 0, maxHeight: 430 }}>
        <div className="card prosp-chart-card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Ligações — últimos 14 dias</p>
            <span className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>
              {base.filter(p => p.ultimoContato >= isoAddDays(TODAY_ISO, -13)).length} no período
            </span>
          </div>
          <BarChartLigacoes prospectas={base} />
        </div>
        <div className="card prosp-chart-card">
          <p className="text-sm font-bold mb-4" style={{ color: 'var(--text)' }}>Distribuição por status</p>
          <DonutStatus prospectas={base} />
        </div>
      </div>

      {caixa && (
        <CaixaClassificacao
          titulo={caixa.titulo}
          leads={caixa.leads}
          cor={caixa.cor}
          visao={visao}
          onClose={() => setCaixa(null)}
        />
      )}
    </div>
  );
}

// ── Caixa com todos os leads de uma classificação do dashboard ──────────────
// Aberta ao clicar num card. Lista as mesmas colunas da aba Leads e, quando
// há segundo telefone, mostra a coluna extra também.
function CaixaClassificacao({ titulo, leads, cor, visao, onClose }) {
  const ordenados = useMemo(() => {
    const nome = (p) => (p.empresa || '').toLowerCase();
    return [...leads].sort((a, b) => nome(a).localeCompare(nome(b)));
  }, [leads]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box prosp-caixa" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="prosp-caixa-dot" style={{ background: cor }} />
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>{titulo}</h3>
            <span className="prosp-pill" style={{ background: '#F1F5F9', color: 'var(--muted)' }}>
              {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)' }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          {visao === 'geral' ? 'Toda a base' : `Apenas leads prospectados por ${visao === 'ana' ? 'Ana' : 'Ricardo'}`}
        </p>

        {ordenados.length === 0 ? (
          <div className="text-center py-10">
            <Building2 size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhum lead nesta classificação.</p>
          </div>
        ) : (
          <div className="card scroll-x" style={{ background: '#F8FAFC', boxShadow: 'none', padding: 0 }}>
            {(() => {
              const temTel2 = ordenados.some(p => p.telefone2);
              const cols = temTel2
                ? '1.5fr 100px 1fr 140px 140px 82px 108px 72px 90px'
                : '1.6fr 100px 1fr 150px 90px 108px 72px 100px';
              return (<>
                <div className="meta-thead prosp-leads-thead px-4 py-2.5 grid text-xs font-semibold"
                  style={{ gridTemplateColumns: cols, gap: '8px' }}>
                  <span>Empresa</span><span>Cidade</span><span>Nicho</span><span>Telefone</span>
                  {temTel2 && <span>Telefone 2</span>}<span>Últ. contato</span><span>Status</span><span>Fonte</span><span>Quem prospectou</span>
                </div>
                {ordenados.map((p, i) => {
                  const st = statusInfo(p.status);
                  const venc = p.status === 'retornar' && (!p.retornoEm || p.retornoEm <= TODAY_ISO);
                  return (
                    <div key={p.id} className="grid items-center px-4 py-2 text-xs"
                      style={{ gridTemplateColumns: cols, gap: '8px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                      <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{p.empresa}</span>
                      <span style={{ color: 'var(--muted)' }}>{p.cidade || '—'}</span>
                      <span className="truncate" style={{ color: 'var(--muted)' }}>{p.nicho || '—'}</span>
                      <span className="font-semibold" style={{ color: 'var(--signalDeep)' }}>{p.telefone || '—'}</span>
                      {temTel2 && <span className="font-semibold" style={{ color: 'var(--muted)' }}>{p.telefone2 || '—'}</span>}
                      <span style={{ color: 'var(--muted)' }}>{p.ultimoContato ? fmtDDMM(p.ultimoContato) : '—'}</span>
                      <span className="prosp-pill" style={{ background: st.bg, color: venc ? '#DC2626' : st.color }}>
                        {st.label}{p.status === 'retornar' && p.retornoEm ? ` ${fmtDDMM(p.retornoEm)}` : ''}
                      </span>
                      <span><FontePill fonte={p.fonte} /></span>
                      <span><ProspectadorPill prospectador={p.prospectador} /></span>
                    </div>
                  );
                })}
              </>);
            })()}
          </div>
        )}
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
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Telefone</label>
              <input className="input-field" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Telefone 2</label>
              <input className="input-field" value={form.telefone2 || ''} onChange={e => setForm(f => ({ ...f, telefone2: e.target.value }))} placeholder="Segundo contato (opcional)" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Cidade</label>
              <input className="input-field" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Lista</label>
              <input className="input-field" value={form.lista} onChange={e => setForm(f => ({ ...f, lista: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Fonte</label>
            <div className="flex gap-2">
              {Object.entries(FONTES).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, fonte: k }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:  (form.fonte || 'upload') === k ? v.bg : '#F8FAFC',
                    borderColor: (form.fonte || 'upload') === k ? v.color : 'var(--line)',
                    color:       (form.fonte || 'upload') === k ? v.color : 'var(--faint)',
                    cursor: 'pointer',
                  }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Quem prospectou</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(f => ({ ...f, prospectador: '' }))}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background:  !form.prospectador ? '#F1F5F9' : '#F8FAFC',
                  borderColor: !form.prospectador ? '#94A3B8' : 'var(--line)',
                  color:       !form.prospectador ? '#475569' : 'var(--faint)',
                  cursor: 'pointer',
                }}>
                Sem dono
              </button>
              {PROSPECTADORES.map(p => (
                <button key={p.key} type="button" onClick={() => setForm(f => ({ ...f, prospectador: p.key }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:  form.prospectador === p.key ? p.bg : '#F8FAFC',
                    borderColor: form.prospectador === p.key ? p.color : 'var(--line)',
                    color:       form.prospectador === p.key ? p.color : 'var(--faint)',
                    cursor: 'pointer',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
            {!form.prospectador && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--faint)' }}>Sem dono: aparece na fila dos dois prospectadores.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Nicho</label>
            <input className="input-field" value={form.nicho} onChange={e => setForm(f => ({ ...f, nicho: e.target.value }))} />
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
  const [fFonte, setFFonte]   = useState('');
  const [fProspectador, setFProspectador] = useState('');
  const [somenteContatados, setSomenteContatados] = useState(true);
  const [popAberto, setPopAberto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cidades = useMemo(() => [...new Set(prospectas.map(p => p.cidade).filter(Boolean))].sort(), [prospectas]);
  const listas  = useMemo(() => [...new Set(prospectas.map(p => p.lista).filter(Boolean))].sort(), [prospectas]);

  const nFiltros = (busca ? 1 : 0) + (fCidade ? 1 : 0) + (fStatus ? 1 : 0) + (fLista ? 1 : 0) + (fFonte ? 1 : 0) + (fProspectador ? 1 : 0);
  const limparFiltros = () => { setBusca(''); setFCidade(''); setFStatus(''); setFLista(''); setFFonte(''); setFProspectador(''); };

  const filtrados = prospectas.filter(p =>
    (!somenteContatados || p.status !== 'novo') &&
    (!busca   || `${p.empresa} ${p.nicho} ${p.telefone}`.toLowerCase().includes(busca.toLowerCase())) &&
    (!fCidade || p.cidade === fCidade) &&
    (!fStatus || p.status === fStatus) &&
    (!fLista  || p.lista === fLista) &&
    (!fFonte  || p.fonte === fFonte) &&
    (!fProspectador || p.prospectador === fProspectador)
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
                <select className="input-field" style={selStyle} value={fFonte} onChange={e => setFFonte(e.target.value)}>
                  <option value="">Todas as fontes</option>
                  {Object.entries(FONTES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="input-field" style={selStyle} value={fProspectador} onChange={e => setFProspectador(e.target.value)}>
                  <option value="">Todos os prospectadores</option>
                  {PROSPECTADORES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
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
          {(() => {
            const temTel2 = filtrados.some(p => p.telefone2);
            const cols = temTel2 ? '1.5fr 100px 1fr 150px 145px 80px 118px 72px 78px 100px' : '1.6fr 105px 1fr 170px 85px 118px 103px 72px 100px';
            return (
          <div style={{ minWidth: temTel2 ? 1100 : 1010 }}>
            <div className="meta-thead prosp-leads-thead px-5 py-3 grid text-xs font-semibold" style={{ gridTemplateColumns: cols, gap: '8px' }}>
              <span>Empresa</span><span>Cidade</span><span>Nicho</span><span>Telefone</span>{temTel2 && <span>Telefone 2</span>}<span>Últ. contato</span><span>Status</span><span>Fonte</span><span>Quem prospectou</span><span>Lista</span>
            </div>
            {filtrados.map((p, idx) => {
              const st = statusInfo(p.status);
              const venc = p.status === 'retornar' && (!p.retornoEm || p.retornoEm <= TODAY_ISO);
              return (
                <div key={p.id} className={`meta-row prosp-leads-row ${idx % 2 === 1 ? 'alt' : ''}`}
                  style={{ gridTemplateColumns: cols, gap: '8px', borderBottom: idx < filtrados.length - 1 ? '1px solid var(--line)' : 'none' }}
                  onClick={() => setEditando(p)}>
                  <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{p.empresa}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.cidade || '—'}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>{p.nicho || '—'}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--signalDeep)' }}>{p.telefone || '—'}</span>
                  {temTel2 && <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{p.telefone2 || '—'}</span>}
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.ultimoContato ? fmtDDMM(p.ultimoContato) : '—'}</span>
                  <span>
                    <span className="prosp-pill" style={{ background: st.bg, color: venc ? '#DC2626' : st.color }}>
                      {st.label}{p.status === 'retornar' && p.retornoEm ? ` ${fmtDDMM(p.retornoEm)}` : ''}
                    </span>
                  </span>
                  <span><FontePill fonte={p.fonte} /></span>
                  <span><ProspectadorPill prospectador={p.prospectador} /></span>
                  <span className="text-xs truncate" style={{ color: 'var(--faint)' }}>{p.lista || '—'}</span>
                </div>
              );
            })}
          </div>
          );
        })()}
        </div>
      )}

      {editando && (
        <LeadEditModal lead={editando} onClose={() => setEditando(null)} onSave={handleSave} onDelete={handleDelete} />
      )}
    </div>
  );
}

// ── Apify: busca de leads qualificados no Google Maps ────────────────────────

function ProspApify({ prospectas, setProspectas }) {
  const [termos, setTermos]       = useState('transportadora\nlogística');
  const [cidade, setCidade]       = useState('');
  const [maxPorBusca, setMax]     = useState(30);
  const [actorId, setActor]       = useState(getActorId());
  const [status, setStatus]       = useState('');
  const [encontrados, setEncontrados] = useState(0);
  const [rodando, setRodando]     = useState(false);
  const [preview, setPreview]     = useState(null); // { records, dupDb, invalidos, fechados, cidades }
  const [erro, setErro]           = useState('');
  const [msg, setMsg]             = useState('');
  const [importando, setImportando] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const [tokenInput, setTokenInput] = useState(getToken());
  const [testeToken, setTesteToken] = useState(null);
  const [migracaoPendente, setMigracaoPendente] = useState(false);
  const abortRef = useRef(null);
  const actorNome = (ACTORS.find(a => a.id === actorId) || ACTORS[0]).label;

  // Avisa se a coluna 'fonte' ainda não existe no banco (Migração 4 do SQL pendente).
  // Sem ela os leads importados entram, mas não ficam marcados como vindos da Apify.
  useEffect(() => {
    colunaFonteExiste().then(existe => setMigracaoPendente(!existe));
  }, []);

  // Pré-busca: mostra quantos leads daquela cidade já existem na base
  const cidadesBase = useMemo(
    () => [...new Set(prospectas.map(p => p.cidade).filter(Boolean))].sort(),
    [prospectas],
  );

  const handleActor = (id) => { setActor(id); setActorId(id); };

  const salvarToken = async () => {
    setToken(tokenInput);
    setTesteToken(null);
    const r = await testarToken(tokenInput);
    setTesteToken(r);
    if (r.ok) setErro('');
  };

  const buscar = async () => {
    const searchStringsArray = termos.split('\n').map(t => t.trim()).filter(Boolean);
    if (!searchStringsArray.length || !cidade.trim()) {
      setErro('Preencha a cidade e ao menos um termo de busca (um por linha).');
      return;
    }
    setErro(''); setMsg(''); setPreview(null); setEncontrados(0);
    setRodando(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { items } = await runScraper({
        actorId,
        input: inputPadrao({ searchStringsArray, locationQuery: cidade.trim(), maxCrawledPlacesPerSearch: maxPorBusca }),
        onStatus: (s, n) => { setStatus(s); setEncontrados(n); },
        signal: controller.signal,
      });

      // Mesma análise de duplicidade do upload de CSV: qualquer número que já
      // exista na base descarta o lugar, e lugares sem telefone discável também
      const digitosNoApp = new Set();
      for (const p of prospectas) {
        [firstPhoneDigits(p.telefone), firstPhoneDigits(p.telefone2)].forEach(d => d && digitosNoApp.add(d));
      }
      const vistos = new Set();
      const novos = [], invalidos = [], fechados = [];
      let dupDb = 0, dupLote = 0;
      for (const place of items) {
        if (place.permanentlyClosed || place.temporarilyClosed) { fechados.push(place); continue; }
        const rec = mapPlaceToProspect(place);
        if (!rec.empresa) continue;
        const d1 = firstPhoneDigits(rec.telefone), d2 = firstPhoneDigits(rec.telefone2);
        if (!d1) { invalidos.push(rec); continue; }
        if ((d1 && digitosNoApp.has(d1)) || (d2 && digitosNoApp.has(d2))) { dupDb++; continue; }
        if ((d1 && vistos.has(d1)) || (d2 && vistos.has(d2))) { dupLote++; continue; }
        vistos.add(d1); if (d2) vistos.add(d2);
        novos.push(rec);
      }
      if (!novos.length && !items.length) {
        setErro('A busca não encontrou lugares. Tente outros termos ou uma cidade maior.');
        setRodando(false); return;
      }
      setPreview({ records: novos, dupDb, dupLote, invalidos, fechados });
      setStatus('');
    } catch (e) {
      if (e.name === 'AbortError') setStatus('');
      else setErro(`Não foi possível concluir a busca: ${e.message}`);
    }
    setRodando(false);
    abortRef.current = null;
  };

  const cancelar = async () => {
    if (abortRef.current) abortRef.current.abort();
    setRodando(false); setStatus('');
    setMsg('Busca cancelada.');
  };

  const listaNome = preview ? `Apify — ${cidade.trim()}` : '';

  const handleImport = async () => {
    if (!preview) return;
    setImportando(true); setErro('');
    const res = await createCrmProspectasBulk(preview.records.map(r => ({ ...r, lista: listaNome })));
    setImportando(false);
    if (!res.ok) { setErro('Falha ao importar. Verifique sua conexão e se a tabela crm_prospectas foi criada no Supabase.'); return; }
    const atualizadas = await fetchCrmProspectas();
    setProspectas(atualizadas);
    if (res.ignorouFonte) {
      setMsg(`${preview.records.length} leads importados — mas a coluna "fonte" ainda não existe no banco. Execute a Migração 4 no SQL do Supabase para que eles constem como vindos da Apify.`);
      setMigracaoPendente(true);
    } else {
      setMsg(`${preview.records.length} leads da Apify importados da lista "${listaNome}".`);
    }
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Radar size={17} style={{ color: 'var(--signal)' }} /> Apify — Leads do Google Maps
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Busca empresas por nicho e cidade no Google Maps. Os leads importados ficam marcados como fonte <b>Apify</b>.
          </p>
        </div>
        <button className="btn-ghost flex items-center gap-1.5" onClick={() => setConfigAberto(v => !v)}>
          <Settings2 size={13} /> Configurações da API
        </button>
      </div>

      {migracaoPendente && (
        <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', boxShadow: 'none', padding: '13px 18px' }}>
          <p className="text-xs font-bold" style={{ color: '#B45309' }}>Migração 4 pendente no Supabase</p>
          <p className="text-xs mt-1" style={{ color: '#92400E' }}>
            A coluna <b>fonte</b> ainda não existe no banco. Os leads importados agora entram na base, mas não
            ficam marcados como "Apify" até você rodar a <b>Migração 4</b> (final do arquivo
            <b> supabase_novo_banco.sql</b>) no SQL Editor do Supabase. Depois de rodar, os próximos imports já
            saem com a fonte correta.
          </p>
        </div>
      )}

      {configAberto && (
        <div className="card" style={{ padding: 20 }}>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Token da API Apify</label>
          <div className="flex gap-2">
            <input className="input-field" value={tokenInput} onChange={e => { setTokenInput(e.target.value); setTesteToken(null); }}
              placeholder="apify_api_..." style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} />
            <button className="btn-primary whitespace-nowrap" onClick={salvarToken}>Salvar e testar</button>
          </div>
          {testeToken && (
            <p className="text-xs font-semibold mt-2" style={{ color: testeToken.ok ? 'var(--ok)' : 'var(--danger)' }}>
              {testeToken.ok ? 'Token válido — conexão com o Apify funcionando.' : `Token recusado: ${testeToken.erro}`}
            </p>
          )}
          <div className="mt-4">
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Scraper utilizado</label>
            <div className="flex gap-2 flex-wrap">
              {ACTORS.map(a => (
                <button key={a.id} type="button" onClick={() => handleActor(a.id)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:  actorId === a.id ? 'var(--signalSoft)' : '#F8FAFC',
                    borderColor: actorId === a.id ? 'var(--signal)' : 'var(--line)',
                    color:       actorId === a.id ? 'var(--signalDeep)' : 'var(--faint)',
                    cursor: 'pointer',
                  }}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>
              Termos de busca (um por linha) *
            </label>
            <textarea className="input-field" rows={3} value={termos} onChange={e => setTermos(e.target.value)}
              placeholder="transportadora&#10;logística&#10;caminhão" style={{ resize: 'none' }} />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Cidade / região *</label>
              <input className="input-field" value={cidade} onChange={e => setCidade(e.target.value)}
                placeholder="Cachoeirinha" list="apify-cidades" />
              <datalist id="apify-cidades">
                {cidadesBase.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Máx. por termo</label>
              <input type="number" min="1" max="200" className="input-field" value={maxPorBusca}
                onChange={e => setMax(Number(e.target.value) || 30)} />
            </div>
          </div>
        </div>

        {erro && <p className="text-xs font-semibold mt-4" style={{ color: '#DC2626' }}>{erro}</p>}
        {msg && <p className="text-xs font-semibold mt-4" style={{ color: 'var(--ok)' }}>{msg}</p>}

        {rodando ? (
          <div className="mt-5 card" style={{ background: 'var(--signalSoft)', border: '1px solid rgba(37,99,235,0.25)', boxShadow: 'none', padding: '16px 18px' }}>
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--signal)' }} />
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: 'var(--signalDeep)' }}>Buscando leads — {actorNome}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {status || 'Aguardando...'}{encontrados > 0 ? ` · ${encontrados} lugares encontrados` : ''}
                </p>
              </div>
              <button className="btn-danger flex items-center gap-1.5" onClick={cancelar}>
                <StopCircle size={13} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-5">
            <button className="btn-accent flex items-center gap-1.5" onClick={buscar}
              disabled={!termos.trim() || !cidade.trim()}>
              <Radar size={14} /> Buscar leads
            </button>
            <span className="text-xs" style={{ color: 'var(--faint)' }}>
              {actorNome} · {termos.split('\n').map(t => t.trim()).filter(Boolean).length} termo(s)
            </span>
          </div>
        )}

        {preview && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="prosp-stat" style={{ borderColor: 'var(--signal)' }}>
                <p className="prosp-stat-num" style={{ color: 'var(--signalDeep)' }}>{preview.records.length}</p>
                <p className="prosp-stat-label">novos para importar</p>
              </div>
              <div className="prosp-stat"><p className="prosp-stat-num" style={{ color: '#7C3AED' }}>{preview.dupDb}</p><p className="prosp-stat-label">já estão na base</p></div>
              <div className="prosp-stat"><p className="prosp-stat-num" style={{ color: '#D97706' }}>{preview.dupLote}</p><p className="prosp-stat-label">repetidos na busca</p></div>
              <div className="prosp-stat"><p className="prosp-stat-num" style={{ color: '#DC2626' }}>{preview.invalidos.length}</p><p className="prosp-stat-label">sem telefone válido</p></div>
            </div>

            {preview.invalidos.length > 0 && (
              <div className="card" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', boxShadow: 'none', padding: '10px 14px' }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#D97706' }}>
                  {preview.invalidos.length} lugar(es) sem telefone discável (foram descartados):
                </p>
                <p className="text-xs" style={{ color: '#B45309' }}>
                  {preview.invalidos.slice(0, 6).map(r => r.empresa).join(' · ')}
                  {preview.invalidos.length > 6 && ` · +${preview.invalidos.length - 6} outros`}
                </p>
              </div>
            )}

            <div className="card" style={{ background: '#F8FAFC', boxShadow: 'none', padding: 0, overflow: 'hidden' }}>
              <div className="meta-thead prosp-leads-thead px-4 py-2.5 grid text-xs font-semibold" style={{ gridTemplateColumns: '1.6fr 100px 1.2fr 160px 110px', gap: '8px' }}>
                <span>Empresa</span><span>Cidade</span><span>Nicho</span><span>Telefone</span><span>Fonte</span>
              </div>
              {preview.records.slice(0, 8).map((r, i) => (
                <div key={i} className="grid items-center px-4 py-2 text-xs" style={{ gridTemplateColumns: '1.6fr 100px 1.2fr 160px 110px', gap: '8px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                  <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{r.empresa}</span>
                  <span style={{ color: 'var(--muted)' }}>{r.cidade || '—'}</span>
                  <span className="truncate" style={{ color: 'var(--muted)' }}>{r.nicho || '—'}</span>
                  <span className="font-semibold" style={{ color: 'var(--signalDeep)' }}>{r.telefone || '—'}</span>
                  <span><FontePill fonte="apify" /></span>
                </div>
              ))}
              {preview.records.length > 8 && (
                <p className="text-xs px-4 py-2" style={{ color: 'var(--faint)' }}>+ {preview.records.length - 8} outros...</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1" />
              <button className="btn-ghost" onClick={() => setPreview(null)}>Descartar</button>
              <button className="btn-primary flex items-center gap-1.5" disabled={importando || preview.records.length === 0} onClick={handleImport}>
                <Link2 size={14} /> {importando ? 'Importando...' : `Importar ${preview.records.length} leads`}
              </button>
            </div>
          </div>
        )}
      </div>
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
      // (qualquer um dos dois números conta para validar e para detectar repetição)
      const digitosNoApp = new Set();
      for (const p of prospectas) {
        [firstPhoneDigits(p.telefone), firstPhoneDigits(p.telefone2)].forEach(d => d && digitosNoApp.add(d));
      }
      const vistosNoArquivo = new Set();
      const novos = [];
      const invalidos = [];
      let dupDb = 0, dupFile = 0;
      for (const r of records) {
        let tel = r.telefone, tel2 = r.telefone2 || '';
        if (!firstPhoneDigits(tel) && firstPhoneDigits(tel2)) { [tel, tel2] = [tel2, tel]; } // o principal precisa ser discável
        const d1 = firstPhoneDigits(tel), d2 = firstPhoneDigits(tel2);
        if (!d1) { invalidos.push(r); continue; }
        if ((d1 && digitosNoApp.has(d1)) || (d2 && digitosNoApp.has(d2))) { dupDb++; continue; }
        if ((d1 && vistosNoArquivo.has(d1)) || (d2 && vistosNoArquivo.has(d2))) { dupFile++; continue; }
        vistosNoArquivo.add(d1); if (d2) vistosNoArquivo.add(d2);
        novos.push({ ...r, telefone: tel, telefone2: tel2 });
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
              {(() => {
                const temTel2 = preview.records.some(r => r.telefone2);
                const cols = temTel2 ? '1.5fr 90px 1fr 150px 150px' : '1.6fr 100px 1fr 170px';
                return (<>
                  <div className="meta-thead prosp-leads-thead px-4 py-2.5 grid text-xs font-semibold" style={{ gridTemplateColumns: cols, gap: '8px' }}>
                    <span>Empresa</span><span>Cidade</span><span>Nicho</span><span>Telefone</span>{temTel2 && <span>Telefone 2</span>}
                  </div>
                  {preview.records.slice(0, 8).map((r, i) => (
                    <div key={i} className="grid items-center px-4 py-2 text-xs" style={{ gridTemplateColumns: cols, gap: '8px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                      <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{r.empresa}</span>
                      <span style={{ color: 'var(--muted)' }}>{r.cidade || '—'}</span>
                      <span className="truncate" style={{ color: 'var(--muted)' }}>{r.nicho || '—'}</span>
                      <span className="font-semibold" style={{ color: 'var(--signalDeep)' }}>{r.telefone || '—'}</span>
                      {temTel2 && <span className="font-semibold" style={{ color: 'var(--muted)' }}>{r.telefone2 || '—'}</span>}
                    </div>
                  ))}
                </>);
              })()}
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
  const [prospectador, setProspectador] = useState(() => localStorage.getItem('crm_prospectador') || '');
  const [cidade, setCidade]   = useState('');
  const [obs, setObs]         = useState('');
  const [retornoData, setRetornoData] = useState('');
  const [aviso, setAviso]     = useState('');
  const [reuniaoAberta, setReuniaoAberta] = useState(false);

  // A pergunta "quem vai prospectar?" é feita toda vez que se entra na Prospecção
  // Ativa — fica salva no navegador para a sessão atual.
  const [perguntaAberta, setPerguntaAberta] = useState(true);
  const escolherProspectador = (k) => {
    setProspectador(k);
    localStorage.setItem('crm_prospectador', k);
    setPerguntaAberta(false);
  };

  const cidades = useMemo(() => {
    const map = {};
    for (const p of prospectas) {
      const c = p.cidade || 'Sem cidade';
      map[c] ||= { total: 0, fila: 0 };
      map[c].total++;
      if (naFila(p, prospectador)) map[c].fila++;
    }
    return Object.entries(map).sort((a, b) => b[1].fila - a[1].fila);
  }, [prospectas, prospectador]);

  const fila = useMemo(() => {
    if (!cidade) return [];
    return prospectas
      .filter(p => (p.cidade || 'Sem cidade') === cidade)
      .filter(p => naFila(p, prospectador));
  }, [cidade, prospectas, prospectador]);

  const totalCidade = prospectas.filter(p => (p.cidade || 'Sem cidade') === cidade).length;
  const atual = fila[0];
  const feitos = totalCidade - fila.length;

  const registrar = async (status) => {
    if (!atual) return;
    // O primeiro contato registra quem está prospectando; a partir daí o lead
    // sai da fila do outro prospectador (mecanismo anti-duplicação).
    const prospectarComo = atual.prospectador || prospectador;
    const patch = { status, prospectador: prospectarComo, ultimoContato: TODAY_ISO, retornoEm: status === 'retornar' ? (retornoData || TODAY_ISO) : '', obs: obs || atual.obs };
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
    const prospectarComo = atual.prospectador || prospectador;
    const patch = { status: 'reuniao', prospectador: prospectarComo, ultimoContato: TODAY_ISO, retornoEm: '', obs: obs || atual.obs };
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

  if (!prospectador || perguntaAberta) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Prospecção Ativa</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Quem vai prospectar agora?</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROSPECTADORES.map(p => (
            <button key={p.key} onClick={() => escolherProspectador(p.key)}
              className="card flex items-center gap-3"
              style={{
                padding: '20px 22px', cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${prospectador === p.key ? p.color : 'var(--line)'}`,
                background: prospectador === p.key ? p.bg : '#fff',
                transition: 'all 0.15s',
              }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: prospectador === p.key ? '#fff' : p.bg }}>
                <Users size={18} style={{ color: p.color }} />
              </div>
              <div>
                <p className="text-base font-bold" style={{ color: 'var(--text)' }}>{p.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {prospectas.filter(x => naFila(x, p.key)).length} leads na fila dele(a)
                </p>
              </div>
              {prospectador === p.key && (
                <Check size={16} style={{ color: p.color, marginLeft: 'auto', flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs" style={{ color: 'var(--faint)' }}>
          Quem atende um lead primeiro deixa o nome registrado — a partir daí o lead sai da fila do outro e
          ninguém prospecta duas vezes a mesma empresa.
        </p>
      </div>
    );
  }

  if (!cidade) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
              Prospecção Ativa
              <span className="prosp-pill" style={{ background: (prospectadorInfo(prospectador)||{}).bg, color: (prospectadorInfo(prospectador)||{}).color }}>
                {(prospectadorInfo(prospectador)||{}).label}
              </span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Escolha a cidade — o app mostra um contato por vez</p>
          </div>
          <button className="btn-ghost" onClick={() => setPerguntaAberta(true)}>Trocar prospectador</button>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            Prospecção — {cidade}
            <span className="prosp-pill" style={{ background: (prospectadorInfo(prospectador)||{}).bg, color: (prospectadorInfo(prospectador)||{}).color }}>
              {(prospectadorInfo(prospectador)||{}).label}
            </span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{feitos} de {totalCidade} nesta cidade</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setPerguntaAberta(true)}>Trocar prospectador</button>
          <button className="btn-ghost" onClick={() => setCidade('')}>Trocar cidade</button>
        </div>
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
          {(atual.telefone || atual.telefone2) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', flexShrink: 0 }}>
              {atual.telefone && (
                <a href={`tel:+55${phoneDigits(atual.telefone)}`} className="prosp-call-btn">
                  <PhoneCall size={18} /> {atual.telefone}
                </a>
              )}
              {atual.telefone2 && (
                <a href={`tel:+55${phoneDigits(atual.telefone2)}`} className="prosp-call-btn alt">
                  <PhoneCall size={15} /> {atual.telefone2}
                </a>
              )}
            </div>
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
      {sub === 'apify'     && <ProspApify prospectas={prospectas} setProspectas={setProspectas} />}
      {sub === 'upload'    && <ProspUpload prospectas={prospectas} setProspectas={setProspectas} />}
      {sub === 'fluxo'     && <ProspFluxo prospectas={prospectas} setProspectas={setProspectas} empresaAtiva={empresaAtiva} />}
    </>
  );
}
