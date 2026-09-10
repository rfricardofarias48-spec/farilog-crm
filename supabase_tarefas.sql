-- =========================================================
-- MIGRAÇÃO CRM - Aba Tarefas (tarefas + registro diário)
-- Execute este script no SQL Editor do Supabase.
-- =========================================================

-- 1. Tabela de tarefas (lista simples do dia a dia)
CREATE TABLE IF NOT EXISTS crm_tarefas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  concluida BOOLEAN DEFAULT FALSE,
  criada_em TIMESTAMPTZ DEFAULT now(),
  concluida_em TIMESTAMPTZ
);

-- 2. Tabela de registro diário (resumo + nota de produtividade)
--    Um registro por dia (coluna "data" é única).
CREATE TABLE IF NOT EXISTS crm_diarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  resumo TEXT,
  nota INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT crm_diarios_data_unico UNIQUE (data)
);

-- 3. Habilitar Row Level Security e permitir acesso (mesmo padrão das outras tabelas)
ALTER TABLE crm_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_diarios ENABLE ROW LEVEL SECURITY;

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

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_tarefas_criada_em ON crm_tarefas(criada_em);
CREATE INDEX IF NOT EXISTS idx_crm_diarios_data ON crm_diarios(data);
