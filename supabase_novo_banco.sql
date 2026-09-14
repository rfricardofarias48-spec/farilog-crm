-- ============================================================================
-- PRODUTIVIDADE/CRM — MIGRAÇÃO COMPLETA PARA O BANCO NOVO
-- Execute este arquivo UMA VEZ no SQL Editor do projeto novo do Supabase.
--
-- Ele cria todas as tabelas do app, as políticas de acesso (RLS) e já
-- transporta os dados atuais: 3 empresas, 5 leads e 1 compromisso.
-- É seguro rodar de novo (nada é duplicado).
-- ============================================================================

-- ── 1. TABELAS ──────────────────────────────────────────────────────────────

-- Empresas gerenciadas no CRM
CREATE TABLE IF NOT EXISTS crm_empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Leads do pipeline de vendas
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_empresa TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  cidade TEXT,
  quantidade INT DEFAULT 0,
  etapa TEXT DEFAULT 'novo',
  tipo TEXT DEFAULT 'diaria',
  ultimo_contato DATE,
  reuniao_data DATE,
  reuniao_hora TIME,
  evento_id UUID,
  observacoes TEXT,
  empresa TEXT DEFAULT 'Farilog',
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Compromissos da agenda
CREATE TABLE IF NOT EXISTS crm_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  data DATE NOT NULL,
  hora TIME,
  descricao TEXT,
  cor TEXT DEFAULT '#2563EB',
  empresa TEXT DEFAULT 'Farilog',
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Carteira de clientes
CREATE TABLE IF NOT EXISTS crm_clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  responsavel TEXT,
  contato TEXT,
  tipo TEXT DEFAULT 'diaria',
  data_entrada DATE,
  empresa TEXT DEFAULT 'Farilog'
);

-- Tarefas (aba Tarefas)
CREATE TABLE IF NOT EXISTS crm_tarefas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  concluida BOOLEAN DEFAULT FALSE,
  criada_em TIMESTAMPTZ DEFAULT now(),
  concluida_em TIMESTAMPTZ
);

-- Registro diário: resumo + nota de produtividade (um por dia)
CREATE TABLE IF NOT EXISTS crm_diarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  resumo TEXT,
  nota INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT crm_diarios_data_unico UNIQUE (data)
);

-- Metas (aba Metas): título + linhas [{ texto, prazo, atingida }] + ordem de exibição
CREATE TABLE IF NOT EXISTS crm_metas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  linhas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Leads de prospecção (aba Prospecção): importados das listas CSV no formato Hurma
CREATE TABLE IF NOT EXISTS crm_prospectas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  cidade TEXT,
  nicho TEXT,
  telefone TEXT,
  obs TEXT,
  contato_em TEXT,
  lista TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  ultimo_contato DATE,
  retorno_em DATE,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ── 2. SEGURANÇA (RLS) — mesmo padrão aberto usado pelo app ────────────────

ALTER TABLE crm_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_eventos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tarefas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_diarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_metas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_prospectas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select crm_empresas" ON crm_empresas;
CREATE POLICY "Allow anon select crm_empresas" ON crm_empresas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_empresas" ON crm_empresas;
CREATE POLICY "Allow anon insert crm_empresas" ON crm_empresas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_empresas" ON crm_empresas;
CREATE POLICY "Allow anon update crm_empresas" ON crm_empresas FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_empresas" ON crm_empresas;
CREATE POLICY "Allow anon delete crm_empresas" ON crm_empresas FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon select crm_leads" ON crm_leads;
CREATE POLICY "Allow anon select crm_leads" ON crm_leads FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_leads" ON crm_leads;
CREATE POLICY "Allow anon insert crm_leads" ON crm_leads FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_leads" ON crm_leads;
CREATE POLICY "Allow anon update crm_leads" ON crm_leads FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_leads" ON crm_leads;
CREATE POLICY "Allow anon delete crm_leads" ON crm_leads FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon select crm_eventos" ON crm_eventos;
CREATE POLICY "Allow anon select crm_eventos" ON crm_eventos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_eventos" ON crm_eventos;
CREATE POLICY "Allow anon insert crm_eventos" ON crm_eventos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_eventos" ON crm_eventos;
CREATE POLICY "Allow anon update crm_eventos" ON crm_eventos FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_eventos" ON crm_eventos;
CREATE POLICY "Allow anon delete crm_eventos" ON crm_eventos FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon select crm_clientes" ON crm_clientes;
CREATE POLICY "Allow anon select crm_clientes" ON crm_clientes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_clientes" ON crm_clientes;
CREATE POLICY "Allow anon insert crm_clientes" ON crm_clientes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_clientes" ON crm_clientes;
CREATE POLICY "Allow anon update crm_clientes" ON crm_clientes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_clientes" ON crm_clientes;
CREATE POLICY "Allow anon delete crm_clientes" ON crm_clientes FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon select crm_tarefas" ON crm_tarefas;
CREATE POLICY "Allow anon select crm_tarefas" ON crm_tarefas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_tarefas" ON crm_tarefas;
CREATE POLICY "Allow anon insert crm_tarefas" ON crm_tarefas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_tarefas" ON crm_tarefas;
CREATE POLICY "Allow anon update crm_tarefas" ON crm_tarefas FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_tarefas" ON crm_tarefas;
CREATE POLICY "Allow anon delete crm_tarefas" ON crm_tarefas FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon select crm_diarios" ON crm_diarios;
CREATE POLICY "Allow anon select crm_diarios" ON crm_diarios FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_diarios" ON crm_diarios;
CREATE POLICY "Allow anon insert crm_diarios" ON crm_diarios FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_diarios" ON crm_diarios;
CREATE POLICY "Allow anon update crm_diarios" ON crm_diarios FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_diarios" ON crm_diarios;
CREATE POLICY "Allow anon delete crm_diarios" ON crm_diarios FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon select crm_metas" ON crm_metas;
CREATE POLICY "Allow anon select crm_metas" ON crm_metas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_metas" ON crm_metas;
CREATE POLICY "Allow anon insert crm_metas" ON crm_metas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_metas" ON crm_metas;
CREATE POLICY "Allow anon update crm_metas" ON crm_metas FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_metas" ON crm_metas;
CREATE POLICY "Allow anon delete crm_metas" ON crm_metas FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow anon select crm_prospectas" ON crm_prospectas;
CREATE POLICY "Allow anon select crm_prospectas" ON crm_prospectas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert crm_prospectas" ON crm_prospectas;
CREATE POLICY "Allow anon insert crm_prospectas" ON crm_prospectas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update crm_prospectas" ON crm_prospectas;
CREATE POLICY "Allow anon update crm_prospectas" ON crm_prospectas FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete crm_prospectas" ON crm_prospectas;
CREATE POLICY "Allow anon delete crm_prospectas" ON crm_prospectas FOR DELETE USING (true);

