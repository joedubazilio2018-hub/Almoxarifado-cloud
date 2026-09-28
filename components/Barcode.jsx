'use client';
import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

/* Código de barras Code 128 desenhado em SVG (imprime nítido em qualquer
   impressora e não depende de "imprimir cores de fundo"). O valor é o próprio
   código do item (o "id" dele no estoque). Code 128 só aceita caracteres ASCII
   simples: se o código tiver acento ou símbolo estranho, mostra o texto puro. */
export default function Barcode({ value, height = 38, showText = true }) {
  const ref = useRef(null);
  const [erro, setErro] = useState(false);
  const code = String(value || '').trim();

  useEffect(() => {
    if (!ref.current || !code) return;
    try {
      JsBarcode(ref.current, code, {
        format: 'CODE128',
        width: 1.8,
        height,
        displayValue: false,
        margin: 0,
        lineColor: '#000000',
      });
      setErro(false);
    } catch {
      setErro(true);
    }
  }, [code, height]);

  if (!code) return null;
  if (erro) {
    return <span className="text-xs text-red-500">Código inválido para barras: {code}</span>;
  }
  return (
    <span className="inline-flex flex-col items-start">
      <svg ref={ref} style={{ maxWidth: '100%', height }} />
      {showText && <span className="font-mono text-[10px] tracking-wider text-slate-700 leading-none mt-0.5">{code}</span>}
    </span>
  );
}
