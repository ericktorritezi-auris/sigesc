#!/bin/bash
set -e
BASE="http://localhost:3000"

TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"erick.torritezi@souyess.com.br","senha":"Souyess@2026Teste"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
AUTH="Authorization: Bearer $TOKEN"

EMPRESA_ID=$(curl -s -H "$AUTH" $BASE/api/empresas | python3 -c "import json,sys; print(json.load(sys.stdin)['empresas'][0]['id'])")

echo "=== SETUP: Criar pesquisa + cliente + ativar ==="
P_JSON=$(curl -s -X POST $BASE/api/pesquisas -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"titulo\":\"Pesquisa Sprint 3\",\"empresaId\":\"$EMPRESA_ID\",\"rotuloEntidade\":\"Município\"}")
P_ID=$(echo "$P_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['id'])")
SLUG=$(echo "$P_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['slug_link_publico'])")
echo "Pesquisa: $P_ID | slug: $SLUG"

curl -s -X POST $BASE/api/pesquisas/$P_ID/clientes -H "$AUTH" -H "Content-Type: application/json" -d '{"nomeCliente":"Prefeitura de Alvorada Nova"}' > /dev/null
curl -s -X POST $BASE/api/pesquisas/$P_ID/ativar -H "$AUTH" > /dev/null
echo "Pesquisa ativada."
echo ""

echo "=== TESTE 1: Acessar link /p/:slug (deve servir a página do formulário) ==="
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" $BASE/p/$SLUG
echo ""

echo "=== TESTE 2: GET config público (site key do recaptcha) ==="
curl -s $BASE/api/publico/config
echo -e "\n"

echo "=== TESTE 3: GET dados públicos da pesquisa ativa ==="
PESQUISA_PUBLICA=$(curl -s $BASE/api/publico/pesquisas/$SLUG)
echo "$PESQUISA_PUBLICA" | python3 -c "
import json, sys
d = json.load(sys.stdin)['pesquisa']
print('Título:', d['titulo'])
print('Rótulo entidade:', d['rotuloEntidade'])
print('Qtd blocos:', len(d['blocos']))
print('Qtd clientes na carteira:', len(d['clientes']))
"
echo ""

echo "=== TESTE 4: GET pesquisa por slug INEXISTENTE (deve dar 404) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" $BASE/api/publico/pesquisas/slug-que-nao-existe
echo ""

echo "=== TESTE 5: GET pesquisa em RASCUNHO (não deve estar acessível publicamente) ==="
P2_JSON=$(curl -s -X POST $BASE/api/pesquisas -H "$AUTH" -H "Content-Type: application/json" -d "{\"titulo\":\"Pesquisa Rascunho\",\"empresaId\":\"$EMPRESA_ID\"}")
SLUG2=$(echo "$P2_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['slug_link_publico'])")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" $BASE/api/publico/pesquisas/$SLUG2
echo ""

echo "=== TESTE 6: RECUSA de consentimento (deve gravar no log LGPD, sem criar resposta) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/publico/pesquisas/$SLUG/recusa -H "Content-Type: application/json" -d '{}'
echo ""

echo "=== TESTE 7: Confirmar no banco que a recusa foi gravada corretamente ==="
su - postgres -c "psql -d sigesc_test -t -c \"SELECT aceitou, resposta_id, nome_completo FROM consentimentos_lgpd ORDER BY respondido_em DESC LIMIT 1;\""
echo ""

