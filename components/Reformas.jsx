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
      const reformaId = novaReforma.id;

      const modelosRows = modelos
        .filter(m => m.modelo && m.quantidade)
        .map(m => ({ reforma_id: reformaId, modelo: m.modelo, quantidade: Number(m.quantidade) }));
      const rodasRows = rodas
        .filter(r => r.tamanho && r.quantidade)
        .map(r => ({ reforma_id: reformaId, tamanho: r.tamanho, material: r.material || null, quantidade: Number(r.quantidade) }));
      const protetoresRows = protetores
        .filter(p => p.tipo && p.quantidade)
        .map(p => ({ reforma_id: reformaId, tipo: p.tipo, quantidade: Number(p.quantidade) }));

      await Promise.all([
        modelosRows.length    ? reformasApi.insertModelos(modelosRows)       : Promise.resolve(),
        rodasRows.length      ? reformasApi.insertRodas(rodasRows)           : Promise.resolve(),
        protetoresRows.length ? reformasApi.insertProtetores(protetoresRows) : Promise.resolve(),
      ]);

      setMsg({ text: `Reforma "${payload.reforma}" registrada!`, type: 'success' });
      resetForm();
      await loadReformas();
    } catch (err) {
      console.error('❌ Erro ao salvar reforma:', err);
      setMsg({ text: 'Erro ao salvar reforma.', type: 'error' });
    } finally {
      setSaving(false);
    }
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
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Nova Reforma — preencha tudo que já souber</p>

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

        <Field label="Tipo de perfil">
          <Select value={form.tipo_perfil} onChange={e => setForm({ ...form, tipo_perfil: e.target.value })}>
            <option value="">— Selecione —</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </Select>
        </Field>

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

        <button type="submit" disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all text-sm tracking-wide shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Salvando...' : 'Registrar Reforma'}
        </button>
      </form>

      {/* Lista simples — só pra confirmar que salvou (Passo 1; cards bonitos entram no Passo 2) */}
      <div>
        <h2 className="text-sm font-bold text-slate-600 mb-3">Reformas registradas ({reformas.length})</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : reformas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Nenhuma reforma registrada ainda.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {reformas.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span>
                  <span className="font-semibold text-slate-800">{r.reforma}</span>
                  {r.cliente ? ` — ${r.cliente}` : ''}
                  {r.quantidade ? ` · Qtd: ${r.quantidade}` : ''}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{STATUS_LABEL[r.status] || r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
