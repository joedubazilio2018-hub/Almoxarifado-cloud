export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
}

/* Quadradinho de check impresso — não é um <input>, é só o desenho do
   quadrado, pra imprimir de forma consistente e ser marcado à caneta
   (ou já vir preenchido quando o status é escolhido no sistema). */
export function PrintCheckbox({ size = 16, checked = false }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center shrink-0 border-2 border-slate-800 align-middle"
    >
      {checked && (
        <span
          style={{ width: size * 0.6, height: size * 0.6 }}
          className="bg-slate-800"
        />
      )}
    </span>
  );
}
