'use client';
import React, { useState, useEffect } from 'react';
import { PrintCheckbox } from './printUtils';

/* ─────────────────────────────────────────────
   SUPABASE CONFIG (mesmo projeto do page.js / Reformas.jsx)
   Só leitura aqui — Etiquetas nunca escreve na tabela reformas.
───────────────────────────────────────────── */
const SUPA_URL = 'https://ujvaietlkqjwjfqtxoxn.supabase.co';
const SUPA_KEY = 'sb_publishable_vrT8lrS0PBmL0LGbuBQPrg_jGNtO6wW';

async function db(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
    },
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

export default function Etiquetas() {
  const [included, setIncluded]       = useState(emptyIncluded());
  const [values, setValues]           = useState(emptyValues());
  const [includeStatus, setIncludeStatus] = useState(false);
  const [status, setStatus]           = useState('');
  const [queue, setQueue]             = useState([]);
  const [showPrint, setShowPrint]     = useState(false);

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

  function handleAdd() {
    const fields = FIELD_DEFS
      .filter(f => included[f.key])
      .map(f => ({ key: f.key, label: f.label, value: values[f.key] }));

    if (fields.length === 0 && !includeStatus) return;

    setQueue(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fields, includeStatus, status },
    ]);

    // Mantém os campos marcados (mesma estrutura) mas limpa os valores,
    // pra facilitar preencher a próxima etiqueta igual.
    setValues(emptyValues());
    setStatus('');
    setSelectedReformaId('');
  }

  function handleRemove(id) {
    setQueue(prev => prev.filter(q => q.id !== id));
  }

  function handleClearQueue() {
    setQueue([]);
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
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          Campos desta etiqueta {selectedCount > 0 && <span className="text-indigo-500">({selectedCount} selecionado{selectedCount > 1 ? 's' : ''})</span>}
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          {FIELD_DEFS.map(f => {
            const lockedByReforma = isLinked && (f.key === 'reforma' || f.key === 'cliente');
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
                <input
                  type={f.type}
                  value={values[f.key]}
                  onChange={(e) => setValue(f.key, e.target.value)}
                  disabled={!included[f.key]}
                  readOnly={lockedByReforma}
                  placeholder={f.type === 'text' ? f.label : ''}
                  className={`flex-1 min-w-0 text-sm bg-transparent outline-none disabled:text-slate-300 ${lockedByReforma ? 'text-emerald-700 font-semibold' : ''}`}
                />
              </div>
            );
          })}
        </div>

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

        <button
          onClick={handleAdd}
          disabled={selectedCount === 0 && !includeStatus}
          className="mt-4 w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-sm font-bold transition"
        >
          + Adicionar à fila de impressão
        </button>
      </div>

      {/* ── Fila ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Fila de etiquetas ({queue.length})
          </p>
          {queue.length > 0 && (
            <button onClick={handleClearQueue} className="text-xs font-semibold text-slate-400 hover:text-red-500 transition">
              Limpar tudo
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-slate-300 py-4 text-center">Nenhuma etiqueta adicionada ainda.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {queue.map((q, idx) => (
              <div key={q.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-lg px-3 py-2">
                <p className="text-xs text-slate-600 truncate">
                  <span className="font-bold text-slate-400 mr-2">#{idx + 1}</span>
                  {q.fields.length > 0
                    ? q.fields.map(f => `${f.label}: ${f.value || '—'}`).join('  ·  ')
                    : '(sem campos de texto)'}
                  {q.includeStatus && (
                    <span className="ml-2 text-indigo-500 font-semibold">
                      {q.status ? `· ${STATUS_OPTIONS.find(s => s.key === q.status)?.label}` : '· status em branco'}
                    </span>
                  )}
                </p>
                <button onClick={() => handleRemove(q.id)} className="shrink-0 text-slate-300 hover:text-red-500 transition text-lg leading-none">
                  ×
                </button>
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
            {queue.map(q => (
              <div
                key={q.id}
                style={{ width: '14cm', height: '6cm' }}
                className="border-2 border-slate-800 rounded-md p-3 flex flex-col justify-between break-inside-avoid print:break-inside-avoid"
              >
                <div className="space-y-1 overflow-hidden">
                  {q.fields.length > 0 ? q.fields.map(f => (
                    <p key={f.key} className="text-sm leading-snug">
                      <span className="font-bold text-slate-800">{f.label.toUpperCase()}:</span>{' '}
                      <span className="text-slate-700">{f.value || ''}</span>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
