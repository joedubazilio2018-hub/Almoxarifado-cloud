'use client';
import React, { useEffect, useRef, useState } from 'react';

/* Leitor de código de barras / QR pela câmera do celular.
   Abre a câmera traseira e lê códigos:
   - modo normal: lê UM código, chama onScan(texto) e quem chama fecha o leitor;
   - modo contínuo (continuous): continua aberto depois de cada leitura, esperando
     ~1,5 s antes de aceitar o próximo (evita ler a mesma caixa duas vezes seguidas).
   "feedback" é um texto que quem chama pode mostrar embaixo (ex: "Lido: Protetor — 87 un.").
   Precisa de HTTPS (a Vercel já entrega) e da permissão de câmera. */
export default function BarcodeScanner({ onScan, onClose, continuous = false, feedback = '', title = '📷 Aponte para o código de barras ou QR' }) {
  const [erro, setErro] = useState('');
  const [iniciando, setIniciando] = useState(true);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan; // sempre a versão mais nova (evita closure velha)
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

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
            // área de leitura larga, mas alta o bastante pra caber um QR inteiro
            qrbox: (w, h) => ({
              width: Math.floor(w * 0.85),
              height: Math.floor(Math.min(h * 0.75, w * 0.7)),
            }),
          },
          (texto) => {
            if (lido) return;
            lido = true;
            if (navigator.vibrate) navigator.vibrate(80);
            onScanRef.current(texto);
            if (continuousRef.current) {
              setTimeout(() => { lido = false; }, 1500); // libera a próxima leitura
            }
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
          <p className="text-sm font-bold text-slate-700">{title}</p>
          <button type="button" onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-red-500 px-2 py-1">
            {continuous ? 'Concluir ✓' : 'Fechar ✕'}
          </button>
        </div>
        <div className="p-3">
          <div id="leitor-codigo" className="w-full min-h-[240px] bg-slate-100 rounded-lg overflow-hidden" />
          {iniciando && !erro && <p className="text-xs text-slate-400 text-center mt-2">Abrindo câmera...</p>}
          {erro && <p className="text-xs text-red-600 font-semibold mt-2">{erro}</p>}
          {feedback && (
            <p className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-2 text-center">{feedback}</p>
          )}
          {!erro && !iniciando && !feedback && (
            <p className="text-[11px] text-slate-400 text-center mt-2">Deixe o código inteiro dentro da área, com boa luz e sem reflexo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
