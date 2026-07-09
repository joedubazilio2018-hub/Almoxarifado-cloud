'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

/* ─────────────────────────────────────────────
   SUPABASE CONFIG
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
    console.error("❌ SUPABASE RAW ERROR:", errText);
    throw new Error(errText);
  }
  const data = await res.text();
  console.log("SUPABASE RESPONSE:", data);
  return data ? JSON.parse(data) : [];
}

// Helpers por tabela
const api = {
  // ITEMS
  getItems:   () => db('items?order=name'),
  upsertItem: (row) => db('items', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: JSON.stringify(row) }),
  deleteItem: (id) => db(`items?id=eq.${id}`, { method: 'DELETE', prefer: '' }),

  // CATEGORIES
  getCategories:   () => db('categories?order=name'),
  insertCategory:  (row) => db('categories', { method: 'POST', body: JSON.stringify(row) }),
  updateCategory:  (id, row) => db(`categories?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(row) }),
  deleteCategory:  (id) => db(`categories?id=eq.${id}`, { method: 'DELETE', prefer: '' }),

  // INBOUND
  getInbound:    () => db('inbound_log?order=date.desc'),
  insertInbound: (row) => db('inbound_log', { method: 'POST', body: JSON.stringify(row) }),

  // OUTBOUND
  getOutbound:    () => db('outbound_log?order=date.desc'),
  insertOutbound: (row) => db('outbound_log', { method: 'POST', body: JSON.stringify(row) }),

  // SC MAP
  getScMap:   () => db('sc_map'),
  upsertSc:   (row) => db('sc_map', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: JSON.stringify(row) }),
  deleteSc:   (itemId) => db(`sc_map?item_id=eq.${itemId}`, { method: 'DELETE', prefer: '' }),
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0];

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function rowToItem(r) {
  return { id: r.id, name: r.name, location: r.location || '', application: r.application || '', unit: r.unit, minStock: r.min_stock, maxStock: r.max_stock, categoryId: r.category_id || null };
}
function itemToRow(i) {
  return { id: i.id, name: i.name, location: i.location || '', application: i.application || '', unit: i.unit, min_stock: Number(i.minStock), max_stock: Number(i.maxStock), category_id: i.categoryId || null };
}
function rowToInbound(r) {
  return { id: r.id, itemId: r.item_id, qty: r.qty, date: r.date, sc: r.sc };
}
function rowToOutbound(r) {
  return { id: r.id, itemId: r.item_id, qty: r.qty, date: r.date, notes: r.notes };
}
function rowToSc(r) {
  return { itemId: r.item_id, sc: r.sc, qty: r.qty, dateSc: r.date_sc, dateEta: r.date_eta };
}
function rowToCategory(r) {
  return { id: r.id, name: r.name };
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  const colors = { success: 'bg-emerald-600 text-white', error: 'bg-red-500 text-white', warning: 'bg-amber-500 text-white', info: 'bg-blue-500 text-white' };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold max-w-xs ${colors[toast.type]}`}>
      <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'info' ? '↻' : '⚠'}</span>
      <span>{toast.msg}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ITEM SEARCH SELECT
───────────────────────────────────────────── */
function ItemSearchSelect({ items, value, onChange, getQty, showStock = false, ringColor = 'blue' }) {
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
  const ringMap = { blue: 'focus:ring-blue-400', emerald: 'focus:ring-emerald-400', rose: 'focus:ring-rose-400' };
  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-left flex justify-between items-center focus:outline-none focus:ring-2 ${ringMap[ringColor]} transition`}>
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? `[${selected.id}] ${selected.name}${showStock ? ` — disponível: ${getQty(selected.id)} ${selected.unit}` : ''}` : '— Escolha um item —'}
        </span>
        <span className="text-slate-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus type="text" placeholder="🔍 Buscar por código ou nome..." value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <ul className="max-h-52 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum item encontrado.</li>
              : filtered.map(item => {
                  const stock = getQty ? getQty(item.id) : null;
                  return (
                    <li key={item.id} onClick={() => { onChange(item.id); setQuery(''); setOpen(false); }}
                      className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition flex justify-between items-center ${value === item.id ? 'bg-blue-50' : ''}`}>
                      <div>
                        <span className="font-mono text-[11px] text-slate-400 font-bold">[{item.id}]</span>
                        <span className="ml-2 font-medium text-slate-800">{item.name}</span>
                        <span className="ml-2 text-[11px] text-slate-400">{item.location}</span>
                      </div>
                      {showStock && stock !== null && (
                        <span className={`text-xs font-bold ml-3 shrink-0 ${stock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>{stock} {item.unit}</span>
                      )}
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
   SC PANEL
───────────────────────────────────────────── */
function ScPanel({ itemId, scMap, onSave, onClear }) {
  const sc = scMap[itemId];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ sc: '', dateSc: today(), dateEta: '' });

  const openEdit = () => {
    setForm(sc ? { sc: sc.sc, dateSc: sc.dateSc, dateEta: sc.dateEta } : { sc: '', dateSc: today(), dateEta: '' });
    setEditing(true);
  };
  const save = () => { if (!form.sc) return; onSave(itemId, form); setEditing(false); };

  if (sc && !editing) return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-600 text-sm">🛒</span>
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">SC Registrada</span>
        </div>
        <div className="flex gap-2">
          <button onClick={openEdit} className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold underline">Editar</button>
          <button onClick={() => onClear(itemId)} className="text-[11px] text-slate-400 hover:text-red-500 font-semibold underline">Remover</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div><p className="text-blue-400 font-medium">Nº SC</p><p className="font-bold text-blue-800 font-mono">{sc.sc}</p></div>
        <div><p className="text-blue-400 font-medium">Data SC</p><p className="font-bold text-blue-800">{fmtDate(sc.dateSc)}</p></div>
        <div><p className="text-blue-400 font-medium">Previsão</p><p className="font-bold text-blue-800">{sc.dateEta ? fmtDate(sc.dateEta) : '—'}</p></div>
      </div>
    </div>
  );

  if (editing) return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-3">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">📝 Registrar SC de Compra</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 sm:col-span-1">
          <label className="block text-[10px] font-bold text-blue-500 uppercase mb-1">Nº da SC</label>
          <input type="text" placeholder="SC-2026-99" value={form.sc} onChange={e => setForm({ ...form, sc: e.target.value })}
            className="w-full px-2.5 py-2 bg-white border border-blue-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-blue-500 uppercase mb-1">Data SC</label>
          <input type="date" value={form.dateSc} onChange={e => setForm({ ...form, dateSc: e.target.value })}
            className="w-full px-2.5 py-2 bg-white border border-blue-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-blue-500 uppercase mb-1">Previsão</label>
          <input type="date" value={form.dateEta} onChange={e => setForm({ ...form, dateEta: e.target.value })}
            className="w-full px-2.5 py-2 bg-white border border-blue-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition">Salvar SC</button>
        <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg bg-white transition">Cancelar</button>
      </div>
    </div>
  );

  return (
    <button onClick={openEdit}
      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition text-xs font-semibold">
      <span>🛒</span> Registrar SC de Compra
    </button>
  );
}

/* ─────────────────────────────────────────────
   UI HELPERS
───────────────────────────────────────────── */
const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5';

function Field({ label, accent, children }) {
  return (
    <div>
      <label className={`${labelCls} ${accent ? 'text-' + accent + '-500' : ''}`}>{label}</label>
      {children}
    </div>
  );
}
function Input({ ringColor = 'blue', mono, ...props }) {
  const ringMap = { blue: 'focus:ring-blue-400', emerald: 'focus:ring-emerald-400', rose: 'focus:ring-rose-400', amber: 'focus:ring-amber-400' };
  return (
    <input {...props} className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 ${ringMap[ringColor] || ringMap.blue} focus:border-transparent transition ${mono ? 'font-mono' : ''} ${props.className || ''}`} />
  );
}
function Select({ ringColor = 'blue', children, ...props }) {
  const ringMap = { blue: 'focus:ring-blue-400', emerald: 'focus:ring-emerald-400', rose: 'focus:ring-rose-400' };
  return (
    <select {...props} className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 ${ringMap[ringColor] || ringMap.blue} focus:border-transparent transition appearance-none cursor-pointer`}>
      {children}
    </select>
  );
}
function SubmitBtn({ color, children, disabled }) {
  const map = { slate: 'bg-slate-800 hover:bg-slate-900', emerald: 'bg-emerald-600 hover:bg-emerald-700', rose: 'bg-rose-600 hover:bg-rose-700' };
  return (
    <button type="submit" disabled={disabled}
      className={`w-full ${map[color] || map.slate} text-white font-bold py-3 rounded-xl transition-all text-sm tracking-wide shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}
function StatusBadge({ status, label }) {
  const map = { danger: 'bg-red-50 text-red-700 border-red-200', warning: 'bg-amber-50 text-amber-700 border-amber-200', healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  return <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold border rounded-full ${map[status]}`}>{label}</span>;
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function InventoryApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [activeTab, setActiveTab]   = useState('stock');
  const [loading, setLoading]       = useState(false);

  const [items,       setItems]       = useState([]);
  const [inboundLog,  setInboundLog]  = useState([]);
  const [outboundLog, setOutboundLog] = useState([]);
  const [scMap,       setScMap]       = useState({});
  const [categories,  setCategories]  = useState([]);

  const [newItem, setNewItem] = useState({ id: '', name: '', location: '', application: '', unit: 'Un', minStock: '', maxStock: '', categoryId: null });
  const [newInbound,  setNewInbound]  = useState({ itemId: '', qty: '', date: today(), sc: '' });
  const [newOutbound, setNewOutbound] = useState({ itemId: '', qty: '', date: today(), notes: '' });
  const [receivingSc, setReceivingSc] = useState(null);
  const [receiveQty,  setReceiveQty]  = useState('');
  const [newSc, setNewSc] = useState({ itemId: '', sc: '', qty: '', dateSc: today(), dateEta: '' });
  const [scSortOrder, setScSortOrder] = useState('desc');
  const [editingSc,   setEditingSc]   = useState(null);
  const [editScForm,  setEditScForm]  = useState({ sc: '', qty: '', dateSc: '', dateEta: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [toast,       setToast]       = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [expandedItem,    setExpandedItem]    = useState(null);
  const [collapsedCats,   setCollapsedCats]   = useState({});

  // Estado para criar nova categoria inline no formulário
  const [newCatName,    setNewCatName]    = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [savingCat,     setSavingCat]     = useState(false);

  /* ── Toast ── */
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── Carregar dados do Supabase ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rawItems, rawInbound, rawOutbound, rawSc, rawCats] = await Promise.all([
        api.getItems(),
        api.getInbound(),
        api.getOutbound(),
        api.getScMap(),
        api.getCategories(),
      ]);
      setItems(rawItems.map(rowToItem));
      setInboundLog(rawInbound.map(rowToInbound));
      setOutboundLog(rawOutbound.map(rowToOutbound));
      const map = {};
      rawSc.forEach(r => { const s = rowToSc(r); map[s.itemId] = s; });
      setScMap(map);
      setCategories(rawCats.map(rowToCategory));
    } catch (e) {
      showToast('Erro ao conectar com o banco. Verifique a conexão.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('inv_logged') === 'true') {
      setIsLoggedIn(true);
      loadAll();
    }
  }, [loadAll]);

  /* ── Cálculos ── */
  const getQty = useCallback((itemId) => {
    const totalIn  = inboundLog.filter(r => r.itemId === itemId).reduce((s, r) => s + Number(r.qty), 0);
    const totalOut = outboundLog.filter(r => r.itemId === itemId).reduce((s, r) => s + Number(r.qty), 0);
    return totalIn - totalOut;
  }, [inboundLog, outboundLog]);

  const getKanban = useCallback((itemId) => {
    const qty  = getQty(itemId);
    const item = items.find(i => i.id === itemId);
    if (!item) return { label: 'Ideal', status: 'healthy' };
    if (qty < Number(item.minStock))        return { label: 'CRÍTICO', status: 'danger'  };
    if (qty <= Number(item.minStock) * 1.3) return { label: 'ATENÇÃO', status: 'warning' };
    return                                         { label: 'Ideal',   status: 'healthy' };
  }, [items, getQty]);

  const getScStatus = useCallback((itemId) => {
    const sc = scMap[itemId];
    if (!sc || !sc.dateEta) return null;
    const hoje = today();
    if (sc.dateEta === hoje) return 'chega_hoje';
    if (sc.dateEta < hoje)   return 'atrasada';
    return null;
  }, [scMap]);

  const getLastMovements = useCallback((itemId) => {
    const inbound = inboundLog
      .filter(r => r.itemId === itemId)
      .map(r => ({ type: 'Entrada', qty: r.qty, date: r.date, sc: r.sc }));
    const outbound = outboundLog
      .filter(r => r.itemId === itemId)
      .map(r => ({ type: 'Saída', qty: r.qty, date: r.date, notes: r.notes }));
    return [...inbound, ...outbound]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [inboundLog, outboundLog]);

  /* ── SC ── */
  const saveSc = useCallback(async (itemId, data) => {
    try {
      await api.upsertSc({ item_id: itemId, sc: data.sc, qty: Number(data.qty) || null, date_sc: data.dateSc, date_eta: data.dateEta || null });
      setScMap(prev => ({ ...prev, [itemId]: data }));
      showToast('SC registrada!');
    } catch { showToast('Erro ao salvar SC.', 'error'); }
  }, [showToast]);

  const clearSc = useCallback(async (itemId) => {
    try {
      await api.deleteSc(itemId);
      setScMap(prev => { const u = { ...prev }; delete u[itemId]; return u; });
      showToast('SC removida.', 'warning');
    } catch { showToast('Erro ao remover SC.', 'error'); }
  }, [showToast]);

  /* ── Categoria inline ── */
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return showToast('Informe o nome da categoria.', 'error');
    setSavingCat(true);
    try {
      const result = await api.insertCategory({ name: newCatName.trim() });
      const created = rowToCategory(Array.isArray(result) ? result[0] : result);
      setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewItem(prev => ({ ...prev, categoryId: created.id }));
      setNewCatName('');
      setShowNewCatInput(false);
      showToast(`Categoria "${created.name}" criada!`);
    } catch { showToast('Erro ao criar categoria.', 'error'); }
    finally { setSavingCat(false); }
  };

  /* ── HANDLERS ── */
  const handleLogin = (e) => {
    e.preventDefault();
    if (email === 'jo.edubazilio2018@gmail.com' && password === 'Art@2023') {
      setIsLoggedIn(true);
      localStorage.setItem('inv_logged', 'true');
      loadAll();
    } else { showToast('E-mail ou senha incorretos!', 'error'); }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('inv_logged');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newItem.id || !newItem.name) return showToast('Código e Nome são obrigatórios.', 'error');
    setSaving(true);
    try {
      if (editingItem) {
        await api.upsertItem(itemToRow(newItem));
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...newItem, minStock: Number(newItem.minStock), maxStock: Number(newItem.maxStock) } : i));
        setEditingItem(null);
        showToast('Item atualizado!');
      } else {
        if (items.some(i => i.id === newItem.id)) return showToast('Este código já está cadastrado.', 'error');
        await api.upsertItem(itemToRow(newItem));
        setItems(prev => [...prev, { ...newItem, minStock: Number(newItem.minStock), maxStock: Number(newItem.maxStock) }]);
        showToast(`"${newItem.name}" cadastrado!`);
      }
      setNewItem({ id: '', name: '', location: '', application: '', unit: 'Un', minStock: '', maxStock: '', categoryId: null });
      setShowNewCatInput(false);
      setNewCatName('');
    } catch { showToast('Erro ao salvar item.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Deseja realmente excluir este item?')) return;
    try {
      await api.deleteItem(itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      showToast('Item removido.', 'warning');
    } catch { showToast('Erro ao excluir item.', 'error'); }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setNewItem({ id: item.id, name: item.name, location: item.location || '', application: item.application || '', unit: item.unit, minStock: item.minStock, maxStock: item.maxStock, categoryId: item.categoryId || null });
    setShowNewCatInput(false);
    setNewCatName('');
    setActiveTab('register');
  };

  const handleInbound = async (e) => {
    e.preventDefault();
    if (!newInbound.itemId || !newInbound.qty) return showToast('Selecione o item e a quantidade.', 'error');
    setSaving(true);
    try {
      const row = { id: `IN-${Date.now()}`, item_id: newInbound.itemId, qty: Number(newInbound.qty), date: newInbound.date, sc: newInbound.sc };
      const result = await api.insertInbound(row);
      console.log("✅ INSERT RESULT:", result);
      setInboundLog(prev => [...prev, rowToInbound(row)]);
      await clearSc(newInbound.itemId);
      const name = items.find(i => i.id === newInbound.itemId)?.name;
      setNewInbound({ itemId: '', qty: '', date: today(), sc: '' });
      showToast(`Entrada de "${name}" registrada!`);
    } catch (err) {
      console.error("❌ ERRO INSERT INBOUND:", err);
      showToast('Erro ao registrar entrada.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOutbound = async (e) => {
    e.preventDefault();
    if (!newOutbound.itemId || !newOutbound.qty) return showToast('Selecione o item e a quantidade.', 'error');
    const available = getQty(newOutbound.itemId);
    if (Number(newOutbound.qty) > available) return showToast(`Estoque insuficiente! Disponível: ${available} un.`, 'error');
    setSaving(true);
    try {
      const row = { id: `OUT-${Date.now()}`, item_id: newOutbound.itemId, qty: Number(newOutbound.qty), date: newOutbound.date, notes: newOutbound.notes };
      await api.insertOutbound(row);
      setOutboundLog(prev => [...prev, rowToOutbound(row)]);
      const name = items.find(i => i.id === newOutbound.itemId)?.name;
      setNewOutbound({ itemId: '', qty: '', date: today(), notes: '' });
      showToast(`Saída de "${name}" confirmada!`);
    } catch { showToast('Erro ao registrar saída.', 'error'); }
    finally { setSaving(false); }
  };

  const sortedScEntries = Object.entries(scMap).sort((a, b) => {
    const dateA = a[1].dateSc || '';
    const dateB = b[1].dateSc || '';
    return scSortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
  });

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.id.includes(searchQuery)
  );
  const criticalItems = items.filter(i => ['danger', 'warning'].includes(getKanban(i.id).status));

  // Agrupa itens filtrados por categoria para a aba Estoque
  const itemsByCategory = React.useMemo(() => {
    const groups = {};
    // Grupo sem categoria
    groups['__none__'] = { name: 'Sem Categoria', items: [] };
    categories.forEach(cat => { groups[cat.id] = { name: cat.name, items: [] }; });
    filteredItems.forEach(item => {
      const key = item.categoryId && groups[item.categoryId] ? item.categoryId : '__none__';
      groups[key].items.push(item);
    });
    // Remove grupos vazios
    return Object.entries(groups).filter(([, g]) => g.items.length > 0);
  }, [filteredItems, categories]);

  const toggleCategory = (catId) => {
    setCollapsedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleRegisterSc = async (e) => {
    e.preventDefault();
    if (!newSc.itemId || !newSc.sc) return showToast('Selecione o item e informe o número da SC.', 'error');
    setSaving(true);
    try {
      await saveSc(newSc.itemId, { sc: newSc.sc, qty: newSc.qty, dateSc: newSc.dateSc, dateEta: newSc.dateEta });
      const name = items.find(i => i.id === newSc.itemId)?.name;
      setNewSc({ itemId: '', sc: '', qty: '', dateSc: today(), dateEta: '' });
      showToast(`SC registrada para "${name}"!`);
    } catch {
      showToast('Erro ao registrar SC.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditSc = (itemId) => {
    const sc = scMap[itemId];
    setEditScForm({ sc: sc.sc, qty: sc.qty || '', dateSc: sc.dateSc, dateEta: sc.dateEta || '' });
    setEditingSc(itemId);
  };

  const saveEditSc = async (itemId) => {
    if (!editScForm.sc) return showToast('Informe o número da SC.', 'error');
    setSaving(true);
    try {
      await saveSc(itemId, editScForm);
      setEditingSc(null);
      showToast('SC atualizada!');
    } catch {
      showToast('Erro ao atualizar SC.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveSc = async (itemId) => {
    if (!receiveQty || Number(receiveQty) <= 0) return showToast('Informe a quantidade recebida.', 'error');
    setSaving(true);
    try {
      const sc = scMap[itemId];
      const row = { id: `IN-${Date.now()}`, item_id: itemId, qty: Number(receiveQty), date: today(), sc: sc?.sc || '' };
      await api.insertInbound(row);
      setInboundLog(prev => [...prev, rowToInbound(row)]);
      await clearSc(itemId);
      const name = items.find(i => i.id === itemId)?.name;
      setReceivingSc(null);
      setReceiveQty('');
      showToast(`Entrada de "${name}" registrada e SC encerrada!`);
    } catch {
      showToast('Erro ao registrar entrada.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancelEditSc = () => setEditingSc(null);

  /* ── LOGIN ── */
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Toast toast={toast} />
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mb-4 shadow-xl shadow-blue-900/50 text-3xl">📦</div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Almoxarifado Cloud</h1>
            <p className="text-slate-400 text-sm mt-1">Gestão de Estoque & Kanban Inteligente</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">E-mail</label>
                <input type="email" required placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Senha</label>
                <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition text-sm shadow-lg shadow-blue-900/40 mt-2">
                Entrar no Sistema
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'stock',    icon: '📦', label: 'Estoque',                                      activeColor: 'bg-blue-600'    },
    { id: 'kanban',   icon: '⚠️', label: `Kanban (${criticalItems.length})`,             activeColor: 'bg-amber-600'   },
    { id: 'sc',       icon: '🛒', label: `SC Compra (${Object.keys(scMap).length})`,     activeColor: 'bg-purple-600'  },
    { id: 'register', icon: '➕', label: editingItem ? 'Editando' : 'Cadastrar',         activeColor: 'bg-slate-600'   },
    { id: 'inbound',  icon: '📥', label: 'Entrada',                                      activeColor: 'bg-emerald-700' },
    { id: 'outbound', icon: '📤', label: 'Saída',                                        activeColor: 'bg-rose-700'    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <Toast toast={toast} />

      {/* SIDEBAR */}
      <aside className="bg-slate-900 text-white w-full md:w-60 flex flex-col shrink-0 md:sticky md:top-0 md:h-screen">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-base shadow">📦</div>
            <div>
              <h2 className="font-bold text-sm leading-tight">Almoxarifado</h2>
              <span className="text-[10px] text-emerald-400 font-semibold">● Supabase Cloud</span>
            </div>
          </div>
          <button onClick={handleLogout} className="md:hidden text-xs text-slate-400 hover:text-white border border-slate-700 py-1 px-2.5 rounded-lg transition">Sair</button>
        </div>
        <nav className="flex flex-row md:flex-col p-2 gap-1 overflow-x-auto md:overflow-x-visible md:flex-1">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)}
              className={`flex-shrink-0 md:flex-shrink flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${activeTab === n.id ? `${n.activeColor} text-white shadow-sm` : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <span>{n.icon}</span>
              <span className="hidden sm:inline md:inline">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="hidden md:flex p-4 border-t border-slate-800 flex-col gap-2">
          <button onClick={loadAll} className="text-xs text-slate-500 hover:text-emerald-400 transition w-full text-left">↻ Sincronizar dados</button>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-200 transition w-full text-left">← Fazer Logout</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto">

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-3xl mb-3 animate-spin">↻</div>
                <p className="text-slate-500 text-sm">Carregando dados...</p>
              </div>
            </div>
          )}

          {!loading && (
            <>
              {/* ── ESTOQUE ── */}
              {activeTab === 'stock' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-slate-900">Estoque Geral</h1>
                      <p className="text-slate-400 text-xs mt-0.5">Saldos em tempo real · {items.length} itens · {categories.length} categorias</p>
                    </div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="🔍 Buscar por código ou nome…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-72 shadow-sm" />
                      <button onClick={loadAll} className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition text-sm" title="Sincronizar">↻</button>
                    </div>
                  </div>

                  {/* Tabela agrupada por categoria */}
                  <div className="space-y-4">
                    {itemsByCategory.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-slate-400">Nenhum item encontrado.</div>
                    ) : itemsByCategory.map(([catId, group]) => {
                      const isCollapsed = collapsedCats[catId] === undefined ? true : collapsedCats[catId];
                      return (
                        <div key={catId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          {/* Cabeçalho da categoria — clicável */}
                          <button
                            onClick={() => toggleCategory(catId)}
                            className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition border-b border-slate-200"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{isCollapsed ? '▶' : '▼'}</span>
                              <span className="font-bold text-slate-700 text-sm">{group.name}</span>
                              <span className="text-[11px] text-slate-400 bg-slate-200 rounded-full px-2 py-0.5 font-semibold">{group.items.length} {group.items.length === 1 ? 'item' : 'itens'}</span>
                            </div>
                          </button>

                          {/* Tabela de itens da categoria */}
                          {!isCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                                    <th className="px-4 py-3 text-left">Código</th>
                                    <th className="px-4 py-3 text-left">Item</th>
                                    <th className="px-4 py-3 text-left hidden lg:table-cell">Localização</th>
                                    <th className="px-4 py-3 text-left">Aplicação</th>
                                    <th className="px-4 py-3 text-center">Qtd.</th>
                                    <th className="px-4 py-3 text-left">Kanban</th>
                                    <th className="px-4 py-3 text-left hidden md:table-cell">SC Pendente</th>
                                    <th className="px-4 py-3 text-center">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {group.items.map(item => {
                                    const qty = getQty(item.id);
                                    const ks  = getKanban(item.id);
                                    const sc  = scMap[item.id];
                                    return (
                                      <React.Fragment key={item.id}>
                                        <tr className="hover:bg-slate-50 transition-colors">
                                          <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">{item.id}</td>
                                          <td className="px-4 py-3">
                                            <button
                                              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                              className="font-semibold text-slate-900 hover:text-blue-600 transition flex items-center gap-2"
                                            >
                                              {item.name}
                                              <span className="text-xs text-slate-400">{expandedItem === item.id ? '▲' : '▼'}</span>
                                            </button>
                                          </td>
                                          <td className="px-4 py-3 hidden lg:table-cell">
                                            <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[11px] px-2 py-0.5 rounded-md font-mono">{item.location || '—'}</span>
                                          </td>
                                          <td className="px-4 py-3 text-xs text-slate-600">{item.application || '—'}</td>
                                          <td className="px-4 py-3 text-center">
                                            <span className="font-bold text-slate-900">{qty}</span>
                                            <span className="text-[11px] text-slate-400 ml-1">{item.unit}</span>
                                          </td>
                                          <td className="px-4 py-3"><StatusBadge status={ks.status} label={ks.label} /></td>
                                          <td className="px-4 py-3 hidden md:table-cell">
                                            {sc ? (
                                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">🛒 {sc.sc}</span>
                                            ) : (
                                              <span className="text-[11px] text-slate-300">—</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                              <button onClick={() => handleEditItem(item)} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition">Editar</button>
                                              <button onClick={() => handleDeleteItem(item.id)} className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition">Excluir</button>
                                            </div>
                                          </td>
                                        </tr>

                                        {expandedItem === item.id && (
                                          <tr>
                                            <td colSpan="8" className="bg-slate-50 px-6 py-4">
                                              <div className="space-y-2">
                                                <p className="text-xs font-bold text-slate-500 uppercase">Últimas movimentações</p>
                                                {getLastMovements(item.id).length === 0 ? (
                                                  <p className="text-xs text-slate-400">Nenhuma movimentação encontrada.</p>
                                                ) : (
                                                  getLastMovements(item.id).map((mov, idx) => (
                                                    <div key={idx} className="flex flex-col gap-1 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2">
                                                      <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                          <span>{mov.type === 'Entrada' ? '📥' : '📤'}</span>
                                                          <span className={mov.type === 'Entrada' ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>{mov.type}</span>
                                                          <span className="text-slate-500">{mov.qty} {item.unit}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-400">{fmtDate(mov.date)}</span>
                                                      </div>
                                                      {mov.type === 'Entrada' && mov.sc && (
                                                        <span className="text-[11px] text-blue-600 font-mono pl-6">🛒 SC: {mov.sc}</span>
                                                      )}
                                                      {mov.type === 'Saída' && mov.notes && (
                                                        <span className="text-[11px] text-slate-500 italic pl-6">📝 {mov.notes}</span>
                                                      )}
                                                    </div>
                                                  ))
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── KANBAN ── */}
              {activeTab === 'kanban' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-amber-700">Alertas Kanban</h1>
                    <p className="text-slate-400 text-xs mt-0.5">Itens críticos · registre a SC diretamente no card</p>
                  </div>
                  {criticalItems.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center">
                      <div className="text-4xl mb-3">🎉</div>
                      <p className="text-emerald-800 font-bold text-sm">Todos os itens estão com estoque saudável!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {criticalItems.map(item => {
                        const qty        = getQty(item.id);
                        const isCritical = qty < Number(item.minStock);
                        const pct        = Math.min(100, Math.max(0, (qty / Number(item.maxStock)) * 100));
                        return (
                          <div key={item.id} className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col gap-4 ${isCritical ? 'border-red-200 ring-1 ring-red-100' : 'border-amber-200 ring-1 ring-amber-100'}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono text-[10px] font-bold text-slate-400">CÓD {item.id}</span>
                                <h3 className="font-bold text-slate-900 text-sm mt-0.5">{item.name}</h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">📍 {item.location || 'Sem local'}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {isCritical ? '🔴 CRÍTICO' : '🟡 ATENÇÃO'}
                                </span>
                                {getScStatus(item.id) === 'chega_hoje' && (
                                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">📦 Chega hoje</span>
                                )}
                                {getScStatus(item.id) === 'atrasada' && (
                                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 animate-pulse">⏰ Não chegou</span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 text-center bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
                              <div><p className="text-slate-400">Mínimo</p><p className="font-bold text-slate-700 mt-0.5">{item.minStock}</p></div>
                              <div className="border-x border-slate-200"><p className="text-slate-400">Atual</p><p className={`font-bold text-lg mt-0.5 ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>{qty}</p></div>
                              <div><p className="text-slate-400">Máximo</p><p className="font-bold text-slate-700 mt-0.5">{item.maxStock}</p></div>
                            </div>
                            <div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                                <span>{Math.round(pct)}% da capacidade</span>
                                <span>Repor: <strong className="text-slate-600">{Number(item.maxStock) - qty} {item.unit}</strong></span>
                              </div>
                            </div>
                            <ScPanel itemId={item.id} scMap={scMap} onSave={saveSc} onClear={clearSc} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── SC DE COMPRA ── */}
              {activeTab === 'sc' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-purple-800">SC de Compra</h1>
                    <p className="text-slate-400 text-xs mt-0.5">Registre solicitações de compra e acompanhe as previsões de chegada</p>
                  </div>
                  <div className="max-w-lg">
                    <form onSubmit={handleRegisterSc} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                      <Field label="Selecionar Item">
                        <ItemSearchSelect items={items} value={newSc.itemId}
                          onChange={v => setNewSc({ ...newSc, itemId: v })}
                          getQty={getQty} showStock={true} ringColor="blue" />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Nº da SC">
                          <Input ringColor="blue" mono type="text" required placeholder="SC-2026-99"
                            value={newSc.sc} onChange={e => setNewSc({ ...newSc, sc: e.target.value })} />
                        </Field>
                        <Field label="Quantidade Solicitada">
                          <Input ringColor="blue" type="number" required min="1" placeholder="Ex: 50"
                            value={newSc.qty} onChange={e => setNewSc({ ...newSc, qty: e.target.value })} />
                        </Field>
                      </div>
                      <Field label="Data da SC">
                        <Input ringColor="blue" type="date" required
                          value={newSc.dateSc} onChange={e => setNewSc({ ...newSc, dateSc: e.target.value })} />
                      </Field>
                      <Field label="Previsão de Chegada">
                        <Input ringColor="blue" type="date"
                          value={newSc.dateEta} onChange={e => setNewSc({ ...newSc, dateEta: e.target.value })} />
                      </Field>
                      <SubmitBtn color="slate" disabled={saving}>{saving ? 'Salvando...' : '🛒 Registrar SC'}</SubmitBtn>
                    </form>
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-600 mb-3">SCs Ativas ({Object.keys(scMap).length})</h2>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                              <th className="px-4 py-3 text-left">Item</th>
                              <th className="px-4 py-3 text-left">Nº SC</th>
                              <th className="px-4 py-3 text-left">Qtd.</th>
                              <th className="px-4 py-3 text-left">
                                <button onClick={() => setScSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                                  className="flex items-center gap-1 hover:text-slate-600 transition">
                                  Data SC
                                  <span className="text-[10px]">{scSortOrder === 'asc' ? '▲' : '▼'}</span>
                                </button>
                              </th>
                              <th className="px-4 py-3 text-left">Previsão</th>
                              <th className="px-4 py-3 text-left">Status</th>
                              <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sortedScEntries.length === 0 ? (
                              <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">Nenhuma SC ativa.</td></tr>
                            ) : (
                              sortedScEntries.map(([itemId, sc]) => {
                                const item = items.find(i => i.id === itemId);
                                const status = getScStatus(itemId);

                                if (editingSc === itemId) {
                                  return (
                                    <tr key={itemId} className="bg-blue-50">
                                      <td className="px-4 py-3">
                                        <span className="font-semibold text-slate-800">{item ? item.name : itemId}</span>
                                        <span className="text-[11px] text-slate-400 ml-2 font-mono">[{itemId}]</span>
                                      </td>
                                      <td className="px-4 py-2">
                                        <Input ringColor="blue" mono type="text" value={editScForm.sc}
                                          onChange={e => setEditScForm({ ...editScForm, sc: e.target.value })}
                                          className="text-xs py-1.5" />
                                      </td>
                                      <td className="px-4 py-2">
                                        <Input ringColor="blue" type="number" min="1" value={editScForm.qty}
                                          onChange={e => setEditScForm({ ...editScForm, qty: e.target.value })}
                                          className="text-xs py-1.5" />
                                      </td>
                                      <td className="px-4 py-2">
                                        <Input ringColor="blue" type="date" value={editScForm.dateSc}
                                          onChange={e => setEditScForm({ ...editScForm, dateSc: e.target.value })}
                                          className="text-xs py-1.5" />
                                      </td>
                                      <td className="px-4 py-2">
                                        <Input ringColor="blue" type="date" value={editScForm.dateEta}
                                          onChange={e => setEditScForm({ ...editScForm, dateEta: e.target.value })}
                                          className="text-xs py-1.5" />
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="text-[11px] text-slate-400">Editando...</span>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex gap-1.5 justify-center">
                                          <button onClick={() => saveEditSc(itemId)} disabled={saving}
                                            className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition disabled:opacity-50">
                                            Salvar
                                          </button>
                                          <button onClick={cancelEditSc}
                                            className="px-2 py-1 bg-slate-300 text-slate-700 rounded text-xs hover:bg-slate-400 transition">
                                            Cancelar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <React.Fragment key={itemId}>
                                    <tr className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3">
                                        <span className="font-semibold text-slate-800">{item ? item.name : itemId}</span>
                                        <span className="text-[11px] text-slate-400 ml-2 font-mono">[{itemId}]</span>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-xs text-blue-700">{sc.sc}</td>
                                      <td className="px-4 py-3 text-xs text-slate-600">{sc.qty || '—'} {item?.unit || ''}</td>
                                      <td className="px-4 py-3 text-xs text-slate-600">{fmtDate(sc.dateSc)}</td>
                                      <td className="px-4 py-3 text-xs text-slate-600">{sc.dateEta ? fmtDate(sc.dateEta) : '—'}</td>
                                      <td className="px-4 py-3">
                                        {status === 'chega_hoje' && (
                                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">📦 Chega hoje</span>
                                        )}
                                        {status === 'atrasada' && (
                                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">⏰ Não chegou</span>
                                        )}
                                        {!status && (
                                          <span className="text-[11px] text-slate-400">No prazo</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <div className="flex gap-1.5 justify-center">
                                          <button onClick={() => { setReceivingSc(itemId); setReceiveQty(sc.qty || ''); }}
                                            className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition">
                                            ✓ Chegou
                                          </button>
                                          <button onClick={() => openEditSc(itemId)} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition">Editar</button>
                                          <button onClick={() => clearSc(itemId)} className="px-2 py-1 bg-slate-400 text-white rounded text-xs hover:bg-slate-500 transition">Remover</button>
                                        </div>
                                      </td>
                                    </tr>

                                    {receivingSc === itemId && (
                                      <tr className="bg-emerald-50">
                                        <td colSpan="7" className="px-4 py-3">
                                          <div className="flex flex-wrap items-end gap-3">
                                            <span className="text-xs font-bold text-emerald-700">📥 Confirmar recebimento de "{item?.name}":</span>
                                            <div className="w-32">
                                              <Input ringColor="emerald" type="number" min="1" placeholder="Qtd. recebida"
                                                value={receiveQty} onChange={e => setReceiveQty(e.target.value)}
                                                className="text-xs py-1.5" />
                                            </div>
                                            <button onClick={() => handleReceiveSc(itemId)} disabled={saving}
                                              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50">
                                              Confirmar Entrada
                                            </button>
                                            <button onClick={() => { setReceivingSc(null); setReceiveQty(''); }}
                                              className="px-3 py-1.5 bg-slate-300 text-slate-700 rounded text-xs hover:bg-slate-400 transition">
                                              Cancelar
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CADASTRAR / EDITAR ── */}
              {activeTab === 'register' && (
                <div className="max-w-lg mx-auto space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">{editingItem ? `Editando: ${editingItem.name}` : 'Cadastrar Novo Item'}</h1>
                    <p className="text-slate-400 text-xs mt-0.5">{editingItem ? 'Altere os dados e salve.' : 'Insira o item na base de dados mestre'}</p>
                  </div>
                  <form onSubmit={handleRegister} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Field label="Código / ID (Código de Barras)">
                          <Input autoFocus mono type="text" required placeholder="Ex: 78910001"
                            value={newItem.id} onChange={e => setNewItem({ ...newItem, id: e.target.value })}
                            disabled={!!editingItem} className={editingItem ? 'opacity-50 cursor-not-allowed' : ''} />
                        </Field>
                      </div>
                      <div>
                        <Field label="Unidade">
                          <Select value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })}>
                            {['Un', 'Cx', 'Kg', 'Pacote', 'Metro', 'Galo', 'Litro'].map(u => <option key={u}>{u}</option>)}
                          </Select>
                        </Field>
                      </div>
                    </div>

                    <Field label="Nome Descritivo">
                      <Input type="text" required placeholder="Ex: Parafuso Sextavado M10"
                        value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                    </Field>

                    {/* ── Campo de Categoria ── */}
                    <Field label="Categoria">
                      <div className="space-y-2">
                        <Select value={newItem.categoryId || ''} onChange={e => setNewItem({ ...newItem, categoryId: e.target.value || null })}>
                          <option value="">— Sem categoria —</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </Select>

                        {/* Botão para criar nova categoria */}
                        {!showNewCatInput ? (
                          <button type="button" onClick={() => setShowNewCatInput(true)}
                            className="text-xs text-blue-500 hover:text-blue-700 font-semibold flex items-center gap-1 transition">
                            ＋ Criar nova categoria
                          </button>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Nome da nova categoria..."
                              value={newCatName}
                              onChange={e => setNewCatName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } }}
                              className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                              autoFocus
                            />
                            <button type="button" onClick={handleCreateCategory} disabled={savingCat}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50">
                              {savingCat ? '...' : 'Criar'}
                            </button>
                            <button type="button" onClick={() => { setShowNewCatInput(false); setNewCatName(''); }}
                              className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300 transition">
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </Field>

                    <Field label="Aplicação / Onde é usado">
                      <Input type="text" placeholder="Ex: Máquina Corte Laser, Produto XPTO, Linha 03"
                        value={newItem.application} onChange={e => setNewItem({ ...newItem, application: e.target.value })} />
                    </Field>

                    <Field label="Localização no Almoxarifado">
                      <Input type="text" placeholder="Ex: Prateleira B, Setor 4"
                        value={newItem.location} onChange={e => setNewItem({ ...newItem, location: e.target.value })} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                      <Field label="Qtd. Mínima — Gatilho Kanban" accent="amber">
                        <input type="number" required min="0" placeholder="Ex: 10"
                          value={newItem.minStock} onChange={e => setNewItem({ ...newItem, minStock: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 transition" />
                      </Field>
                      <Field label="Qtd. Máxima (Meta)">
                        <Input type="number" required min="0" placeholder="Ex: 100"
                          value={newItem.maxStock} onChange={e => setNewItem({ ...newItem, maxStock: e.target.value })} />
                      </Field>
                    </div>

                    <div className="flex gap-3">
                      <SubmitBtn color="slate" disabled={saving}>
                        {saving ? 'Salvando...' : editingItem ? '💾 Salvar Alterações' : 'Salvar Item no Banco Mestre'}
                      </SubmitBtn>
                      {editingItem && (
                        <button type="button" onClick={() => { setEditingItem(null); setNewItem({ id: '', name: '', location: '', application: '', unit: 'Un', minStock: '', maxStock: '', categoryId: null }); setShowNewCatInput(false); setNewCatName(''); }}
                          className="px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* ── ENTRADA ── */}
              {activeTab === 'inbound' && (
                <div className="max-w-lg mx-auto space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-emerald-800">Registrar Entrada de Material</h1>
                    <p className="text-slate-400 text-xs mt-0.5">Vincule a movimentação a uma Solicitação de Compra (SC)</p>
                  </div>
                  <form onSubmit={handleInbound} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <Field label="Selecionar Item">
                      <ItemSearchSelect items={items} value={newInbound.itemId}
                        onChange={v => setNewInbound({ ...newInbound, itemId: v })}
                        getQty={getQty} showStock={false} ringColor="emerald" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Quantidade Recebida">
                        <Input ringColor="emerald" type="number" required min="1" placeholder="0"
                          value={newInbound.qty} onChange={e => setNewInbound({ ...newInbound, qty: e.target.value })} />
                      </Field>
                      <Field label="Nº da SC">
                        <Input ringColor="emerald" mono type="text" required placeholder="SC-2026-99"
                          value={newInbound.sc} onChange={e => setNewInbound({ ...newInbound, sc: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Data de Chegada">
                      <Input ringColor="emerald" type="date" required
                        value={newInbound.date} onChange={e => setNewInbound({ ...newInbound, date: e.target.value })} />
                    </Field>
                    <SubmitBtn color="emerald" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar Entrada de Material'}</SubmitBtn>
                  </form>
                </div>
              )}

              {/* ── SAÍDA ── */}
              {activeTab === 'outbound' && (
                <div className="max-w-lg mx-auto space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-rose-800">Registrar Saída / Consumo</h1>
                    <p className="text-slate-400 text-xs mt-0.5">Deduz do saldo atual do estoque</p>
                  </div>
                  <form onSubmit={handleOutbound} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <Field label="Selecionar Item">
                      <ItemSearchSelect items={items} value={newOutbound.itemId}
                        onChange={v => setNewOutbound({ ...newOutbound, itemId: v })}
                        getQty={getQty} showStock={true} ringColor="rose" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Quantidade Retirada">
                        <Input ringColor="rose" type="number" required min="1" placeholder="0"
                          value={newOutbound.qty} onChange={e => setNewOutbound({ ...newOutbound, qty: e.target.value })} />
                      </Field>
                      <Field label="Data da Retirada">
                        <Input ringColor="rose" type="date" required
                          value={newOutbound.date} onChange={e => setNewOutbound({ ...newOutbound, date: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Destino / Observações">
                      <textarea rows="3" placeholder="Ex: Entregue ao técnico João — manutenção máquina 02."
                        value={newOutbound.notes} onChange={e => setNewOutbound({ ...newOutbound, notes: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400 transition resize-none" />
                    </Field>
                    <SubmitBtn color="rose" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar Baixa no Estoque'}</SubmitBtn>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
