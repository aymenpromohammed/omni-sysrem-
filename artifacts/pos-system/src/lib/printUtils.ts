export function printGenericDocument(title: string, data: any, settings: any) {
  const s = settings || {};
  const accentColor = s.accentColor || "#1e293b";
  const bizName = s.companyName || "OmniSystem Pro";
  const subtitle = s.companySubtitle || "";
  const logo = (s.printLogo !== "false" && s.logoUrl) ? `<img src="${s.logoUrl}" style="max-height:80px;object-fit:contain;" alt="Logo" />` : "";
  
  let contentHtml = "";

  if (data) {
    if (data.supplier && data.invoices) {
      // Specialized layout for Supplier Statement
      contentHtml += `
        <div style="margin-bottom:20px; padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">
          <table style="width:100%; font-size:12px;">
            <tr>
              <td><strong>اسم المورد:</strong> ${data.supplier.name}</td>
              <td><strong>كود المورد:</strong> ${data.supplier.code || '---'}</td>
              <td><strong>الهاتف:</strong> ${data.supplier.phone || '---'}</td>
              <td><strong>الرصيد الحالي:</strong> <span style="color:${data.supplier.balance > 0 ? '#16a34a' : data.supplier.balance < 0 ? '#dc2626' : '#000'}; font-weight:bold; font-size:14px;" dir="ltr">${Number(data.supplier.balance).toFixed(2)} ر.س</span></td>
            </tr>
          </table>
        </div>
        <h3 style="color:${accentColor}; border-bottom:2px solid ${accentColor}; padding-bottom:5px; margin-bottom:15px;">حركة الفواتير</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>تاريخ الفاتورة</th>
              <th>رقم الفاتورة</th>
              <th>المبلغ</th>
              <th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices.length > 0 ? data.invoices.map((inv: any) => `
              <tr>
                <td>${new Date(inv.invoice_date || inv.created_at).toLocaleDateString('ar-SA')}</td>
                <td>${inv.invoice_number || inv.id}</td>
                <td style="font-weight:bold" dir="ltr">${Number(inv.total).toFixed(2)}</td>
                <td>${inv.notes || '---'}</td>
              </tr>
            `).join('') : `<tr><td colspan="4" style="text-align:center;">لا توجد فواتير</td></tr>`}
          </tbody>
        </table>
      `;
    } else {
      // Generic Layout for anything else (like Purchase Orders, Receipts, etc)
      contentHtml += `<div style="margin-bottom:20px; padding:15px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">`;
      
      const tableRows: string[] = [];
      const arraysToRender: {title: string, items: any[]}[] = [];

      Object.entries(data).forEach(([key, value]) => {
        // Exclude system keys
        if (key === 'id' || key === 'created_at' || key === 'updated_at') return;

        if (Array.isArray(value)) {
          arraysToRender.push({ title: key, items: value });
        } else if (typeof value === 'object' && value !== null) {
          tableRows.push(`<tr><td style="font-weight:bold; width:150px;">${key}</td><td><pre style="margin:0;font-family:inherit;">${JSON.stringify(value)}</pre></td></tr>`);
        } else {
          tableRows.push(`<tr><td style="font-weight:bold; width:150px;">${key}</td><td>${value}</td></tr>`);
        }
      });

      if (tableRows.length > 0) {
        contentHtml += `<table style="width:100%; font-size:12px; line-height:2;"><tbody>${tableRows.join('')}</tbody></table>`;
      }
      contentHtml += `</div>`;

      // Render Arrays as Tables
      arraysToRender.forEach(arr => {
        if (arr.items.length === 0) return;
        contentHtml += `<h3 style="color:${accentColor}; border-bottom:2px solid ${accentColor}; padding-bottom:5px; margin-bottom:15px;">${arr.title}</h3>`;
        contentHtml += `<table class="data-table"><thead><tr>`;
        const headers = Object.keys(arr.items[0] || {}).filter(k => k !== 'id' && !k.endsWith('_id'));
        headers.forEach(h => {
          contentHtml += `<th>${h}</th>`;
        });
        contentHtml += `</tr></thead><tbody>`;
        arr.items.forEach((item: any) => {
          contentHtml += `<tr>`;
          headers.forEach(h => {
            const v = item[h];
            contentHtml += `<td>${typeof v === 'object' ? JSON.stringify(v) : v}</td>`;
          });
          contentHtml += `</tr>`;
        });
        contentHtml += `</tbody></table>`;
      });
    }
  }

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
    body { font-family: 'Cairo', sans-serif; color: #000; margin: 0; padding: 30px; font-size: 13px; line-height: 1.6; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accentColor}; padding-bottom: 20px; margin-bottom: 30px; }
    .header-right { text-align: right; flex: 1; }
    .header-center { text-align: center; flex: 1; }
    .header-left { text-align: left; flex: 1; }
    .biz-name { font-weight: 900; font-size: 24px; color: ${accentColor}; margin-bottom: 5px; }
    .biz-sub { font-weight: 700; font-size: 14px; color: #475569; }
    .doc-title { font-size: 18px; font-weight: 900; background: ${accentColor}; color: #fff; padding: 6px 24px; border-radius: 20px; display: inline-block; margin-top: 10px; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
    .data-table th { background-color: #f8fafc; color: #0f172a; font-weight: 900; }
    .footer { display: flex; justify-content: space-between; border-top: 2px solid ${accentColor}; padding-top: 20px; margin-top: 50px; font-weight: bold; font-size: 12px; color: #475569; }
    .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; }
    .sig-box { width: 25%; }
    .sig-line { border-top: 1px solid #000; padding-top: 5px; font-weight: bold; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-right">
      <div class="biz-name">${bizName}</div>
      <div class="biz-sub">${subtitle}</div>
    </div>
    <div class="header-center">
      ${logo}
      <br/>
      <div class="doc-title">${title}</div>
    </div>
    <div class="header-left">
      <div style="font-weight:bold;">تاريخ الإصدار:</div>
      <div>${new Date().toLocaleDateString('ar-SA')}</div>
    </div>
  </div>

  <div style="text-align:center; font-weight:bold; font-size:16px; margin-bottom:30px; color:#334155;">
    ${title.includes('مورد') || title.includes('عميل') ? (s.customerHeaderText || '') : (s.reportHeaderText || '')}
  </div>

  ${contentHtml}

  <div class="signatures">
    <div class="sig-box"><div class="sig-line">توقيع المستلم / المعتمد</div></div>
    <div class="sig-box"><div class="sig-line">الختم الرسمي</div></div>
    <div class="sig-box"><div class="sig-line">توقيع الإدارة / المحاسب</div></div>
  </div>

  <div class="footer">
    <div>${s.reportFooterText || 'تمت الطباعة بواسطة OmniSystem Pro'}</div>
    <div>${s.voucherFooterText || ''}</div>
  </div>
</body>
</html>
  `;

  const printWin = window.open("", "_blank");
  if (!printWin) return;
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
  }, 600);
}
