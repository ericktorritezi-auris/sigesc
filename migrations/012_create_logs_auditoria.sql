CREATE TABLE IF NOT EXISTS logs_auditoria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    acao            VARCHAR(100) NOT NULL,
    entidade        VARCHAR(100) NOT NULL,
    entidade_id     UUID,
    detalhes        JSONB,
    ip_origem       VARCHAR(64),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_entidade ON logs_auditoria(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_logs_criado_em ON logs_auditoria(criado_em);
