import { useState, useEffect } from 'react';
import {
  fetchCrmLeads, createCrmLead, updateCrmLead, deleteCrmLead,
  fetchCrmEventos, createCrmEvento, updateCrmEvento, deleteCrmEvento,
  fetchCrmClientes, createCrmCliente, updateCrmCliente, deleteCrmCliente,
  fetchCrmEmpresas, createCrmEmpresa, updateCrmEmpresa, deleteCrmEmpresa,
} from './lib/db';
import TarefasModule from './Tarefas';
import {
  Plus, X, Trash2, ChevronLeft, ChevronRight,
  CalendarDays, Lock, KanbanSquare, LogOut, Users, MapPin,
  Building2, Pencil, Truck, ListTodo,
} from 'lucide-react';

// ── Paleta Farilog ─────────────────────────────────────────────────────────
const C = {
  text:       '#101B2F',
  muted:      '#5C6B84',
  faint:      '#92A0B5',
  line:       '#E4E9F1',
  signal:     '#FF6B2C',
  signalDeep: '#F25C1F',
  signalSoft: '#FFF0E6',
  ink900:     '#0B1426',
  ink950:     '#070D1A',
};

const T  = { color: C.text };
const TM = { color: C.muted };

const CRM_PASSWORD = '676012';

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ── Marca ──────────────────────────────────────────────────────────────────
function LogoMark({ size = 34 }) {
  return (
    <div className="flex items-center justify-center flex-shrink-0" style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: 'linear-gradient(135deg, #FF8A3C 0%, #F25C1F 100%)',
      boxShadow: '0 4px 14px rgba(255,107,44,0.4)',
    }}>
      <Truck size={Math.round(size * 0.52)} color="#070D1A" strokeWidth={2.4} />
    </div>
  );
}

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
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1100px 520px at 18% -12%, rgba(255,107,44,0.16), transparent 62%), linear-gradient(180deg, #0B1426 0%, #070D1A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* linhas de estrada ao fundo */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 26px)',
      }} />
      <div style={{ width: '100%', maxWidth: 372, position: 'relative' }}>
        <div className="card" style={{ padding: '34px 32px 30px', borderRadius: 22, boxShadow: '0 30px 90px rgba(0,0,0,0.5)' }}>
          <div className="flex flex-col items-center mb-6">
            <LogoMark size={52} />
            <h2 className="mt-4" style={{ fontSize: 21, fontWeight: 700, color: C.text, margin: '14px 0 0' }}>Farilog CRM</h2>
            <p className="text-xs mt-1 text-center" style={{ color: C.muted }}>Área restrita · digite sua senha para acessar</p>
          </div>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              className="input-field"
              style={{ textAlign: 'center', padding: '12px 14px', fontSize: 14, letterSpacing: '0.2em' }}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••"
              autoFocus
            />
            {error && (
              <p className="text-xs mt-2 text-center font-semibold" style={{ color: C.danger }}>{error}</p>
            )}
            <button type="submit" className="btn-accent w-full mt-4" style={{ width: '100%', padding: '12px', fontSize: 14 }}>
              Entrar
            </button>
          </form>
        </div>
        <p className="text-center mt-4" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.28)' }}>
          FARILOG · LOGÍSTICA
        </p>
      </div>
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

