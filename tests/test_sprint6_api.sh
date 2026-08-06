#!/bin/bash
set -e
BASE="http://localhost:3000"

TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"erick.torritezi@souyess.com.br","senha":"Souyess@2026Teste"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
AUTH="Authorization: Bearer $TOKEN"

EMPRESA_ID=$(curl -s -H "$AUTH" $BASE/api/empresas | python3 -c "import json,sys; print(json.load(sys.stdin)['empresas'][0]['id'])")

echo "=== SETUP: pesquisa + cliente + ativar + 1 resposta ==="
P_JSON=$(curl -s -X POST $BASE/api/pesquisas -H "$AUTH" -H "Content-Type: application/json" -d "{\"titulo\":\"Pesquisa Sprint 6\",\"empresaId\":\"$EMPRESA_ID\"}")
P_ID=$(echo "$P_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['id'])")
SLUG=$(echo "$P_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['pesquisa']['slug_link_publico'])")
curl -s -X POST $BASE/api/pesquisas/$P_ID/clientes -H "$AUTH" -H "Content-Type: application/json" -d '{"nomeCliente":"Cliente Sprint 6"}' > /dev/null
curl -s -X POST $BASE/api/pesquisas/$P_ID/ativar -H "$AUTH" > /dev/null
curl -s $BASE/api/publico/pesquisas/$SLUG > /tmp/pp_s6.json
CLIENTE_ID=$(python3 -c "import json; print(json.load(open('/tmp/pp_s6.json'))['pesquisa']['clientes'][0]['id'])")

python3 << PYEOF
import json
d = json.load(open('/tmp/pp_s6.json'))['pesquisa']
resp = []
for b in d['blocos']:
    for p in b['perguntas']:
        if p['tipo'] == 'escala_0_10':
            resp.append({'perguntaId': p['id'], 'valorNumerico': 8})
        elif p['tipo'] == 'texto_livre' and b['tipo_bloco'] != 'identificacao':
            resp.append({'perguntaId': p['id'], 'valorTexto': 'teste'})
        elif p['tipo'] == 'multipla_escolha':
            opcoes = p.get('opcoes') or ['Gestor']
            resp.append({'perguntaId': p['id'], 'valorTexto': opcoes[0]})
        elif p['tipo'] == 'selecao' and b['tipo_bloco'] == 'identificacao':
            resp.append({'perguntaId': p['id'], 'valorTexto': 'Setor Teste'})
payload = {
    'clienteId': '$CLIENTE_ID',
    'nomeCompleto': 'Teste Sprint 6',
    'email': 'teste@sprint6.com',
    'cargo': 'Cargo Teste',
    'respostas': resp,
}
json.dump(payload, open('/tmp/payload_s6.json', 'w'))
PYEOF

RESP_JSON=$(curl -s -X POST $BASE/api/publico/pesquisas/$SLUG/responder -H "Content-Type: application/json" -d @/tmp/payload_s6.json)
echo "Resposta criada: $(echo $RESP_JSON | python3 -c "import json,sys; print(json.load(sys.stdin).get('respostaId','ERRO'))")"

echo ""
echo "=== USUÁRIOS ==="
echo "--- TESTE 1: Criar usuário vinculado ---"
USR_JSON=$(curl -s -X POST $BASE/api/usuarios -H "$AUTH" -H "Content-Type: application/json" -d '{"nome":"Rodrigo Alencar","email":"rodrigo.teste@souyess.com.br","senha":"SenhaForte123"}')
echo "$USR_JSON"
USR_ID=$(echo "$USR_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['usuario']['id'])")
echo ""

echo "--- TESTE 2: Listar usuários (deve ter 1) ---"
curl -s -H "$AUTH" $BASE/api/usuarios | python3 -c "import json,sys; d=json.load(sys.stdin); print('total:', d['total'])"
echo ""

echo "--- TESTE 3: Usuário vinculado consegue logar e ver as MESMAS pesquisas do gestor? ---"
USR_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"rodrigo.teste@souyess.com.br","senha":"SenhaForte123"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
curl -s -H "Authorization: Bearer $USR_TOKEN" $BASE/api/pesquisas | python3 -c "import json,sys; d=json.load(sys.stdin); print('total pesquisas visiveis:', d['total'])"
echo ""

