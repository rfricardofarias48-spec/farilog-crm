import { supabase } from './supabase';

// ── Leads (Pipeline) ────────────────────────────────────────────────────────

function mapCrmLead(r) {
  return {
    id:          r.id,
    nomeEmpresa: r.nome_empresa,
    contato:     r.contato || '',
    telefone:    r.telefone || '',
    cidade:      r.cidade || '',
    quantidade:  Number(r.quantidade ?? 0),
    etapa:       r.etapa,
    tipo:        r.tipo || 'diaria',
    observacoes: r.observacoes || '',
    criadoEm:    r.criado_em,
  };
}

export async function fetchCrmLeads() {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) { console.error('[db] fetchCrmLeads:', error.message); return []; }
  return data.map(mapCrmLead);
}

export async function createCrmLead({ nomeEmpresa, contato, telefone, cidade, quantidade, etapa, tipo, observacoes }) {
  const { data, error } = await supabase
    .from('crm_leads')
    .insert({
      nome_empresa: nomeEmpresa,
      contato:      contato || null,
      telefone:     telefone || null,
      cidade:       cidade || null,
      quantidade:   quantidade || 0,
      etapa:        etapa || 'novo',
      tipo:         tipo || 'diaria',
      observacoes:  observacoes || null,
    })
    .select()
    .single();
  if (error) { console.error('[db] createCrmLead:', error.message); return null; }
  return mapCrmLead(data);
}

export async function updateCrmLead(id, patch) {
  const p = {};
  if (patch.nomeEmpresa !== undefined) p.nome_empresa = patch.nomeEmpresa;
  if (patch.contato     !== undefined) p.contato      = patch.contato;
  if (patch.telefone    !== undefined) p.telefone     = patch.telefone;
  if (patch.cidade      !== undefined) p.cidade       = patch.cidade;
  if (patch.quantidade  !== undefined) p.quantidade   = patch.quantidade;
  if (patch.etapa       !== undefined) p.etapa        = patch.etapa;
  if (patch.tipo        !== undefined) p.tipo         = patch.tipo;
  if (patch.observacoes !== undefined) p.observacoes  = patch.observacoes;
  const { error } = await supabase.from('crm_leads').update(p).eq('id', id);
  if (error) { console.error('[db] updateCrmLead:', error.message); return false; }
  return true;
}

export async function deleteCrmLead(id) {
  const { error } = await supabase.from('crm_leads').delete().eq('id', id);
  if (error) { console.error('[db] deleteCrmLead:', error.message); return false; }
  return true;
}

// ── Agenda (Eventos) ────────────────────────────────────────────────────────

function mapCrmEvento(r) {
  return {
    id:        r.id,
    titulo:    r.titulo,
    data:      r.data,
    hora:      r.hora ? r.hora.slice(0, 5) : '',
    descricao: r.descricao || '',
    cor:       r.cor || '#2563EB',
  };
}

export async function fetchCrmEventos() {
  const { data, error } = await supabase
    .from('crm_eventos')
    .select('*')
    .order('data')
    .order('hora');
  if (error) { console.error('[db] fetchCrmEventos:', error.message); return []; }
  return data.map(mapCrmEvento);
}

export async function createCrmEvento({ titulo, data, hora, descricao, cor }) {
  const { data: row, error } = await supabase
    .from('crm_eventos')
    .insert({ titulo, data, hora: hora || null, descricao: descricao || null, cor: cor || '#2563EB' })
    .select()
    .single();
  if (error) { console.error('[db] createCrmEvento:', error.message); return null; }
  return mapCrmEvento(row);
}

export async function updateCrmEvento(id, patch) {
  const p = {};
  if (patch.titulo    !== undefined) p.titulo    = patch.titulo;
  if (patch.data      !== undefined) p.data      = patch.data;
  if (patch.hora      !== undefined) p.hora      = patch.hora || null;
  if (patch.descricao !== undefined) p.descricao = patch.descricao;
  if (patch.cor       !== undefined) p.cor       = patch.cor;
  const { error } = await supabase.from('crm_eventos').update(p).eq('id', id);
  if (error) { console.error('[db] updateCrmEvento:', error.message); return false; }
  return true;
}

export async function deleteCrmEvento(id) {
  const { error } = await supabase.from('crm_eventos').delete().eq('id', id);
  if (error) { console.error('[db] deleteCrmEvento:', error.message); return false; }
  return true;
}

// ── Carteira de Clientes ────────────────────────────────────────────────────

function mapCrmCliente(r) {
  return {
    id:          r.id,
    nome:        r.nome,
    responsavel: r.responsavel || '',
    contato:     r.contato || '',
    tipo:        r.tipo || 'diaria',
    dataEntrada: r.data_entrada || '',
  };
}

export async function fetchCrmClientes() {
  const { data, error } = await supabase
    .from('crm_clientes')
    .select('*')
    .order('nome');
  if (error) { console.error('[db] fetchCrmClientes:', error.message); return []; }
  return data.map(mapCrmCliente);
}

export async function createCrmCliente({ nome, responsavel, contato, tipo, dataEntrada }) {
  const { data, error } = await supabase
    .from('crm_clientes')
    .insert({
      nome,
      responsavel:  responsavel || null,
      contato:      contato || null,
      tipo:         tipo || 'diaria',
      data_entrada: dataEntrada || null,
    })
    .select()
    .single();
  if (error) { console.error('[db] createCrmCliente:', error.message); return null; }
  return mapCrmCliente(data);
}

export async function updateCrmCliente(id, patch) {
  const p = {};
  if (patch.nome        !== undefined) p.nome         = patch.nome;
  if (patch.responsavel !== undefined) p.responsavel  = patch.responsavel;
  if (patch.contato     !== undefined) p.contato      = patch.contato;
  if (patch.tipo        !== undefined) p.tipo         = patch.tipo;
  if (patch.dataEntrada !== undefined) p.data_entrada = patch.dataEntrada;
  const { error } = await supabase.from('crm_clientes').update(p).eq('id', id);
  if (error) { console.error('[db] updateCrmCliente:', error.message); return false; }
  return true;
}

export async function deleteCrmCliente(id) {
  const { error } = await supabase.from('crm_clientes').delete().eq('id', id);
  if (error) { console.error('[db] deleteCrmCliente:', error.message); return false; }
  return true;
}
