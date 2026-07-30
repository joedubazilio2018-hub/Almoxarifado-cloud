import React, { useState, useEffect } from 'react';

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
  getReformas:  () => db('reformas?order=created_at.desc'),
  insertReforma: (row) => db('reformas', { method: 'POST', body: JSON.stringify(row) }),

  insertModelos:    (rows) => db('reforma_modelos', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
  insertRodas:      (rows) => db('reforma_rodas', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
  insertProtetores: (rows) => db('reforma_protetores', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows) }),
};

/* ─────────────────────────────────────────────
   LISTAS FIXAS DO CHECKLIST
───────────────────────────────────────────── */
const MODELOS_OPCOES = ['101', '102', '103', '107', '110/111', '114/115', '118/119', 'Outro'];
const RODA_TAMANHOS   = ['4"', '5"', '6"', '6" carga'];
const RODA_MATERIAIS  = ['PU', 'PVC'];
const PROTETOR_TIPOS  = ['PP', 'PVC', 'JUMBOCAR', 'CUNHA', 'TUBO FREE', 'TUBO B3', 'TUBO ID', '16X30', 'ANATÔMICO', 'ANATÔMICO (OBLONGO)'];

const STATUS_LABEL = {
  recebido:      'Recebido',
  em_producao:   'Em produção',
  em_separacao:  'Em separação',
  finalizado:    'Finalizado',
};

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
  tipo_perfil: '',
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

  const loadReformas = async () => {
    setLoading(true);
    try {
      const rows = await reformasApi.getReformas();
      setReformas(rows);
    } catch {
      setMsg({ text: 'Erro ao carregar reformas.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReformas(); }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  /* ── Linhas dinâmicas ── */
  const addModelo    = () => setModelos(prev => [...prev, { modelo: MODELOS_OPCOES[0], quantidade: '' }]);
  const addRoda       = () => setRodas(prev => [...prev, { tamanho: RODA_TAMANHOS[0], material: RODA_MATERIAIS[0], quantidade: '' }]);
  const addProtetor   = () => setProtetores(prev => [...prev, { tipo: PROTETOR_TIPOS[0], quantidade: '' }]);

  const updateRow = (setter, idx, field, value) => {
    setter(prev => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };
  const removeRow = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setForm(emptyForm());
    setModelos([]);
    setRodas([]);
    setProtetores([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reforma) {
      setMsg({ text: 'Preencha ao menos o número da Reforma.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantidade: form.quantidade ? Number(form.quantidade) : null,
        tipo_perfil: form.tipo_perfil || null,
        status: 'recebido',
      };
      const [novaReforma] = await reformasApi.insertReforma(payload);
