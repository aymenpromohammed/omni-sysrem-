import React, { useState } from 'react';
import { useQZTray } from '../hooks/useQZTray';
import { Printer, CheckCircle2, AlertTriangle, RefreshCw, Server, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

export function QZTrayWidget() {
  const { connected, connecting, version, printers, error, connect, disconnect, printData } = useQZTray();
  const [testPrinter, setTestPrinter] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestPrint = async () => {
    setTesting(true);
    setTestResult(null);
    const printer = testPrinter || printers[0] || null;
    const res = await printData(
      printer,
      `\x1B\x40\x1B\x61\x01================================\n   OMNI SYSTEM PRO - QZ TRAY\n================================\nاختبار الطباعة عبر QZ Tray ناجح!\nالطابعة: ${printer || "الافتراضية"}\nالتاريخ: ${new Date().toLocaleString('ar-SA')}\n================================\n\n\n\x1B\x69`,
      1,
      true
    );
    setTesting(false);
    if (res.success) {
      setTestResult("✅ تم إرسال صفحة الاختبار بنجاح إلى الطابعة عبر QZ Tray!");
    } else {
      setTestResult(`❌ فشل الاختبار: ${res.error}`);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-xl space-y-4" dir="rtl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-3.5 h-3.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : connecting ? 'bg-amber-500 animate-spin' : 'bg-red-500'}`} />
          <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
            <Printer size={16} className="text-emerald-400" />
            <span>نظام طباعة QZ Tray الحراري</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <Wifi size={12} />
              <span>متصل (v{version || '3.x'})</span>
            </span>
          ) : (
            <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <WifiOff size={12} />
              <span>غير متصل</span>
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-300 space-y-2">
        <p className="leading-relaxed">
          نظام QZ Tray يربط تطبيق الكاشير بـ <strong className="text-emerald-400">الطابعات الحرارية المحلية مباشرة (USB / Network / Bluetooth)</strong> دون مشاكل المتصفح أو تداخل أوامر الطباعة، وبدون أي توقف للنظام.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl text-red-300 text-[11px] flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">تنبيه اتصال QZ Tray:</div>
                <div>{error}</div>
              </div>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-red-500/20 text-[11px] text-slate-300 space-y-1 mt-1">
              <div className="font-bold text-amber-300">💡 حل مشكلة "غير متصل" مع الطابعة المتصلة:</div>
              <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-300">
                <li>تأكد من تشغيل تطبيق <strong className="text-white">QZ Tray</strong> على جهازك (يظهر بجوار ساعة ويندوز).</li>
                <li>بسبب سياسة أمان المتصفح (HTTPS)، يرجى فتح هذا الرابط مرة واحدة فقط: <a href="https://localhost:8182" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-bold">https://localhost:8182</a> واضغط Advanced ثم Proceed لتجاوز تحذير الشهادة.</li>
                <li>ثم اضغط زر "إعادة محاولة الاتصال" أدناه.</li>
              </ol>
            </div>
          </div>
        )}

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>الطابعات المتاحة على الجهاز ({printers.length}):</span>
            <button 
              onClick={() => connect()} 
              disabled={connecting}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-bold"
            >
              <RefreshCw size={12} className={connecting ? "animate-spin" : ""} />
              <span>تحديث القائمة</span>
            </button>
          </div>

          {printers.length > 0 ? (
            <div className="flex items-center gap-2">
              <select 
                value={testPrinter} 
                onChange={e => setTestPrinter(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
              >
                <option value="">-- اختر طابعة الاختبار الافتراضية --</option>
                {printers.map((p, idx) => (
                  <option key={idx} value={p}>{p}</option>
                ))}
              </select>
              <button
                onClick={handleTestPrint}
                disabled={testing}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Printer size={14} />
                <span>{testing ? "جاري الطباعة..." : "اختبار الطباعة"}</span>
              </button>
            </div>
          ) : (
            <div className="text-amber-400 text-[11px] py-1">
              ⚠️ لم يتم رصد طابعات عبر QZ Tray. تأكد من تشغيل QZ Tray وتثبيت الطابعات.
            </div>
          )}

          {testResult && (
            <div className="text-[11px] p-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 font-bold">
              {testResult}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck size={13} className="text-emerald-400" />
          <span>تدفق آمن: POS React ➔ QZ Tray ➔ الطابعة الحرارية</span>
        </span>
        {!connected && (
          <button 
            onClick={() => connect()} 
            className="text-emerald-400 underline font-bold cursor-pointer hover:text-emerald-300"
          >
            إعادة محاولة الاتصال
          </button>
        )}
      </div>
    </div>
  );
}
