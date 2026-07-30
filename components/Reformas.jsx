import React, { useState, useEffect, useRef } from 'react';

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
    console.error('❌ SUPABASE RAW ERROR (Reformas):', errText);
    throw new Error(errText);
  }
  const data = await res.text();
  return data ? JSON.parse(data) : [];
}

const reformasApi = {
  getReformas:   () => db('reformas?order=created_at.desc'),
  insertReforma: (row) => db('reformas', { method: 'POST', body: JSON.stringify(row) }),
  updateReforma: (id, row) => db(`reformas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(row) }),
  deleteReforma: (id) => db(`reformas?id=eq.${id}`, { method: 'DELETE', prefer: '' }),

  getModelos:       () => db('reforma_modelos'),
  insertModelos:    (rows) => db('reforma_modelos', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
  deleteModelos:    (reformaId) => db(`reforma_modelos?reforma_id=eq.${reformaId}`, { method: 'DELETE', prefer: '' }),

  getRodas:         () => db('reforma_rodas'),
  insertRodas:      (rows) => db('reforma_rodas', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
  deleteRodas:      (reformaId) => db(`reforma_rodas?reforma_id=eq.${reformaId}`, { method: 'DELETE', prefer: '' }),

  getProtetores:    () => db('reforma_protetores'),
  insertProtetores: (rows) => db('reforma_protetores', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
  deleteProtetores: (reformaId) => db(`reforma_protetores?reforma_id=eq.${reformaId}`, { method: 'DELETE', prefer: '' }),

  getPerfis:        () => db('reforma_perfis'),
  insertPerfis:     (rows) => db('reforma_perfis', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
  deletePerfis:     (reformaId) => db(`reforma_perfis?reforma_id=eq.${reformaId}`, { method: 'DELETE', prefer: '' }),

  // Estoque real — só leitura, pra ligar o Tipo de perfil aos itens já cadastrados
  getItems:      () => db('items?order=name'),
  getInboundLog: () => db('inbound_log'),
  getOutboundLog:() => db('outbound_log'),
};

/* ─────────────────────────────────────────────
   LISTAS FIXAS DO CHECKLIST
───────────────────────────────────────────── */
const MODELOS_OPCOES = ['101', '102', '103', '107', '110/111', '114/115', '118/119', 'Outro'];
const RODA_TAMANHOS   = ['4"', '5"', '6"', '6" carga'];
const RODA_MATERIAIS  = ['PU', 'PVC'];
const PROTETOR_TIPOS  = ['PP', 'PVC', 'JUMBOCAR', 'CUNHA', 'TUBO FREE', 'TUBO B3', 'TUBO ID', '16X30', 'ANATÔMICO', 'ANATÔMICO (OBLONGO)'];
const METROS_PERFIL_POR_CARRINHO = 3;

const STATUS_LABEL = {
  recebido:      'Recebido',
  em_producao:   'Em produção',
  em_separacao:  'Em separação',
  finalizado:    'Finalizado',
};
const STATUS_FLOW = ['recebido', 'em_producao', 'em_separacao', 'finalizado'];
const STATUS_COLORS = {
  recebido:     'bg-blue-50 text-blue-700 border-blue-200',
  em_producao:  'bg-amber-50 text-amber-700 border-amber-200',
  em_separacao: 'bg-purple-50 text-purple-700 border-purple-200',
  finalizado:   'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
}

/* ─────────────────────────────────────────────
   UI HELPERS (auto-contidos, mesmo estilo do app)
───────────────────────────────────────────── */
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5';

function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
function Input(props) {
  return (
    <input {...props}
      className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition ${props.className || ''}`} />
  );
}
function Select({ children, ...props }) {
  return (
    <select {...props}
      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition appearance-none cursor-pointer">
      {children}
    </select>
  );
}
function TextArea(props) {
  return (
    <textarea {...props} rows={props.rows || 3}
      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition resize-none" />
  );
}

