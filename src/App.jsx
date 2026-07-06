import { useState, useEffect } from 'react';
import {
  fetchCrmLeads, createCrmLead, updateCrmLead, deleteCrmLead,
  fetchCrmEventos, createCrmEvento, updateCrmEvento, deleteCrmEvento,
  fetchCrmClientes, createCrmCliente, updateCrmCliente, deleteCrmCliente,
} from './lib/db';
import {
  Plus, X, User, Trash2, ChevronLeft, ChevronRight,
  CalendarDays, Lock, KanbanSquare, LogOut, Users,
} from 'lucide-react';

const T  = { color: '#0F172A' };
const TM = { color: '#94A3B8' };

const PRIMARY    = '#2563EB';
const PRIMARY_DK = '#1D4ED8';
const PRIMARY_BG = '#EFF6FF';

const CRM_PASSWORD = '676012';

// ── Bloqueio por senha ─────────────────────────────────────────────────────
function CRMGate({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === CRM_PASSWORD) {
      sessionStorage.setItem('crm_unlocked', 'true');
      onUnlock();
    } else {
      setError('Senha incorreta.');
    }
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', background: '#EEF1F5' }}>
      <form onSubmit={handleSubmit} className="card p-6" style={{ width: '100%', maxWidth: '320px' }}>
        <div className="flex flex-col items-center mb-4">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: PRIMARY_BG }}>
            <Lock size={18} style={{ color: PRIMARY }} />
          </div>
          <h3 className="text-sm font-bold" style={T}>CRM</h3>
          <p className="text-xs mt-1 text-center" style={TM}>Digite a senha para acessar</p>
        </div>
        <input
          type="password"
          className="input-field text-center"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          placeholder="Senha"
          autoFocus
        />
        {error && <p className="text-xs mt-2 text-center font-semibold" style={{ color: '#E11D48' }}>{error}</p>}
        <button type="submit" className="btn-primary w-full mt-4" style={{ width: '100%' }}>Entrar</button>
      </form>
    </div>
  );
}

const STAGES = [
  { key: 'novo',        label: 'Novo Lead',        color: '#64748B' },
  { key: 'proposta',    label: 'Proposta Enviada', color: '#2563EB' },
  { key: 'reuniao',     label: 'Reunião',          color: '#7C3AED' },
  { key: 'fechamento',  label: 'Fechamento',       color: '#0891B2' },
  { key: 'caiu',        label: 'Caiu',             color: '#DC2626' },
  { key: 'venda',       label: 'Venda',            color: '#059669' },
];

const TIPO_OPTIONS = [
  { key: 'diaria',  label: 'Diária',  color: '#2563EB', bg: '#EFF6FF' },
  { key: 'carreta', label: 'Carreta', color: '#DC2626', bg: '#FEE2E2' },
];
const tipoInfo = (tipo) => TIPO_OPTIONS.find(t => t.key === tipo) || TIPO_OPTIONS[0];