echo "=== TESTE 8: Montar payload de resposta COMPLETA e enviar ==="
# Extrai os ids das perguntas pra montar respostas de teste
IDS=$(echo "$PESQUISA_PUBLICA" | python3 -c "
import json, sys
d = json.load(sys.stdin)['pesquisa']
resp = []
for b in d['blocos']:
    for p in b['perguntas']:
        if p['tipo'] == 'escala_0_10':
            resp.append({'perguntaId': p['id'], 'valorNumerico': 8})
        elif p['tipo'] == 'texto_livre' and b['tipo_bloco'] != 'identificacao':
            resp.append({'perguntaId': p['id'], 'valorTexto': 'Resposta de teste automatizado.'})
        elif p['tipo'] == 'multipla_escolha':
            resp.append({'perguntaId': p['id'], 'valorTexto': (p.get('opcoes') or ['Gestor'])[0]})
        elif p['tipo'] == 'selecao' and b['tipo_bloco'] == 'identificacao':
            resp.append({'perguntaId': p['id'], 'valorTexto': 'Secretaria de Teste'})
print(json.dumps(resp))
")
CLIENTE_ID=$(echo "$PESQUISA_PUBLICA" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['clientes'][0]['id'])")

PAYLOAD=$(python3 -c "
import json
resp = json.loads('$IDS')
payload = {
    'clienteId': '$CLIENTE_ID',
    'nomeCompleto': 'Maria da Silva Teste',
    'email': 'maria.teste@prefeitura.gov.br',
    'cargo': 'Secretária de Administração',
    'respostas': resp
}
print(json.dumps(payload))
")

RESP_ENVIO=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $BASE/api/publico/pesquisas/$SLUG/responder -H "Content-Type: application/json" -d "$PAYLOAD")
echo "$RESP_ENVIO"
echo ""

echo "=== TESTE 9: Confirmar que a pesquisa TRAVOU as perguntas após a 1a resposta ==="
curl -s -H "$AUTH" $BASE/api/pesquisas/$P_ID | python3 -c "
import json, sys
d = json.load(sys.stdin)['pesquisa']
print('perguntas_travadas:', d['perguntas_travadas'], '(esperado: True)')
"
echo ""

echo "=== TESTE 10: Tentar editar pergunta na pesquisa agora travada (deve dar 423) ==="
PERGUNTA_ID=$(echo "$PESQUISA_PUBLICA" | python3 -c "
import json, sys
d = json.load(sys.stdin)['pesquisa']
bloco = [b for b in d['blocos'] if b['tipo_bloco']=='atendimento'][0]
print(bloco['perguntas'][0]['id'])
")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT $BASE/api/pesquisas/$P_ID/perguntas/$PERGUNTA_ID -H "$AUTH" -H "Content-Type: application/json" -d '{"texto":"nao deveria mudar"}'
echo ""

echo "=== TESTE 11: Enviar resposta SEM cliente (deve dar 400) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/publico/pesquisas/$SLUG/responder -H "Content-Type: application/json" \
  -d '{"nomeCompleto":"Teste","email":"teste@teste.com","cargo":"Cargo","respostas":[]}'
echo ""

echo "=== TESTE 12: Enviar resposta com pergunta obrigatória FALTANDO (deve dar 422) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/publico/pesquisas/$SLUG/responder -H "Content-Type: application/json" \
  -d "{\"clienteId\":\"$CLIENTE_ID\",\"nomeCompleto\":\"Teste\",\"email\":\"teste@teste.com\",\"cargo\":\"Cargo\",\"respostas\":[]}"
echo ""

echo "=== TESTE 13: Enviar resposta com nota de escala FORA do range (deve dar 422) ==="
IDS_INVALIDO=$(echo "$PESQUISA_PUBLICA" | python3 -c "
import json, sys
d = json.load(sys.stdin)['pesquisa']
resp = []
for b in d['blocos']:
    for p in b['perguntas']:
        if p['tipo'] == 'escala_0_10':
            resp.append({'perguntaId': p['id'], 'valorNumerico': 99})
        elif p['tipo'] == 'texto_livre' and b['tipo_bloco'] != 'identificacao':
            resp.append({'perguntaId': p['id'], 'valorTexto': 'teste'})
        elif p['tipo'] == 'multipla_escolha':
            resp.append({'perguntaId': p['id'], 'valorTexto': (p.get('opcoes') or ['Gestor'])[0]})
        elif p['tipo'] == 'selecao' and b['tipo_bloco'] == 'identificacao':
            resp.append({'perguntaId': p['id'], 'valorTexto': 'Secretaria de Teste'})
print(json.dumps(resp))
")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/publico/pesquisas/$SLUG/responder -H "Content-Type: application/json" \
  -d "{\"clienteId\":\"$CLIENTE_ID\",\"nomeCompleto\":\"Teste\",\"email\":\"teste@teste.com\",\"cargo\":\"Cargo\",\"respostas\":$IDS_INVALIDO}"
echo ""

echo "=== TESTE 14: Confirmar dados gravados no banco (respostas, itens, LGPD) ==="
su - postgres -c "psql -d sigesc_test -c \"SELECT nome_completo, email, cargo, concluida, ano_mes FROM respostas;\""
su - postgres -c "psql -d sigesc_test -c \"SELECT count(*) AS itens_gravados FROM respostas_itens;\""
su - postgres -c "psql -d sigesc_test -c \"SELECT aceitou, count(*) FROM consentimentos_lgpd GROUP BY aceitou;\""
echo ""

echo "=== TESTE 15: Rate limit das rotas públicas está registrado? (checagem de headers) ==="
curl -s -I $BASE/api/publico/pesquisas/$SLUG | grep -i "ratelimit"
echo ""

echo "=== FIM DOS TESTES DO SPRINT 3 ==="
