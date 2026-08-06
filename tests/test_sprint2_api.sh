#!/bin/bash
set -e
BASE="http://localhost:3000"

TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"erick.torritezi@souyess.com.br","senha":"Souyess@2026Teste"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
AUTH="Authorization: Bearer $TOKEN"

echo "=== TESTE 1: Empresas existentes (deve ter 1, a padrão do seed) ==="
curl -s -H "$AUTH" $BASE/api/empresas
echo -e "\n"

echo "=== TESTE 2: Criar empresa SIGCORP ==="
SIGCORP_JSON=$(curl -s -X POST $BASE/api/empresas -H "$AUTH" -H "Content-Type: application/json" -d '{"nome":"SIGCORP"}')
echo "$SIGCORP_JSON"
SIGCORP_ID=$(echo "$SIGCORP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['empresa']['id'])")
echo "SIGCORP_ID=$SIGCORP_ID"
echo ""

echo "=== TESTE 3: Criar empresa ETRIUM ==="
ETRIUM_JSON=$(curl -s -X POST $BASE/api/empresas -H "$AUTH" -H "Content-Type: application/json" -d '{"nome":"ETRIUM"}')
ETRIUM_ID=$(echo "$ETRIUM_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['empresa']['id'])")
echo "ETRIUM_ID=$ETRIUM_ID"
echo ""

echo "=== TESTE 4: Criar pesquisa nova para SIGCORP ==="
P1_JSON=$(curl -s -X POST $BASE/api/pesquisas -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"titulo\":\"ISC 2026.08\",\"empresaId\":\"$SIGCORP_ID\",\"rotuloEntidade\":\"Município\"}")
echo "$P1_JSON" | python3 -m json.tool
P1_ID=$(echo "$P1_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['id'])")
P1_CICLO=$(echo "$P1_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['ciclo_id'])")
echo "P1_ID=$P1_ID | CICLO=$P1_CICLO"
echo ""

