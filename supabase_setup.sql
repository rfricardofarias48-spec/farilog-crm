-- Tabela de Empresas
CREATE TABLE IF NOT EXISTS crm_empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna empresa nas tabelas existentes
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Padrão';
ALTER TABLE crm_eventos ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Padrão';
ALTER TABLE crm_clientes ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Padrão';

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_empresa ON crm_leads(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_eventos_empresa ON crm_eventos(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_empresa ON crm_clientes(empresa);