import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/* ─────────────────────────────────────────────
   SUPABASE CONFIG (mesmo projeto do page.js)
───────────────────────────────────────────── */
const SUPA_URL = 'https://ujvaietlkqjwjfqtxoxn.supabase.co';
const SUPA_KEY = 'sb_publishable_vrT8lrS0PBmL0LGbuBQPrg_jGNtO6wW';

async function db(path, opts = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
    },
    ...opts,
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ SUPABASE RAW ERROR (ContagemSemanal):', errText);
    throw new Error(errText);
  }
  const data = await res.text();
  return data ? JSON.parse(data) : [];
}

const contagemApi = {
  getItems:       () => db('items?order=name'),
  getInboundLog:  () => db('inbound_log'),
  getOutboundLog: () => db('outbound_log'),
  insertInboundBulk:  (rows) => db('inbound_log',  { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
  insertOutboundBulk: (rows) => db('outbound_log', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
};

const today = () => new Date().toISOString().split('T')[0];
const OBS_CONTAGEM = 'Contagem semanal';

/* Normaliza texto para comparar cabeçalhos de planilha (sem acento, minúsculo) */
function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function rowToInbound(r)  { return { id: r.id, itemId: r.item_id, qty: r.qty, date: r.date, sc: r.sc }; }
function rowToOutbound(r) { return { id: r.id, itemId: r.item_id, qty: r.qty, date: r.date, notes: r.notes }; }

export default function ContagemSemanal() {
  const [items, setItems] = useState([]);
  const [inboundLog, setInboundLog] = useState([]);
  const [outboundLog, setOutboundLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState(null); // { text, type }
  const [searchQuery, setSearchQuery] = useState('');
  const [fisico, setFisico] = useState({}); // { itemId: 'valor digitado' }
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rawItems, rawInbound, rawOutbound] = await Promise.all([
        contagemApi.getItems(),
        contagemApi.getInboundLog(),
        contagemApi.getOutboundLog(),
      ]);
      setItems(rawItems.map(i => ({ id: i.id, name: i.name, unit: i.unit })));
      setInboundLog(rawInbound.map(rowToInbound));
      setOutboundLog(rawOutbound.map(rowToOutbound));
    } catch (err) {
      console.error('Erro ao carregar dados para contagem:', err);
      setMsg({ text: 'Erro ao carregar itens/estoque.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getQty = useCallback((itemId) => {
    const totalIn  = inboundLog.filter(r => r.itemId === itemId).reduce((s, r) => s + Number(r.qty), 0);
    const totalOut = outboundLog.filter(r => r.itemId === itemId).reduce((s, r) => s + Number(r.qty), 0);
    return totalIn - totalOut;
  }, [inboundLog, outboundLog]);

  /* ── Linhas com saldo calculado ── */
  const rows = useMemo(() => {
    return items.map(item => {
      const sistema = getQty(item.id);
      const valorDigitado = fisico[item.id];
      const contado = valorDigitado !== undefined && valorDigitado !== '';
      const fisicoNum = contado ? Number(valorDigitado) : null;
      const saldo = contado && !Number.isNaN(fisicoNum) ? fisicoNum - sistema : null;
      return { ...item, sistema, valorDigitado: valorDigitado ?? '', contado, saldo };
    });
  }, [items, fisico, getQty]);

  const filteredRows = rows.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.id.includes(searchQuery)
  );

  const resumo = useMemo(() => {
    const contados = rows.filter(r => r.contado);
    const entradas = contados.filter(r => r.saldo > 0);
    const saidas   = contados.filter(r => r.saldo < 0);
    const semAlteracao = contados.filter(r => r.saldo === 0);
    return { contados: contados.length, entradas, saidas, semAlteracao: semAlteracao.length };
  }, [rows]);

  /* ── Importar planilha (xlsx/csv) ── */
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMsg(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!json.length) {
        setMsg({ text: 'A planilha está vazia.', type: 'error' });
        return;
      }

      // Descobre dinamicamente qual coluna é o código e qual é a quantidade física
      const headers = Object.keys(json[0]);
      const colCodigo = headers.find(h => /codig/.test(norm(h)) || norm(h) === 'id');
      const colFisico = headers.find(h => /fisic/.test(norm(h)));

      if (!colCodigo || !colFisico) {
        setMsg({ text: 'Não encontrei as colunas "Código" e "Qtd Física" na planilha. Confira os cabeçalhos.', type: 'error' });
        return;
      }

      const itemIds = new Set(items.map(i => i.id));
      const novosFisico = {};
      let preenchidos = 0;
      const naoEncontrados = [];

      json.forEach(row => {
        const codigo = String(row[colCodigo] ?? '').trim();
        const valor = row[colFisico];
        if (!codigo || valor === '' || valor === undefined || valor === null) return;
        if (!itemIds.has(codigo)) { naoEncontrados.push(codigo); return; }
        const num = Number(valor);
        if (Number.isNaN(num)) return;
        novosFisico[codigo] = String(num);
        preenchidos++;
      });

      setFisico(prev => ({ ...prev, ...novosFisico }));

      if (preenchidos === 0) {
        setMsg({ text: 'Nenhuma linha da planilha pôde ser lida (confira os códigos e a coluna de qtd física).', type: 'error' });
      } else {
        const extra = naoEncontrados.length
          ? ` ${naoEncontrados.length} código(s) da planilha não existem no sistema (${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '...' : ''}).`
          : '';
        setMsg({ text: `${preenchidos} item(ns) preenchidos a partir da planilha.${extra}`, type: extra ? 'warning' : 'success' });
      }
    } catch (err) {
      console.error('Erro ao importar planilha:', err);
      setMsg({ text: 'Erro ao ler a planilha. Verifique se é um arquivo .xlsx, .xls ou .csv válido.', type: 'error' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Exportar modelo de planilha para preencher offline ── */
  const handleExportModelo = async () => {
    try {
      const XLSX = await import('xlsx');
      const linhas = [...items]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        .map(item => ({
          'Código': item.id,
          'Descrição': item.name,
          'Qtd Sistema': getQty(item.id),
          'Qtd Fisico': '',
        }));
      const ws = XLSX.utils.json_to_sheet(linhas);
      ws['!cols'] = [{ wch: 12 }, { wch: 45 }, { wch: 14 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contagem');
      XLSX.writeFile(wb, `contagem-semanal_${today()}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar modelo:', err);
      setMsg({ text: 'Erro ao gerar a planilha modelo.', type: 'error' });
    }
  };

  const handleLimpar = () => {
    if (!confirm('Limpar todos os valores de contagem digitados/importados?')) return;
    setFisico({});
    setMsg(null);
  };

  /* ── Aplica a contagem: gera entradas/saídas em massa ── */
  const handleAplicar = async () => {
    const { entradas, saidas } = resumo;
    if (entradas.length === 0 && saidas.length === 0) {
      setMsg({ text: 'Nenhuma diferença para lançar (tudo bate com o sistema).', type: 'warning' });
      return;
    }
    const ok = confirm(
      `Serão lançados ${entradas.length} entrada(s) e ${saidas.length} saída(s), com data de hoje e observação "${OBS_CONTAGEM}".\n\nConfirmar?`
    );
    if (!ok) return;

    setSaving(true);
    try {
      const stamp = Date.now();
      const inboundRows = entradas.map((r, idx) => ({
        id: `IN-${stamp}-${idx}`, item_id: r.id, qty: r.saldo, date: today(), sc: OBS_CONTAGEM,
      }));
      const outboundRows = saidas.map((r, idx) => ({
        id: `OUT-${stamp}-${idx}`, item_id: r.id, qty: Math.abs(r.saldo), date: today(), notes: OBS_CONTAGEM,
      }));

      if (inboundRows.length)  await contagemApi.insertInboundBulk(inboundRows);
      if (outboundRows.length) await contagemApi.insertOutboundBulk(outboundRows);

      setInboundLog(prev => [...prev, ...inboundRows.map(rowToInbound)]);
      setOutboundLog(prev => [...prev, ...outboundRows.map(rowToOutbound)]);
      setFisico({});
      setMsg({ text: `Contagem aplicada! ${inboundRows.length} entrada(s) e ${outboundRows.length} saída(s) lançadas.`, type: 'success' });
    } catch (err) {
      console.error('Erro ao aplicar contagem:', err);
      setMsg({ text: 'Erro ao lançar a contagem. Nada foi perdido — tente novamente.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const msgStyles = {
    error:   'bg-rose-50 text-rose-700 border-rose-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Contagem Semanal</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Digite a quantidade física contada ou importe a planilha preenchida — o sistema calcula o saldo e lança entradas/saídas em massa com a observação "{OBS_CONTAGEM}".
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExportModelo} disabled={loading || !items.length}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition disabled:opacity-50">
              📄 Exportar planilha
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileImport} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing || loading}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
              {importing ? 'Importando...' : '📥 Importar planilha'}
            </button>
            <button onClick={handleLimpar} disabled={loading}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition disabled:opacity-50">
              🧹 Limpar
            </button>
          </div>
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${msgStyles[msg.type] || msgStyles.success}`}>
            {msg.text}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
          <span>{resumo.contados} contado(s)</span>
          <span className="text-emerald-700">↑ {resumo.entradas.length} entrada(s)</span>
          <span className="text-rose-700">↓ {resumo.saidas.length} saída(s)</span>
          <span className="text-slate-400">= {resumo.semAlteracao} sem alteração</span>
          <div className="flex-1" />
          <button onClick={handleAplicar} disabled={saving || loading || (resumo.entradas.length === 0 && resumo.saidas.length === 0)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Aplicando...' : '✅ Aplicar contagem'}
          </button>
        </div>

        <input type="text" placeholder="Buscar por código ou nome..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando itens...</div>
        ) : (
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Código</th>
                  <th className="px-4 py-2.5">Nome</th>
                  <th className="px-4 py-2.5 text-center">Sistema</th>
                  <th className="px-4 py-2.5 text-center w-32">Físico</th>
                  <th className="px-4 py-2.5 text-center">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(r => (
                  <tr key={r.id} className={r.contado ? (r.saldo === 0 ? 'bg-slate-50/50' : 'bg-blue-50/40') : ''}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.id}</td>
                    <td className="px-4 py-2 text-slate-700">{r.name}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{r.sistema} <span className="text-slate-400">{r.unit}</span></td>
                    <td className="px-4 py-2">
                      <input type="number" value={r.valorDigitado}
                        onChange={e => setFisico(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="—"
                        className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      {r.contado ? (
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          r.saldo > 0 ? 'bg-emerald-100 text-emerald-700' :
                          r.saldo < 0 ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {r.saldo > 0 ? '+' : ''}{r.saldo}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
                {!filteredRows.length && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">Nenhum item encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