echo "--- TESTE 4: Usuário vinculado NÃO pode criar outro usuário (deve dar 403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/usuarios -H "Authorization: Bearer $USR_TOKEN" -H "Content-Type: application/json" -d '{"nome":"Outro","email":"outro@teste.com","senha":"12345678"}'
echo ""

echo "--- TESTE 5: Desativar usuário e confirmar que ele não loga mais ---"
curl -s -X PUT $BASE/api/usuarios/$USR_ID -H "$AUTH" -H "Content-Type: application/json" -d '{"ativo":false}' > /dev/null
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d '{"email":"rodrigo.teste@souyess.com.br","senha":"SenhaForte123"}'
echo ""

echo "=== RESPOSTAS ==="
echo "--- TESTE 6: Listar respostas (deve ter pelo menos 1) ---"
curl -s -H "$AUTH" "$BASE/api/respostas?limit=20" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('total:', d['total'])
for r in d['respostas']:
    print(' -', r['nome_cliente'], '|', r['empresa_nome'], '| score:', r['score_geral'])
"
echo ""

echo "--- TESTE 7: Filtrar respostas por cliente ---"
curl -s -H "$AUTH" "$BASE/api/respostas?clienteId=$CLIENTE_ID" | python3 -c "import json,sys; print('total filtrado:', json.load(sys.stdin)['total'])"
echo ""

echo "--- TESTE 8: Detalhe de uma resposta (deve trazer todos os blocos/perguntas) ---"
RESPOSTA_ID=$(echo "$RESP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['respostaId'])")
curl -s -H "$AUTH" $BASE/api/respostas/$RESPOSTA_ID | python3 -c "
import json, sys
d = json.load(sys.stdin)['resposta']
print('Score geral:', d['score_geral'])
print('Qtd blocos:', len(d['blocos']))
for b in d['blocos']:
    respondidas = sum(1 for p in b['perguntas'] if p['valor_numerico'] is not None or p['valor_texto'])
    print(f'  Bloco {b[\"tipo_bloco\"]}: {respondidas}/{len(b[\"perguntas\"])} respondidas')
"
echo ""

echo "--- TESTE 9: Tentar acessar resposta de ID inexistente (deve dar 404) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -H "$AUTH" $BASE/api/respostas/00000000-0000-0000-0000-000000000000
echo ""

echo "=== LGPD ==="
echo "--- TESTE 10: Listar consentimentos (deve ter pelo menos 1, o aceite da resposta) ---"
curl -s -H "$AUTH" $BASE/api/lgpd | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('total:', d['total'])
for c in d['consentimentos']:
    print(' -', c.get('nome_completo'), '| aceitou:', c['aceitou'])
"
echo ""

echo "--- TESTE 11: Registrar uma recusa e confirmar que aparece na listagem também ---"
curl -s -X POST $BASE/api/publico/pesquisas/$SLUG/recusa -H "Content-Type: application/json" -d '{}' > /dev/null
curl -s -H "$AUTH" $BASE/api/lgpd | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('total apos recusa:', d['total'])
recusas = [c for c in d['consentimentos'] if not c['aceitou']]
print('recusas encontradas:', len(recusas))
"
echo ""

echo "=== CONFIGURAÇÕES ==="
echo "--- TESTE 12: Buscar configuração atual da organização ---"
curl -s -H "$AUTH" $BASE/api/configuracoes | python3 -m json.tool
echo ""

echo "--- TESTE 13: Atualizar configuração (nome, cor, política, toggles) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT $BASE/api/configuracoes -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"corPrimaria":"#FF5733","politicaPrivacidadePadrao":"Nova política de teste.","iaAnaliseHabilitada":false,"recaptchaHabilitado":false}'
echo ""

echo "--- TESTE 14: Confirmar que o toggle de reCAPTCHA desligado reflete no formulário público ---"
curl -s $BASE/api/publico/pesquisas/$SLUG | python3 -c "
import json, sys
d = json.load(sys.stdin)['pesquisa']
print('recaptchaHabilitado (deve ser False agora):', d['recaptchaHabilitado'])
"
echo ""

echo "--- TESTE 15: Usuário comum (não-gestor) tentando alterar configurações (deve dar 403) ---"
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT $BASE/api/configuracoes -H "Authorization: Bearer $USR_TOKEN" -H "Content-Type: application/json" -d '{"nome":"Hack"}'
echo ""

echo "=== FIM DOS TESTES DO SPRINT 6 ==="
