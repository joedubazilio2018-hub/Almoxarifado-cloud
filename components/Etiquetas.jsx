'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { PrintCheckbox, fmtDate } from './printUtils';

/* ─────────────────────────────────────────────
   SUPABASE CONFIG (mesmo projeto do page.js / Reformas.jsx)
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
    console.error('❌ SUPABASE RAW ERROR (Etiquetas):', errText);
    throw new Error(errText);
  }
  const data = await res.text();
  return data ? JSON.parse(data) : [];
}

const reformasApi = {
  // Só os campos que interessam aqui: nº da reforma, cliente e status (pra identificar na lista)
  getReformas: () => db('reformas?select=id,reforma,cliente,status,created_at&order=created_at.desc'),
};

// Fila de etiquetas: agora vive no Supabase (tabela etiquetas_fila), compartilhada
// entre celular e computador. Antes ficava só em localStorage, por isso não sincronizava.
const filaApi = {
  getFila:        () => db('etiquetas_fila?order=created_at.asc'),
  insertFila:     (row) => db('etiquetas_fila', { method: 'POST', body: JSON.stringify(row) }),
  // Insert em lote (array) — uma única chamada, tudo ou nada. Usado no modo "vários pesos".
  insertFilaMany: (rows) => db('etiquetas_fila', { method: 'POST', body: JSON.stringify(rows) }),
  updateFila:     (id, row) => db(`etiquetas_fila?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(row) }),
  deleteFila:     (id) => db(`etiquetas_fila?id=eq.${id}`, { method: 'DELETE', prefer: '' }),
  deleteFilaIds:  (ids) => db(`etiquetas_fila?id=in.(${ids.join(',')})`, { method: 'DELETE', prefer: '' }),
};

const STATUS_LABEL = {
  recebido:      'Recebido',
  em_producao:   'Em produção',
  em_separacao:  'Em separação',
  finalizado:    'Finalizado',
};

/* Campos disponíveis pra montar a etiqueta. Cada etiqueta da fila usa só
   os campos marcados como "incluir" — o resto nem aparece na impressão.
   É texto livre, exceto "Nº Reforma" e "Cliente", que também podem vir
   vinculados a um registro real da tabela reformas (só leitura). */
const FIELD_DEFS = [
  { key: 'item',    label: 'Item / Descrição', type: 'text' },
  { key: 'medida',  label: 'Medida',           type: 'text' },
  { key: 'nf',      label: 'Nº NF',            type: 'text' },
  { key: 'data',    label: 'Data',             type: 'date' },
  { key: 'peso',    label: 'Peso',             type: 'text' },
  { key: 'reforma', label: 'Nº Reforma',       type: 'text' },
  { key: 'cliente', label: 'Cliente',          type: 'text' },
  { key: 'pedido',  label: 'Nº Pedido',        type: 'text' },
  { key: 'obs',     label: 'Obs',              type: 'text' },
];

const STATUS_OPTIONS = [
  { key: 'aguardando', label: 'Aguardando conferência' },
  { key: 'aprovado',   label: 'Aprovado' },
  { key: 'reprovado',  label: 'Reprovado' },
];

function emptyIncluded() {
  return FIELD_DEFS.reduce((acc, f) => ({ ...acc, [f.key]: false }), {});
}
function emptyValues() {
  return FIELD_DEFS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});
}

// Aceita "12,5" ou "12.5" (vírgula ou ponto) e devolve número, ou NaN se inválido.
function parsePesoBR(str) {
  if (str == null) return NaN;
  return parseFloat(String(str).trim().replace(',', '.'));
}
// Devolve o número formatado com vírgula, sem casas decimais desnecessárias
// (ex: 12.5 → "12,5"; 10 → "10"; 9.456 → "9,456").
function formatPesoBR(n) {
  if (!isFinite(n)) return '';
  const arredondado = Math.round(n * 1000) / 1000;
  return String(arredondado).replace('.', ',');
}