echo "=== TESTE 5: Detalhe da pesquisa — 7 blocos com perguntas certas ==="
curl -s -H "$AUTH" $BASE/api/pesquisas/$P1_ID | python3 -c "
import json, sys
data = json.load(sys.stdin)['pesquisa']
for b in data['blocos']:
    print(f\"Bloco {b['ordem']} ({b['tipo_bloco']}): {len(b['perguntas'])} perguntas | fechadas={b['qtdFechadas']}/{b['limite_fechadas']} abertas={b['qtdAbertas']}/{b['limite_abertas']} peso={b['peso_no_score']}\")
"
echo ""

echo "=== TESTE 6: Duplicar pesquisa para ETRIUM, MESMO CICLO ==="
DUP_JSON=$(curl -s -X POST $BASE/api/pesquisas/$P1_ID/duplicar -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"empresaId\":\"$ETRIUM_ID\",\"mesmoCiclo\":true}")
echo "$DUP_JSON" | python3 -m json.tool
DUP_ID=$(echo "$DUP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['id'])")
DUP_CICLO=$(echo "$DUP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['ciclo_id'])")
echo ""
echo "Ciclo original: $P1_CICLO"
echo "Ciclo da cópia: $DUP_CICLO"
if [ "$P1_CICLO" == "$DUP_CICLO" ]; then echo "RESULTADO: MESMO CICLO (correto, vai consolidar)"; else echo "RESULTADO: CICLOS DIFERENTES (BUG!)"; fi
echo ""

echo "=== TESTE 7: Duplicar de novo, agora em CICLO NOVO (independente) ==="
DUP2_JSON=$(curl -s -X POST $BASE/api/pesquisas/$P1_ID/duplicar -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"empresaId\":\"$SIGCORP_ID\",\"mesmoCiclo\":false}")
DUP2_CICLO=$(echo "$DUP2_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['ciclo_id'])")
echo "Ciclo original: $P1_CICLO | Ciclo da 2ª cópia (independente): $DUP2_CICLO"
if [ "$P1_CICLO" != "$DUP2_CICLO" ]; then echo "RESULTADO: CICLOS DIFERENTES (correto, independente)"; else echo "RESULTADO: MESMO CICLO (BUG!)"; fi
echo ""

echo "=== TESTE 8: Adicionar 7ª pergunta fechada no bloco Atendimento (deve ser BLOQUEADO, limite é 6) ==="
BLOCO_ATENDIMENTO=$(curl -s -H "$AUTH" $BASE/api/pesquisas/$P1_ID | python3 -c "
import json, sys
data = json.load(sys.stdin)['pesquisa']
bloco = [b for b in data['blocos'] if b['tipo_bloco']=='atendimento'][0]
print(bloco['id'])
")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/pesquisas/$P1_ID/blocos/$BLOCO_ATENDIMENTO/perguntas \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"texto":"Pergunta extra que deveria ser bloqueada","tipo":"escala_0_10"}'
echo ""

echo "=== TESTE 9: Tentar adicionar pergunta no bloco Orientações (estrutura 100% fixa, deve bloquear) ==="
BLOCO_ORIENT=$(curl -s -H "$AUTH" $BASE/api/pesquisas/$P1_ID | python3 -c "
import json, sys
data = json.load(sys.stdin)['pesquisa']
bloco = [b for b in data['blocos'] if b['tipo_bloco']=='orientacoes'][0]
print(bloco['id'])
")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/pesquisas/$P1_ID/blocos/$BLOCO_ORIENT/perguntas \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"texto":"Pergunta que nao deveria existir aqui","tipo":"escala_0_10"}'
echo ""

echo "=== TESTE 10: Adicionar cliente na carteira ==="
CLIENTE_JSON=$(curl -s -X POST $BASE/api/pesquisas/$P1_ID/clientes -H "$AUTH" -H "Content-Type: application/json" -d '{"nomeCliente":"Prefeitura de Alvorada Nova"}')
echo "$CLIENTE_JSON"
echo ""

echo "=== TESTE 11: Ativar pesquisa (agora tem 1 cliente, deve funcionar) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/pesquisas/$P1_ID/ativar -H "$AUTH"
echo ""

echo "=== TESTE 12: Tentar ativar pesquisa SEM cliente (deve bloquear) ==="
P2_JSON=$(curl -s -X POST $BASE/api/pesquisas -H "$AUTH" -H "Content-Type: application/json" -d "{\"titulo\":\"Pesquisa Sem Cliente\",\"empresaId\":\"$SIGCORP_ID\"}")
P2_ID=$(echo "$P2_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['id'])")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/pesquisas/$P2_ID/ativar -H "$AUTH"
echo ""

echo "=== TESTE 13: Editar texto de uma pergunta ==="
PERGUNTA_ID=$(curl -s -H "$AUTH" $BASE/api/pesquisas/$P1_ID | python3 -c "
import json, sys
data = json.load(sys.stdin)['pesquisa']
bloco = [b for b in data['blocos'] if b['tipo_bloco']=='atendimento'][0]
print(bloco['perguntas'][0]['id'])
")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT $BASE/api/pesquisas/$P1_ID/perguntas/$PERGUNTA_ID \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"texto":"Texto editado pelo gestor via API"}'
echo ""

echo "=== TESTE 14: Remover pergunta NÃO fixa (deve funcionar) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE $BASE/api/pesquisas/$P1_ID/perguntas/$PERGUNTA_ID -H "$AUTH"
echo ""

echo "=== TESTE 15: Tentar remover pergunta FIXA (nome completo do Bloco 2 — deve bloquear) ==="
PERGUNTA_FIXA_ID=$(curl -s -H "$AUTH" $BASE/api/pesquisas/$P1_ID | python3 -c "
import json, sys
data = json.load(sys.stdin)['pesquisa']
bloco = [b for b in data['blocos'] if b['tipo_bloco']=='identificacao'][0]
pergunta = [p for p in bloco['perguntas'] if p['tipo']=='nome'][0]
print(pergunta['id'])
")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE $BASE/api/pesquisas/$P1_ID/perguntas/$PERGUNTA_FIXA_ID -H "$AUTH"
echo ""

echo "=== TESTE 16: Listar pesquisas paginado (deve ter pelo menos 4: original + 2 duplicadas + sem-cliente) ==="
curl -s -H "$AUTH" "$BASE/api/pesquisas?page=1&limit=20" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print('Total:', data['total'], '| Página:', data['page'], '| Total páginas:', data['totalPaginas'])
for p in data['pesquisas']:
    print(f\"  - {p['titulo']} | empresa={p['empresa_nome']} | status={p['status']} | clientes={p['total_clientes']}\")
"
echo ""

echo "=== TESTE 17: Tentar acessar pesquisa de outro gestor (simulando token adulterado / pesquisa inexistente) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -H "$AUTH" $BASE/api/pesquisas/00000000-0000-0000-0000-000000000000
echo ""

echo "=== FIM DOS TESTES DO SPRINT 2 ==="
