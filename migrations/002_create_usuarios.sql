CREATE TABLE IF NOT EXISTS usuarios (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacao_id          UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
    nome                    VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) NOT NULL UNIQUE,
    senha_hash              VARCHAR(255) NOT NULL,
    perfil                  VARCHAR(20) NOT NULL CHECK (perfil IN ('gestor', 'usuario')),
    -- Preenchido apenas quando perfil = 'usuario'. Um usuário pertence a exatamente um gestor.
    gestor_id               UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    -- Campo reservado para um futuro perfil consolidador acima do gestor (não usado na v1).
    hierarquia_superior_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    ativo                   BOOLEAN NOT NULL DEFAULT true,
    ultimo_login            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_usuario_tem_gestor CHECK (
        (perfil = 'gestor' AND gestor_id IS NULL) OR
        (perfil = 'usuario' AND gestor_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_usuarios_organizacao ON usuarios(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_gestor ON usuarios(gestor_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