/* Linha repetível genérica (usada por Modelos, Rodas e Protetores) */
function RepeatableRow({ children, onRemove }) {
  return (
    <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">{children}</div>
      <button type="button" onClick={onRemove}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition">
        ✕
      </button>
    </div>
  );
}

function AddRowBtn({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition text-xs font-semibold">
      + {children}
    </button>
  );
}

/* Busca de item do estoque real, com aviso de disponível/indisponível */
function ItemSearchSelect({ items, value, onChange, getQty }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef(null);
  const selected          = items.find(i => i.id === value);
  const filtered          = items.filter(i =>
    i.name.toLowerCase().includes(query.toLowerCase()) || i.id.includes(query)
  );
  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-indigo-400 transition">
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? `${selected.name} — disponível: ${getQty(selected.id)} ${selected.unit || ''}` : '— Selecione o perfil —'}
        </span>
        <span className="text-slate-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus type="text" placeholder="🔍 Buscar perfil..." value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <ul className="max-h-52 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum item "perfil" encontrado no estoque.</li>
              : filtered.map(item => {
                  const stock = getQty(item.id);
                  return (
                    <li key={item.id} onClick={() => { onChange(item.id); setQuery(''); setOpen(false); }}
                      className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition flex justify-between items-center ${value === item.id ? 'bg-indigo-50' : ''}`}>
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className={`text-xs font-bold ml-3 shrink-0 ${stock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>{stock <= 0 ? 'Indisponível' : `${stock} ${item.unit || ''}`}</span>
                    </li>
                  );
                })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */
const emptyForm = () => ({
  reforma: '',
  quantidade: '',
  cliente: '',
  logo_definida: '',
  cor_perfil_chegou: '',
  cor_perfil_definida: '',
  observacao: '',
});

export default function Reformas() {
  const [reformas, setReformas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null); // { text, type }

  const [form, setForm]           = useState(emptyForm());
  const [modelos, setModelos]     = useState([]);
  const [rodas, setRodas]         = useState([]);
  const [protetores, setProtetores] = useState([]);
  const [perfis, setPerfis]         = useState([]);
  const [editingId, setEditingId]   = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [items, setItems]           = useState([]);
  const [inboundLog, setInboundLog] = useState([]);
  const [outboundLog, setOutboundLog] = useState([]);

  const getQty = (itemId) => {
    const totalIn  = inboundLog.filter(r => r.item_id === itemId).reduce((s, r) => s + Number(r.qty), 0);
    const totalOut = outboundLog.filter(r => r.item_id === itemId).reduce((s, r) => s + Number(r.qty), 0);
    return totalIn - totalOut;
  };
  const perfilItems = items.filter(i => i.name.toLowerCase().includes('perfil'));

  const loadEstoque = async () => {
    try {
      const [rawItems, rawIn, rawOut] = await Promise.all([
        reformasApi.getItems(),
        reformasApi.getInboundLog(),
        reformasApi.getOutboundLog(),
      ]);
      setItems(rawItems);
      setInboundLog(rawIn);
      setOutboundLog(rawOut);
    } catch {
      setMsg({ text: 'Erro ao carregar estoque de perfis.', type: 'error' });
    }
  };

  const loadReformas = async () => {
    setLoading(true);
    try {
      const [rows, allModelos, allRodas, allProtetores, allPerfis] = await Promise.all([
        reformasApi.getReformas(),
        reformasApi.getModelos(),
        reformasApi.getRodas(),
        reformasApi.getProtetores(),
        reformasApi.getPerfis(),
      ]);
      const merged = rows.map(r => ({
        ...r,
        modelos:    allModelos.filter(m => m.reforma_id === r.id),
        rodas:      allRodas.filter(m => m.reforma_id === r.id),
        protetores: allProtetores.filter(m => m.reforma_id === r.id),
        perfis:     allPerfis.filter(m => m.reforma_id === r.id),
      }));
      setReformas(merged);
    } catch {
      setMsg({ text: 'Erro ao carregar reformas.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReformas(); loadEstoque(); }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  /* ── Linhas dinâmicas ── */
  const addModelo    = () => setModelos(prev => [...prev, { modelo: MODELOS_OPCOES[0], quantidade: '' }]);
  const addRoda       = () => setRodas(prev => [...prev, { tamanho: RODA_TAMANHOS[0], material: RODA_MATERIAIS[0], quantidade: '' }]);
  const addProtetor   = () => setProtetores(prev => [...prev, { tipo: PROTETOR_TIPOS[0], quantidade: '' }]);
  const addPerfil      = () => setPerfis(prev => [...prev, { item_id: '', qtd_carrinho: '', quantidade: '' }]);

  const updateRow = (setter, idx, field, value) => {
    setter(prev => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };
  // Perfil é o único caso onde 1 campo (qtd. de carrinho) recalcula outro (metros usados) na mesma linha
  const updatePerfilQtdCarrinho = (idx, value) => {
    setPerfis(prev => prev.map((row, i) => (i === idx
      ? { ...row, qtd_carrinho: value, quantidade: value ? String(Number(value) * METROS_PERFIL_POR_CARRINHO) : '' }
      : row)));
  };
  const removeRow = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setForm(emptyForm());
    setModelos([]);
    setRodas([]);
    setProtetores([]);
    setPerfis([]);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reforma) {
      setMsg({ text: 'Preencha ao menos o número da Reforma.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const perfisValidos = perfis.filter(p => p.item_id && p.quantidade);
      const primeiroPerfilItem = perfisValidos.length ? items.find(i => i.id === perfisValidos[0].item_id) : null;
      const tipoPerfilDetectado = primeiroPerfilItem ? (primeiroPerfilItem.name.match(/\b([bc])\b/i)?.[1]?.toUpperCase() || null) : null;

      const payload = {
        reforma: form.reforma,
        quantidade: form.quantidade ? Number(form.quantidade) : null,
        cliente: form.cliente || null,
        logo_definida: form.logo_definida || null,
        cor_perfil_chegou: form.cor_perfil_chegou || null,
        cor_perfil_definida: form.cor_perfil_definida || null,
        tipo_perfil: tipoPerfilDetectado,
        observacao: form.observacao || null,
      };

      let reformaId = editingId;
      if (editingId) {
        await reformasApi.updateReforma(editingId, payload);
        await Promise.all([
          reformasApi.deleteModelos(editingId),
          reformasApi.deleteRodas(editingId),
          reformasApi.deleteProtetores(editingId),
          reformasApi.deletePerfis(editingId),
        ]);
      } else {
        const [novaReforma] = await reformasApi.insertReforma({ ...payload, status: 'recebido' });
        reformaId = novaReforma.id;
      }

      const modelosRows = modelos
        .filter(m => m.modelo && m.quantidade)
        .map(m => ({ reforma_id: reformaId, modelo: m.modelo, quantidade: Number(m.quantidade) }));
      const rodasRows = rodas
        .filter(r => r.tamanho && r.quantidade)
        .map(r => ({ reforma_id: reformaId, tamanho: r.tamanho, material: r.material || null, quantidade: Number(r.quantidade) }));
      const protetoresRows = protetores
        .filter(p => p.tipo && p.quantidade)
        .map(p => ({ reforma_id: reformaId, tipo: p.tipo, quantidade: Number(p.quantidade) }));
      const perfisRows = perfisValidos
        .map(p => ({ reforma_id: reformaId, item_id: p.item_id, quantidade: Number(p.quantidade) }));

      await Promise.all([
        modelosRows.length    ? reformasApi.insertModelos(modelosRows)       : Promise.resolve(),
        rodasRows.length      ? reformasApi.insertRodas(rodasRows)           : Promise.resolve(),
        protetoresRows.length ? reformasApi.insertProtetores(protetoresRows) : Promise.resolve(),
        perfisRows.length     ? reformasApi.insertPerfis(perfisRows)         : Promise.resolve(),
      ]);

      setMsg({ text: editingId ? `Reforma "${payload.reforma}" atualizada!` : `Reforma "${payload.reforma}" registrada!`, type: 'success' });
      resetForm();
      await loadReformas();
    } catch (err) {
      console.error('❌ Erro ao salvar reforma:', err);
      setMsg({ text: 'Erro ao salvar reforma.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r) => {
    setEditingId(r.id);
    setForm({
      reforma: r.reforma || '',
      quantidade: r.quantidade ?? '',
      cliente: r.cliente || '',
      logo_definida: r.logo_definida || '',
      cor_perfil_chegou: r.cor_perfil_chegou || '',
      cor_perfil_definida: r.cor_perfil_definida || '',
      observacao: r.observacao || '',
    });
    setModelos((r.modelos || []).map(m => ({ modelo: m.modelo, quantidade: m.quantidade ?? '' })));
    setRodas((r.rodas || []).map(rd => ({ tamanho: rd.tamanho, material: rd.material || '', quantidade: rd.quantidade ?? '' })));
    setProtetores((r.protetores || []).map(p => ({ tipo: p.tipo, quantidade: p.quantidade ?? '' })));
    setPerfis((r.perfis || []).map(p => ({
      item_id: p.item_id,
      quantidade: p.quantidade ?? '',
      qtd_carrinho: p.quantidade ? String(Math.round((Number(p.quantidade) / METROS_PERFIL_POR_CARRINHO) * 100) / 100) : '',
    })));
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente excluir esta reforma?')) return;
    try {
      await reformasApi.deleteReforma(id);
      setReformas(prev => prev.filter(r => r.id !== id));
      if (editingId === id) resetForm();
      setMsg({ text: 'Reforma removida.', type: 'success' });
    } catch {
      setMsg({ text: 'Erro ao excluir reforma.', type: 'error' });
    }
  };

  const handleAdvance = async (r) => {
    const idx = STATUS_FLOW.indexOf(r.status);
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[idx + 1];
    try {
      await reformasApi.updateReforma(r.id, { status: nextStatus });
      setReformas(prev => prev.map(x => x.id === r.id ? { ...x, status: nextStatus } : x));
      setMsg({ text: `Reforma avançada para "${STATUS_LABEL[nextStatus]}"!`, type: 'success' });
    } catch {
      setMsg({ text: 'Erro ao avançar status.', type: 'error' });
    }
  };

  const emAndamento = reformas.filter(r => r.status !== 'finalizado');
  const finalizadas  = reformas.filter(r => r.status === 'finalizado');

  const lineItemsSummary = (r) => {
    const parts = [];
    if (r.modelos?.length)    parts.push(`Modelos: ${r.modelos.map(m => `${m.modelo}${m.quantidade ? ` (${m.quantidade})` : ''}`).join(', ')}`);
    if (r.rodas?.length)      parts.push(`Rodas: ${r.rodas.map(rd => `${rd.tamanho}${rd.material ? ` ${rd.material}` : ''}${rd.quantidade ? ` (${rd.quantidade})` : ''}`).join(', ')}`);
    if (r.protetores?.length) parts.push(`Protetores: ${r.protetores.map(p => `${p.tipo}${p.quantidade ? ` (${p.quantidade})` : ''}`).join(', ')}`);
    if (r.perfis?.length)     parts.push(`Perfil: ${r.perfis.map(p => `${items.find(i => i.id === p.item_id)?.name || p.item_id}${p.quantidade ? ` (${p.quantidade})` : ''}`).join(', ')}`);
    return parts;
  };

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-indigo-800">Reformas de Carrinho</h1>
        <p className="text-slate-400 text-xs mt-0.5">Recebido → Em produção → Em separação → Finalizado</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-2xl">
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
          {editingId ? '✏️ Editando Reforma' : 'Nova Reforma — preencha tudo que já souber'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Reforma">
            <Input type="text" required placeholder="Ex: Reforma 001"
              value={form.reforma} onChange={e => setForm({ ...form, reforma: e.target.value })} />
          </Field>
          <Field label="Quantidade">
            <Input type="number" min="1" placeholder="Ex: 10"
              value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} />
          </Field>
        </div>

        <Field label="Cliente">
          <Input type="text" placeholder="Nome do cliente"
            value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
        </Field>

        <Field label="Logo definida">
          <Input type="text" placeholder="Ex: Sim / Não / detalhes"
            value={form.logo_definida} onChange={e => setForm({ ...form, logo_definida: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cor do perfil (chegou)">
            <Input type="text" placeholder="Cor recebida"
              value={form.cor_perfil_chegou} onChange={e => setForm({ ...form, cor_perfil_chegou: e.target.value })} />
          </Field>
          <Field label="Cor do perfil (definida)">
            <Input type="text" placeholder="Cor definida, se já souber"
              value={form.cor_perfil_definida} onChange={e => setForm({ ...form, cor_perfil_definida: e.target.value })} />
          </Field>
        </div>

        {/* Perfil — vinculado ao estoque real; cálculo de metros é por linha (cada linha pode ser um modelo/cor diferente) */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className={labelCls}>Perfil (tipo B/C) — vinculado ao estoque</label>
          <p className="text-[11px] text-slate-400 -mt-1">Cada carrinho consome {METROS_PERFIL_POR_CARRINHO}m de perfil. Uma linha por cor/modelo.</p>

          {perfis.map((row, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <ItemSearchSelect items={perfilItems} value={row.item_id} getQty={getQty}
                    onChange={v => updateRow(setPerfis, idx, 'item_id', v)} />
                </div>
                <button type="button" onClick={() => removeRow(setPerfis, idx)}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 transition"
                  title="Remover esta linha">
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Quantidade de carrinho</label>
                  <input type="number" min="1" placeholder="Ex: 10" value={row.qtd_carrinho}
                    onChange={e => updatePerfilQtdCarrinho(idx, e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Metros usado</label>
                  <div className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700">
                    {row.quantidade ? `${row.quantidade} m` : '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <AddRowBtn onClick={addPerfil}>Adicionar perfil</AddRowBtn>
        </div>

        <Field label="Observação (erros / refugo)">
          <TextArea placeholder="Anotações sobre erros, refugo etc."
            value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} />
        </Field>

        {/* Modelos */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className={labelCls}>Modelo(s) do carrinho</label>
          {modelos.map((row, idx) => (
            <RepeatableRow key={idx} onRemove={() => removeRow(setModelos, idx)}>
              <Select value={row.modelo} onChange={e => updateRow(setModelos, idx, 'modelo', e.target.value)}>
                {MODELOS_OPCOES.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
              <input type="number" min="1" placeholder="Qtd." value={row.quantidade}
                onChange={e => updateRow(setModelos, idx, 'quantidade', e.target.value)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition" />
            </RepeatableRow>
          ))}
          <AddRowBtn onClick={addModelo}>Adicionar modelo</AddRowBtn>
        </div>

        {/* Rodas */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className={labelCls}>Rodas</label>
          {rodas.map((row, idx) => (
            <RepeatableRow key={idx} onRemove={() => removeRow(setRodas, idx)}>
              <Select value={row.tamanho} onChange={e => updateRow(setRodas, idx, 'tamanho', e.target.value)}>
                {RODA_TAMANHOS.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select value={row.material} onChange={e => updateRow(setRodas, idx, 'material', e.target.value)}>
                {RODA_MATERIAIS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
              <input type="number" min="1" placeholder="Qtd." value={row.quantidade}
                onChange={e => updateRow(setRodas, idx, 'quantidade', e.target.value)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition" />
            </RepeatableRow>
          ))}
          <AddRowBtn onClick={addRoda}>Adicionar roda</AddRowBtn>
        </div>

        {/* Protetores */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <label className={labelCls}>Protetores</label>
          {protetores.map((row, idx) => (
            <RepeatableRow key={idx} onRemove={() => removeRow(setProtetores, idx)}>
              <Select value={row.tipo} onChange={e => updateRow(setProtetores, idx, 'tipo', e.target.value)}>
                {PROTETOR_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <input type="number" min="1" placeholder="Qtd." value={row.quantidade}
                onChange={e => updateRow(setProtetores, idx, 'quantidade', e.target.value)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition" />
            </RepeatableRow>
          ))}
          <AddRowBtn onClick={addProtetor}>Adicionar protetor</AddRowBtn>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all text-sm tracking-wide shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Salvando...' : editingId ? '💾 Salvar Alterações' : 'Registrar Reforma'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              className="px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Em andamento */}
      <div>
        <h2 className="text-sm font-bold text-slate-600 mb-3">Em andamento ({emAndamento.length})</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : emAndamento.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Nenhuma reforma em andamento.</div>
        ) : (
          <div className="grid gap-3">
            {emAndamento.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{r.reforma}</p>
                    <p className="text-xs text-slate-400">{r.cliente || 'Sem cliente'} {r.quantidade ? `· Qtd: ${r.quantidade}` : ''} · {fmtDate(r.created_at)}</p>
                  </div>
                  <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold border rounded-full ${STATUS_COLORS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  {r.logo_definida && <p><span className="text-slate-400">Logo:</span> {r.logo_definida}</p>}
                  {r.cor_perfil_chegou && <p><span className="text-slate-400">Cor (chegou):</span> {r.cor_perfil_chegou}</p>}
                  {r.cor_perfil_definida && <p><span className="text-slate-400">Cor (definida):</span> {r.cor_perfil_definida}</p>}
                  {r.tipo_perfil && <p><span className="text-slate-400">Tipo de perfil:</span> {r.tipo_perfil}</p>}
                  {r.observacao && <p className="sm:col-span-2"><span className="text-slate-400">Obs.:</span> {r.observacao}</p>}
                </div>

                {lineItemsSummary(r).map((line, i) => (
                  <p key={i} className="text-xs text-slate-600">{line}</p>
                ))}

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  {STATUS_FLOW.indexOf(r.status) < STATUS_FLOW.length - 1 && (
                    <button onClick={() => handleAdvance(r)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition">
                      Avançar → {STATUS_LABEL[STATUS_FLOW[STATUS_FLOW.indexOf(r.status) + 1]]}
                    </button>
                  )}
                  <button onClick={() => handleEdit(r)} className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600 transition">Editar</button>
                  <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded text-xs font-bold hover:bg-red-100 hover:text-red-600 transition">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finalizadas */}
      <div>
        <h2 className="text-sm font-bold text-slate-600 mb-3">Finalizadas ({finalizadas.length})</h2>
        {finalizadas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Nenhuma reforma finalizada ainda.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {finalizadas.map(r => (
              <div key={r.id}>
                <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition">
                  <span className="text-sm text-slate-700">
                    <span className="font-semibold">{r.reforma}</span>
                    {r.cliente ? ` — ${r.cliente}` : ''}
                    {r.quantidade ? ` · Qtd: ${r.quantidade}` : ''}
                    {' · '}<span className="text-slate-400">{fmtDate(r.created_at)}</span>
                  </span>
                  <span className="text-slate-400 text-xs">{expandedId === r.id ? '▲' : '▼'}</span>
                </button>
                {expandedId === r.id && (
                  <div className="px-4 pb-4 space-y-2 text-xs text-slate-600 bg-slate-50">
                    {r.logo_definida && <p><span className="text-slate-400">Logo:</span> {r.logo_definida}</p>}
                    {r.cor_perfil_chegou && <p><span className="text-slate-400">Cor (chegou):</span> {r.cor_perfil_chegou}</p>}
                    {r.cor_perfil_definida && <p><span className="text-slate-400">Cor (definida):</span> {r.cor_perfil_definida}</p>}
                    {r.tipo_perfil && <p><span className="text-slate-400">Tipo de perfil:</span> {r.tipo_perfil}</p>}
                    {r.observacao && <p><span className="text-slate-400">Obs.:</span> {r.observacao}</p>}
                    {lineItemsSummary(r).map((line, i) => <p key={i}>{line}</p>)}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => handleEdit(r)} className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600 transition">Editar</button>
                      <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded text-xs font-bold hover:bg-red-100 hover:text-red-600 transition">Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
