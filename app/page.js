'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

/* ─────────────────────────────────────────────
   SEED DATA
───────────────────────────────────────────── */
const SEED_ITEMS = [
  { id: '1001', name: 'Luva de Nitrilo M',    location: 'Prateleira A1', unit: 'Cx',   minStock: 10, maxStock: 50 },
  { id: '1002', name: 'Fita Isolante 20m',    location: 'Gaveta B3',    unit: 'Un',   minStock: 5,  maxStock: 30 },
  { id: '1003', name: 'Detergente Industrial', location: 'Palete C2',   unit: 'Galo', minStock: 15, maxStock: 40 },
];
const SEED_INBOUND  = [
  { id: 'IN-001', itemId: '1001', qty: 20, date: '2026-06-01', sc: 'SC-12345' },
  { id: 'IN-002', itemId: '1002', qty: 4,  date: '2026-06-02', sc: 'SC-12346' },
];
const SEED_OUTBOUND = [
  { id: 'OUT-001', itemId: '1001', qty: 5, date: '2026-06-03', notes: 'Uso na produção' },
];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0];

function ls(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  const colors = { success: 'bg-emerald-600 text-white', error: 'bg-red-500 text-white', warning: 'bg-amber-500 text-white' };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold toast-animate max-w-xs ${colors[toast.type]}`}>
      <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : '⚠'}</span>
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
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
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
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum item encontrado.</li>
            ) : filtered.map(item => {
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
   SC PANEL — painel de SC dentro do card Kanban
───────────────────────────────────────────── */
function ScPanel({ itemId, scMap, onSave, onClear }) {
  const sc = scMap[itemId];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ sc: '', dateSc: today(), dateEta: '' });

  const openEdit = () => {
    setForm(sc ? { sc: sc.sc, dateSc: sc.dateSc, dateEta: sc.dateEta } : { sc: '', dateSc: today(), dateEta: '' });
    setEditing(true);
  };

  const save = () => {
    if (!form.sc) return;
    onSave(itemId, form);
    setEditing(false);
  };

  /* SC já registrada */
  if (sc && !editing) {
    return (
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
          <div>
            <p className="text-blue-400 font-medium">Nº SC</p>
            <p className="font-bold text-blue-800 font-mono">{sc.sc}</p>
          </div>
          <div>
            <p className="text-blue-400 font-medium">Data SC</p>
            <p className="font-bold text-blue-800">{fmtDate(sc.dateSc)}</p>
          </div>
          <div>
            <p className="text-blue-400 font-medium">Previsão</p>
            <p className="font-bold text-blue-800">{sc.dateEta ? fmtDate(sc.dateEta) : '—'}</p>
          </div>
        </div>
      </div>
    );
  }

  /* Formulário de cadastro/edição */
  if (editing) {
    return (
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
          <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white transition">Cancelar</button>
        </div>
      </div>
    );
  }

  /* Botão para abrir */
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
    <input {...props}
      className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 ${ringMap[ringColor] || ringMap.blue} focus:border-transparent transition ${mono ? 'font-mono' : ''} ${props.className || ''}`} />
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

