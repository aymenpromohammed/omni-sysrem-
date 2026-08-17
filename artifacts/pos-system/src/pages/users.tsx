import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useGetUsers, useCreateUser, useUpdateUser, useDeleteUser, getGetUsersQueryKey } from "@workspace/api-client-react";
import type { User, UserInput, UserUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

type FormData = {
  username: string;
  name: string;
  role: "admin" | "accountant" | "cashier";
  password: string;
  active: boolean;
  can_discount: boolean;
};

export default function Users() {
  const { data: users = [], isLoading } = useGetUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormData>({ username: "", name: "", role: "cashier", password: "", active: true, can_discount: false });

  const openAdd = () => {
    setEditing(null);
    setForm({ username: "", name: "", role: "cashier", password: "", active: true, can_discount: false });
    setShowDialog(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    const isPrivileged = u.role === "admin" || u.role === "accountant" || u.role === "developer";
    setForm({
      username: u.username,
      name: u.name,
      role: (u.role === "admin" || u.role === "accountant") ? u.role : "cashier",
      password: "",
      active: u.active,
      can_discount: u.can_discount !== undefined ? Boolean(u.can_discount) : isPrivileged
    });
    setShowDialog(true);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetUsersQueryKey() });

  const handleSave = () => {
    if (!form.username || !form.name || (!editing && !form.password)) return;
    if (editing) {
      const data: UserUpdate = {
        username: form.username,
        name: form.name,
        role: form.role,
        active: form.active,
        can_discount: form.role === "admin" || form.role === "accountant" ? true : form.can_discount,
        password: form.password || null
      };
      updateMutation.mutate({ id: editing.id, data }, {
        onSuccess: () => {
          invalidate();
          setShowDialog(false);
          toast({ title: "تم التحديث بنجاح", description: `تم تحديث بيانات وصلاحيات المستخدم ${form.name}` });
        },
        onError: () => toast({ variant: "destructive", title: "فشل في التحديث" })
      });
    } else {
      const data: UserInput = {
        username: form.username,
        name: form.name,
        role: form.role,
        password: form.password,
        active: form.active,
        can_discount: form.role === "admin" || form.role === "accountant" ? true : form.can_discount
      };
      createMutation.mutate({ data }, {
        onSuccess: () => {
          invalidate();
          setShowDialog(false);
          toast({ title: "تمت الإضافة بنجاح", description: `تم إنشاء المستخدم ${form.name}` });
        },
        onError: () => toast({ variant: "destructive", title: "فشل في الإضافة" })
      });
    }
  };

  const handleDelete = (u: User) => {
    if (!confirm(`حذف المستخدم "${u.name}"؟`)) return;
    deleteMutation.mutate({ id: u.id }, {
      onSuccess: invalidate,
      onError: () => toast({ variant: "destructive", title: "فشل في الحذف" })
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">إدارة المستخدمين والصلاحيات</h1>
            <p className="text-xs text-slate-500 mt-0.5">التحكم في حسابات الكاشير، المدراء، وصلاحيات الخصم في نقطة البيع</p>
          </div>
          <Button onClick={openAdd} className="gap-2 bg-blue-700 hover:bg-blue-800"><Plus className="w-4 h-4" />إضافة مستخدم</Button>
        </div>
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-right p-3 font-semibold">الاسم</th>
                  <th className="text-right p-3 font-semibold">اسم المستخدم</th>
                  <th className="text-right p-3 font-semibold">الدور</th>
                  <th className="text-center p-3 font-semibold">صلاحية الخصم (POS)</th>
                  <th className="text-right p-3 font-semibold">الحالة</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => {
                  const hasDiscountPerm = Boolean(u.can_discount ?? (u.role === "admin" || u.role === "accountant" || u.role === "developer"));
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{u.name}</td>
                      <td className="p-3 font-mono text-muted-foreground">{u.username}</td>
                      <td className="p-3">
                        <Badge variant={u.role === "admin" ? "default" : u.role === "accountant" ? "outline" : "secondary"}>
                          {u.role === "admin" ? "مدير" : u.role === "accountant" ? "محاسب" : u.role === "developer" ? "مطور" : "كاشير"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {hasDiscountPerm ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            مسموح بالخصم
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                            ممنوع (يتطلب إذن)
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant={u.active ? "outline" : "destructive"} className={u.active ? "text-green-600 border-green-600" : ""}>
                          {u.active ? "نشط" : "موقوف"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="تعديل"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(u)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="حذف"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">لا يوجد مستخدمون</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل مستخدم وصلاحياته" : "إضافة مستخدم جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">الاسم الكامل *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="مثال: أحمد محمد" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم المستخدم *</label>
              <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} dir="ltr" placeholder="مثال: cashier1" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">كلمة المرور {editing ? "(اتركها فارغة للإبقاء)" : "*"}</label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">الدور (نوع الحساب)</label>
              <div className="flex gap-2">
                {(["admin", "accountant", "cashier"] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        role: r,
                        can_discount: (r === "admin" || r === "accountant") ? true : form.can_discount
                      });
                    }}
                    className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                      form.role === r
                        ? "bg-blue-700 text-white border-blue-700 shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {r === "admin" ? "مدير نظام" : r === "accountant" ? "محاسب" : "كاشير"}
                  </button>
                ))}
              </div>
            </div>

            {/* صلاحية الخصم للمستخدم */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">صلاحية الخصم في نقطة البيع</p>
                  <p className="text-xs text-slate-500">
                    {form.role === "admin" || form.role === "accountant"
                      ? "مفعّلة تلقائياً للمدراء والمحاسبين"
                      : "السماح لهذا الكاشير بإدخال الخصم على الفواتير بدون طلب إذن المدير"}
                  </p>
                </div>
                <Switch
                  checked={form.role === "admin" || form.role === "accountant" ? true : form.can_discount}
                  disabled={form.role === "admin" || form.role === "accountant"}
                  onCheckedChange={v => setForm({ ...form, can_discount: v })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <label className="text-sm font-medium">حالة الحساب</label>
                <p className="text-xs text-slate-500">الحسابات الموقوفة لا يمكنها تسجيل الدخول للنظام</p>
              </div>
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={!form.username || !form.name} className="bg-blue-700 hover:bg-blue-800">
              حفظ البيانات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