// Campos que mudam a cada etiqueta e por isso são limpos depois de "Adicionar".
// Os demais (item, NF, data, reforma, cliente, pedido) e os checkboxes ficam como estão,
// pra você não precisar remarcar tudo a cada etiqueta. Quer que o Item também limpe? Inclua 'item' aqui.
const CAMPOS_LIMPOS_APOS_ADICIONAR = ['medida', 'peso', 'obs'];

// Separa os pesos digitados. Aceita quebra de linha, espaço ou ponto e vírgula.
// ATENÇÃO: vírgula NÃO separa, porque é o separador decimal (27,5 = vinte e sete e meio).
function parsePesosLista(str) {
  return String(str || '').split(/[\s;]+/).map(p => p.trim()).filter(Boolean);
}

// Na exibição (lista da fila e impressão), a medida aparece colada ao nome do item
// (ex: "Arame 9,5") em vez de numa linha separada. Só junta quando os dois campos existem;
// se o Item não estiver marcado, a Medida continua saindo sozinha. Os dados salvos
// não mudam (item e medida seguem separados), então os totais por medida continuam funcionando.
function camposParaExibir(fields) {
  const item   = fields.find(f => f.key === 'item');
  const medida = fields.find(f => f.key === 'medida');
  if (!item || !medida) return fields;
  const junto = [item.value, medida.value]
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  return fields
    .filter(f => f.key !== 'medida')
    .map(f => f.key === 'item' ? { ...f, value: junto } : f);
}

function novoCard(id) {
  return { id: id || `c${Date.now()}`, medida: '', pesos: '' };
}

