CREATE TABLE IF NOT EXISTS respostas_itens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resposta_id     UUID NOT NULL REFERENCES respostas(id) ON DELETE CASCADE,
    pergunta_id     UUID NOT NULL REFERENCES pesquisa_perguntas(id) ON DELETE CASCADE,
    valor_numerico  SMALLINT CHECK (valor_numerico BETWEEN 0 AND 10),
    valor_texto     TEXT,
    sentimento_ia   VARCHAR(10) CHECK (sentimento_ia IN ('positivo', 'neutro', 'negativo') OR sentimento_ia IS NULL),

    UNIQUE(resposta_id, pergunta_id)
);

CREATE INDEX IF NOT EXISTS idx_respostas_itens_resposta ON respostas_itens(resposta_id);
CREATE INDEX IF NOT EXISTS idx_respostas_itens_pergunta ON respostas_itens(pergunta_id);
