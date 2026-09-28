'use client';
import React, { useEffect, useRef, useState } from 'react';

/* Leitor de código de barras / QR pela câmera do celular.
   Abre a câmera traseira, lê UM código e chama onScan(texto). Quem chama
   fecha o leitor. Precisa de HTTPS (a Vercel já entrega) e da permissão de câmera. */
export default function BarcodeScanner({ onScan, onClose }) {
  const [erro, setErro] = useState('');
  const [iniciando, setIniciando] = useState(true);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan; // sempre a versão mais nova (evita closure velha)

  useEffect(() => {
    let cancelado = false;
    let lido = false;
    let scanner = null;
    let rodando = false;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
        if (cancelado) return;
        scanner = new Html5Qrcode('leitor-codigo', {
          verbose: false,
          formatsToSupport: [F.CODE_128, F.CODE_39, F.EAN_13, F.EAN_8, F.QR_CODE],
          useBarCodeDetectorIfSupported: true, // usa o leitor nativo do Chrome/Android quando existe
        });
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            // área de leitura larga e baixa: melhor pra código de barras linear
            qrbox: (w, h) => ({ width: Math.floor(w * 0.9), height: Math.floor(Math.min(h * 0.5, 180)) }),
          },
          (texto) => {
            if (lido) return;
            lido = true;
            if (navigator.vibrate) navigator.vibrate(80);
            onScanRef.current(texto);
          },
          () => {} // erro de "não achou código neste frame" — normal, ignora
        );
        rodando = true;
        if (cancelado) {
          await scanner.stop().catch(() => {});
          return;
        }
        setIniciando(false);
      } catch (e) {
        if (cancelado) return;
        const msg = String(e?.message || e || '');
        if (/permission|denied|notallowed/i.test(msg)) {
          setErro('Sem permissão de câmera. Libere a câmera para este site nas configurações do navegador e tente de novo.');
        } else if (/notfound|no camera|requested device/i.test(msg)) {
          setErro('Nenhuma câmera encontrada neste aparelho.');
        } else {
          setErro('Não consegui abrir a câmera. Confira se o site está em HTTPS e se a câmera não está em uso por outro app.');
        }
        setIniciando(false);
      }
    })();

    return () => {
      cancelado = true;
      if (scanner && rodando) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="text-sm font-bold text-slate-700">📷 Aponte para o código do item</p>
          <button type="button" onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-red-500 px-2 py-1">Fechar ✕</button>
        </div>
        <div className="p-3">
          <div id="leitor-codigo" className="w-full min-h-[240px] bg-slate-100 rounded-lg overflow-hidden" />
          {iniciando && !erro && <p className="text-xs text-slate-400 text-center mt-2">Abrindo câmera...</p>}
          {erro && <p className="text-xs text-red-600 font-semibold mt-2">{erro}</p>}
          {!erro && !iniciando && (
            <p className="text-[11px] text-slate-400 text-center mt-2">Deixe o código inteiro dentro da faixa, com boa luz e sem reflexo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
