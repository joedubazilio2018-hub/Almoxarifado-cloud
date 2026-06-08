'use client';

import React, { useState, useEffect, useCallback } from 'react';

/* ─────────────────────────────────────────────
   INITIAL SEED DATA
───────────────────────────────────────────── */
const SEED_ITEMS = [
  { id: '1001', name: 'Luva de Nitrilo M', location: 'Prateleira A1', unit: 'Cx',   minStock: 10, maxStock: 50 },
  { id: '1002', name: 'Fita Isolante 20m',  location: 'Gaveta B3',    unit: 'Un',   minStock: 5,  maxStock: 30 },
  { id: '1003', name: 'Detergente Industrial', location: 'Palete C2', unit: 'Galo', minStock: 15, maxStock: 40 },
];
const SEED_INBOUND = [
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
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

/* ─────────────────────────────────────────────
   TOAST COMPONENT
───────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  const colors = {
    success: 'bg-emerald-600 text-white',
    error:   'bg-red-500 text-white',
    warning: 'bg-amber-500 text-white',
  };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold toast-animate max-w-xs ${colors[toast.type]}`}>
      <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : '⚠'}</span>
      <span>{toast.msg}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   INPUT HELPERS
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
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-${ringColor}-400 focus:border-transparent transition ${mono ? 'font-mono' : ''} ${props.className || ''}`}
    />
  );
}

function Select({ ringColor = 'blue', children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-${ringColor}-400 focus:border-transparent transition appearance-none cursor-pointer`}
    >
      {children}
    </select>
  );
}

function SubmitBtn({ color, children }) {
  const map = {
    slate:   'bg-slate-800 hover:bg-slate-900',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    rose:    'bg-rose-600 hover:bg-rose-700',
  };
  return (
    <button
      type="submit"
      className={`w-full ${map[color] || map.slate} text-white font-bold py-3 rounded-xl transition-all text-sm tracking-wide shadow-sm hover:shadow-md active:scale-[0.98]`}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────── */
function StatusBadge({ status, label }) {
  const map = {
    danger:  'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold border rounded-full ${map[status]}`}>
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function InventoryApp() {
  /* Auth */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  /* Navigation */
  const [activeTab, setActiveTab] = useState('stock');

  /* Core data — seeded from localStorage on mount */
  const [items,       setItems]       = useState(SEED_ITEMS);
  const [inboundLog,  setInboundLog]  = useState(SEED_INBOUND);
  const [outboundLog, setOutboundLog] = useState(SEED_OUTBOUND);

  /* Form state */
  const [newItem,     setNewItem]     = useState({ id: '', name: '', location: '', unit: 'Un', minStock: '', maxStock: '' });
  const [newInbound,  setNewInbound]  = useState({ itemId: '', qty: '', date: today(), sc: '' });
  const [newOutbound, setNewOutbound] = useState({ itemId: '', qty: '', date: today(), notes: '' });
  const [searchQuery, setSearchQuery] = useState('');

  /* Toast */
  const [toast, setToast] = useState(null);

  /* ── Hydrate from localStorage on first render ── */
  useEffect(() => {
    const savedItems    = ls('inv_items',    null);
    const savedInbound  = ls('inv_inbound',  null);
    const savedOutbound = ls('inv_outbound', null);
    if (savedItems)    setItems(savedItems);
    if (savedInbound)  setInboundLog(savedInbound);
    if (savedOutbound) setOutboundLog(savedOutbound);
    if (ls('inv_logged', false)) setIsLoggedIn(true);
  }, []);

  /* ── Toast helper ── */
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /* ── Persist helper ── */
  const persist = useCallback((i, ib, ob) => {
    setItems(i); setInboundLog(ib); setOutboundLog(ob);
    lsSet('inv_items', i);
    lsSet('inv_inbound', ib);
    lsSet('inv_outbound', ob);
  }, []);

  /* ─────────────────────────────────────────────
     CALCULATIONS
  ───────────────────────────────────────────── */
  const getQty = useCallback((itemId) => {
    const totalIn  = inboundLog.filter(r => r.itemId === itemId).reduce((s, r) => s + Number(r.qty), 0);
    const totalOut = outboundLog.filter(r => r.itemId === itemId).reduce((s, r) => s + Number(r.qty), 0);
    return totalIn - totalOut;
  }, [inboundLog, outboundLog]);

  const getKanban = useCallback((itemId) => {
    const qty  = getQty(itemId);
    const item = items.find(i => i.id === itemId);
    if (!item) return { label: 'Ideal', status: 'healthy' };
    if (qty < Number(item.minStock))            return { label: 'CRÍTICO',  status: 'danger'  };
    if (qty <= Number(item.minStock) * 1.3)     return { label: 'ATENÇÃO',  status: 'warning' };
    return                                             { label: 'Ideal',     status: 'healthy' };
  }, [items, getQty]);

  /* ─────────────────────────────────────────────
     HANDLERS
  ───────────────────────────────────────────── */
  const handleLogin = (e) => {
    e.preventDefault();
    if (email && password) {
      setIsLoggedIn(true);
      lsSet('inv_logged', true);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    lsSet('inv_logged', false);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!newItem.id || !newItem.name) return showToast('Código e Nome são obrigatórios.', 'error');
    if (items.some(i => i.id === newItem.id)) return showToast('Este código já está cadastrado.', 'error');
    const updated = [...items, { ...newItem, minStock: Number(newItem.minStock), maxStock: Number(newItem.maxStock) }];
    persist(updated, inboundLog, outboundLog);
    setNewItem({ id: '', name: '', location: '', unit: 'Un', minStock: '', maxStock: '' });
    showToast(`"${newItem.name}" cadastrado com sucesso!`);
    setActiveTab('stock');
  };

  const handleInbound = (e) => {
    e.preventDefault();
    if (!newInbound.itemId || !newInbound.qty) return showToast('Selecione o item e a quantidade.', 'error');
    const entry = { ...newInbound, qty: Number(newInbound.qty), id: `IN-${Date.now()}` };
    persist(items, [...inboundLog, entry], outboundLog);
    const name = items.find(i => i.id === newInbound.itemId)?.name;
    setNewInbound({ itemId: '', qty: '', date: today(), sc: '' });
    showToast(`Entrada de "${name}" registrada!`);
    setActiveTab('stock');
  };

  const handleOutbound = (e) => {
    e.preventDefault();
    if (!newOutbound.itemId || !newOutbound.qty) return showToast('Selecione o item e a quantidade.', 'error');
    const available = getQty(newOutbound.itemId);
    const qty = Number(newOutbound.qty);
    if (qty > available) {
      showToast(`Estoque insuficiente! Disponível: ${available} un. Saída não registrada.`, 'error');
      return;
    }
    const entry = { ...newOutbound, qty, id: `OUT-${Date.now()}` };
    persist(items, inboundLog, [...outboundLog, entry]);
    const name = items.find(i => i.id === newOutbound.itemId)?.name;
    setNewOutbound({ itemId: '', qty: '', date: today(), notes: '' });
    showToast(`Saída de "${name}" confirmada!`);
    setActiveTab('stock');
  };

  /* ─────────────────────────────────────────────
     DERIVED LISTS
  ───────────────────────────────────────────── */
  const filteredItems  = items.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.id.includes(searchQuery)
  );
  const criticalItems  = items.filter(i => ['danger', 'warning'].includes(getKanban(i.id).status));
  const alertCount     = criticalItems.length;

  /* ─────────────────────────────────────────────
     LOGIN SCREEN
  ───────────────────────────────────────────── */
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mb-4 shadow-xl shadow-blue-900/50 text-3xl">
              📦
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Almoxarifado Cloud
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gestão de Estoque & Kanban Inteligente</p>
          </div>

          {/* Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">E-mail</label>
                <input
                  type="email" required placeholder="seu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Senha</label>
                <input
                  type="password" required placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold py-3 rounded-xl transition-all text-sm tracking-wide shadow-lg shadow-blue-900/40 mt-2"
              >
                Entrar no Sistema
              </button>
            </form>
            <p className="text-center text-[11px] text-slate-600 mt-4">
              Digite qualquer e-mail e senha para acessar
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     MAIN APP LAYOUT
  ───────────────────────────────────────────── */
  const navItems = [
    { id: 'stock',    icon: '📦', label: 'Estoque',                     activeColor: 'bg-blue-600'    },
    { id: 'kanban',   icon: '⚠️', label: `Kanban (${alertCount})`,      activeColor: 'bg-amber-600'   },
    { id: 'register', icon: '➕', label: 'Cadastrar',                    activeColor: 'bg-slate-600'   },
    { id: 'inbound',  icon: '📥', label: 'Entrada',                     activeColor: 'bg-emerald-700' },
    { id: 'outbound', icon: '📤', label: 'Saída',                       activeColor: 'bg-rose-700'    },
  ];

  const ringMap = { stock: 'blue', kanban: 'amber', register: 'slate', inbound: 'emerald', outbound: 'rose' };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      <Toast toast={toast} />

      {/* ── SIDEBAR (desktop) / TOP BAR (mobile) ── */}
      <aside className="bg-slate-900 text-white w-full md:w-60 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-base shadow">📦</div>
            <div>
              <h2 className="font-bold text-sm leading-tight">Almoxarifado</h2>
              <span className="text-[10px] text-emerald-400 font-semibold">● Online</span>
            </div>
          </div>
          <button onClick={handleLogout} className="md:hidden text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 py-1 px-2.5 rounded-lg transition">
            Sair
          </button>
        </div>

        {/* Nav — horizontal on mobile, vertical on desktop */}
        <nav className="flex flex-row md:flex-col p-2 gap-1 overflow-x-auto md:overflow-x-visible md:flex-1 scrollbar-hide">
          {navItems.map(n => (
            <button
              key={n.id}
              onClick={() => setActiveTab(n.id)}
              className={`flex-shrink-0 md:flex-shrink flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap md:whitespace-normal ${
                activeTab === n.id
                  ? `${n.activeColor} text-white shadow-sm`
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{n.icon}</span>
              <span className="hidden sm:inline md:inline">{n.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout — desktop */}
        <div className="hidden md:flex p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-200 transition w-full text-left">
            ← Fazer Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto">

          {/* ════════════════════════════════
              TAB: ESTOQUE
          ════════════════════════════════ */}
          {activeTab === 'stock' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Estoque Geral</h1>
                  <p className="text-slate-400 text-xs mt-0.5">Saldos calculados em tempo real · {items.length} itens cadastrados</p>
                </div>
                <input
                  type="text"
                  placeholder="🔍 Buscar por código ou nome…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-72 shadow-sm"
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="px-4 py-3 text-left">Código</th>
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="px-4 py-3 text-left hidden lg:table-cell">Localização</th>
                        <th className="px-4 py-3 text-center">Qtd. Atual</th>
                        <th className="px-4 py-3 text-left">Kanban</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-4 py-10 text-center text-slate-400 text-sm">
                            Nenhum item encontrado.
                          </td>
                        </tr>
                      ) : filteredItems.map(item => {
                        const qty = getQty(item.id);
                        const ks  = getKanban(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">{item.id}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[11px] px-2 py-0.5 rounded-md font-mono">
                                {item.location || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-slate-900">{qty}</span>
                              <span className="text-[11px] text-slate-400 ml-1">{item.unit}</span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={ks.status} label={ks.label} />
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

          {/* ════════════════════════════════
              TAB: KANBAN
          ════════════════════════════════ */}
          {activeTab === 'kanban' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-amber-700">Alertas Kanban</h1>
                <p className="text-slate-400 text-xs mt-0.5">Itens que atingiram ou romperam o estoque mínimo</p>
              </div>

              {criticalItems.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-emerald-800 font-bold text-sm">Todos os itens estão com estoque saudável!</p>
                  <p className="text-emerald-600 text-xs mt-1">Nenhuma reposição necessária no momento.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {criticalItems.map(item => {
                    const qty        = getQty(item.id);
                    const isCritical = qty < Number(item.minStock);
                    const pct        = Math.min(100, Math.max(0, (qty / Number(item.maxStock)) * 100));
                    const needQty    = Number(item.maxStock) - qty;

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
                          <div>
                            <p className="text-slate-400 font-medium">Mínimo</p>
                            <p className="font-bold text-slate-700 mt-0.5">{item.minStock}</p>
                          </div>
                          <div className="border-x border-slate-200">
                            <p className="text-slate-400 font-medium">Atual</p>
                            <p className={`font-bold text-lg mt-0.5 ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>{qty}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-medium">Máximo</p>
                            <p className="font-bold text-slate-700 mt-0.5">{item.maxStock}</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-400' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                            <span>{Math.round(pct)}% da capacidade</span>
                            <span>Repor: <strong className="text-slate-600">{needQty} {item.unit}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              TAB: CADASTRAR
          ════════════════════════════════ */}
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
                  <Input type="text" placeholder="Ex: Prateleira B, Setor 4"
                    value={newItem.location} onChange={e => setNewItem({ ...newItem, location: e.target.value })} />
                </Field>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <Field label="Qtd. Mínima — Gatilho Kanban" accent="amber">
                    <input type="number" required min="0" placeholder="Ex: 10"
                      value={newItem.minStock} onChange={e => setNewItem({ ...newItem, minStock: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                    />
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

          {/* ════════════════════════════════
              TAB: ENTRADA
          ════════════════════════════════ */}
          {activeTab === 'inbound' && (
            <div className="max-w-lg mx-auto space-y-5">
              <div>
                <h1 className="text-xl font-bold text-emerald-800">Registrar Entrada de Material</h1>
                <p className="text-slate-400 text-xs mt-0.5">Vincule a movimentação a uma Solicitação de Compra (SC)</p>
              </div>
              <form onSubmit={handleInbound} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <Field label="Selecionar Item">
                  <Select ringColor="emerald" required value={newInbound.itemId}
                    onChange={e => setNewInbound({ ...newInbound, itemId: e.target.value })}>
                    <option value="">— Escolha um item cadastrado —</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>[{i.id}] {i.name}</option>
                    ))}
                  </Select>
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

          {/* ════════════════════════════════
              TAB: SAÍDA
          ════════════════════════════════ */}
          {activeTab === 'outbound' && (
            <div className="max-w-lg mx-auto space-y-5">
              <div>
                <h1 className="text-xl font-bold text-rose-800">Registrar Saída / Consumo</h1>
                <p className="text-slate-400 text-xs mt-0.5">Deduz do saldo atual do estoque</p>
              </div>
              <form onSubmit={handleOutbound} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <Field label="Selecionar Item">
                  <Select ringColor="rose" required value={newOutbound.itemId}
                    onChange={e => setNewOutbound({ ...newOutbound, itemId: e.target.value })}>
                    <option value="">— Escolha um item cadastrado —</option>
                    {items.map(i => {
                      const s = getQty(i.id);
                      return (
                        <option key={i.id} value={i.id}>
                          [{i.id}] {i.name} — disponível: {s} {i.unit}
                        </option>
                      );
                    })}
                  </Select>
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
                  <textarea
                    rows="3"
                    placeholder="Ex: Entregue ao técnico João — manutenção máquina 02."
                    value={newOutbound.notes}
                    onChange={e => setNewOutbound({ ...newOutbound, notes: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition resize-none"
                  />
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
