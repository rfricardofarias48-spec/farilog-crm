import { supabase } from './supabase';

// ── Empresas ────────────────────────────────────────────────────────────────

function mapCrmEmpresa(r) {
  return {
    id:        r.id,
    nome:      r.nome,
    criadoEm:  r.criado_em,
  };
}

export async function fetchCrmEmpresas() {
  const { data, error } = await supabase
    .from('crm_empresas')
    .select('*')
    .order('criado_em', { ascending: true });
  if (error) { console.error('[db] fetchCrmEmpresas:', error.message); return []; }
  return data.map(mapCrmEmpresa);
}

export async function createCrmEmpresa({ nome }) {
  const { data, error } = await supabase
    .from('crm_empresas')
    .insert({ nome })
    .select()
    .single();
  if (error) { console.error('[db] createCrmEmpresa:', error.message); return null; }
  return mapCrmEmpresa(data);
}

export async function updateCrmEmpresa(id, patch) {
  const p = {};
  if (patch.nome !== undefined) p.nome = patch.nome;
  const { error } = await supabase.from('crm_empresas').update(p).eq('id', id);
  if (error) { console.error('[db] updateCrmEmpresa:', error.message); return false; }
  return true;
}

export async function deleteCrmEmpresa(id) {
  const { error } = await supabase.from('crm_empresas').delete().eq('id', id);
  if (error) { console.error('[db] deleteCrmEmpresa:', error.message); return false; }
  return true;
}

// ── Leads (Pipeline) ────────────────────────────────────────────────────────

function mapCrmLead(r) {
  return {
    id:            r.id,
    nomeEmpresa:   r.nome_empresa,
    contato:       r.contato || '',
    telefone:      r.telefone || '',
    cidade:        r.cidade || '',
    quantidade:    Number(r.quantidade ?? 0),
    etapa:         r.etapa,
    tipo:          r.tipo || 'diaria',
    ultimoContato: r.ultimo_contato || '',
    reuniaoData:   r.reuniao_data || '',
    reuniaoHora:   r.reuniao_hora ? r.reuniao_hora.slice(0, 5) : '',
    eventoId:      r.evento_id || null,
    observacoes:   r.observacoes || '',
    empresa:       r.empresa || 'Padrão',
    criadoEm:      r.criado_em,
  };
}

export async function fetchCrmLeads(empresa = null) {
  let query = supabase.from('crm_leads').select('*');
  if (empresa) query = query.eq('empresa', empresa);
  query = query.order('criado_em', { ascending: false });
  const { data, error } = await query;
  if (error) { console.error('[db] fetchCrmLeads:', error.message); return []; }
  return data.map(mapCrmLead);
}

export async function createCrmLead({ nomeEmpresa, contato, telefone, cidade, quantidade, etapa, tipo, ultimoContato, reuniaoData, reuniaoHora, eventoId, observacoes, empresa = 'Padrão' }) {
  const { data, error } = await supabase
    .from('crm_leads')
    .insert({
      nome_empresa:   nomeEmpresa,
      contato:        contato || null,
      telefone:       telefone || null,
      cidade:         cidade || null,
      quantidade:     quantidade || 0,
      etapa:          etapa || 'novo',
      tipo:           tipo || 'diaria',
      ultimo_contato: ultimoContato || null,
      reuniao_data:   reuniaoData || null,
      reuniao_hora:   reuniaoHora || null,
      evento_id:      eventoId || null,
      observacoes:    observacoes || null,
      empresa:        empresa || 'Padrão',
    })
    .select()
    .single();
  if (error) { console.error('[db] createCrmLead:', error.message); return null; }
  return mapCrmLead(data);
}

export async function updateCrmLead(id, patch) {
  const p = {};
  if (patch.nomeEmpresa   !== undefined) p.nome_empresa   = patch.nomeEmpresa;
  if (patch.contato       !== undefined) p.contato        = patch.contato;
  if (patch.telefone      !== undefined) p.telefone       = patch.telefone;
  if (patch.cidade        !== undefined) p.cidade         = patch.cidade;
  if (patch.quantidade    !== undefined) p.quantidade     = patch.quantidade;
  if (patch.etapa         !== undefined) p.etapa          = patch.etapa;
  if (patch.tipo          !== undefined) p.tipo           = patch.tipo;
  if (patch.ultimoContato !== undefined) p.ultimo_contato = patch.ultimoContato;
  if (patch.reuniaoData   !== undefined) p.reuniao_data   = patch.reuniaoData || null;
  if (patch.reuniaoHora   !== undefined) p.reuniao_hora   = patch.reuniaoHora || null;
  if (patch.eventoId      !== undefined) p.evento_id      = patch.eventoId;
  if (patch.observacoes   !== undefined) p.observacoes    = patch.observacoes;
  if (patch.empresa       !== undefined) p.empresa        = patch.empresa;
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
    empresa:   r.empresa || 'Padrão',
  };
}

export async function fetchCrmEventos(empresa = null) {
  let query = supabase.from('crm_eventos').select('*');
  if (empresa) query = query.eq('empresa', empresa);
  query = query.order('data').order('hora');
  const { data, error } = await query;
  if (error) { console.error('[db] fetchCrmEventos:', error.message); return []; }
  return data.map(mapCrmEvento);
}

export async function createCrmEvento({ titulo, data, hora, descricao, cor, empresa = 'Padrão' }) {
  const { data: row, error } = await supabase
    .from('crm_eventos')
    .insert({ titulo, data, hora: hora || null, descricao: descricao || null, cor: cor || '#2563EB', empresa: empresa || 'Padrão' })
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
  if (patch.empresa   !== undefined) p.empresa   = patch.empresa;
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
    empresa:     r.empresa || 'Padrão',
  };
}

export async function fetchCrmClientes(empresa = null) {
  let query = supabase.from('crm_clientes').select('*');
  if (empresa) query = query.eq('empresa', empresa);
  query = query.order('nome');
  const { data, error } = await query;
  if (error) { console.error('[db] fetchCrmClientes:', error.message); return []; }
  return data.map(mapCrmCliente);
}

export async function createCrmCliente({ nome, responsavel, contato, tipo, dataEntrada, empresa = 'Padrão' }) {
  const { data, error } = await supabase
    .from('crm_clientes')
    .insert({
      nome,
      responsavel:  responsavel || null,
      contato:      contato || null,
      tipo:         tipo || 'diaria',
      data_entrada: dataEntrada || null,
      empresa:      empresa || 'Padrão',
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
  if (patch.empresa     !== undefined) p.empresa      = patch.empresa;
  const { error } = await supabase.from('crm_clientes').update(p).eq('id', id);
  if (error) { console.error('[db] updateCrmCliente:', error.message); return false; }
  return true;
}

export async function deleteCrmCliente(id) {
  const { error } = await supabase.from('crm_clientes').delete().eq('id', id);
  if (error) { console.error('[db] deleteCrmCliente:', error.message); return false; }
  return true;
}