function SubmitBtn({ color, children }) {
  const map = { slate: 'bg-slate-800 hover:bg-slate-900', emerald: 'bg-emerald-600 hover:bg-emerald-700', rose: 'bg-rose-600 hover:bg-rose-700' };
  return (
    <button type="submit" className={`w-full ${map[color] || map.slate} text-white font-bold py-3 rounded-xl transition-all text-sm tracking-wide shadow-sm hover:shadow-md active:scale-[0.98]`}>
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

  const [items,       setItems]       = useState(SEED_ITEMS);
  const [inboundLog,  setInboundLog]  = useState(SEED_INBOUND);
  const [outboundLog, setOutboundLog] = useState(SEED_OUTBOUND);
  // scMap: { [itemId]: { sc, dateSc, dateEta } }
  const [scMap, setScMap] = useState({});

  const [newItem, setNewItem] = useState({
  id: '', name: '', location: '', application: '',  unit: 'Un',  minStock: '',  maxStock: '' });
  const [newInbound,  setNewInbound]  = useState({ itemId: '', qty: '', date: today(), sc: '' });
  const [newOutbound, setNewOutbound] = useState({ itemId: '', qty: '', date: today(), notes: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [toast,       setToast]       = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    const si = ls('inv_items', null), ib = ls('inv_inbound', null), ob = ls('inv_outbound', null);
    if (si) setItems(si); if (ib) setInboundLog(ib); if (ob) setOutboundLog(ob);
    const sm = ls('inv_scmap', null); if (sm) setScMap(sm);
    if (ls('inv_logged', false)) setIsLoggedIn(true);
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const persist = useCallback((i, ib, ob) => {
    setItems(i); setInboundLog(ib); setOutboundLog(ob);
    lsSet('inv_items', i); lsSet('inv_inbound', ib); lsSet('inv_outbound', ob);
  }, []);

  const saveSc = useCallback((itemId, data) => {
    const updated = { ...scMap, [itemId]: data };
    setScMap(updated);
    lsSet('inv_scmap', updated);
    showToast('SC registrada com sucesso!');
  }, [scMap, showToast]);

  const clearSc = useCallback((itemId) => {
    const updated = { ...scMap };
    delete updated[itemId];
    setScMap(updated);
    lsSet('inv_scmap', updated);
    showToast('SC removida.', 'warning');
  }, [scMap, showToast]);

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

  /* HANDLERS */
  const handleLogin = (e) => {
    e.preventDefault();
    if (email === 'jo.edubazilio2018@gmail.com' && password === 'Art@2023') {
      setIsLoggedIn(true); lsSet('inv_logged', true);
    } else { showToast('E-mail ou senha incorretos!', 'error'); }
  };

  const handleLogout = () => { setIsLoggedIn(false); lsSet('inv_logged', false); };
  
  const handleDeleteItem = (itemId) => {

  if (!confirm('Deseja realmente excluir este item?')) {
    return;
  }

  const updatedItems =
    items.filter(item => item.id !== itemId);

  persist(
    updatedItems,
    inboundLog,
    outboundLog
  );

  showToast('Item removido com sucesso!', 'warning');
};

  const handleEditItem = (item) => {

  setEditingItem(item);

  setNewItem({
    id: item.id,
    name: item.name,
    location: item.location || '',
    application: item.application || '',
    unit: item.unit,
    minStock: item.minStock,
    maxStock: item.maxStock
  });

  setActiveTab('register');
};
   
  const handleRegister = (e) => {

  e.preventDefault();

  if (!newItem.id || !newItem.name) {
    return showToast(
      'Código e Nome são obrigatórios.',
      'error'
    );
  }

  if (editingItem) {

    const updatedItems = items.map(item =>
      item.id === editingItem.id
        ? {
            ...newItem,
            minStock: Number(newItem.minStock),
            maxStock: Number(newItem.maxStock)
          }
        : item
    );

    persist(
      updatedItems,
      inboundLog,
      outboundLog
    );

    setEditingItem(null);

    setNewItem({
      id: '',
      name: '',
      location: '',
      application: '',
      unit: 'Un',
      minStock: '',
      maxStock: ''
    });

    showToast('Item atualizado com sucesso!');

    setActiveTab('stock');

    return;
  }

  if (items.some(i => i.id === newItem.id)) {
    return showToast(
      'Este código já está cadastrado.',
      'error'
    );
  }

  persist(
    [
      ...items,
      {
        ...newItem,
        minStock: Number(newItem.minStock),
        maxStock: Number(newItem.maxStock)
      }
    ],
    inboundLog,
    outboundLog
  );

  setNewItem({
    id: '',
    name: '',
    location: '',
    application: '',
    unit: 'Un',
    minStock: '',
    maxStock: ''
  });

  showToast(`"${newItem.name}" cadastrado!`);

  setActiveTab('stock');
};
   
  const handleInbound = (e) => {
    e.preventDefault();
    if (!newInbound.itemId || !newInbound.qty) return showToast('Selecione o item e a quantidade.', 'error');
    persist(items, [...inboundLog, { ...newInbound, qty: Number(newInbound.qty), id: `IN-${Date.now()}` }], outboundLog);
    // Ao dar entrada, limpa a SC pendente do item
    clearSc(newInbound.itemId);
    const name = items.find(i => i.id === newInbound.itemId)?.name;
    setNewInbound({ itemId: '', qty: '', date: today(), sc: '' });
    showToast(`Entrada de "${name}" registrada!`);
    setActiveTab('stock');
  };

  const handleOutbound = (e) => {
    e.preventDefault();
    if (!newOutbound.itemId || !newOutbound.qty) return showToast('Selecione o item e a quantidade.', 'error');
    const available = getQty(newOutbound.itemId);
    if (Number(newOutbound.qty) > available) return showToast(`Estoque insuficiente! Disponível: ${available} un.`, 'error');
    persist(items, inboundLog, [...outboundLog, { ...newOutbound, qty: Number(newOutbound.qty), id: `OUT-${Date.now()}` }]);
    const name = items.find(i => i.id === newOutbound.itemId)?.name;
    setNewOutbound({ itemId: '', qty: '', date: today(), notes: '' });
    showToast(`Saída de "${name}" confirmada!`);
    setActiveTab('stock');
  };

  const filteredItems = items.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.id.includes(searchQuery)
  );
  const criticalItems = items.filter(i => ['danger', 'warning'].includes(getKanban(i.id).status));

  /* LOGIN */
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

  /* MAIN APP */
  const navItems = [
    { id: 'stock',    icon: '📦', label: 'Estoque',                        activeColor: 'bg-blue-600'    },
    { id: 'kanban',   icon: '⚠️', label: `Kanban (${criticalItems.length})`, activeColor: 'bg-amber-600' },
    { id: 'register', icon: '➕', label: 'Cadastrar',                       activeColor: 'bg-slate-600'   },
    { id: 'inbound',  icon: '📥', label: 'Entrada',                        activeColor: 'bg-emerald-700' },
    { id: 'outbound', icon: '📤', label: 'Saída',                          activeColor: 'bg-rose-700'    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <Toast toast={toast} />

      {/* SIDEBAR */}
      <aside className="bg-slate-900 text-white w-full md:w-60 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-base shadow">📦</div>
            <div>
              <h2 className="font-bold text-sm leading-tight">Almoxarifado</h2>
              <span className="text-[10px] text-emerald-400 font-semibold">● Online</span>
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
        <div className="hidden md:flex p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-200 transition w-full text-left">← Fazer Logout</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto">

          {/* ── ESTOQUE ── */}
          {activeTab === 'stock' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Estoque Geral</h1>
                  <p className="text-slate-400 text-xs mt-0.5">Saldos em tempo real · {items.length} itens</p>
                </div>
                <input type="text" placeholder="🔍 Buscar por código ou nome…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-72 shadow-sm" />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="px-4 py-3 text-left hidden lg:table-cell">Localização</th>
                        <th className="px-4 py-3 text-left"> Aplicação</th>
                        <th className="px-4 py-3 text-center">Qtd.</th>
                        <th className="px-4 py-3 text-left">Kanban</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">SC Pendente</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.length === 0 ? (
                        <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400">Nenhum item encontrado.</td></tr>
                      ) : filteredItems.map(item => {
                        const qty = getQty(item.id);
                        const ks  = getKanban(item.id);
                        const sc  = scMap[item.id];
                        return (
  <tr key={item.id} className="hover:bg-slate-50 transition-colors">

    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">
      {item.id}
    </td>

    <td className="px-4 py-3 font-semibold text-slate-900">
      {item.name}
    </td>

    <td className="px-4 py-3 hidden lg:table-cell">
      <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[11px] px-2 py-0.5 rounded-md font-mono">
        {item.location || '—'}
      </span>
    </td>

    <td className="px-4 py-3 text-xs text-slate-600">
      {item.application || '—'}
    </td>

    <td className="px-4 py-3 text-center">
      <span className="font-bold text-slate-900">
        {qty}
      </span>
      <span className="text-[11px] text-slate-400 ml-1">
        {item.unit}
      </span>
    </td>

    <td className="px-4 py-3">
      <StatusBadge
        status={ks.status}
        label={ks.label}
      />
    </td>

    <td className="px-4 py-3 hidden md:table-cell">
      {sc ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
          🛒 {sc.sc}
        </span>
      ) : (
        <span className="text-[11px] text-slate-300">
          —
        </span>
      )}
    </td>

    <td className="px-4 py-3">
      <div className="flex gap-2">

        <button
          onClick={() => handleEditItem(item)}
          className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
        >
          Editar
        </button>

        <button
          onClick={() => handleDeleteItem(item.id)}
          className="px-2 py-1 bg-red-500 text-white rounded text-xs"
        >
          Excluir
        </button>

      </div>
    </td>

  </tr>
);
                      })}
                    </tbody> 
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── KANBAN ── */}
          {activeTab === 'kanban' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-amber-700">Alertas Kanban</h1>
                <p className="text-slate-400 text-xs mt-0.5">Itens críticos · registre a SC de compra diretamente no card</p>
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

                        {/* Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-slate-400">CÓD {item.id}</span>
                            <h3 className="font-bold text-slate-900 text-sm mt-0.5">{item.name}</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">📍 {item.location || 'Sem local'}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isCritical ? '🔴 CRÍTICO' : '🟡 ATENÇÃO'}
                          </span>
                        </div>

                        {/* Qty grid */}
                        <div className="grid grid-cols-3 text-center bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
                          <div><p className="text-slate-400">Mínimo</p><p className="font-bold text-slate-700 mt-0.5">{item.minStock}</p></div>
                          <div className="border-x border-slate-200"><p className="text-slate-400">Atual</p><p className={`font-bold text-lg mt-0.5 ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>{qty}</p></div>
                          <div><p className="text-slate-400">Máximo</p><p className="font-bold text-slate-700 mt-0.5">{item.maxStock}</p></div>
                        </div>

                        {/* Progress */}
                        <div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                            <span>{Math.round(pct)}% da capacidade</span>
                            <span>Repor: <strong className="text-slate-600">{Number(item.maxStock) - qty} {item.unit}</strong></span>
                          </div>
                        </div>

                        {/* SC Panel */}
                        <ScPanel itemId={item.id} scMap={scMap} onSave={saveSc} onClear={clearSc} />

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CADASTRAR ── */}
          {activeTab === 'register' && (
            <div className="max-w-lg mx-auto space-y-5">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Cadastrar Novo Item</h1>
                <p className="text-slate-400 text-xs mt-0.5">Insira o item na base de dados mestre</p>
              </div>
              <form onSubmit={handleRegister} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Código / ID (Código de Barras)">
                      <Input autoFocus mono type="text" required placeholder="Ex: 78910001"
                        value={newItem.id} onChange={e => setNewItem({ ...newItem, id: e.target.value })} />
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
                <Field label="Localização no Almoxarifado">
             <Field label="Aplicação / Onde é usado">
  <Input
    type="text"
    placeholder="Ex: Máquina Corte Laser, Produto XPTO, Linha 03"
    value={newItem.application}
    onChange={e =>
      setNewItem({
        ...newItem,
        application: e.target.value
      })
    }
  />
</Field>
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
                <SubmitBtn color="slate">Salvar Item no Banco Mestre</SubmitBtn>
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
                <SubmitBtn color="emerald">Confirmar Entrada de Material</SubmitBtn>
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
                <SubmitBtn color="rose">Confirmar Baixa no Estoque</SubmitBtn>
              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
