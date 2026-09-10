import { useState, useEffect } from 'react';
import {
  fetchCrmTarefas, createCrmTarefa, updateCrmTarefa, deleteCrmTarefa,
  fetchCrmDiarios, saveCrmDiario,
} from './lib/db';
import {
  Plus, Trash2, Check, ChartLine, ListTodo, History, CalendarCheck,
  ClipboardList, Award, CalendarDays, Flame, Info,
} from 'lucide-react';

// ── Helpers de data (datas tratadas como valores de calendário, sem fuso) ──
const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function isoAddDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function fmtDDMM(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DOW_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function dowOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function fmtLonga(iso) {
  return `${DOW_FULL[dowOf(iso)]}, ${fmtDDMM(iso)}`;
}

function fmtMes(iso) {
  const [y, m] = iso.split('-');
  return `${y}-${m}`;
}

function fmtHora(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const fmtNum = (x) => (x === null ? '—' : x.toFixed(1).replace('.', ','));

// Cor por faixa de nota: 1-3 vermelho, 4-6 âmbar, 7-10 verde
function notaColor(n) {
  if (n <= 3) return { fg: '#E5484D', bg: '#FDEDEE', solid: '#E5484D' };
  if (n <= 6) return { fg: '#D97706', bg: '#FBF1DF', solid: '#D97706' };
  return { fg: '#0FA36B', bg: '#E7F6EF', solid: '#0FA36B' };
}

function NotaBadge({ nota }) {
  const c = notaColor(nota);
  return (
    <span className="nota-badge" style={{ background: c.bg, color: c.fg }}>
      {nota}
    </span>
  );
}

// ── Card de estatística ────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: '16px 18px', flex: 1, minWidth: 150 }}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} style={{ color: accent ? 'var(--signal)' : 'var(--faint)' }} />}
        <p className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>{label}</p>
      </div>
      <p className="display" style={{ fontSize: 26, fontWeight: 700, color: accent ? 'var(--signal-deep)' : 'var(--text)', lineHeight: 1.1 }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}

// ── Gráfico dos últimos 15 dias ────────────────────────────────────────────
function Chart15({ diarios }) {
  const days = Array.from({ length: 15 }, (_, i) => isoAddDays(TODAY_ISO, i - 14));
  const byData = Object.fromEntries(diarios.map(d => [d.data, d]));
  const notas = days.map(d => byData[d.data]?.nota).filter(n => n > 0);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Notas dos últimos 15 dias</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Sua produtividade diária, de 1 a 10</p>
        </div>
        {media !== null && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'var(--signal-soft)', color: 'var(--signal-deep)' }}>
            Média no período: {fmtNum(media)}
          </span>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        {media !== null && (
          <div style={{
            position: 'absolute', left: 0, right: 0,
            bottom: `calc(${(media / 10) * 100}% + 24px)`,
            borderTop: '2px dashed rgba(59,130,246,0.5)',
            pointerEvents: 'none',
          }} />
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '7px', height: '170px', borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
          {days.map((iso) => {
            const reg = byData[iso];
            const nota = reg?.nota || 0;
            const isToday = iso === TODAY_ISO;
            const pct = nota > 0 ? (nota / 10) * 100 : 0;
            return (
              <div key={iso} className="bar-col" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }} title={reg ? `${fmtDDMM(iso)} — nota ${nota}` : `${fmtDDMM(iso)} — sem registro`}>
                <span className="display" style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--signal-deep)' : 'var(--muted)', visibility: nota ? 'visible' : 'hidden', lineHeight: 1 }}>
                  {nota || '·'}
                </span>
                <div style={{
                  width: '72%', maxWidth: 34, height: `${pct}%`, minHeight: nota ? 6 : 3,
                  borderRadius: '6px 6px 2px 2px',
                  background: nota
                    ? (isToday
                        ? 'linear-gradient(180deg, var(--signal) 0%, var(--signal-deep) 100%)'
                        : 'linear-gradient(180deg, #3B4E78 0%, var(--ink-700) 100%)')
                    : 'var(--line)',
                  transition: 'height 0.3s ease',
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '7px', paddingTop: '7px' }}>
          {days.map((iso) => {
            const [, m, d] = iso.split('-');
            const isToday = iso === TODAY_ISO;
            return (
              <div key={iso} style={{ flex: 1, textAlign: 'center', lineHeight: 1.25 }}>
                <p className="display" style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--signal-deep)' : 'var(--text)' }}>{d}</p>
                <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--faint)' }}>{m}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Sub-aba Dashboard ──────────────────────────────────────────────────────
function TasksDashboard({ tarefas, diarios }) {
  const mes = fmtMes(TODAY_ISO);
  const doMes = diarios.filter(d => fmtMes(d.data) === mes);
  const media = doMes.length ? doMes.reduce((a, d) => a + d.nota, 0) / doMes.length : null;
  const melhor = doMes.length ? doMes.reduce((a, b) => (b.nota > a.nota ? b : a)) : null;

  const diaData = (ts) => (ts ? ts.slice(0, 10) : '');
  const concluidasMes = tarefas.filter(t => t.concluida && diaData(t.concluidaEm).startsWith(mes)).length;
  const hojeReg = diarios.find(d => d.data === TODAY_ISO);
  const pendentes = tarefas.filter(t => !t.concluida).length;

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon={Award} label="Média do mês" value={fmtNum(media)} sub={`${doMes.length} dia(s) registrado(s)`} accent />
        <StatCard icon={CalendarCheck} label="Dias registrados" value={doMes.length} sub={`em ${mes.split('-')[1]}/${mes.split('-')[0]}`} />
        <StatCard icon={Check} label="Tarefas concluídas" value={concluidasMes} sub="neste mês" />
        <StatCard icon={Flame} label="Melhor dia" value={melhor ? melhor.nota : '—'} sub={melhor ? fmtDDMM(melhor.data) : 'sem registros'} />
      </div>

      <Chart15 diarios={diarios} />

      <div className="card" style={{ padding: '18px 20px' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <CalendarDays size={14} style={{ color: 'var(--signal)' }} />
          <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Hoje — {fmtLonga(TODAY_ISO)}</p>
        </div>
        {hojeReg ? (
          <div className="flex items-start gap-3">
            <NotaBadge nota={hojeReg.nota} />
            <p className="text-sm" style={{ color: 'var(--muted)', flex: 1, minWidth: 0 }}>
              {hojeReg.resumo || <span style={{ color: 'var(--faint)' }}>Sem resumo escrito.</span>}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Info size={13} style={{ color: 'var(--faint)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {pendentes > 0
                ? `Você tem ${pendentes} tarefa(s) pendente(s). Ao final do dia, registre seu resumo e sua nota na sub-aba Tarefas.`
                : 'Ao final do dia, registre seu resumo e sua nota na sub-aba Tarefas.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-aba Tarefas (lista + resumo do dia) ────────────────────────────────
function TasksList({ tarefas, hojeReg, onAdd, onToggle, onDelete, onSaveDia, savingDia }) {
  const [novoTitulo, setNovoTitulo] = useState('');
  const [resumo, setResumo] = useState(hojeReg?.resumo || '');
  const [nota, setNota] = useState(hojeReg?.nota || 0);
  const [feedback, setFeedback] = useState(null); // { tipo: 'ok' | 'erro', msg }
  const [erroTarefa, setErroTarefa] = useState(false);

  useEffect(() => {
    setResumo(hojeReg?.resumo || '');
    setNota(hojeReg?.nota || 0);
  }, [hojeReg?.atualizadoEm]);

  const pendentes = tarefas.filter(t => !t.concluida);
  const concluidas = tarefas.filter(t => t.concluida);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    setErroTarefa(false);
    const ok = await onAdd(novoTitulo.trim());
    if (!ok) setErroTarefa(true);
    else setNovoTitulo('');
  };

  const handleSave = async () => {
    setFeedback(null);
    const ok = await onSaveDia({ resumo, nota });
    if (ok) {
      setFeedback({ tipo: 'ok', msg: `Registro salvo às ${fmtHora(new Date().toISOString())}.` });
    } else {
      setFeedback({ tipo: 'erro', msg: 'Não foi possível salvar. Verifique sua conexão e se o script supabase_tarefas.sql foi executado no Supabase.' });
    }
  };

  const renderRow = (t) => {
    return (
      <div key={t.id} className="flex items-center gap-3" style={{ padding: '11px 6px', borderBottom: '1px solid var(--line)' }}>
        <button
          type="button"
          className={`task-check ${t.concluida ? 'done' : ''}`}
          onClick={() => onToggle(t)}
          aria-label={t.concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
        >
          {t.concluida && <Check size={13} color="white" strokeWidth={3} />}
        </button>
        <span style={{
          fontSize: 13.5, fontWeight: 500, flex: 1, minWidth: 0,
          color: t.concluida ? 'var(--faint)' : 'var(--text)',
          textDecoration: t.concluida ? 'line-through' : 'none',
        }}>
          {t.titulo}
        </span>
        <button
          type="button"
          onClick={() => onDelete(t)}
          className="flex items-center justify-center"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', padding: 6, borderRadius: 8 }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-soft)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.background = 'none'; }}
          aria-label="Excluir tarefa"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card" style={{ padding: '18px 20px' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ListTodo size={15} style={{ color: 'var(--signal)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Minhas tarefas</h3>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>
            {concluidas.length} de {tarefas.length} concluída(s)
          </span>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 mb-1">
          <input
            className="input-field"
            value={novoTitulo}
            onChange={e => setNovoTitulo(e.target.value)}
            placeholder="Adicionar uma tarefa..."
          />
          <button type="submit" className="btn-accent flex items-center gap-1.5" disabled={!novoTitulo.trim()} style={{ flexShrink: 0 }}>
            <Plus size={14} /> Adicionar
          </button>
        </form>

        {erroTarefa && (
          <p className="text-xs font-semibold mt-2" style={{ color: 'var(--danger)' }}>
            Não foi possível adicionar a tarefa. Verifique sua conexão e se o script supabase_tarefas.sql foi executado no Supabase.
          </p>
        )}

        {tarefas.length === 0 ? (
          <div className="py-9 text-center">
            <ClipboardList size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>Nenhuma tarefa ainda</p>
            <p className="text-xs mt-1" style={{ color: 'var(--faint)' }}>Adicione a primeira acima e acompanhe seu progresso.</p>
          </div>
        ) : (
          <>
            {pendentes.map(renderRow)}
            {pendentes.length > 0 && concluidas.length > 0 && <div style={{ height: 1 }} />}
            {concluidas.map(renderRow)}
          </>
        )}
      </div>

      <div className="card" style={{ padding: '18px 20px' }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarCheck size={15} style={{ color: 'var(--signal)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Resumo do dia</h3>
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>{fmtLonga(TODAY_ISO)}</span>
        </div>

        <textarea
          className="input-field"
          rows={3}
          value={resumo}
          onChange={e => setResumo(e.target.value)}
          placeholder="Como foi o dia? O que rendeu, o que travou..."
          style={{ resize: 'none' }}
        />

        <div className="mt-4">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Nota de produtividade (1 a 10)</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
              const sel = nota === n;
              const c = notaColor(n);
              return (
                <button
                  key={n}
                  type="button"
                  className="nota-pill"
                  onClick={() => setNota(n)}
                  style={sel ? { background: c.solid, borderColor: c.solid, color: '#fff' } : null}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button type="button" className="btn-accent" onClick={handleSave} disabled={!nota || savingDia}>
            {savingDia ? 'Salvando...' : hojeReg ? 'Atualizar registro do dia' : 'Salvar registro do dia'}
          </button>
          {feedback && (
            <span className="text-xs font-semibold" style={{ color: feedback.tipo === 'ok' ? 'var(--ok)' : 'var(--danger)' }}>
              {feedback.msg}
            </span>
          )}
          {!feedback && hojeReg && (
            <span className="text-xs" style={{ color: 'var(--faint)' }}>
              Último registro hoje às {fmtHora(hojeReg.atualizadoEm)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-aba Histórico ──────────────────────────────────────────────────────
function presetRange(key) {
  const [y, m] = TODAY_ISO.split('-').map(Number);
  if (key === 'hoje') return [TODAY_ISO, TODAY_ISO];
  if (key === '7dias') return [isoAddDays(TODAY_ISO, -6), TODAY_ISO];
  if (key === 'mes') {
    return [`${y}-${String(m).padStart(2, '0')}-01`, TODAY_ISO];
  }
  if (key === 'mesPassado') {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const ultimo = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    return [`${py}-${String(pm).padStart(2, '0')}-01`, `${py}-${String(pm).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`];
  }
  return null;
}

function detectPreset(de, ate) {
  for (const key of ['hoje', '7dias', 'mes', 'mesPassado']) {
    const [d, a] = presetRange(key);
    if (d === de && a === ate) return key;
  }
  return null;
}

function TasksHistory({ tarefas, diarios }) {
  const [de, setDe] = useState(() => presetRange('mes')[0]);
  const [ate, setAte] = useState(() => presetRange('mes')[1]);

  const noPeriodo = diarios.filter(d => d.data >= de && d.data <= ate).sort((a, b) => b.data.localeCompare(a.data));
  const media = noPeriodo.length ? noPeriodo.reduce((a, d) => a + d.nota, 0) / noPeriodo.length : null;
  const melhor = noPeriodo.length ? noPeriodo.reduce((a, b) => (b.nota > a.nota ? b : a)) : null;

  const diaData = (ts) => (ts ? ts.slice(0, 10) : '');
  const tarefasPorDia = {};
  tarefas.forEach(t => {
    const d = diaData(t.criadaEm);
    if (d) (tarefasPorDia[d] ||= []).push(t);
  });
  const concluidasNoPeriodo = tarefas.filter(t => t.concluida && diaData(t.concluidaEm) >= de && diaData(t.concluidaEm) <= ate).length;

  // Dias com registro ou com tarefas criadas no período
  const dias = new Set([...noPeriodo.map(d => d.data), ...Object.keys(tarefasPorDia).filter(d => d >= de && d <= ate)]);
  const linhas = [...dias].sort((a, b) => b.localeCompare(a));

  const preset = detectPreset(de, ate);
  const setPreset = (key) => { const [d, a] = presetRange(key); setDe(d); setAte(a); };

  return (
    <div className="space-y-4">
      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="flex items-center gap-2 mb-3">
          <History size={14} style={{ color: 'var(--signal)' }} />
          <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Período</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            ['hoje', 'Hoje'],
            ['7dias', 'Últimos 7 dias'],
            ['mes', 'Este mês'],
            ['mesPassado', 'Mês passado'],
          ].map(([key, label]) => (
            <button key={key} className={`chip ${preset === key ? 'active' : ''}`} onClick={() => setPreset(key)}>
              {label}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <label className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>De</label>
            <input type="date" className="input-field" style={{ width: 150, padding: '7px 10px' }} value={de} onChange={e => setDe(e.target.value)} />
            <label className="text-xs font-semibold" style={{ color: 'var(--faint)' }}>Até</label>
            <input type="date" className="input-field" style={{ width: 150, padding: '7px 10px' }} value={ate} onChange={e => setAte(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon={Award} label="Média de produtividade" value={fmtNum(media)} sub={`${noPeriodo.length} dia(s) com nota`} accent />
        <StatCard icon={Flame} label="Melhor dia" value={melhor ? melhor.nota : '—'} sub={melhor ? fmtDDMM(melhor.data) : 'sem registros'} />
        <StatCard icon={ClipboardList} label="Tarefas criadas" value={linhas.reduce((acc, d) => acc + (tarefasPorDia[d]?.length || 0), 0)} sub="no período" />
        <StatCard icon={Check} label="Tarefas concluídas" value={concluidasNoPeriodo} sub="no período" />
      </div>

      {linhas.length === 0 ? (
        <div className="card py-12 text-center">
          <History size={22} className="mx-auto mb-2" style={{ color: '#C6CFDD' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>Nenhum registro neste período</p>
          <p className="text-xs mt-1" style={{ color: 'var(--faint)' }}>Registre o resumo do dia na sub-aba Tarefas para construir seu histórico.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {linhas.map(dia => {
            const reg = diarios.find(d => d.data === dia);
            const doDia = (tarefasPorDia[dia] || []).slice().sort((a, b) => Number(a.concluida) - Number(b.concluida));
            const concl = doDia.filter(t => t.concluida).length;
            return (
              <div key={dia} className="card" style={{ padding: '15px 20px' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div style={{ minWidth: 86 }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--faint)', textTransform: 'capitalize' }}>{DOW_FULL[dowOf(dia)]}</p>
                    <p className="display text-sm font-bold" style={{ color: 'var(--text)' }}>{fmtDDMM(dia)}</p>
                  </div>
                  {reg ? <NotaBadge nota={reg.nota} /> : (
                    <span className="nota-badge" style={{ background: '#EEF1F6', color: 'var(--faint)' }}>—</span>
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {reg?.resumo
                      ? <p className="text-sm" style={{ color: 'var(--muted)' }}>{reg.resumo}</p>
                      : <p className="text-sm" style={{ color: 'var(--faint)' }}>{reg ? 'Sem resumo escrito.' : 'Dia sem registro de nota.'}</p>}
                  </div>
                  {doDia.length > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--signal-soft)', color: 'var(--signal-deep)' }}>
                      {concl}/{doDia.length} tarefa(s)
                    </span>
                  )}
                </div>
                {doDia.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5" style={{ paddingLeft: 98 }}>
                    {doDia.map(t => (
                      <span key={t.id} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{
                        background: t.concluida ? 'var(--ok-soft)' : '#EEF1F6',
                        color: t.concluida ? 'var(--ok)' : 'var(--muted)',
                        textDecoration: t.concluida ? 'line-through' : 'none',
                      }}>
                        {t.concluida && <Check size={10} strokeWidth={3} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />}
                        {t.titulo}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Módulo principal (sub-abas) ────────────────────────────────────────────
export default function TarefasModule() {
  const [sub, setSub] = useState('dashboard');
  const [tarefas, setTarefas] = useState([]);
  const [diarios, setDiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingDia, setSavingDia] = useState(false);

  useEffect(() => {
    Promise.all([fetchCrmTarefas(), fetchCrmDiarios()])
      .then(([t, d]) => { setTarefas(t); setDiarios(d); })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (titulo) => {
    const saved = await createCrmTarefa({ titulo });
    if (saved) {
      setTarefas(prev => [saved, ...prev]);
      return true;
    }
    return false;
  };

  const handleToggle = async (t) => {
    const novo = !t.concluida;
    setTarefas(prev => prev.map(x => x.id === t.id ? { ...x, concluida: novo, concluidaEm: novo ? new Date().toISOString() : null } : x));
    const ok = await updateCrmTarefa(t.id, { concluida: novo });
    if (!ok) setTarefas(prev => prev.map(x => x.id === t.id ? t : x));
  };

  const handleDelete = async (t) => {
    setTarefas(prev => prev.filter(x => x.id !== t.id));
    await deleteCrmTarefa(t.id);
  };

  const handleSaveDia = async ({ resumo, nota }) => {
    setSavingDia(true);
    const saved = await saveCrmDiario({ data: TODAY_ISO, resumo, nota });
    setSavingDia(false);
    if (saved) {
      setDiarios(prev => {
        const exists = prev.some(d => d.data === saved.data);
        return exists ? prev.map(d => d.data === saved.data ? saved : d) : [...prev, saved].sort((a, b) => a.data.localeCompare(b.data));
      });
      return true;
    }
    return false;
  };

  const hojeReg = diarios.find(d => d.data === TODAY_ISO);

  const SUBS = [
    { key: 'dashboard', label: 'Dashboard', icon: ChartLine },
    { key: 'tarefas',   label: 'Tarefas',   icon: ListTodo },
    { key: 'historico', label: 'Histórico', icon: History },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Tarefas</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Sua produtividade diária e seu histórico de notas</p>
        </div>
        <div className="subtabs">
          {SUBS.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`subtab ${sub === key ? 'active' : ''}`} onClick={() => setSub(key)}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card py-14 text-center text-sm" style={{ color: 'var(--muted)' }}>Carregando...</div>
      ) : (
        <>
          {sub === 'dashboard' && <TasksDashboard tarefas={tarefas} diarios={diarios} />}
          {sub === 'tarefas'   && <TasksList tarefas={tarefas} hojeReg={hojeReg} onAdd={handleAdd} onToggle={handleToggle} onDelete={handleDelete} onSaveDia={handleSaveDia} savingDia={savingDia} />}
          {sub === 'historico' && <TasksHistory tarefas={tarefas} diarios={diarios} />}
        </>
      )}
    </div>
  );
}