export default function Etiquetas() {
  const [included, setIncluded]       = useState(emptyIncluded());
  const [values, setValues]           = useState(emptyValues());
  const [includeStatus, setIncludeStatus] = useState(false);
  const [status, setStatus]           = useState('');
  const [queue, setQueue]             = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError]   = useState(false);
  const [savingQueue, setSavingQueue] = useState(false);
  const [showPrint, setShowPrint]     = useState(false);
  const [editingId, setEditingId]     = useState(null);

  // ── Modo "vários pesos": gera uma etiqueta pra cada peso digitado,
  // repetindo os demais campos (item, medida, NF, data, reforma, cliente...).
  // Útil pra arames/tubos, onde cada rolo/peça tem um peso diferente
  // mas o resto da etiqueta é idêntico.
  // Cada "card" é uma medida (ex: 9,5mm, 6mm) com a sua lista de pesos:
  // dá pra alternar entre os cards e gerar tudo de uma vez. ──
  const [multiPeso, setMultiPeso]         = useState(false);
  const [cards, setCards]                 = useState([novoCard('c0')]);
  const [activeCardId, setActiveCardId]   = useState('c0');
  const [tara, setTara]                   = useState(''); // ex: 15 (spyder do arame) — descontada de cada peso, não sai na etiqueta

  // ── Vínculo com Reformas (só leitura: nº da reforma + cliente) ──
  const [reformasList, setReformasList]         = useState([]);
  const [loadingReformas, setLoadingReformas]   = useState(true);
  const [reformasError, setReformasError]       = useState(false);
  const [selectedReformaId, setSelectedReformaId] = useState('');

  useEffect(() => {
    reformasApi.getReformas()
      .then(rows => setReformasList(rows))
      .catch(() => setReformasError(true))
      .finally(() => setLoadingReformas(false));
  }, []);

  // Fila compartilhada: carrega do Supabase (não mais do localStorage).
  const loadQueue = useCallback(() => {
    setLoadingQueue(true);
    setQueueError(false);
    return filaApi.getFila()
      .then(rows => setQueue(rows.map(r => ({
        id: r.id, fields: r.fields || [], includeStatus: r.include_status, status: r.status || '',
      }))))
      .catch(() => setQueueError(true))
      .finally(() => setLoadingQueue(false));
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const isLinked = selectedReformaId !== '';

  function handleSelectReforma(id) {
    if (!id) {
      setSelectedReformaId('');
      return;
    }
    const rec = reformasList.find(r => String(r.id) === String(id));
    if (!rec) return;

    setSelectedReformaId(id);
    setValues(prev => ({ ...prev, reforma: rec.reforma || '', cliente: rec.cliente || '' }));
    setIncluded(prev => ({ ...prev, reforma: true, cliente: true }));
  }

  function handleUnlinkReforma() {
    setSelectedReformaId('');
    // Mantém o que já estava preenchido, só destrava pra edição manual.
  }

  const toggleField = (key) => setIncluded(prev => ({ ...prev, [key]: !prev[key] }));
  const setValue     = (key, v) => setValues(prev => ({ ...prev, [key]: v }));

  const selectedCount = FIELD_DEFS.filter(f => included[f.key]).length;

  // Modo "vários pesos" só vale se o campo Peso estiver marcado e não estiver editando uma etiqueta.
  const multiAtivo = multiPeso && included.peso && !editingId;

  const taraNum = parsePesoBR(tara) || 0;
  const activeCard = cards.find(c => c.id === activeCardId) || cards[0];

  function toggleMultiPeso() {
    const next = !multiPeso;
    setMultiPeso(next);
    if (next) setIncluded(prev => ({ ...prev, medida: true })); // a medida vem dos cards
  }
  function updateCard(id, patch) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }
  function addCard() {
    const c = novoCard();
    setCards(prev => [...prev, c]);
    setActiveCardId(c.id);
  }
  function removeCard(id) {
    if (cards.length <= 1) return;
    const restantes = cards.filter(c => c.id !== id);
    setCards(restantes);
    if (activeCardId === id) setActiveCardId(restantes[0].id);
  }
  function resetCards() {
    setCards([novoCard('c0')]);
    setActiveCardId('c0');
  }
  // Quantidade de etiquetas e peso líquido de um card
  function resumoCard(card) {
    const pesos = parsePesosLista(card.pesos);
    const liquidos = pesos.map(parsePesoBR).filter(n => !isNaN(n)).map(n => n - taraNum);
    return { qtd: pesos.length, liquido: liquidos.reduce((s, n) => s + n, 0) };
  }
  const totalEtiquetasMulti = cards.reduce((s, c) => s + resumoCard(c).qtd, 0);
  const totalLiquidoMulti   = cards.reduce((s, c) => s + resumoCard(c).liquido, 0);

  function limparValoresPorEtiqueta() {
    setValues(prev => {
      const next = { ...prev };
      CAMPOS_LIMPOS_APOS_ADICIONAR.forEach(k => { next[k] = ''; });
      return next;
    });
  }

  async function handleAdd() {
    // ── Modo "vários pesos": uma etiqueta por peso, em cada card (medida) ──
    if (multiAtivo) {
      const pesoDef = FIELD_DEFS.find(f => f.key === 'peso');
      const rows = [];

      for (const card of cards) {
        const pesos = parsePesosLista(card.pesos);
        if (pesos.length === 0) continue; // card sem pesos é ignorado
        const medida = card.medida.trim();

        if (included.medida && !medida) {
          alert('Tem um card com pesos mas sem medida. Preencha a medida ou apague o card.');
          setActiveCardId(card.id);
          return;
        }

        for (const pesoBruto of pesos) {
          const pesoNum = parsePesoBR(pesoBruto);
          if (!isNaN(pesoNum) && pesoNum - taraNum <= 0) {
            alert(`O peso "${pesoBruto}" (${medida || 'sem medida'}) é menor ou igual à tara (${formatPesoBR(taraNum)} kg). Confira antes de gerar.`);
            setActiveCardId(card.id);
            return;
          }
          // Desconta a tara — se o valor digitado não for um número válido, mantém como digitado.
          const pesoLiquido = isNaN(pesoNum) ? pesoBruto : formatPesoBR(pesoNum - taraNum);

          // Monta na ordem de FIELD_DEFS: medida vem do card, peso é o líquido, o resto vem do formulário.
          const fields = FIELD_DEFS
            .filter(f => f.key === 'peso' || included[f.key])
            .map(f => ({
              key: f.key, label: f.label, type: f.type,
              value: f.key === 'peso' ? pesoLiquido : f.key === 'medida' ? medida : values[f.key],
            }));

          rows.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fields, include_status: includeStatus, status,
          });
        }
      }

      if (rows.length === 0) {
        alert('Digite pelo menos um peso em algum card (um por linha).');
        return;
      }

      setSavingQueue(true);
      try {
        await filaApi.insertFilaMany(rows); // tudo ou nada: se falhar, nenhuma etiqueta entra
        setQueue(prev => [
          ...prev,
          ...rows.map(r => ({ id: r.id, fields: r.fields, includeStatus, status })),
        ]);
        // Mantém o modo, os cards (medidas) e os campos fixos; limpa só os pesos.
        setCards(prev => prev.map(c => ({ ...c, pesos: '' })));
        limparValoresPorEtiqueta();
      } catch (e) {
        console.error('Erro ao salvar etiquetas (vários pesos):', e);
        alert('Não foi possível salvar as etiquetas agora. Nenhuma foi adicionada. Verifique sua conexão e tente de novo.');
      } finally {
        setSavingQueue(false);
      }
      return;
    }

    const fields = FIELD_DEFS
      .filter(f => included[f.key])
      .map(f => ({ key: f.key, label: f.label, value: values[f.key], type: f.type }));

    if (fields.length === 0 && !includeStatus) return;

    // Como os checkboxes agora ficam marcados entre uma etiqueta e outra,
    // evita gerar etiqueta em branco por clique sem querer.
    if (fields.length > 0 && !includeStatus && fields.every(f => !String(f.value || '').trim())) {
      alert('Preencha pelo menos um campo antes de adicionar.');
      return;
    }

    setSavingQueue(true);
    try {
      if (editingId) {
        await filaApi.updateFila(editingId, { fields, include_status: includeStatus, status });
        setQueue(prev => prev.map(q =>
          q.id === editingId ? { ...q, fields, includeStatus, status } : q
        ));
        setEditingId(null);

        // Terminou de editar: volta o formulário ao estado inicial.
        setValues(emptyValues());
        setIncluded(emptyIncluded());
        setIncludeStatus(false);
        setStatus('');
        setSelectedReformaId('');
      } else {
        const row = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fields, include_status: includeStatus, status,
        };
        await filaApi.insertFila(row);
        setQueue(prev => [...prev, { id: row.id, fields, includeStatus, status }]);

        // Mantém checkboxes, carimbo de status e vínculo com a reforma marcados;
        // limpa só o que muda a cada etiqueta (ver CAMPOS_LIMPOS_APOS_ADICIONAR).
        limparValoresPorEtiqueta();
      }
    } catch (e) {
      console.error('Erro ao salvar etiqueta na fila:', e);
      alert('Não foi possível salvar a etiqueta agora. Verifique sua conexão e tente de novo.');
    } finally {
      setSavingQueue(false);
    }
  }

  function handleEdit(id) {
    const item = queue.find(q => q.id === id);
    if (!item) return;

    const nextIncluded = emptyIncluded();
    const nextValues   = emptyValues();
    item.fields.forEach(f => {
      nextIncluded[f.key] = true;
      nextValues[f.key]   = f.value;
    });

    setIncluded(nextIncluded);
    setValues(nextValues);
    setIncludeStatus(item.includeStatus);
    setStatus(item.status || '');
    setSelectedReformaId(''); // edição manual; se quiser revincular, escolhe de novo
    setMultiPeso(false);
    resetCards();
    setTara('');
    setEditingId(id);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setValues(emptyValues());
    setIncluded(emptyIncluded());
    setIncludeStatus(false);
    setStatus('');
    setSelectedReformaId('');
    setMultiPeso(false);
    resetCards();
    setTara('');
  }

  async function handleRemove(id) {
    const prevQueue = queue;
    setQueue(prev => prev.filter(q => q.id !== id));
    if (editingId === id) handleCancelEdit();
    try {
      await filaApi.deleteFila(id);
    } catch (e) {
      console.error('Erro ao remover etiqueta:', e);
      setQueue(prevQueue); // desfaz a remoção local se a chamada falhar
      alert('Não foi possível remover a etiqueta agora. Verifique sua conexão e tente de novo.');
    }
  }

  async function handleClearQueue() {
    if (queue.length === 0) return;
    const ids = queue.map(q => q.id);
    const prevQueue = queue;
    setQueue([]);
    setEditingId(null);
    try {
      await filaApi.deleteFilaIds(ids);
    } catch (e) {
      console.error('Erro ao limpar fila:', e);
      setQueue(prevQueue);
      alert('Não foi possível limpar a fila agora. Verifique sua conexão e tente de novo.');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-indigo-800">Etiquetas de Identificação</h1>
        <p className="text-slate-400 text-xs mt-0.5">
          Monte etiquetas em texto livre, escolha os campos de cada uma e imprima tudo junto pra recortar e colar.
        </p>
      </div>

      {/* ── Vínculo com Reforma ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
          Vincular a uma reforma existente <span className="text-slate-300 normal-case font-medium">(opcional)</span>
        </p>
        <p className="text-[11px] text-slate-400 mb-3">
          Puxa automaticamente o Nº Reforma e o Cliente do registro selecionado. O resto da etiqueta continua sendo texto livre.
        </p>

        {reformasError ? (
          <p className="text-xs text-amber-600">Não foi possível carregar as reformas agora. Preencha Nº Reforma e Cliente manualmente abaixo.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={selectedReformaId}
              onChange={(e) => handleSelectReforma(e.target.value)}
              disabled={loadingReformas}
              className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white disabled:text-slate-300"
            >
              <option value="">
                {loadingReformas ? 'Carregando reformas...' : '— Nenhuma / preencher manualmente —'}
              </option>
              {reformasList.map(r => (
                <option key={r.id} value={r.id}>
                  Nº {r.reforma || '—'} — {r.cliente || 'sem cliente'} ({STATUS_LABEL[r.status] || r.status})
                </option>
              ))}
            </select>

            {isLinked && (
              <button
                type="button"
                onClick={handleUnlinkReforma}
                className="shrink-0 px-3 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-lg hover:border-red-300 hover:text-red-500 transition"
              >
                🔗 Desvincular
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Formulário ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        {editingId && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
            ✏️ Editando etiqueta — ajuste os campos abaixo e clique em "Salvar edição".
          </div>
        )}
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          Campos desta etiqueta {selectedCount > 0 && <span className="text-indigo-500">({selectedCount} selecionado{selectedCount > 1 ? 's' : ''})</span>}
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          {FIELD_DEFS.map(f => {
            const lockedByReforma = isLinked && (f.key === 'reforma' || f.key === 'cliente');
            const isPeso = f.key === 'peso';
            const isMedida = f.key === 'medida';
            return (
              <div key={f.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                lockedByReforma
                  ? 'border-emerald-300 bg-emerald-50'
                  : included[f.key] ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'
              }`}>
                <input
                  type="checkbox"
                  checked={included[f.key]}
                  onChange={() => toggleField(f.key)}
                  className="w-4 h-4 accent-indigo-600 shrink-0"
                />
                <label className="text-xs font-semibold text-slate-600 w-28 shrink-0 flex items-center gap-1">
                  {f.label}
                  {lockedByReforma && <span title="Vinculado à reforma selecionada">🔗</span>}
                </label>
                {isPeso && included.peso && !editingId ? (
                  <button
                    type="button"
                    onClick={toggleMultiPeso}
                    className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border transition mr-1 ${
                      multiPeso
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                    }`}
                    title="Gerar uma etiqueta pra cada peso, repetindo o resto dos campos"
                  >
                    ⚖️ Vários pesos
                  </button>
                ) : null}
                <input
                  type={f.type}
                  value={values[f.key]}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  disabled={!included[f.key] || (isPeso && multiAtivo) || (isMedida && multiAtivo)}
                  readOnly={lockedByReforma}
                  placeholder={
                    isPeso && multiAtivo ? 'defina os pesos abaixo'
                    : isMedida && multiAtivo ? 'definida nos cards abaixo'
                    : (f.type === 'text' ? f.label : '')
                  }
                  className={`flex-1 min-w-0 text-sm bg-transparent outline-none disabled:text-slate-300 ${lockedByReforma ? 'text-emerald-700 font-semibold' : ''}`}
                />
              </div>
            );
          })}
        </div>

        {multiAtivo && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3">
            <p className="text-xs font-bold text-amber-700 mb-1">
              ⚖️ Vários pesos por medida
            </p>
            <p className="text-[11px] text-amber-600 mb-2">
              Cada card é uma medida. Toque num card pra alternar entre eles e digite os pesos dele (um por linha ou separados por espaço). Os demais campos marcados acima (item, NF, data, reforma, cliente...) se repetem em todas as etiquetas. Ao final, um clique gera tudo.
            </p>

            <div className="flex items-center gap-2 mb-3">
              <label className="text-[11px] font-bold text-amber-700 shrink-0">Tara por peso (kg):</label>
              <input
                type="text"
                inputMode="decimal"
                value={tara}
                onChange={(e) => setTara(e.target.value)}
                placeholder="ex: 15 (spyder do arame)"
                className="w-40 text-sm border border-amber-200 rounded-md px-2 py-1 bg-white outline-none focus:border-amber-400"
              />
              <span className="text-[10px] text-amber-500">descontada de cada peso — não aparece na etiqueta</span>
            </div>

            {/* Cards de medida */}
            <div className="flex flex-wrap gap-2 mb-3">
              {cards.map(c => {
                const r = resumoCard(c);
                const ativo = activeCard && activeCard.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCardId(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      ativo
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white border-amber-200 text-amber-700 hover:border-amber-400'
                    }`}
                  >
                    {c.medida.trim() || 'Sem medida'}
                    <span className={`ml-1.5 font-semibold ${ativo ? 'text-amber-100' : 'text-amber-400'}`}>
                      ({r.qtd})
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={addCard}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-dashed border-amber-400 text-amber-600 bg-white hover:bg-amber-100 transition"
              >
                + Medida
              </button>
            </div>

            {activeCard && (
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-[11px] font-bold text-amber-700 shrink-0">Medida:</label>
                  <input
                    type="text"
                    value={activeCard.medida}
                    onChange={(e) => updateCard(activeCard.id, { medida: e.target.value })}
                    placeholder="ex: 9,5"
                    className="flex-1 min-w-0 text-sm border border-amber-200 rounded-md px-2 py-1 bg-white outline-none focus:border-amber-400"
                  />
                  {cards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCard(activeCard.id)}
                      className="shrink-0 text-[11px] font-bold text-slate-400 hover:text-red-500 transition"
                    >
                      🗑 Apagar card
                    </button>
                  )}
                </div>
                <textarea
                  value={activeCard.pesos}
                  onChange={(e) => updateCard(activeCard.id, { pesos: e.target.value })}
                  placeholder={'Pesos, um por linha. Ex:\n27,5\n28,0\n26,8'}
                  rows={4}
                  className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-amber-400"
                />
                {(() => {
                  const r = resumoCard(activeCard);
                  return r.qtd > 0 ? (
                    <p className="text-[11px] text-amber-700 font-semibold mt-1">
                      {r.qtd} peso(s) nesta medida — líquido: {formatPesoBR(r.liquido)} kg
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            {totalEtiquetasMulti > 0 && (
              <p className="text-[11px] text-amber-700 font-semibold mt-2">
                Total: {totalEtiquetasMulti} etiqueta(s) serão geradas — líquido: {formatPesoBR(totalLiquidoMulti)} kg
              </p>
            )}
          </div>
        )}

        {/* Carimbo de status */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeStatus}
              onChange={() => setIncludeStatus(v => !v)}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Incluir carimbo de status</span>
          </label>

          {includeStatus && (
            <div className="flex flex-wrap gap-2 pl-6">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(prev => prev === s.key ? '' : s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                    status === s.key
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <p className="w-full text-[11px] text-slate-400 mt-1">
                Deixe nenhum marcado se quiser imprimir as três caixinhas em branco pra assinalar depois, à caneta.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleAdd}
            disabled={
              (selectedCount === 0 && !includeStatus) ||
              savingQueue ||
              (multiAtivo && totalEtiquetasMulti === 0)
            }
            className={`px-5 py-2.5 text-white rounded-lg text-sm font-bold transition disabled:bg-slate-200 disabled:text-slate-400 ${
              editingId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {savingQueue
              ? 'Salvando...'
              : editingId
              ? '✓ Salvar edição'
              : multiAtivo
              ? `+ Adicionar ${totalEtiquetasMulti || ''} etiqueta(s) à fila`
              : '+ Adicionar à fila de impressão'}
          </button>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              className="px-5 py-2.5 border border-slate-200 text-slate-500 rounded-lg text-sm font-bold hover:border-red-300 hover:text-red-500 transition"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </div>

      {/* ── Fila ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Fila de etiquetas ({queue.length})
          </p>
          <div className="flex items-center gap-3">
            <button onClick={loadQueue} disabled={loadingQueue}
              className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 disabled:text-slate-300 transition">
              {loadingQueue ? 'Atualizando...' : '🔄 Atualizar'}
            </button>
            {queue.length > 0 && (
              <button onClick={handleClearQueue} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition">
                Limpar tudo
              </button>
            )}
          </div>
        </div>

        {/* Total de peso por medida — soma tudo que já está na fila, mesmo
            vindo de lotes/momentos diferentes (útil pra conferir com a NF
            quando o material chega misturado). */}
        {(() => {
          const totaisPorMedida = queue.reduce((acc, q) => {
            const medidaField = q.fields.find(f => f.key === 'medida');
            const pesoField   = q.fields.find(f => f.key === 'peso');
            if (!medidaField?.value || !pesoField?.value) return acc;
            const pesoNum = parsePesoBR(pesoField.value);
            if (isNaN(pesoNum)) return acc;
            const medida = medidaField.value;
            if (!acc[medida]) acc[medida] = { total: 0, count: 0 };
            acc[medida].total += pesoNum;
            acc[medida].count += 1;
            return acc;
          }, {});
          const medidas = Object.keys(totaisPorMedida);
          if (medidas.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-2 mb-3">
              {medidas.map(medida => (
                <span key={medida} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600">
                  {medida}: <span className="text-slate-900">{formatPesoBR(totaisPorMedida[medida].total)} kg</span>
                  <span className="text-slate-400 font-normal"> ({totaisPorMedida[medida].count})</span>
                </span>
              ))}
            </div>
          );
        })()}

        {queueError && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            Não foi possível carregar a fila agora. Verifique sua conexão e clique em "Atualizar".
          </p>
        )}

        {loadingQueue ? (
          <p className="text-sm text-slate-300 py-4 text-center">Carregando fila...</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-slate-300 py-4 text-center">Nenhuma etiqueta adicionada ainda.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {queue.map((q, idx) => (
              <div key={q.id} className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 ${
                editingId === q.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100'
              }`}>
                <p className="text-xs text-slate-600 truncate">
                  <span className="font-bold text-slate-400 mr-2">#{idx + 1}</span>
                  {q.fields.length > 0
                    ? camposParaExibir(q.fields).map(f => `${f.label}: ${f.type === 'date' && f.value ? fmtDate(f.value) : (f.value || '—')}`).join('  ·  ')
                    : '(sem campos de texto)'}
                  {q.includeStatus && (
                    <span className="ml-2 text-indigo-500 font-semibold">
                      {q.status ? `· ${STATUS_OPTIONS.find(s => s.key === q.status)?.label}` : '· status em branco'}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleEdit(q.id)} className="text-slate-400 hover:text-indigo-600 transition text-xs font-bold">
                    ✏️ Editar
                  </button>
                  <button onClick={() => handleRemove(q.id)} className="text-slate-300 hover:text-red-500 transition text-lg leading-none">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPrint(true)}
          disabled={queue.length === 0}
          className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-bold transition"
        >
          🖨️ Imprimir etiquetas ({queue.length})
        </button>
      </div>

      {showPrint && <PrintEtiquetas queue={queue} onClose={() => setShowPrint(false)} />}
    </div>
  );
}

/* Quanto menos campos a etiqueta tiver, maior a fonte — pra preencher bem
   o espaço de 14x6cm em vez de deixar tudo grudado e pequeno no topo. */
function fieldTextSizeClass(count) {
  if (count <= 2) return 'text-2xl';
  if (count === 3) return 'text-xl';
  if (count === 4) return 'text-lg';
  if (count <= 6) return 'text-sm';
  return 'text-xs';
}

/* ─────────────────────────────────────────────
   FOLHA DE ETIQUETAS — pronta pra imprimir, recortar e colar
   Cada etiqueta sai com 14cm x 6cm.
───────────────────────────────────────────── */
function PrintEtiquetas({ queue, onClose }) {
  return (
    <div className="print-modal-overlay fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto py-6 print:bg-white print:p-0 print:block">
      <div className="w-full max-w-4xl mx-4">
        <div className="print:hidden flex items-center justify-between mb-3 sticky top-0">
          <p className="text-white font-bold text-sm">Etiquetas prontas ({queue.length})</p>
          <div className="flex gap-2">
            <button onClick={() => window.print()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition">
              🖨️ Imprimir
            </button>
            <button onClick={onClose}
              className="px-4 py-2 bg-white text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100 transition">
              Fechar
            </button>
          </div>
        </div>

        <div className="printable-sheet bg-white rounded-2xl print:rounded-none p-6 print:p-0">
          <div className="flex flex-wrap gap-4 print:gap-3">
            {queue.map(q => {
              const campos = camposParaExibir(q.fields);
              return (
              <div
                key={q.id}
                style={{ width: '14cm', height: '6cm' }}
                className="border-2 border-slate-800 rounded-md p-3 flex flex-col justify-between break-inside-avoid print:break-inside-avoid"
              >
                <div className={`flex-1 flex flex-col overflow-hidden ${
                  campos.length > 1 ? 'justify-evenly' : 'justify-center'
                }`}>
                  {campos.length > 0 ? campos.map(f => (
                    <p key={f.key} className={`${fieldTextSizeClass(campos.length)} leading-snug`}>
                      <span className="font-bold text-slate-800">{f.label.toUpperCase()}:</span>{' '}
                      <span className="text-slate-700">
                        {f.type === 'date' && f.value ? fmtDate(f.value) : (f.value || '')}
                      </span>
                    </p>
                  )) : (
                    <p className="text-xs text-slate-300">—</p>
                  )}
                </div>

                {q.includeStatus && (
                  <div className="flex items-center gap-3 pt-2 mt-1 border-t border-slate-200">
                    {STATUS_OPTIONS.map(s => (
                      <span key={s.key} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                        <PrintCheckbox size={11} checked={q.status === s.key} />
                        {s.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
