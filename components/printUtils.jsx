export function fmtDate(iso) {
  if (!iso) return '—';

  // Datas no formato "AAAA-MM-DD" (vindas de <input type="date">) não podem
  // passar por `new Date(iso)` direto: o JS interpreta isso como meia-noite
  // em UTC, e ao converter pra horário local (Brasil, UTC-3) o dia "volta"
  // pro dia anterior. Por isso montamos a data manualmente, em horário local.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) {
    const [, y, m, d] = match;
    const local = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(local) ? '—' : local.toLocaleDateString('pt-BR');
  }

  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
}

/* Quadradinho de check impresso — não é um <input>, é só o desenho do
   quadrado, pra imprimir de forma consistente e ser marcado à caneta
   (ou já vir preenchido quando o status é escolhido no sistema).
   Usa um "X" de texto em vez de quadrado preenchido (background-color)
   porque a maioria dos navegadores não imprime cor de fundo por padrão
   — só cor de texto/borda —, então o preenchimento sumia no papel. */
export function PrintCheckbox({ size = 16, checked = false }) {
  return (
    <span
      style={{ width: size, height: size, lineHeight: `${size}px`, fontSize: size * 0.85 }}
      className="relative inline-flex items-center justify-center shrink-0 border-2 border-slate-800 align-middle font-bold text-slate-900"
    >
      {checked ? 'X' : ''}
    </span>
  );
}