// ── Modal de Lead (novo / editar) ─────────────────────────────────────────
function LeadModal({ initial, defaultEtapa, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial || {
    nomeEmpresa: '', contato: '', telefone: '', quantidade: '', etapa: defaultEtapa || 'novo', tipo: 'diaria', observacoes: '',
  });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);
  const qtyLabel = form.tipo === 'carreta' ? 'Descargas/Semana' : 'Vagas';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nomeEmpresa.trim()) return;
    setSaving(true);
    await onSave({ ...form, quantidade: Number(form.quantidade) || 0 });
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={T}>{isEdit ? 'Editar Lead' : 'Novo Lead'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Empresa *</label>
            <input className="input-field" value={form.nomeEmpresa} onChange={e => setForm(f => ({ ...f, nomeEmpresa: e.target.value }))} placeholder="Nome da empresa" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Contato</label>
              <input className="input-field" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Nome do contato" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Telefone</label>
              <input className="input-field" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>{qtyLabel}</label>
              <input type="number" step="1" min="0" className="input-field" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Etapa</label>
              <select className="input-field" value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#64748B' }}>Tipo</label>
            <div className="flex gap-2">
              {TIPO_OPTIONS.map(t => (
                <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, tipo: t.key }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:  form.tipo === t.key ? t.bg : '#F8FAFC',
                    borderColor: form.tipo === t.key ? t.color : 'rgba(0,0,0,0.08)',
                    color:       form.tipo === t.key ? t.color : '#94A3B8',
                    cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Observações</label>
            <textarea className="input-field" rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes do lead..." style={{ resize: 'none' }} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            {isEdit && (
              <button type="button" className="btn-danger flex items-center gap-1.5" onClick={() => onDelete(initial.id)}>
                <Trash2 size={13} /> Excluir
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || !form.nomeEmpresa.trim()} className="btn-primary" style={{ opacity: saving || !form.nomeEmpresa.trim() ? 0.6 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Card de Lead (arrastável) ──────────────────────────────────────────────
function LeadCard({ lead, onDragStart, onDragEnd, onClick, dragging }) {
  const tInfo = tipoInfo(lead.tipo);
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(lead)}
      className="card p-3"
      style={{
        cursor: 'grab', opacity: dragging ? 0.4 : 1,
        transition: 'opacity 0.15s, transform 0.15s',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{lead.nomeEmpresa}</p>
        <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: tInfo.bg, color: tInfo.color }}>
          {tInfo.label}
        </span>
      </div>
      {lead.contato && (
        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#64748B' }}>
          <User size={11} /> {lead.contato}
        </p>
      )}
      {lead.quantidade > 0 && (
        <p className="text-xs font-bold mt-1.5" style={{ color: PRIMARY }}>
          {lead.quantidade} {lead.tipo === 'carreta' ? 'descargas/semana' : 'vagas'}
        </p>
      )}
    </div>
  );
}

// ── Pipeline (Kanban) ──────────────────────────────────────────────────────
function Pipeline() {
  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dragged, setDragged]     = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [newStage, setNewStage]   = useState('novo');

  useEffect(() => { fetchCrmLeads().then(l => { setLeads(l); setLoading(false); }); }, []);

  const openNew = (stage) => { setEditing(null); setNewStage(stage); setModalOpen(true); };
  const openEdit = (lead) => { setEditing(lead); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSave = async (form) => {
    if (editing) {
      setLeads(prev => prev.map(l => l.id === editing.id ? { ...l, ...form } : l));
      await updateCrmLead(editing.id, form);
    } else {
      const saved = await createCrmLead(form);
      if (saved) setLeads(prev => [saved, ...prev]);
    }
    setModalOpen(false);
  };

  const handleDelete = async (id) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setModalOpen(false);
    await deleteCrmLead(id);
  };

  const moveLead = async (id, etapa) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, etapa } : l));
    await updateCrmLead(id, { etapa });
  };

  const handleDrop = (e, stageKey) => {
    e.preventDefault();
    setDragOverCol(null);
    if (dragged && dragged.etapa !== stageKey) moveLead(dragged.id, stageKey);
    setDragged(null);
  };

  if (loading) return <div className="card py-14 text-center text-sm" style={TM}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={T}>Pipeline de Vendas</h2>
          <p className="text-xs mt-0.5" style={TM}>Arraste os cards entre as etapas</p>
        </div>
        <button onClick={() => openNew('novo')} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Novo Lead
        </button>
      </div>

      <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
        {STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.etapa === stage.key);
          const isOver = dragOverCol === stage.key;
          return (
            <div
              key={stage.key}
              onDragOver={e => { e.preventDefault(); setDragOverCol(stage.key); }}
              onDragLeave={() => setDragOverCol(prev => prev === stage.key ? null : prev)}
              onDrop={e => handleDrop(e, stage.key)}
              style={{
                flex: '0 0 260px', display: 'flex', flexDirection: 'column',
                background: isOver ? 'rgba(37,99,235,0.05)' : 'transparent',
                borderRadius: '14px', transition: 'background 0.15s',
                border: isOver ? `1.5px dashed ${PRIMARY}` : '1.5px dashed transparent',
                padding: '2px',
              }}
            >
              <div className="px-2 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                  <p className="text-xs font-bold" style={{ color: '#0F172A' }}>{stage.label}</p>
                  <span className="text-xs font-semibold ml-auto" style={{ color: '#94A3B8' }}>{stageLeads.length}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '80px' }}>
                {stageLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    dragging={dragged?.id === lead.id}
                    onDragStart={(e, l) => { setDragged(l); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragged(null); setDragOverCol(null); }}
                    onClick={openEdit}
                  />
                ))}
                <button
                  onClick={() => openNew(stage.key)}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                  style={{ border: '1.5px dashed rgba(0,0,0,0.1)', color: '#94A3B8', background: 'transparent', cursor: 'pointer' }}
                >
                  <Plus size={13} /> Adicionar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <LeadModal
          initial={editing}
          defaultEtapa={newStage}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Modal de Compromisso ───────────────────────────────────────────────────