-- ── 3. ÍNDICES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_crm_leads_empresa    ON crm_leads(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_leads_etapa      ON crm_leads(etapa);
CREATE INDEX IF NOT EXISTS idx_crm_eventos_empresa  ON crm_eventos(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_empresa ON crm_clientes(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_tarefas_criada_em ON crm_tarefas(criada_em);
CREATE INDEX IF NOT EXISTS idx_crm_diarios_data     ON crm_diarios(data);

-- ── 4. DADOS ATUAIS (migrados do banco anterior) ───────────────────────────

INSERT INTO crm_empresas (id, nome, criado_em) VALUES
  ('b92cd72f-d98f-4a32-bcbf-9634381da0ef', 'Farilog',   '2026-08-05T18:07:11.753392+00:00'),
  ('af8753a8-ffb3-4da8-8ebb-09dcde3255cb', 'Elevva',    '2026-08-05T18:11:36.567721+00:00'),
  ('1701d2a9-f22c-43c2-b76a-d5bd12891ecc', 'SITES ANA', '2026-08-08T12:34:58.299103+00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_eventos (id, titulo, data, hora, descricao, cor, empresa, criado_em) VALUES
  ('d6ba23c2-efd8-4a0c-ba6b-dcf1bc5f59a4', 'Reunião — Tiago (Dismaria)', '2026-07-09', '10:00:00',
   'Reuniao agendada para 09/06, possivel cliente com 8 vagas em média, ja recebeu proposta. ',
   '#7C3AED', 'Farilog', '2026-07-08T18:08:35.186043+00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_leads (id, nome_empresa, contato, telefone, cidade, quantidade, etapa, tipo, ultimo_contato, reuniao_data, reuniao_hora, evento_id, observacoes, empresa, criado_em) VALUES
  ('ef488497-595e-4ff9-86e2-48f773859db7', 'Mais Agro Hostifruti', 'Elisandra', '(51) 99465-1001', 'Cachoeirinha', 15, 'caiu', 'diaria',
   '2026-07-13', NULL, '09:00:00', NULL,
   'Proposta em analise, pediu para retornar na sexta-feira 10/07.

Nova proposta enviada em 13/07. ', 'Farilog', '2026-07-08T18:11:10.839287+00:00'),
  ('c062470c-db26-487e-b6c4-ff585915ce76', 'Modular', 'Felipe', '(51) 99782-1209', 'Nova Santa Rita', 35, 'caiu', 'diaria',
   '2026-07-07', NULL, '09:00:00', NULL,
   'Enviada proposta em 05/06, nova tentativa de contato em 07/06, cliente possui Prestameg como fornecedor, resistente a troca.',
   'Farilog', '2026-07-08T18:07:01.880919+00:00'),
  ('863deb74-07d6-4d74-8e00-2d7538af2a25', 'Mesasul', 'Admilson', '(51) 3357-5757', 'Cachoeirinha', 20, 'proposta', 'diaria',
   '2026-07-09', NULL, '09:00:00', NULL,
   'Proposta em analise, pediu para retornar na quinta-feira 09/06.

Cliente trabalha com modelo barato de cooperativa, negocio dificil. ', 'Farilog', '2026-07-08T18:10:14.480051+00:00'),
  ('7a638acc-4b93-4d0f-b124-de8a598b1beb', 'Dismaria', 'Tiago', '(51) 97400-2029', 'Cachoeirinha', 8, 'venda', 'diaria',
   '2026-07-09', '2026-07-09', '10:00:00', 'd6ba23c2-efd8-4a0c-ba6b-dcf1bc5f59a4',
   'Reuniao agendada para 09/06, possivel cliente com 8 vagas em média, ja recebeu proposta.

Reuniao positiva no dia 09/06, documentacao inicial enviada, aguardando ok do cliente para iniciar os trabalhos, boa possibilidade de negocio. ',
   'Farilog', '2026-07-08T18:08:35.074526+00:00'),
  ('9f98e92f-d646-4c1c-88f8-aef0fbc30424', 'Transito', 'Michel', '(51) 99377-4699', 'Nova Santa RIta', 15, 'venda', 'diaria',
   '2026-07-04', NULL, '09:00:00', NULL,
   'Proposta em analise, cliente demorado. ', 'Farilog', '2026-07-08T18:13:40.095951+00:00')
ON CONFLICT (id) DO NOTHING;

-- Fim da migração. Nenhum dado de clientes/tarefas/diários existia no banco anterior.
