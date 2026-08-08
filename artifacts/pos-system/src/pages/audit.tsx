import { AdminLayout } from "@/components/admin-layout";
import { useQuery } from "@tanstack/react-query";
import { FileText, Clock } from "lucide-react";

function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}
async function apiGet(url: string) { const r = await fetchAuth(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }

export default function AuditPage() {
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["audit-logs"], queryFn: () => apiGet("/api/audit-logs") });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" />سجل العمليات والرقابة (Audit Log)</h1>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-right p-3 font-semibold">التاريخ والوقت</th>
                  <th className="text-right p-3 font-semibold">المستخدم</th>
                  <th className="text-right p-3 font-semibold">العملية</th>
                  <th className="text-right p-3 font-semibold">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(logs as any[]).map(l => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground flex items-center gap-1 font-mono text-xs"><Clock className="w-3.5 h-3.5" />{new Date(l.created_at).toLocaleString("ar-SA")}</td>
                    <td className="p-3 font-medium">{l.user_name ?? "النظام"}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-semibold">{l.action}</span></td>
                    <td className="p-3 text-muted-foreground">{l.details ?? "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد عمليات مسجلة في السجل بعد</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