function formatDDMM(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── Modal de Empresa ────────────────────────────────────────────────────────
function EmpresaModal({ initial, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial || { nome: '' });
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
          <h3 className="text-base font-bold" style={T}>{isEdit ? 'Editar Empresa' : 'Nova Empresa'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Nome da Empresa *</label>
            <input className="input-field" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Digite o nome da empresa" autoFocus />
          </div>

          <div className="flex items-center gap-2 pt-2">
            {isEdit && (
              <button type="button" className="btn-danger flex items-center gap-1.5" onClick={() => onDelete(initial.id)}>
                <Trash2 size={13} /> Excluir
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || !form.nome.trim()} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Aba Empresas (Seleção de empresa ativa) ─────────────────────────────────
function EmpresaSelector({ empresaAtiva, onSelectEmpresa }) {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const MAX_EMPRESAS = 3;
  const podeCriarNova = empresas.length < MAX_EMPRESAS;

  useEffect(() => {
    fetchCrmEmpresas().then(e => {
      setEmpresas(e);
      setLoading(false);
      // Se não houver empresa ativa e houver empresas, seleciona a Farilog (ou a primeira)
      if (!empresaAtiva && e.length > 0) {
        const farilog = e.find(emp => emp.nome === 'Farilog');
        onSelectEmpresa(farilog ? farilog.nome : e[0].nome);
      }
    });
  }, []);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (emp) => { setEditing(emp); setModalOpen(true); };

  const handleSave = async (form) => {
    if (editing) {
      const oldNome = editing.nome;
      setEmpresas(prev => prev.map(e => e.id === editing.id ? { ...e, ...form } : e));
      await updateCrmEmpresa(editing.id, form);
      // Se a empresa que foi renomeada é a ativa, atualiza o nome ativo
      if (empresaAtiva === oldNome) {
        onSelectEmpresa(form.nome);
      }
    } else {
      const saved = await createCrmEmpresa(form);
      if (saved) {
        setEmpresas(prev => [...prev, saved]);
        // Se for a primeira empresa, seleciona automaticamente
        if (empresas.length === 0) {
          onSelectEmpresa(saved.nome);
        }
      }
    }
    setModalOpen(false);
  };

  const handleDelete = async (id) => {
    const deletedEmpresa = empresas.find(e => e.id === id);
    setEmpresas(prev => {
      const filtered = prev.filter(e => e.id !== id);
      // Se a empresa ativa foi excluída, seleciona a primeira disponível
      if (empresaAtiva === deletedEmpresa?.nome) {
        if (filtered.length > 0) {
          onSelectEmpresa(filtered[0].nome);
        } else {
          onSelectEmpresa(null);
        }
      }
      return filtered;
    });
    setModalOpen(false);
    await deleteCrmEmpresa(id);
  };

  if (loading) return <div className="card py-14 text-center text-sm" style={{ color: C.muted }}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={T}>Empresas</h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Selecione a empresa que deseja gerenciar</p>
        </div>
        {podeCriarNova ? (
          <button onClick={openNew} className="btn-primary flex items-center gap-1.5">
            <Plus size={14} /> Nova Empresa
          </button>
        ) : (
          <span className="text-xs font-semibold px-3 py-2" style={{ color: C.faint }}>
            Máximo de {MAX_EMPRESAS} empresas
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empresas.map(emp => {
          const isActive = empresaAtiva === emp.nome;
          return (
            <div
              key={emp.id}
              onClick={() => onSelectEmpresa(emp.nome)}
              style={{
                cursor: 'pointer',
                background: isActive ? C.signalSoft : 'white',
                border: `2px solid ${isActive ? C.signal : C.line}`,
                borderRadius: '16px',
                padding: '20px',
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = '#C9D2E0'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = C.line; }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isActive ? 'white' : '#F2F4F8' }}>
                  <Building2 size={18} style={{ color: isActive ? C.signalDeep : C.muted }} />
                </div>
                {isActive && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: C.signal, color: C.ink950 }}>
                    Ativa
                  </span>
                )}
              </div>
              <p className="text-sm font-bold" style={T}>{emp.nome}</p>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={e => { e.stopPropagation(); openEdit(emp); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: '#F2F4F8', border: 'none', cursor: 'pointer', color: C.muted }}
                >
                  <Pencil size={12} /> Editar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {empresas.length < 3 && (
        <div className="card py-10 text-center" style={{ border: '2px dashed #C9D2E0', background: 'transparent', boxShadow: 'none' }}>
          <Building2 size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
          <p className="text-sm font-semibold" style={{ color: C.muted }}>
            {empresas.length === 0 ? 'Nenhuma empresa cadastrada ainda' : `Você pode cadastrar mais ${MAX_EMPRESAS - empresas.length} empresa(s)`}
          </p>
          <button onClick={openNew} className="btn-primary flex items-center gap-1.5 mt-3 mx-auto">
            <Plus size={14} /> Cadastrar Empresa
          </button>
        </div>
      )}

      {modalOpen && (
        <EmpresaModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Modal de Lead (novo / editar) ─────────────────────────────────────────
function LeadModal({ initial, defaultEtapa, onClose, onSave, onDelete, empresaAtiva }) {
  const [form, setForm] = useState(initial || {
    nomeEmpresa: '', contato: '', telefone: '', cidade: '', quantidade: '', etapa: defaultEtapa || 'novo', tipo: 'diaria', ultimoContato: '',
    reuniaoData: '', reuniaoHora: '09:00', observacoes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const isEdit = Boolean(initial);
  const qtyLabel = form.tipo === 'carreta' ? 'Descargas/Semana' : 'Vagas';
  const isReuniao = form.etapa === 'reuniao';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nomeEmpresa.trim()) return;
    if (isReuniao && (!form.reuniaoData || !form.reuniaoHora)) {
      setError('Informe a data e o horário da reunião.');
      return;
    }
    setError('');
    setSaving(true);
    await onSave({ ...form, quantidade: Number(form.quantidade) || 0, empresa: empresaAtiva });
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={T}>{isEdit ? 'Editar Lead' : 'Novo Lead'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Empresa *</label>
            <input className="input-field" value={form.nomeEmpresa} onChange={e => setForm(f => ({ ...f, nomeEmpresa: e.target.value }))} placeholder="Nome da empresa" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Contato</label>
              <input className="input-field" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Nome do contato" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Telefone</label>
              <input className="input-field" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Cidade</label>
              <input className="input-field" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Cidade do lead" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Último Contato</label>
              <input type="date" className="input-field" value={form.ultimoContato} onChange={e => setForm(f => ({ ...f, ultimoContato: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>{qtyLabel}</label>
              <input type="number" step="1" min="0" className="input-field" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Etapa</label>
              <select className="input-field" value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {isReuniao && (
            <div className="p-3 rounded-xl" style={{ background: '#F5F3FF', border: '1px solid rgba(124,58,237,0.25)' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#7C3AED' }}>Detalhes da reunião</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Data *</label>
                  <input type="date" className="input-field" value={form.reuniaoData} onChange={e => setForm(f => ({ ...f, reuniaoData: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Horário *</label>
                  <input type="time" className="input-field" value={form.reuniaoHora} onChange={e => setForm(f => ({ ...f, reuniaoHora: e.target.value }))} />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: C.faint }}>Isso cria (ou atualiza) um compromisso na Agenda automaticamente.</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: C.muted }}>Tipo</label>
            <div className="flex gap-2">
              {TIPO_OPTIONS.map(t => (
                <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, tipo: t.key }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:  form.tipo === t.key ? t.bg : '#F8FAFC',
                    borderColor: form.tipo === t.key ? t.color : C.line,
                    color:       form.tipo === t.key ? t.color : C.faint,
                    cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Observações</label>
            <textarea className="input-field" rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes do lead..." style={{ resize: 'none' }} />
          </div>

          {error && <p className="text-xs font-semibold" style={{ color: C.danger }}>{error}</p>}

          <div className="flex items-center gap-2 pt-2">
            {isEdit && (
              <button type="button" className="btn-danger flex items-center gap-1.5" onClick={() => onDelete(initial.id)}>
                <Trash2 size={13} /> Excluir
              </button>
            )}
            <div className="flex-1" />
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || !form.nomeEmpresa.trim()} className="btn-primary">
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
      className="card"
      style={{
        padding: '12px 14px', cursor: 'grab', opacity: dragging ? 0.4 : 1,
        transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
        borderLeft: `3px solid ${tInfo.color}`,
      }}
    >
      <p className="text-sm font-bold" style={T}>
        {lead.contato ? lead.contato : lead.nomeEmpresa}
        {lead.contato && <span style={{ fontWeight: 500, color: C.faint }}> ({lead.nomeEmpresa})</span>}
      </p>
      {lead.ultimoContato && (
        <p className="text-xs mt-1" style={{ color: C.muted }}>
          ({formatDDMM(lead.ultimoContato)})
        </p>
      )}
      {lead.cidade && (
        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: C.muted }}>
          <MapPin size={11} /> {lead.cidade}
        </p>
      )}
      {lead.etapa === 'reuniao' && lead.reuniaoData && (
        <p className="text-xs font-bold mt-1.5 flex items-center gap-1" style={{ color: '#7C3AED' }}>
          <CalendarDays size={11} /> {formatDDMM(lead.reuniaoData)}{lead.reuniaoHora ? ` às ${lead.reuniaoHora}` : ''}
        </p>
      )}
      {lead.quantidade > 0 && (
        <p className="text-xs font-bold mt-1.5" style={{ color: C.signalDeep }}>
          {lead.quantidade} {lead.tipo === 'carreta' ? 'descargas/semana' : 'vagas'}
        </p>
      )}
    </div>
  );
}

// ── Pipeline (Kanban) ──────────────────────────────────────────────────────
function Pipeline({ empresaAtiva }) {
  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [dragged, setDragged]     = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [newStage, setNewStage]   = useState('novo');

  useEffect(() => {
    setLoading(true);
    fetchCrmLeads(empresaAtiva).then(l => { setLeads(l); setLoading(false); });
  }, [empresaAtiva]);

  const openNew = (stage) => { setEditing(null); setNewStage(stage); setModalOpen(true); };
  const openEdit = (lead) => { setEditing(lead); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const syncReuniaoEvento = async (leadRecord, form) => {
    if (form.etapa !== 'reuniao' || !form.reuniaoData || !form.reuniaoHora) return null;
    const titulo    = `Reunião — ${form.contato ? `${form.contato} (${form.nomeEmpresa})` : form.nomeEmpresa}`;
    const descricao = form.observacoes || `Reunião com lead ${form.nomeEmpresa}`;
    const cor       = STAGES.find(s => s.key === 'reuniao').color;
    if (leadRecord.eventoId) {
      await updateCrmEvento(leadRecord.eventoId, { titulo, data: form.reuniaoData, hora: form.reuniaoHora, descricao, cor });
      return leadRecord.eventoId;
    }
    const evento = await createCrmEvento({ titulo, data: form.reuniaoData, hora: form.reuniaoHora, descricao, cor, empresa: empresaAtiva });
    if (evento) await updateCrmLead(leadRecord.id, { eventoId: evento.id });
    return evento?.id ?? null;
  };

  const handleSave = async (form) => {
    let leadRecord;
    if (editing) {
      leadRecord = { ...editing, ...form };
      setLeads(prev => prev.map(l => l.id === editing.id ? leadRecord : l));
      await updateCrmLead(editing.id, form);
    } else {
      leadRecord = await createCrmLead(form);
      if (leadRecord) setLeads(prev => [leadRecord, ...prev]);
    }

    if (leadRecord) {
      const eventoId = await syncReuniaoEvento(leadRecord, form);
      if (eventoId && eventoId !== leadRecord.eventoId) {
        setLeads(prev => prev.map(l => l.id === leadRecord.id ? { ...l, eventoId } : l));
      }
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
    if (dragged && dragged.etapa !== stageKey) {
      if (stageKey === 'reuniao') {
        setEditing({ ...dragged, etapa: 'reuniao' });
        setNewStage('reuniao');
        setModalOpen(true);
      } else {
        moveLead(dragged.id, stageKey);
      }
    }
    setDragged(null);
  };

  if (loading) return <div className="card py-14 text-center text-sm" style={TM}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
                flex: '0 0 264px', display: 'flex', flexDirection: 'column',
                background: isOver ? 'rgba(255,107,44,0.05)' : 'transparent',
                borderRadius: '14px', transition: 'background 0.15s',
                border: isOver ? '1.5px dashed var(--signal)' : '1.5px dashed transparent',
                padding: '2px',
              }}
            >
              <div className="px-2 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                  <p className="text-xs font-bold" style={T}>{stage.label}</p>
                  <span className="text-xs font-semibold ml-auto" style={{ color: C.faint }}>{stageLeads.length}</span>
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
                  style={{ border: '1.5px dashed #C9D2E0', color: C.faint, background: 'transparent', cursor: 'pointer' }}
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
          empresaAtiva={empresaAtiva}
        />
      )}
    </div>
  );
}

// ── Modal de Compromisso ───────────────────────────────────────────────────
const EVENT_COLORS = ['#FF6B2C', '#7C3AED', '#059669', '#DB2777', '#0891B2', '#1B2A4A'];

function EventModal({ initial, defaultDate, onClose, onSave, onDelete, empresaAtiva }) {
  const [form, setForm] = useState(initial || {
    titulo: '', data: defaultDate, hora: '09:00', descricao: '', cor: EVENT_COLORS[0],
  });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.data) return;
    setSaving(true);
    await onSave({ ...form, empresa: empresaAtiva });
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={T}>{isEdit ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Título *</label>
            <input className="input-field" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Reunião, ligação..." autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Data</label>
              <input type="date" className="input-field" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Horário</label>
              <input type="time" className="input-field" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Descrição</label>
            <textarea className="input-field" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes do compromisso..." style={{ resize: 'none' }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: C.muted }}>Cor</label>
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
            <button type="submit" disabled={saving || !form.titulo.trim()} className="btn-primary">
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

function Agenda({ empresaAtiva }) {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor]   = useState(() => { const [y,m] = TODAY_ISO.split('-'); return { year: Number(y), month: Number(m) - 1 }; });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [newDate, setNewDate]     = useState(TODAY_ISO);

  useEffect(() => {
    setLoading(true);
    fetchCrmEventos(empresaAtiva).then(ev => { setEvents(ev); setLoading(false); });
  }, [empresaAtiva]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
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
        <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-2" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <CalendarDays size={15} style={{ color: C.signal }} />
            <p className="text-sm font-bold" style={T}>{MONTH_FULL[month]} {year}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => gotoMonth(-1)} className="p-1.5 rounded-lg" style={{ background: '#F2F4F8', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}><ChevronLeft size={14} /></button>
            <button onClick={gotoToday} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#F2F4F8', border: 'none', cursor: 'pointer', color: C.muted }}>Hoje</button>
            <button onClick={() => gotoMonth(1)} className="p-1.5 rounded-lg" style={{ background: '#F2F4F8', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}><ChevronRight size={14} /></button>
          </div>
        </div>

        {/* Dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--line)', background: '#F8FAFC' }}>
          {DOW_SHORT.map(d => (
            <div key={d} className="text-center py-2 text-xs font-semibold" style={{ color: C.faint }}>{d}</div>
          ))}
        </div>

        {/* Grade */}
        <div className="scroll-x">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minWidth: 640 }}>
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
                    borderRight: (idx % 7 !== 6) ? '1px solid var(--line)' : 'none',
                    borderBottom: '1px solid var(--line)',
                    background: c.current ? 'transparent' : '#F8FAFC',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = c.current ? '#F8FAFC' : '#F1F4F8'}
                  onMouseLeave={e => e.currentTarget.style.background = c.current ? 'transparent' : '#F8FAFC'}
                >
                  <div className="flex items-center justify-center mb-1" style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: isToday ? C.signal : 'transparent',
                    color: isToday ? C.ink950 : c.current ? C.text : '#C6CFDD',
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
                          borderRadius: '6px', padding: '2.5px 6px', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
                        }}
                        title={`${ev.hora ? ev.hora + ' — ' : ''}${ev.titulo}`}
                      >
                        {ev.hora && <span style={{ opacity: 0.85 }}>{ev.hora} </span>}{ev.titulo}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '10px', fontWeight: 600, color: C.faint, paddingLeft: '4px' }}>
                        +{dayEvents.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalOpen && (
        <EventModal
          initial={editing}
          defaultDate={newDate}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          empresaAtiva={empresaAtiva}
        />
      )}
    </div>
  );
}

// ── Modal de Cliente (novo / editar) ───────────────────────────────────────
function ClienteModal({ initial, onClose, onSave, onDelete, empresaAtiva }) {
  const [form, setForm] = useState(initial || {
    nome: '', responsavel: '', contato: '', tipo: 'diaria', dataEntrada: TODAY_ISO,
  });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    await onSave({ ...form, empresa: empresaAtiva });
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={T}>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.faint }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Nome *</label>
            <input className="input-field" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do cliente" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Responsável</label>
              <input className="input-field" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Quem atende o cliente" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Contato</label>
              <input className="input-field" value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Telefone ou e-mail" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: C.muted }}>Data de entrada</label>
            <input type="date" className="input-field" value={form.dataEntrada} onChange={e => setForm(f => ({ ...f, dataEntrada: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: C.muted }}>Tipo</label>
            <div className="flex gap-2">
              {TIPO_OPTIONS.map(t => (
                <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, tipo: t.key }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:  form.tipo === t.key ? t.bg : '#F8FAFC',
                    borderColor: form.tipo === t.key ? t.color : C.line,
                    color:       form.tipo === t.key ? t.color : C.faint,
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
            <button type="submit" disabled={saving || !form.nome.trim()} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Carteira de Clientes ────────────────────────────────────────────────────
function Carteira({ empresaAtiva }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchCrmClientes(empresaAtiva).then(c => { setClientes(c); setLoading(false); });
  }, [empresaAtiva]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={T}>Carteira de Clientes</h2>
          <p className="text-xs mt-0.5" style={TM}>Clientes ativos e seus responsáveis</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      <div className="card overflow-hidden scroll-x">
        {clientes.length === 0 ? (
          <div className="py-14 text-center">
            <Users size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
            <p className="text-sm" style={TM}>Nenhum cliente cadastrado ainda</p>
          </div>
        ) : (
          <div style={{ minWidth: 720 }}>
            <div className="px-5 py-3 grid text-xs font-semibold"
              style={{ gridTemplateColumns: '1fr 1fr 1fr 90px 110px', gap: '8px', color: C.faint, borderBottom: '1px solid var(--line)', background: '#F8FAFC', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.08em' }}>
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
                  className="table-row px-5 py-3 grid text-sm items-center"
                  style={{
                    gridTemplateColumns: '1fr 1fr 1fr 90px 110px', gap: '8px',
                    borderBottom: idx < clientes.length - 1 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <span className="font-semibold" style={T}>{c.nome}</span>
                  <span style={{ color: C.muted }}>{c.responsavel || '—'}</span>
                  <span style={{ color: C.muted }}>{c.contato || '—'}</span>
                  <span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: tInfo.bg, color: tInfo.color }}>
                      {tInfo.label}
                    </span>
                  </span>
                  <span style={{ color: C.muted, fontSize: '12px' }}>{c.dataEntrada ? c.dataEntrada.split('-').reverse().join('/') : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <ClienteModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          empresaAtiva={empresaAtiva}
        />
      )}
    </div>
  );
}

// ── App CRM (standalone) ────────────────────────────────────────────────────
const TABS = [
  { key: 'empresa',  label: 'Empresa',             icon: Building2 },
  { key: 'pipeline', label: 'Pipeline',            icon: KanbanSquare },
  { key: 'agenda',   label: 'Agenda',              icon: CalendarDays },
  { key: 'carteira', label: 'Carteira de Clientes', icon: Users },
  { key: 'tarefas',  label: 'Tarefas',             icon: ListTodo },
];

export default function App() {
  const [tab, setTab] = useState('empresa');
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('crm_unlocked') === 'true');
  const [empresaAtiva, setEmpresaAtiva] = useState(null);

  if (!unlocked) return <CRMGate onUnlock={() => setUnlocked(true)} />;

  const precisaEmpresa = tab !== 'empresa' && tab !== 'tarefas' && !empresaAtiva;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="flex items-center gap-2.5 px-4" style={{ height: 62, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <LogoMark size={32} />
          <div className="side-brand-text" style={{ lineHeight: 1.15 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 700, color: '#fff', margin: 0 }}>Farilog</p>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>CRM</p>
          </div>
        </div>

        <nav className="side-nav flex-1 px-3 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`side-link ${tab === key ? 'active' : ''}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        {empresaAtiva && (
          <div className="side-empresa px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl" style={{ background: 'rgba(255,107,44,0.12)', border: '1px solid rgba(255,107,44,0.25)' }}>
              <Building2 size={14} style={{ color: C.signal }} />
              <span className="text-xs font-semibold truncate" style={{ color: '#FFB48C' }}>{empresaAtiva}</span>
            </div>
          </div>
        )}

        <div className="side-footer p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => { sessionStorage.removeItem('crm_unlocked'); setUnlocked(false); }}
            className="side-link"
            title="Bloquear"
          >
            <LogOut size={16} /> <span className="side-link-text">Bloquear</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <div className="content-wrap">
          {tab === 'empresa'  && <EmpresaSelector empresaAtiva={empresaAtiva} onSelectEmpresa={setEmpresaAtiva} />}
          {tab === 'pipeline' && <Pipeline empresaAtiva={empresaAtiva} />}
          {tab === 'agenda'   && <Agenda empresaAtiva={empresaAtiva} />}
          {tab === 'carteira' && <Carteira empresaAtiva={empresaAtiva} />}
          {tab === 'tarefas'  && <TarefasModule />}

          {precisaEmpresa && (
            <div className="card py-14 text-center">
              <Building2 size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
              <p className="text-sm" style={TM}>Selecione uma empresa na aba "Empresa" para começar</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
