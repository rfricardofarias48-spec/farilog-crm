import { useState, useEffect } from 'react';
import { fetchCrmMetas, createCrmMeta, updateCrmMeta, deleteCrmMeta } from './lib/db';
import {
  Target, Plus, X, Trash2, Check, ChevronUp, ChevronDown,
  CalendarDays, Trophy,
} from 'lucide-react';

const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function fmtDDMM(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// Uma meta está concluída quando tem ao menos 1 linha e todas estão atingidas
function metaConcluida(meta) {
  return meta.linhas.length > 0 && meta.linhas.every(l => l.atingida);
}

function proximoPrazo(meta) {
  const pendentes = meta.linhas.filter(l => !l.atingida && l.prazo);
  if (pendentes.length === 0) return null;
  return pendentes.map(l => l.prazo).sort()[0];
}

// ── Tela de detalhe da meta (modal grande) ─────────────────────────────────
function MetaDetalhe({ meta, isNew, onClose, onSave, onDelete }) {
  const [titulo, setTitulo] = useState(meta?.titulo || '');
  const [linhas, setLinhas] = useState(
    meta?.linhas?.length ? meta.linhas : [{ texto: '', prazo: '', atingida: false }]
  );
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const setLinha = (i, patch) => setLinhas(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLinha = () => setLinhas(ls => [...ls, { texto: '', prazo: '', atingida: false }]);
  const remLinha = (i) => setLinhas(ls => ls.filter((_, idx) => idx !== i));

  const atingidas = linhas.filter(l => l.atingida).length;
  const podeSalvar = titulo.trim() && linhas.some(l => l.texto.trim());

  const handleSalvar = async () => {
    const limpas = linhas
      .filter(l => l.texto.trim())
      .map(l => ({ texto: l.texto.trim(), prazo: l.prazo || '', atingida: Boolean(l.atingida) }));
    setSaving(true);
    const ok = await onSave({ titulo: titulo.trim(), linhas: limpas });
    setSaving(false);
    if (!ok) setErro('Não foi possível salvar. Verifique sua conexão e se a tabela crm_metas foi criada no Supabase.');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF' }}>
              <Target size={17} style={{ color: 'var(--signal)' }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {isNew ? 'Nova Meta' : 'Detalhes da Meta'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)' }}><X size={18} /></button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted)' }}>Título da meta *</label>
          <input
            className="input-field"
            style={{ fontSize: 15, fontWeight: 600 }}
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Ex.: Fechar 3 contratos de carreta no mês"
            autoFocus={isNew}
          />
        </div>

        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Linhas da meta (cada uma com prazo e status)</label>
          <span className="text-xs font-bold" style={{ color: atingidas === linhas.length && linhas.length > 0 ? 'var(--ok)' : 'var(--faint)' }}>
            {atingidas}/{linhas.length} atingidas
          </span>
        </div>

        <div className="space-y-2">
          {linhas.map((l, i) => {
            const vencida = l.prazo && !l.atingida && l.prazo < TODAY_ISO;
            return (
              <div key={i} className="meta-linha" style={{ background: l.atingida ? '#F0FDF4' : vencida ? '#FEF2F2' : '#F8FAFC' }}>
                <button
                  className={`task-check flex-shrink-0 ${l.atingida ? 'done' : ''}`}
                  onClick={() => setLinha(i, { atingida: !l.atingida })}
                  title={l.atingida ? 'Desmarcar atingida' : 'Marcar como atingida'}
                >
                  {l.atingida && <Check size={13} color="#fff" strokeWidth={3} />}
                </button>
                <input
                  className="input-field meta-linha-texto"
                  value={l.texto}
                  onChange={e => setLinha(i, { texto: e.target.value })}
                  placeholder={`Meta ${i + 1}...`}
                  style={l.atingida ? { textDecoration: 'line-through', color: 'var(--ok)' } : {}}
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <CalendarDays size={13} style={{ color: vencida ? '#DC2626' : 'var(--faint)' }} />
                  <input
                    type="date"
                    className="input-field meta-linha-prazo"
                    value={l.prazo}
                    onChange={e => setLinha(i, { prazo: e.target.value })}
                    style={{ color: vencida ? '#DC2626' : 'var(--muted)', fontWeight: vencida ? 700 : 500 }}
                  />
                </div>
                <span className="meta-linha-atingida-tag" style={{ color: l.atingida ? 'var(--ok)' : 'var(--faint)' }}>
                  {l.atingida ? 'Atingida' : 'Pendente'}
                </span>
                <button
                  onClick={() => remLinha(i)}
                  className="p-1.5 rounded-lg flex-shrink-0"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--faint)', display: 'flex' }}
                  title="Remover linha"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <button onClick={addLinha} className="meta-add-linha">
          <Plus size={13} /> Adicionar linha
        </button>

        {erro && <p className="text-xs font-semibold mt-3" style={{ color: '#DC2626' }}>{erro}</p>}

        <div className="flex items-center gap-2 pt-5">
          {!isNew && (
            <button type="button" className="btn-danger flex items-center gap-1.5" onClick={() => onDelete(meta.id)}>
              <Trash2 size={13} /> Excluir meta
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" disabled={saving || !podeSalvar} className="btn-primary" onClick={handleSalvar}>
            {saving ? 'Salvando...' : isNew ? 'Criar Meta' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Módulo principal: lista de metas ────────────────────────────────────────
export default function MetasModule() {
  const [metas, setMetas]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [detalhe, setDetalhe]   = useState(null); // { meta } | { novo: true }
  const [erro, setErro]         = useState('');

  useEffect(() => {
    fetchCrmMetas().then(m => { setMetas(m); setLoading(false); });
  }, []);

  const openNew = () => setDetalhe({ novo: true });
  const openMeta = (meta) => setDetalhe({ meta });

  const handleSave = async ({ titulo, linhas }) => {
    if (detalhe?.novo) {
      const ordem = metas.length === 0 ? 0 : Math.max(...metas.map(m => m.ordem)) + 1;
      const saved = await createCrmMeta({ titulo, linhas, ordem });
      if (!saved) return false;
      setMetas(prev => [...prev, saved]);
      setErro('');
      setDetalhe(null);
      return true;
    }
    const alvo = detalhe.meta;
    setMetas(prev => prev.map(m => m.id === alvo.id ? { ...m, titulo, linhas } : m));
    setDetalhe(null);
    const ok = await updateCrmMeta(alvo.id, { titulo, linhas });
    if (!ok) {
      setErro('Não foi possível salvar. Verifique sua conexão e se a tabela crm_metas foi criada no Supabase.');
      fetchCrmMetas().then(setMetas);
    }
    return ok;
  };

  const handleDelete = async (id) => {
    setMetas(prev => prev.filter(m => m.id !== id));
    setDetalhe(null);
    await deleteCrmMeta(id);
  };

  // Move a meta uma posição para cima/baixo trocando o campo `ordem` com a vizinha
  const mover = async (idx, delta) => {
    const alvo = idx + delta;
    if (alvo < 0 || alvo >= metas.length) return;
    const a = metas[idx], b = metas[alvo];
    const novo = [...metas];
    novo[idx] = { ...a, ordem: b.ordem };
    novo[alvo] = { ...b, ordem: a.ordem };
    novo.sort((x, y) => x.ordem - y.ordem || String(x.criadoEm).localeCompare(String(y.criadoEm)));
    setMetas(novo);
    await Promise.all([
      updateCrmMeta(a.id, { ordem: b.ordem }),
      updateCrmMeta(b.id, { ordem: a.ordem }),
    ]);
  };

  if (loading) return <div className="card py-14 text-center text-sm" style={{ color: 'var(--muted)' }}>Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Metas</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Clique em uma meta para ver e marcar as linhas atingidas</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> Nova Meta
        </button>
      </div>

      {erro && (
        <div className="card px-4 py-3 text-xs font-semibold" style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' }}>
          {erro}
        </div>
      )}

      {metas.length === 0 ? (
        <div className="card py-14 text-center">
          <Target size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhuma meta criada ainda</p>
          <button onClick={openNew} className="btn-primary flex items-center gap-1.5 mt-3 mx-auto">
            <Plus size={14} /> Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden scroll-x">
          <div style={{ minWidth: 560 }}>
            <div className="px-5 py-3 grid text-xs font-semibold"
              style={{ gridTemplateColumns: '28px 1fr 130px 110px 64px', gap: '10px', color: 'var(--faint)', borderBottom: '1px solid var(--line)', background: '#F8FAFC', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.08em' }}>
              <span />
              <span>Meta</span>
              <span>Próximo prazo</span>
              <span>Progresso</span>
              <span style={{ textAlign: 'center' }}>Ordem</span>
            </div>
            {metas.map((m, idx) => {
              const done = metaConcluida(m);
              const atingidas = m.linhas.filter(l => l.atingida).length;
              const prazo = proximoPrazo(m);
              const vencida = prazo && prazo < TODAY_ISO;
              return (
                <div
                  key={m.id}
                  className={`meta-row ${done ? 'done' : ''}`}
                  style={{
                    gridTemplateColumns: '28px 1fr 130px 110px 64px', gap: '10px',
                    borderBottom: idx < metas.length - 1 ? '1px solid var(--line)' : 'none',
                  }}
                  onClick={() => openMeta(m)}
                >
                  <span className="flex items-center justify-center">
                    {done
                      ? <Trophy size={16} style={{ color: 'var(--ok)' }} />
                      : <Target size={16} style={{ color: 'var(--signal)' }} />}
                  </span>
                  <span className="font-semibold truncate" style={{ color: done ? 'var(--ok)' : 'var(--text)' }}>
                    {m.titulo}
                    {done && (
                      <span className="meta-badge-done">Concluída</span>
                    )}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: done ? 'var(--faint)' : vencida ? '#DC2626' : 'var(--muted)' }}>
                    {done ? '—' : prazo ? fmtDDMM(prazo) : '—'}
                  </span>
                  <span className="text-xs font-bold" style={{ color: done ? 'var(--ok)' : 'var(--muted)' }}>
                    {atingidas}/{m.linhas.length} atingidas
                  </span>
                  <span className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => mover(idx, -1)}
                      disabled={idx === 0}
                      className="meta-ordem-btn"
                      title="Mover para cima"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => mover(idx, 1)}
                      disabled={idx === metas.length - 1}
                      className="meta-ordem-btn"
                      title="Mover para baixo"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {detalhe && (
        <MetaDetalhe
          meta={detalhe.meta}
          isNew={Boolean(detalhe.novo)}
          onClose={() => setDetalhe(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
