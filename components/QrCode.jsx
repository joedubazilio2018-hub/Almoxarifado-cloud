'use client';
import React, { useMemo } from 'react';
import QRCode from 'qrcode';

/* QR code desenhado em SVG (vetorial: imprime nítido em qualquer impressora e
   não depende de "imprimir cores de fundo"). O texto do QR de uma caixa é
   "CX:" + id da caixa (ex: CX:K7M4QX). A quantidade NÃO vai dentro do QR:
   ela fica guardada na tabela "caixas" do Supabase. */
export default function QrCode({ value, size = '3.6cm' }) {
  const dados = useMemo(() => {
    const texto = String(value || '').trim();
    if (!texto) return null;
    try {
      // "Q" = boa margem de correção, aguenta uma mancha ou dobra na etiqueta
      const qr = QRCode.create(texto, { errorCorrectionLevel: 'Q' });
      const n = qr.modules.size;
      const bits = qr.modules.data;
      let d = '';
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (bits[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
        }
      }
      return { n, d };
    } catch {
      return null;
    }
  }, [value]);

  if (!dados) return <span className="text-xs text-red-500">QR inválido</span>;

  // 4 módulos de margem branca em volta (o leitor precisa dessa "zona de silêncio")
  const margem = 4;
  const total = dados.n + margem * 2;
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      style={{ width: size, height: size }}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={dados.d} transform={`translate(${margem} ${margem})`} fill="#000000" />
    </svg>
  );
}
