-- =============================================
-- MIGRAÇÃO CRM - Tabela exclusiva de empresas
-- =============================================

-- 1. Criar tabela exclusiva do CRM para empresas
CREATE TABLE IF NOT EXISTS crm_empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. Adicionar coluna empresa nas tabelas do CRM
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Farilog';
ALTER TABLE crm_eventos ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Farilog';
ALTER TABLE crm_clientes ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Farilog';

-- 3. Inserir a empresa Farilog na tabela exclusiva do CRM
INSERT INTO crm_empresas (nome) 
SELECT 'Farilog' 
WHERE NOT EXISTS (SELECT 1 FROM crm_empresas WHERE nome = 'Farilog');

-- 4. Atualizar todos os dados existentes para a empresa Farilog
UPDATE crm_leads SET empresa = 'Farilog' WHERE empresa IS NULL;
UPDATE crm_eventos SET empresa = 'Farilog' WHERE empresa IS NULL;
UPDATE crm_clientes SET empresa = 'Farilog' WHERE empresa IS NULL;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_empresa ON crm_leads(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_eventos_empresa ON crm_eventos(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_empresa ON crm_clientes(empresa);