const EVENT_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DB2777', '#0891B2', '#64748B'];

function EventModal({ initial, defaultDate, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial || {
    titulo: '', data: defaultDate, hora: '09:00', descricao: '', cor: EVENT_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.data) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={T}>{isEdit ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Título *</label>
            <input className="input-field" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Reunião, ligação..." autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Data</label>
              <input type="date" className="input-field" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Horário</label>
              <input type="time" className="input-field" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Descrição</label>
            <textarea className="input-field" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes do compromisso..." style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#64748B' }}>Cor</label>
            <div className="flex items-center gap-2">
              {EVENT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, cor: c }))}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', background: c, border: form.cor === c ? '2px solid #0F172A' : '2px solid transparent',
                    cursor: 'pointer', boxShadow: form.cor === c ? '0 0 0 2px white inset' : 'none', outline: form.cor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {isEdit && (
              <button type="button" className="btn-danger flex items-center gap-1.5" onClick={() => onDelete(initial.id)}>
                <Trash2 size={13} /> Excluir
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || !form.titulo.trim()} className="btn-primary" style={{ opacity: saving || !form.titulo.trim() ? 0.6 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Agenda (Calendário mensal) ─────────────────────────────────────────────
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const TODAY_ISO  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function Agenda() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor]   = useState(() => { const [y,m] = TODAY_ISO.split('-'); return { year: Number(y), month: Number(m) - 1 }; });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [newDate, setNewDate]     = useState(TODAY_ISO);

  useEffect(() => { fetchCrmEventos().then(ev => { setEvents(ev); setLoading(false); }); }, []);

  const gotoMonth = (delta) => {
    setCursor(({ year, month }) => {
      let m = month + delta, y = year;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };
  const gotoToday = () => { const [y,m] = TODAY_ISO.split('-'); setCursor({ year: Number(y), month: Number(m) - 1 }); };

  const openNew  = (dateIso) => { setEditing(null); setNewDate(dateIso); setModalOpen(true); };
  const openEdit = (ev) => { setEditing(ev); setModalOpen(true); };

  const handleSave = async (form) => {
    if (editing) {
      setEvents(prev => prev.map(e => e.id === editing.id ? { ...e, ...form } : e));
      await updateCrmEvento(editing.id, form);
    } else {
      const saved = await createCrmEvento(form);
      if (saved) setEvents(prev => [...prev, saved]);
    }
    setModalOpen(false);
  };

  const handleDelete = async (id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setModalOpen(false);
    await deleteCrmEvento(id);
  };

  // Monta a grade do mês (semanas completas)
  const { year, month } = cursor;
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDow; i++) {
    const d = daysInPrevMonth - startDow + i + 1;
    let m = month - 1, y = year; if (m < 0) { m = 11; y--; }
    cells.push({ day: d, month: m, year: y, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month, year, current: true });
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    let d = last.day + 1, m = last.month, y = last.year;
    const dim = new Date(y, m + 1, 0).getDate();
    if (d > dim) { d = 1; m++; if (m > 11) { m = 0; y++; } }
    cells.push({ day: d, month: m, year: y, current: false });
    if (cells.length >= 42) break;
  }

  const isoOf = (c) => `${c.year}-${String(c.month + 1).padStart(2,'0')}-${String(c.day).padStart(2,'0')}`;
  const eventsByDate = events.reduce((acc, ev) => { (acc[ev.data] ||= []).push(ev); return acc; }, {});

  if (loading) return <div className="card py-14 text-center text-sm" style={TM}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={T}>Agenda</h2>
          <p className="text-xs mt-0.5" style={TM}>Clique em um dia para adicionar um compromisso</p>
        </div>
        <button onClick={() => openNew(TODAY_ISO)} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Novo Compromisso
        </button>
      </div>

      <div className="card overflow-hidden">
        {/* Navegação */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2">
            <CalendarDays size={15} style={{ color: PRIMARY }} />
            <p className="text-sm font-bold" style={T}>{MONTH_FULL[month]} {year}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => gotoMonth(-1)} className="p-1.5 rounded-lg" style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}><ChevronLeft size={14} /></button>
            <button onClick={gotoToday} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569' }}>Hoje</button>
            <button onClick={() => gotoMonth(1)} className="p-1.5 rounded-lg" style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}><ChevronRight size={14} /></button>
          </div>
        </div>

        {/* Dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          {DOW_SHORT.map(d => (
            <div key={d} className="text-center py-2 text-xs font-semibold" style={{ color: '#94A3B8' }}>{d}</div>
          ))}
        </div>

        {/* Grade */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((c, idx) => {
            const iso = isoOf(c);
            const isToday = iso === TODAY_ISO;
            const dayEvents = eventsByDate[iso] || [];
            return (
              <div
                key={idx}
                onClick={() => openNew(iso)}
                style={{
                  minHeight: '92px', padding: '6px', cursor: 'pointer',
                  borderRight: (idx % 7 !== 6) ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  background: c.current ? 'transparent' : '#FAFBFC',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = c.current ? '#F8FAFC' : '#F4F5F7'}
                onMouseLeave={e => e.currentTarget.style.background = c.current ? 'transparent' : '#FAFBFC'}
              >
                <div className="flex items-center justify-center mb-1" style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: isToday ? PRIMARY : 'transparent',
                  color: isToday ? 'white' : c.current ? '#0F172A' : '#CBD5E1',
                  fontSize: '11px', fontWeight: isToday ? 800 : 600,
                }}>
                  {c.day}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayEvents.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); openEdit(ev); }}
                      style={{
                        fontSize: '10px', fontWeight: 600, color: 'white', background: ev.cor,
                        borderRadius: '5px', padding: '2px 5px', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
                      }}
                      title={`${ev.hora ? ev.hora + ' — ' : ''}${ev.titulo}`}
                    >
                      {ev.hora && <span style={{ opacity: 0.85 }}>{ev.hora} </span>}{ev.titulo}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', paddingLeft: '4px' }}>
                      +{dayEvents.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <EventModal
          initial={editing}
          defaultDate={newDate}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Modal de Cliente (novo / editar) ───────────────────────────────────────
function ClienteModal({ initial, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial || {
    nome: '', responsavel: '', contato: '', tipo: 'diaria', dataEntrada: TODAY_ISO,
  });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={T}>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Nome *</label>
            <input className="input-field" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do cliente" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Responsável</label>
              <input className="input-field" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Quem atende o cliente" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Contato</label>
              <input className="input-field" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Telefone ou e-mail" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Data de entrada</label>
            <input type="date" className="input-field" value={form.dataEntrada} onChange={e => setForm(f => ({ ...f, dataEntrada: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#64748B' }}>Tipo</label>
            <div className="flex gap-2">
              {TIPO_OPTIONS.map(t => (
                <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, tipo: t.key }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:  form.tipo === t.key ? t.bg : '#F8FAFC',
                    borderColor: form.tipo === t.key ? t.color : 'rgba(0,0,0,0.08)',
                    color:       form.tipo === t.key ? t.color : '#94A3B8',
                    cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {isEdit && (
              <button type="button" className="btn-danger flex items-center gap-1.5" onClick={() => onDelete(initial.id)}>
                <Trash2 size={13} /> Excluir
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || !form.nome.trim()} className="btn-primary" style={{ opacity: saving || !form.nome.trim() ? 0.6 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Carteira de Clientes ────────────────────────────────────────────────────
function Carteira() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);

  useEffect(() => { fetchCrmClientes().then(c => { setClientes(c); setLoading(false); }); }, []);

  const openNew  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (cliente) => { setEditing(cliente); setModalOpen(true); };

  const handleSave = async (form) => {
    if (editing) {
      setClientes(prev => prev.map(c => c.id === editing.id ? { ...c, ...form } : c));
      await updateCrmCliente(editing.id, form);
    } else {
      const saved = await createCrmCliente(form);
      if (saved) setClientes(prev => [...prev, saved].sort((a, b) => a.nome.localeCompare(b.nome)));
    }
    setModalOpen(false);
  };

  const handleDelete = async (id) => {
    setClientes(prev => prev.filter(c => c.id !== id));
    setModalOpen(false);
    await deleteCrmCliente(id);
  };

  if (loading) return <div className="card py-14 text-center text-sm" style={TM}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={T}>Carteira de Clientes</h2>
          <p className="text-xs mt-0.5" style={TM}>Clientes ativos e seus responsáveis</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      <div className="card overflow-hidden">
        {clientes.length === 0 ? (
          <div className="py-14 text-center">
            <Users size={22} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={TM}>Nenhum cliente cadastrado ainda</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-2.5 grid text-xs font-semibold"
              style={{ gridTemplateColumns: '1fr 1fr 1fr 90px 110px', gap: '8px', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span>Cliente</span>
              <span>Responsável</span>
              <span>Contato</span>
              <span>Tipo</span>
              <span>Entrada</span>
            </div>
            {clientes.map((c, idx) => {
              const tInfo = tipoInfo(c.tipo);
              return (
                <div key={c.id} onClick={() => openEdit(c)}
                  className="px-5 py-3 grid text-sm items-center"
                  style={{
                    gridTemplateColumns: '1fr 1fr 1fr 90px 110px', gap: '8px', cursor: 'pointer',
                    borderBottom: idx < clientes.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="font-semibold" style={{ color: '#0F172A' }}>{c.nome}</span>
                  <span style={{ color: '#64748B' }}>{c.responsavel || '—'}</span>
                  <span style={{ color: '#64748B' }}>{c.contato || '—'}</span>
                  <span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: tInfo.bg, color: tInfo.color }}>
                      {tInfo.label}
                    </span>
                  </span>
                  <span style={{ color: '#64748B', fontSize: '12px' }}>{c.dataEntrada ? c.dataEntrada.split('-').reverse().join('/') : '—'}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {modalOpen && (
        <ClienteModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── App CRM (standalone) ────────────────────────────────────────────────────
const TABS = [
  { key: 'pipeline', label: 'Pipeline',            icon: KanbanSquare },
  { key: 'agenda',   label: 'Agenda',               icon: CalendarDays },
  { key: 'carteira', label: 'Carteira de Clientes', icon: Users        },
];

export default function App() {
  const [tab, setTab] = useState('pipeline');
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('crm_unlocked') === 'true');

  if (!unlocked) return <CRMGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div style={{ minHeight: '100vh', background: '#EEF1F5', display: 'flex' }}>
      <aside style={{ width: '220px', flexShrink: 0, background: '#fff', borderRight: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div className="flex items-center gap-2 px-5" style={{ height: '60px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: PRIMARY_BG }}>
            <KanbanSquare size={15} style={{ color: PRIMARY }} />
          </div>
          <span className="text-sm font-bold" style={T}>CRM</span>
        </div>

        <nav className="flex-1 px-3 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full"
              style={{ background: tab === key ? PRIMARY : 'transparent', color: tab === key ? 'white' : '#64748B', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button
            onClick={() => { sessionStorage.removeItem('crm_unlocked'); setUnlocked(false); }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold w-full"
            style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', textAlign: 'left' }}
          >
            <LogOut size={16} /> Bloquear
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6" style={{ minWidth: 0 }}>
        {tab === 'pipeline' && <Pipeline />}
        {tab === 'agenda'   && <Agenda />}
        {tab === 'carteira' && <Carteira />}
      </main>
    </div>
  );
}
