import React, { useEffect, useRef, useState } from 'react';
import { renderBrandedFormQR } from '@/lib/brandedFormQR';

/**
 * The QR code for one way to pay or join.
 *
 * These already existed, but only inside the Command Centre, where a visitor
 * can never see them — the club printed them for the front desk and anyone not
 * standing at the front desk had no way to find one. The same codes belong on
 * a public page: to be scanned off a screen, photographed, or sent to somebody
 * who is deciding at home.
 *
 * A QR that fails to draw is silently dropped rather than left as an empty
 * frame: every one of these sits beside a link that does the same job.
 */
export default function PassQRCode({ url, label }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let current = true;
    setReady(false);
    const offscreen = document.createElement('canvas');
    renderBrandedFormQR(offscreen, url)
      .then(rendered => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!current || !canvas || !context) return;
        canvas.width = rendered.width;
        canvas.height = rendered.height;
        context.drawImage(rendered, 0, 0);
        setReady(true);
      })
      .catch(() => {});
    return () => { current = false; };
  }, [url]);

  return (
    <canvas ref={canvasRef} hidden={!ready}
      role="img" aria-label={`QR code for ${label}`}
      className="h-auto w-full max-w-[9rem] border border-xert-steel/20 bg-white p-1" />
  );
}
