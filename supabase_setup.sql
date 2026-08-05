-- Migração para suportar múltiplas empresas no CRM

-- 1. Adicionar coluna empresa nas tabelas existentes
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Farilog';
ALTER TABLE crm_eventos ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Farilog';
ALTER TABLE crm_clientes ADD COLUMN IF NOT EXISTS empresa TEXT DEFAULT 'Farilog';

-- 2. Atualizar os registros existentes com a empresa padrão Farilog
UPDATE crm_leads SET empresa = 'Farilog' WHERE empresa IS NULL;
UPDATE crm_eventos SET empresa = 'Farilog' WHERE empresa IS NULL;
UPDATE crm_clientes SET empresa = 'Farilog' WHERE empresa IS NULL;

-- 3. Índices para melhor performance nas consultas por empresa
CREATE INDEX IF NOT EXISTS idx_crm_leads_empresa ON crm_leads(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_eventos_empresa ON crm_eventos(empresa);
CREATE INDEX IF NOT EXISTS idx_crm_clientes_empresa ON crm_clientes(empresa);

-- 4. Confirmar que a tabela empresas já existe com Farilog
INSERT INTO empresas (nome) 
SELECT 'Farilog' 
WHERE NOT EXISTS (SELECT 1 FROM empresas WHERE nome = 'Farilog');