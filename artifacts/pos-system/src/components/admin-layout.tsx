import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLogout, useGetSettings } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import {
  LogOut,
  LayoutDashboard,
  Package,
  Tags,
  Receipt,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  FileText,
  UserCheck,
  RotateCcw,
  Calculator,
  KeyRound,
  Utensils,
  Clock,
  Truck,
  Wallet,
  Coins,
  Building,
  Building2,
  Palette,
  Cpu,
  ShieldCheck,
  Boxes,
  ShoppingBag,
  ChevronDown,
  ChevronLeft,
  Database,
  DollarSign,
  ClipboardList,
  Box,
  ListTodo,
  AlertTriangle,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppIcon } from "./AppLogo";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: settings } = useGetSettings();
  const logoutMutation = useLogout();
  const [location, setLocation] = useLocation();
  const sidebarNavRef = useRef<HTMLDivElement>(null);

  const isDeveloper = user?.role === "developer" || user?.username === "developer";
  const [licenseBlockedReason, setLicenseBlockedReason] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkLicense = async () => {
      try {
        const res = await fetch("/api/license/status");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.blocked && !isDeveloper) {
              setLicenseBlockedReason(data.reason || "توقف الترخيص");
            } else {
              setLicenseBlockedReason(null);
            }
          }
        }
      } catch (e) {}
    };

    checkLicense();
    const interval = setInterval(checkLicense, 8000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [isDeveloper]);

  const [isOmniOpen, setIsOmniOpen] = useState(() => {
    return location.startsWith("/onyx-erp");
  });

  const [isHrOpen, setIsHrOpen] = useState(() => location.startsWith("/hr"));
  const [openHrDept, setOpenHrDept] = useState<string | null>(() => {
    if (location.startsWith("/hr")) {
      return "sys_hr";
    }
    return null;
  });

  const [openSubGroups, setOpenSubGroups] = useState<string[]>(["sales_reports", "reports_tab"]);

  const toggleSubGroup = (subId: string, defaultChildId?: string) => {
    setOpenSubGroups((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
    if (defaultChildId) {
      handleNavigateHr(defaultChildId);
    }
  };

  const handleSidebarScroll = () => {
    if (sidebarNavRef.current) {
      sessionStorage.setItem("admin_sidebar_scroll", String(sidebarNavRef.current.scrollTop));
    }
  };

  useLayoutEffect(() => {
    const savedScroll = sessionStorage.getItem("admin_sidebar_scroll");
    if (savedScroll && sidebarNavRef.current) {
      sidebarNavRef.current.scrollTop = Number(savedScroll);
    }
  });

  useEffect(() => {
    if (location.startsWith("/onyx-erp")) {
      setIsOmniOpen(true);
    }
    if (location.startsWith("/hr")) {
      setIsHrOpen(true);
    }
  }, [location]);

  const getParamFromLoc = (locStr: string, paramName: string) => {
    if (locStr.includes("?")) {
      const search = locStr.substring(locStr.indexOf("?"));
      const params = new URLSearchParams(search);
      if (params.get(paramName)) return params.get(paramName);
    }
    const params = new URLSearchParams(window.location.search);
    return params.get(paramName);
  };

  const currentTab = location.startsWith("/onyx-erp")
    ? (getParamFromLoc(location, "tab") || "branches")
    : null;

  const currentHrView = location.startsWith("/hr")
    ? (getParamFromLoc(location, "view") || getParamFromLoc(location, "tab") || "employees")
    : null;

  const saveScrollState = () => {
    if (sidebarNavRef.current) {
      sessionStorage.setItem("admin_sidebar_scroll", String(sidebarNavRef.current.scrollTop));
    }
  };

  const handleNavigateOmni = (tabId: string) => {
    saveScrollState();
    const targetUrl = `/onyx-erp?tab=${tabId}`;
    setLocation(targetUrl);
    window.history.pushState({}, "", targetUrl);
    window.dispatchEvent(new Event("popstate"));
  };

  const handleNavigateOmniSub = (tabId: string, subId: string) => {
    saveScrollState();
    const targetUrl = `/onyx-erp?tab=${tabId}&sub=${subId}`;
    setLocation(targetUrl);
    window.history.pushState({}, "", targetUrl);
    window.dispatchEvent(new Event("popstate"));
  };

  const handleNavigateOmniSubTask = (tabId: string, subId: string, subTaskId: string) => {
    saveScrollState();
    const targetUrl = `/onyx-erp?tab=${tabId}&sub=${subId}&subTask=${subTaskId}`;
    setLocation(targetUrl);
    window.history.pushState({}, "", targetUrl);
    window.dispatchEvent(new Event("popstate"));
  };

  const handleNavigateHr = (viewId: string) => {
    saveScrollState();
    const targetUrl = `/hr?view=${viewId}`;
    setLocation(targetUrl);
    window.history.pushState({}, "", targetUrl);
    window.dispatchEvent(new Event("popstate"));
  };

  const [openOmniDropdowns, setOpenOmniDropdowns] = useState<Record<string, boolean>>({
    branches: true,
    sessions: true,
    users_list: true,
  });

  const toggleOmniDropdown = (id: string) => {
    setOpenOmniDropdowns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const omniServices = [
    {
      id: "branches",
      name: "1. بيانات الفروع والشركة",
      icon: Building2,
      subItems: [
        { id: "company_and_branch_info", name: "1. بيانات الفرع والشركة والترويسات" },
        { id: "location_and_contact", name: "2. الموقع الجغرافي والـ GPS" },
        { id: "financial_and_tax", name: "3. البيانات المالية والضرائب" },
        { id: "operational_settings", name: "4. إعدادات التشغيل والطابعات" },
        { id: "manager_and_personnel", name: "5. بيانات الإدارة والمسؤولين" },
        { id: "branch_operations", name: "6. عمليات الربط بالمستودعات" },
        { id: "branch_reports_tab", name: "7. تقارير أداء ومبيعات الفرع" },
      ]
    },
    {
      id: "sessions",
      name: "2. الصلاحيات والأمان (RBAC Hub)",
      icon: ShieldCheck,
      subItems: [
        {
          id: "users_list",
          name: "1. إدارة المستخدمين والموظفين",
          nestedSubItems: [
            { id: "all_users", name: "👥 دليل وسجل كادر الموظفين" },
            { id: "add_user", name: "➕ إضافة موظف ومستخدم جديد" },
            { id: "edit_user", name: "✏️ تعديل بيانات وملف المستخدم" },
            { id: "branch_access", name: "🛡️ تخصيص الصلاحيات والأفرع" },
            { id: "print_directory", name: "🖨️ طباعة دليل حسابات الموظفين" },
          ]
        },
        { id: "roles_tree", name: "2. شجرة الصلاحيات والأدوار (RBAC)" },
        { id: "active_sessions", name: "3. الجلسات والأجهزة النشطة" },
        { id: "audit_logs", name: "4. سجل العمليات والرقابة" },
        { id: "security_reports", name: "5. تقارير ومؤشرات الأمان" },
      ]
    },
    { id: "invoices", name: "3. فواتير المبيعات", icon: ShoppingBag },
    { id: "products", name: "4. بطاقة الأصناف", icon: Box },
    { id: "warehouses", name: "5. إدارة المستودعات", icon: Database },
    { id: "currencies", name: "6. أسعار العملات", icon: Coins },
    { id: "pricing", name: "7. تسعير الأصناف", icon: DollarSign },
    { id: "audit", name: "8. سجل الرقابة", icon: ClipboardList },
  ];

  type SubItem = { id: string; name: string; nestedSubItems?: { id: string; name: string }[] };
  type CodeItemDef = { id: string; name: string; subItems?: SubItem[] };

  const hrDepartments: { id: string; name: string; icon: any; items: CodeItemDef[] }[] = [
    {
      id: "sys_hr",
      name: "1. شؤون الموظفين والعمليات",
      icon: Users,
      items: [
        { id: "employees", name: "بيانات الموظفين الأساسية" },
        { id: "allowances_emp", name: "بدلات الموظف الإضافية" },
        { id: "emp_stats", name: "شاشة احصائية الموظفين" },
        { id: "admin_data", name: "بيانات الموظف الإدارية" },
        { id: "blacklist", name: "قائمة الموظفين السوداء" },
        { id: "monthly_absence", name: "الغياب الشهري والدوام" },
        { id: "installments", name: "الأقساط الشهرية للموظفين" },
        { id: "loans", name: "نموذج طلب السلفة والقروض" },
        { id: "temp_loans", name: "إدخال السلف المؤقتة للموظفين" },
        { id: "payroll_posting", name: "الترحيل الشهري لكشف المرتبات" },
        { id: "monthly_closure", name: "شاشة الإغلاق الشهري" },
        { id: "notes", name: "شاشة ملاحظات الأقسام" },
        { id: "tools", name: "مستودع وبيانات الأدوات" },
        { id: "entitlements", name: "المستحقات اليومية والشهرية" },
        { id: "leaves", name: "طلب وإقرار الإجازات" },
        { id: "custodies", name: "العهد وممتلكات العمل" },
        { id: "meals", name: "خصومات وجبات الموظفين" },
        { id: "temp_employees", name: "الموظفون المؤقتون والمستقلون" },
      ]
    },
    {
      id: "coding_sys",
      name: "2. قائمة التكويد والتهيئة",
      icon: ListTodo,
      items: [
        { id: "hr_coding_jobs", name: "1. بيانات الوظائف والمسميات المهنية" },
        { id: "hr_coding_allowances", name: "2. البدلات والاستقطاعات الرسمية" },
        { id: "hr_coding_leaves", name: "3. أنواع وتكويد الإجازات" },
        { id: "hr_coding_penalties", name: "4. الجزاءات والمخالفات الإدارية" },
        { id: "hr_coding_nationalities", name: "5. الجنسيات المعتمدة للتعاقد" },
        { id: "hr_coding_shifts", name: "6. الورديات وساعات الدوام" },
        { id: "hr_coding_overtime", name: "7. أنواع العمل الإضافي" },
        { id: "hr_coding_years", name: "8. السنة والشهور الإدارية" },
        { id: "hr_coding_qualifications", name: "9. المؤهلات والتخصصات الأكاديمية" },
        { id: "hr_coding_experiences", name: "10. الخبرات الوظيفية المطلوبة" },
        { id: "hr_coding_custody_cats", name: "11. أصناف العهد العينية" },
        { id: "hr_coding_tool_cats", name: "12. أصناف وحصر الأدوات" },
        { id: "hr_coding_tool_exits", name: "13. حالة خروج الأدوات والمنقولات" },
        { id: "departments", name: "14. بيانات الإدارات والأقسام" },
      ]
    },
    {
      id: "sales_ops_sys",
      name: "3. عمليات المبيعات والمطابخ",
      icon: Utensils,
      items: [
        { id: "order_vouchers", name: "سندات تحصيل وإرجاع الطلبيات" },
        { id: "kitchen_qty", name: "إدخال وكميات المطابخ" },
        { id: "sales_control", name: "رقابة المبيعات وتأمين الأدوات" },
        { id: "post_sales", name: "ترحيل وإلغاء ترحيل الفواتير" },
      ]
    },
    {
      id: "reports_center",
      name: "4. مسير الرواتب والتقارير",
      icon: FileText,
      items: [
        { id: "salaries", name: "كشف المرتبات والمسحوبات" },
        { id: "attendance", name: "سجل الحضور والانصراف" },
        { id: "overtime", name: "الساعات الإضافية والمكافآت" },
        { id: "penalties", name: "المخالفات والجزاءات" },
        {
          id: "sales_reports",
          name: "تقارير مبيعات ورقابة ومطابخ",
          subItems: [
            { id: "sales_reports_general", name: "1. تقارير المبيعات العامة والضرائب" },
            { id: "sales_reports_cashier", name: "2. تقارير مبيعات الكاشيرات والورديات" },
            { id: "sales_reports_control", name: "3. تقارير رقابية وتعديلات الأسعار" },
            { id: "sales_reports_returns", name: "4. تقارير مرتجع المبيعات والفواتير الملغية" },
            { id: "sales_reports_menu", name: "5. طباعة المنيو وقوائم الأصناف والوجبات" },
            { id: "sales_reports_delegates", name: "6. طباعة الطلبيات وإحصائيات المندوبين" },
            { id: "sales_reports_reservations", name: "7. تقارير حجوزات الصالات والطاولات" },
            { id: "sales_reports_insurance", name: "8. تقارير تأمين الأدوات وحافظات الطعام" },
            { id: "sales_reports_delivery", name: "9. تقارير مبيعات التوصيل والدليفري" },
          ]
        },
        {
          id: "reports_tab",
          name: "مركز تقارير شؤون الموظفين",
          subItems: [
            { id: "hr_reports_statement", name: "1. كشف حساب موظف تفصيلي" },
            { id: "hr_reports_custody", name: "2. سجل العهد للموظفين" },
            { id: "hr_reports_tools", name: "3. حركة دخول وخروج الأدوات" },
            { id: "hr_reports_leaves", name: "4. تقارير الإجازات وتوازنات العطل" },
            { id: "hr_reports_penalties", name: "5. تقارير المخالفات والجزاءات" },
            { id: "hr_reports_notes", name: "6. سجل ملاحظات الأقسام" },
          ]
        },
      ]
    }
  ];

  useEffect(() => {
    if (location.startsWith("/hr") && currentHrView) {
      const foundDept = hrDepartments.find((dept) =>
        dept.items.some(
          (item) =>
            item.id === currentHrView ||
            (item.subItems && item.subItems.some((sub) => sub.id === currentHrView))
        )
      );
      if (foundDept) {
        setOpenHrDept(foundDept.id);
      }
    }
  }, [location, currentHrView]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("pos_token");
        window.location.href = "/login";
      }
    });
  };

  const navGroups = [
    {
      title: "العمليات والمبيعات",
      items: [
        { name: "لوحة القيادة", href: "/dashboard", icon: LayoutDashboard },
        { name: "نقطة البيع (POS)", href: "/pos", icon: Receipt },
        { name: "الطلبات والمبيعات", href: "/orders", icon: ShoppingBag },
        { name: "الصالات والطاولات", href: "/tables", icon: Utensils },
        { name: "الورديات والصندوق", href: "/shifts", icon: Clock },
        { name: "المرتجعات والخزينة", href: "/returns", icon: RotateCcw },
      ]
    },
    {
      title: "المخزون والمشتريات",
      items: [
        { name: "الأصناف والمنتجات", href: "/products", icon: Package },
        { name: "التصنيفات", href: "/categories", icon: Tags },
        { name: "حركة وتكلفة المخزون", href: "/inventory", icon: Boxes },
        { name: "الموردين والمشتريات", href: "/suppliers", icon: Truck },
      ]
    },
    {
      title: "الأنظمة المالية والحسابات",
      items: [
        { name: "المحاسبة والسندات", href: "/accounting", icon: Calculator },
        { name: "إدارة العملاء والذمم", href: "/customers", icon: Users },
        { name: "المصروفات التشغيلية", href: "/expenses", icon: Wallet },
        { name: "العملات وأسعار الصرف", href: "/currencies", icon: Coins },
        { name: "الموارد البشرية والرواتب", href: "/hr", icon: UserCheck },
        { name: "التقارير الشاملة", href: "/reports", icon: BarChart3 },
      ]
    },
    {
      title: "تهيئة النظام والأنظمة المتكاملة",
      badge: "Omni Pro",
      items: [
        { name: "تكامل Omni System Pro", href: "/onyx-erp", icon: Cpu, highlight: true },
        { name: "الفروع والمستودعات", href: "/branches", icon: Building },
        { name: "تصميم الترويسة والشعار", href: "/document-print-settings", icon: Palette },
        { name: "سجل الطباعة والوثائق", href: "/print-log", icon: FileText },
        { name: "سجل الرقابة والعمليات", href: "/audit", icon: ShieldCheck },
        { name: "المستخدمين والصلاحيات", href: "/users", icon: UserCircle },
        ...(isDeveloper ? [{ name: "إدارة التراخيص والتفعيل", href: "/licenses", icon: KeyRound }] : []),
        { name: "إعدادات النظام العامة", href: "/settings", icon: Settings },
      ]
    }
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-l border-sidebar-border shadow-md">
        {/* Top App Header */}
        <div className="h-16 flex items-center justify-between border-b border-sidebar-border px-4 bg-sidebar/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-lg border border-sidebar-border/60 overflow-hidden flex items-center justify-center bg-white p-0.5 shadow-xs shrink-0">
              <AppIcon className="w-full h-full object-contain" />
            </div>
            <div className="overflow-hidden min-w-0">
              <h1 className="text-sm font-black text-sidebar-primary-foreground leading-tight truncate">
                Omni System Pro
              </h1>
              <span className="text-[10px] text-amber-500 font-bold tracking-tight block truncate">
                النظام المتكامل من إتقان سوفت
              </span>
            </div>
          </div>
        </div>
        
        {/* Nav Items Container */}
        <div ref={sidebarNavRef} onScroll={handleSidebarScroll} className="flex-1 py-3 px-2.5 overflow-y-auto space-y-5 scrollbar-thin">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-extrabold text-sidebar-foreground/50 uppercase tracking-wider">
                <span>{group.title}</span>
                {group.badge && (
                  <span className="bg-amber-500/20 text-amber-500 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                    {group.badge}
                  </span>
                )}
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isOmniItem = item.href === "/onyx-erp";
                  const isHrItem = item.href === "/hr";

                  if (isHrItem) {
                    const isHrActive = location.startsWith("/hr");

                    return (
                      <div key={item.href} className="space-y-1">
                        <div
                          onClick={() => {
                            saveScrollState();
                            setIsHrOpen(!isHrOpen);
                            if (!location.startsWith("/hr")) {
                              setLocation("/hr?view=employees");
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-bold cursor-pointer group select-none",
                            isHrActive
                              ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs"
                              : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <Icon className="w-4 h-4 shrink-0 text-blue-400 group-hover:scale-110 transition-transform" />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="bg-blue-500/20 text-blue-400 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                              4 إدارات
                            </span>
                            {isHrOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5 text-blue-400/70" />
                            )}
                          </div>
                        </div>

                        {isHrOpen && (
                          <div className="pr-1.5 my-1 space-y-1 border-r-2 border-blue-500/40 mr-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            {hrDepartments.map((dept) => {
                              const DeptIcon = dept.icon;
                              const isDeptOpen = openHrDept === dept.id;
                              const hasActiveChild = dept.items.some(
                                (child) =>
                                  child.id === currentHrView ||
                                  (child.subItems && child.subItems.some((n) => n.id === currentHrView))
                              );

                              return (
                                <div key={dept.id} className="space-y-0.5">
                                  <div
                                    onClick={() => {
                                      saveScrollState();
                                      setOpenHrDept(isDeptOpen ? null : dept.id);
                                    }}
                                    className={cn(
                                      "flex items-center justify-between px-2 py-1.5 rounded-md transition-all text-[11px] font-extrabold cursor-pointer group/dept select-none",
                                      hasActiveChild
                                        ? "bg-blue-950/80 text-blue-300 border border-blue-800/80"
                                        : "bg-sidebar-accent/30 text-sidebar-foreground/90 hover:bg-sidebar-accent/70"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                      <DeptIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                      <span className="truncate">{dept.name}</span>
                                    </div>
                                    {isDeptOpen ? (
                                      <ChevronDown className="w-3 h-3 text-blue-400 shrink-0" />
                                    ) : (
                                      <ChevronLeft className="w-3 h-3 text-sidebar-foreground/50 shrink-0" />
                                    )}
                                  </div>

                                  {isDeptOpen && (
                                    <div className="pr-2 my-1 space-y-0.5 border-r border-blue-500/30 mr-1.5 animate-in fade-in duration-150">
                                      {dept.items.map((sub) => {
                                        if (sub.subItems) {
                                          const isSubGroupOpen = openSubGroups.includes(sub.id);
                                          const hasNestedActive = sub.subItems.some((n) => n.id === currentHrView);

                                          return (
                                            <div key={sub.id} className="space-y-0.5">
                                              <div
                                                onClick={() => {
                                                  saveScrollState();
                                                  toggleSubGroup(sub.id, sub.subItems![0].id);
                                                }}
                                                className={cn(
                                                  "flex items-center justify-between px-2 py-1 rounded transition-all text-[10px] font-extrabold cursor-pointer group/sub select-none",
                                                  hasNestedActive
                                                    ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                                                    : "hover:bg-sidebar-accent/80 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                                                )}
                                              >
                                                <span className="truncate">{sub.name}</span>
                                                {isSubGroupOpen ? (
                                                  <ChevronDown className="w-3 h-3 text-amber-400 shrink-0" />
                                                ) : (
                                                  <ChevronLeft className="w-3 h-3 text-sidebar-foreground/50 shrink-0" />
                                                )}
                                              </div>

                                              {isSubGroupOpen && (
                                                <div className="pr-2 my-0.5 space-y-0.5 border-r border-amber-500/30 mr-1.5 animate-in fade-in duration-150">
                                                  {sub.subItems.map((nested) => {
                                                    const isNestedActive = isHrActive && currentHrView === nested.id;

                                                    return (
                                                      <div
                                                        key={nested.id}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleNavigateHr(nested.id);
                                                        }}
                                                        className={cn(
                                                          "flex items-center justify-between px-2 py-1 rounded transition-all text-[10px] font-medium cursor-pointer group/nested",
                                                          isNestedActive
                                                            ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                                                            : "hover:bg-sidebar-accent/80 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                                                        )}
                                                      >
                                                        <span className="truncate">{nested.name}</span>
                                                        {isNestedActive && (
                                                          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse shrink-0"></span>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }

                                        const isSubActive = isHrActive && currentHrView === sub.id;

                                        return (
                                          <div
                                            key={sub.id}
                                            onClick={() => handleNavigateHr(sub.id)}
                                            className={cn(
                                              "flex items-center justify-between px-2 py-1 rounded transition-all text-[10px] font-semibold cursor-pointer group/sub",
                                              isSubActive
                                                ? "bg-blue-600 text-white font-bold shadow-xs"
                                                : "hover:bg-sidebar-accent/80 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                                            )}
                                          >
                                            <span className="truncate">{sub.name}</span>
                                            {isSubActive && (
                                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (isOmniItem) {
                    const isOmniActive = location.startsWith("/onyx-erp");

                    return (
                      <div key={item.href} className="space-y-1">
                        <div
                          onClick={() => {
                            setIsOmniOpen(!isOmniOpen);
                            if (!location.startsWith("/onyx-erp")) {
                              setLocation("/onyx-erp?tab=branches");
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-bold cursor-pointer group select-none",
                            isOmniActive
                              ? "bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-xs"
                              : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20"
                          )}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <Icon className="w-4 h-4 shrink-0 text-amber-500 group-hover:scale-110 transition-transform" />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="bg-amber-500/20 text-amber-500 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                              8 إدارات
                            </span>
                            {isOmniOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <ChevronLeft className="w-3.5 h-3.5 text-amber-500/70" />
                            )}
                          </div>
                        </div>

                        {isOmniOpen && (
                          <div className="pr-2.5 my-1 space-y-0.5 border-r-2 border-amber-500/40 mr-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            {omniServices.map((svc) => {
                              const SvcIcon = svc.icon;
                              const isSvcActive = isOmniActive && currentTab === svc.id;

                              return (
                                <div key={svc.id} className="space-y-0.5">
                                  <div
                                    onClick={() => {
                                      handleNavigateOmni(svc.id);
                                      if (svc.subItems) {
                                        toggleOmniDropdown(svc.id);
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all text-[11px] font-semibold cursor-pointer group/sub",
                                      isSvcActive
                                        ? "bg-indigo-600 text-white font-bold shadow-xs"
                                        : "hover:bg-sidebar-accent/80 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <SvcIcon className={cn("w-3.5 h-3.5 shrink-0 transition-transform group-hover/sub:scale-110", isSvcActive ? "text-white" : "text-amber-500/80")} />
                                      <span className="truncate">{svc.name}</span>
                                    </div>
                                    {svc.subItems ? (
                                      <ChevronDown className={cn("w-3 h-3 transition-transform text-amber-400 shrink-0", openOmniDropdowns[svc.id] ? "rotate-180" : "")} />
                                    ) : (
                                      isSvcActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                                      )
                                    )}
                                  </div>

                                  {/* SubItems Dropdown list */}
                                  {svc.subItems && openOmniDropdowns[svc.id] && (
                                    <div className="pr-3.5 my-1 space-y-0.5 border-r-2 border-amber-500/40 mr-2 animate-in fade-in duration-150">
                                      {svc.subItems.map((sub) => {
                                        const defaultSub = svc.id === "branches" ? "company_and_branch_info" : "users_list";
                                        const currentSub = getParamFromLoc(location, "sub") || defaultSub;
                                        const isSubActive = isSvcActive && currentSub === sub.id;

                                        return (
                                          <div key={sub.id} className="space-y-0.5">
                                            <div
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleNavigateOmniSub(svc.id, sub.id);
                                                if (sub.nestedSubItems) {
                                                  toggleOmniDropdown(sub.id);
                                                }
                                              }}
                                              className={cn(
                                                "px-2 py-1 rounded text-[10px] font-medium cursor-pointer transition-colors flex items-center justify-between",
                                                isSubActive
                                                  ? "bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/50"
                                                  : "text-slate-300 hover:text-white hover:bg-white/5"
                                              )}
                                            >
                                              <span className="truncate">{sub.name}</span>
                                              <div className="flex items-center gap-1 shrink-0">
                                                {sub.nestedSubItems ? (
                                                  <ChevronDown className={cn("w-3 h-3 text-amber-400/80 transition-transform", (openOmniDropdowns[sub.id] ?? true) ? "rotate-180" : "")} />
                                                ) : (
                                                  isSubActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Nested SubItems Dropdown */}
                                            {sub.nestedSubItems && (openOmniDropdowns[sub.id] ?? true) && (
                                              <div className="pr-2.5 my-0.5 space-y-0.5 border-r border-amber-400/30 mr-1.5 animate-in fade-in duration-150">
                                                {sub.nestedSubItems.map((nest) => {
                                                  const currentSubTask = getParamFromLoc(location, "subTask") || "all_users";
                                                  const isNestActive = isSubActive && currentSubTask === nest.id;

                                                  return (
                                                    <div
                                                      key={nest.id}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleNavigateOmniSubTask(svc.id, sub.id, nest.id);
                                                      }}
                                                      className={cn(
                                                        "px-2 py-0.5 rounded text-[9.5px] font-medium cursor-pointer transition-colors flex items-center justify-between",
                                                        isNestActive
                                                          ? "bg-amber-400/30 text-amber-200 font-extrabold border border-amber-400/60"
                                                          : "text-slate-300/80 hover:text-white hover:bg-white/10"
                                                      )}
                                                    >
                                                      <span className="truncate">{nest.name}</span>
                                                      {isNestActive && <span className="w-1 h-1 rounded-full bg-amber-300 shrink-0"></span>}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                  
                  return (
                    <Link key={item.href} href={item.href} onClick={saveScrollState}>
                      <div className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer group",
                        isActive 
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs font-bold" 
                          : item.highlight
                          ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 font-bold border border-amber-500/20"
                          : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                      )}>
                        <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70")} />
                        <span className="truncate">{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* User Profile & Logout Section */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar/40 shrink-0">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
              {user?.name ? user.name.charAt(0) : "م"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{user?.name || "مدير النظام"}</p>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{user?.role === 'admin' ? 'مدير النظام المالي' : 'كاشير مبيعات'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors font-bold border border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content View Container */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </main>

      {/* Global License Kill Switch Lock Overlay */}
      {licenseBlockedReason && !isDeveloper && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500/50 text-white rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300 dir-rtl">
            <div className="w-20 h-20 bg-red-500/20 text-red-500 border-2 border-red-500/40 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-10 h-10 animate-bounce" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black rounded-full uppercase tracking-widest">
                توقف النظام بالكامل 🔒
              </span>
              <h2 className="text-2xl font-black text-white pt-2">تم تجميد وإيقاف عمل النظام</h2>
              <p className="text-sm text-slate-200 bg-slate-800/90 p-4 rounded-xl border border-slate-700 leading-relaxed font-semibold">
                {licenseBlockedReason}
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 space-y-1.5 text-right">
              <p className="font-bold flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                تنبيه هام من إدارة النظام (إتقان سوفت):
              </p>
              <p className="text-slate-300 leading-relaxed">
                قام المطور بإضافة أو تعديل فترة الترخيص وحالته بالانتهاء أو التوقف. لا يمكن للعميل أو المستثمر استخدام الشاشات والوظائف إلا بعد قيام المطور بتعديل الترخيص مجدداً.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <button
                onClick={handleLogout}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                تسجيل الدخول بحساب المطور لتحديث الترخيص
              </button>

              <div className="text-xs text-slate-400 font-mono flex items-center justify-center gap-2 pt-1">
                <span>للدعم الفني وتحديث التراخيص:</span>
                <a href="tel:777146387" className="text-amber-400 hover:underline font-bold dir-ltr inline-block">777146387</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

