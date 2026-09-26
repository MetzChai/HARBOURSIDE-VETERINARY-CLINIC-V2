export interface PrintOptions {
  title: string;
  bodyHtml: string;
  styles?: string;
}

/**
 * Executes a real physical browser print dialog safely across all browsers (Chrome, Edge, Firefox, Safari).
 * Features:
 * - Ensures colors, background badges, header bars render properly in print (-webkit-print-color-adjust: exact)
 * - Waits for images (logos, barcodes) to finish loading before opening print prompt
 * - Handles popup blocker restrictions using a hidden iframe fallback
 * - Auto-focuses print window and auto-closes temporary popup window after printing
 */
export function printDocument({ title, bodyHtml, styles = "" }: PrintOptions): void {
  if (typeof window === "undefined") return;

  const origin = window.location.origin;

  // Global print styling for high-quality real physical printouts
  const basePrintStyles = `
    * { box-sizing: border-box; }
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      @page {
        size: portrait;
        margin: 12mm;
      }
      .no-print {
        display: none !important;
      }
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 12px;
      line-height: 1.5;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #fee2e2;
      color: #7f1d1d;
      font-weight: bold;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 2px solid #7f1d1d;
    }
    .header-brand img {
      height: 48px;
      width: 48px;
      object-fit: contain;
      border-radius: 6px;
    }
    .header-brand h1 {
      margin: 0;
      font-size: 22px;
      color: #7f1d1d;
    }
    .header-brand h2 {
      margin: 2px 0 0;
      font-size: 14px;
      color: #e5192c;
      font-weight: 600;
    }
    .footer-brand {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
    ${styles}
  `;

  // Fix relative image src (e.g., /logo.png -> http://localhost:3000/logo.png)
  const processedBodyHtml = bodyHtml.replace(
    /src=["']\/(?!\/)([^"']+)["']/g,
    `src="${origin}/$1"`
  );

  const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>${basePrintStyles}</style>
  </head>
  <body>
    ${processedBodyHtml}
  </body>
</html>`;

  // Try opening a print popup window
  const printWin = window.open("", "_blank");

  if (printWin) {
    printWin.document.open();
    printWin.document.write(fullHtml);
    printWin.document.close();

    const doPrint = () => {
      try {
        printWin.focus();
        printWin.print();
        printWin.onafterprint = () => {
          try {
            printWin.close();
          } catch (_) {}
        };
      } catch (e) {
        console.error("Print execution failed:", e);
      }
    };

    // Wait for images to load before calling print dialog
    const images = Array.from(printWin.document.images);
    if (images.length === 0) {
      setTimeout(doPrint, 250);
    } else {
      let loadedCount = 0;
      const onImageFinish = () => {
        loadedCount++;
        if (loadedCount >= images.length) {
          setTimeout(doPrint, 200);
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          onImageFinish();
        } else {
          img.onload = onImageFinish;
          img.onerror = onImageFinish;
        }
      });

      // Safety fallback timeout if image loading hangs
      setTimeout(doPrint, 1200);
    }
  } else {
    // Hidden iframe fallback if popups are blocked by browser
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();

      const doIframePrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Iframe print execution failed:", e);
        } finally {
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (_) {}
          }, 1000);
        }
      };

      const images = Array.from(iframeDoc.images);
      if (images.length === 0) {
        setTimeout(doIframePrint, 250);
      } else {
        let loadedCount = 0;
        const onImageFinish = () => {
          loadedCount++;
          if (loadedCount >= images.length) {
            setTimeout(doIframePrint, 200);
          }
        };

        images.forEach((img) => {
          if (img.complete) {
            onImageFinish();
          } else {
            img.onload = onImageFinish;
            img.onerror = onImageFinish;
          }
        });

        setTimeout(doIframePrint, 1200);
      }
    }
  }
}
