import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Search,
  Receipt,
  Cpu,
  UserCheck,
  Calculator,
  ShieldCheck,
  Settings,
  HelpCircle,
  CheckCircle2,
  Printer,
  ChevronLeft,
  KeyRound,
  FileText,
  Boxes,
  Users,
  Building,
  Sparkles,
} from "lucide-react";

export default function SystemGuidePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("pos");

  const guideSections = [
    {
      id: "pos",
      title: "1. دليل كاشير ونقطة البيع (POS)",
      icon: Receipt,
      color: "bg-blue-500",
      description: "إجراءات المبيعات اليومية، تعليق الفواتير، الورديات وتسليم الخزينة.",
      topics: [
        {
          title: "فتح الوردية وإدخال النقدية الافتتاحية",
          steps: [
            "من القائمة الجانبية اختر 'نقطة البيع (POS)' أو 'الورديات والصندوق'.",
            "إذا لم تكن هناك وردية مفتوحة، سيطلب منك النظام إدخال الرصيد الافتتاحي بالصندوق (العُهدة النقود الافتتاحية).",
            "قم بتأكيد المبلغ واضغط على 'فتح الوردية الآن' لبدء استقبال حركات البيع."
          ]
        },
        {
          title: "إدراج المنتجات وإصدار الفواتير",
          steps: [
            "قم بمسح باركود المنتج عبر قارئ الباركود أو ابحث باسم المنتج أو اختر من التصنيفات السريعة.",
            "اضغط على الصنف لزيادة الكمية، أو استخدم زر تعديل الكمية والسعر في القائمة.",
            "اختر العميل (افتراضي: عميل نقدي) أو حدد عميل آجل مسجل بالنظام."
          ]
        },
        {
          title: "إتمام عملية الدفع وتعليق الفواتير",
          steps: [
            "اختر طريقة الدفع: كاش (نقداً)، شبكة (مدى/بطاقة)، أو دفع مختلط.",
            "في حالة الفواتير غير المكتملة، اضغط على 'تعليق الطلب' للرجوع إليه لاحقاً من قائمة الفواتير المعلقة.",
            "بعد إتمام الدفع يتم إصدار الفاتورة فوراً وطباعتها بحسب إعدادات الطابعة الافتراضية."
          ]
        },
        {
          title: "إغلاق الوردية وتسليم النقدية",
          steps: [
            "من شاشة الورديات، اختر 'إغلاق الوردية'.",
            "أدخل المبلغ النقدي الفعلي الموجود بالخزينة بالإضافة إلى مبالغ الشبكة.",
            "يقوم النظام بمطابقة المبيعات مع المبالغ المدخلة واستخراج تقرير العجز أو الزيادة فوراً."
          ]
        }
      ]
    },
    {
      id: "omni_erp",
      title: "2. نظام Omni System Pro (8 إدارات)",
      icon: Cpu,
      color: "bg-amber-500",
      description: "إدارة الفروع، شجرة الصلاحيات RBAC، الجلسات، والمستودعات.",
      topics: [
        {
          title: "إدارة الفروع والمستودعات والتحويلات",
          steps: [
            "انتقل لـ 'تكامل Omni System Pro' ثم اختر '1. معلومات الشركة والأفرع'.",
            "يمكنك إضافة فرع جديد أو مخزن تجميعي وتحديد الموظف المسؤول والبريد الإلكتروني.",
            "استخدم قسم 'المستودعات والتحويلات' لنقل الأصناف بين الفروع مع تتبع أرقام الشحنات."
          ]
        },
        {
          title: "إدارة الصلاحيات والأمان (RBAC Hub)",
          steps: [
            "من قسم RBAC Hub اختر '1. إدارة المستخدمين والموظفين'.",
            "تصفح القائمة المنسدلة للتعامل مع المهام الفرعية: دليل الموظفين، إضافة موظف جديد، تعديل ملف المستخدم، أو تخصيص الصلاحيات والأفرع.",
            "حدد الدور الأمني (مدير نظام، محاسب، كاشير، مشرف فرع) لمنح الوصول المحدد لكل شاشة."
          ]
        },
        {
          title: "إدارة الجلسات والأجهزة النشطة (Active Sessions)",
          steps: [
            "يتيح قسم الجلسات النشطة مراقبة جميع الأجهزة والمصفحات المتصلة بالنظام حالياً.",
            "يمكن لمدير النظام أو المطور إنهاء جلسة أي مستخدم بضغطة زر لحماية البيانات."
          ]
        },
        {
          title: "سجل العمليات والرقابة (Audit Trail)",
          steps: [
            "يسجل النظام تلقائياً كل عملية إضافة، تعديل، إلغاء، أو تغيير كلمة مرور مع توقيت العملية واسم المستخدم والجهاز."
          ]
        }
      ]
    },
    {
      id: "hr",
      title: "3. شؤون الموظفين والرواتب (HR System)",
      icon: UserCheck,
      color: "bg-indigo-500",
      description: "الملفات الشخصية، مسير الرواتب، الغياب، السلف والجزاءات.",
      topics: [
        {
          title: "إضافة ملف موظف جديد وتخصيص البدلات",
          steps: [
            "اختر 'الموارد البشرية والرواتب' ثم 'بيانات الموظفين الأساسية'.",
            "أدخل البيانات الشخصية، الوظيفة، القسم، والراتب الأساسي.",
            "حدد البدلات السكنية والنقل والمكافآت الدورية من شاشة البدلات."
          ]
        },
        {
          title: "تسجيل السلف، الأقساط والجزاءات",
          steps: [
            "من قسم المعاملات المالية للموظفين، اختر 'نموذج طلب السلفة والقروض'.",
            "حدد قيمة السلفة وقسط الخصم الشهري، ليتم احتسابها تلقائياً عند استخراج مسير الرواتب.",
            "يمكن تسجيل خصومات الغياب والجزاءات الإدارية وتخصيص أسبابها."
          ]
        },
        {
          title: "توليد واعتماد مسير الرواتب الشهري",
          steps: [
            "اختر 'مسير الرواتب الشهري' وحدد الشهر والسنة.",
            "اضغط على 'احتساب الرواتب تلقائياً'، سيقوم النظام بخصم السلف والجزاءات وإضافة البدلات.",
            "اضغط 'اعتماد المسير' ثم اختر 'طباعة كشف الرواتب المعتمد'."
          ]
        }
      ]
    },
    {
      id: "accounting",
      title: "4. المحاسبة والمالية (Accounting)",
      icon: Calculator,
      color: "bg-emerald-500",
      description: "شجرة الحسابات، قيود اليومية، سندات القبض والصرف، وكشوف الحسابات.",
      topics: [
        {
          title: "شجرة الحسابات (Chart of Accounts)",
          steps: [
            "من شاشة 'المحاسبة والسندات'، افتح شجرة الحسابات الموحدة.",
            "يمكنك إضافة حساب فرعي تحت الأصول، الخصوم، الإيرادات، أو المصروفات.",
            "تأكد من اختيار طبيعة الحساب (مدين / دائن) بدقة."
          ]
        },
        {
          title: "إنشاء سندات القبض والصرف وقيد اليومية",
          steps: [
            "اختر 'سند قبض' عند استلام مبالغ من العملاء، أو 'سند صرف' للمصروفات والمشتريات.",
            "أدخل الحساب المقابل، المبلغ، وشرح الحركة.",
            "يتم رحيل السند تلقائياً إلى قيد اليومية العام وتعديل أرصدة الحسابات فوراً."
          ]
        },
        {
          title: "كشوف الحسابات والتقارير المالية",
          steps: [
            "من قسم كشف الحساب، حدد الحساب المطلوب والفترة الزمنية (من تاريخ / إلى تاريخ).",
            "استعرض الرصيد السابق، الحركات التفصيلية، والرصيد النهائي مع إمكانية التصدير والطباعة."
          ]
        }
      ]
    },
    {
      id: "settings_print",
      title: "5. الشعار والشعار وإعدادات الطباعة",
      icon: Printer,
      color: "bg-purple-500",
      description: "تخصيص الهوية البصرية Omni System Pro وهوامش المطبوعات.",
      topics: [
        {
          title: "اعتماد شعار النظام الرسمي",
          steps: [
            "الشعار الرسمي المعتمد حالياً للنظام هو شعار Omni System Pro ذو الأيقونة الزرقاء الحديثة.",
            "لتغيير الشعار أو ترويسة الفواتير، اذهب إلى 'تصميم الترويسة والشعار'.",
            "يمكنك تعديل اسم المنشأة، الرقم الضريبي، النص السفلي للفاتورة، ولون التمييز."
          ]
        },
        {
          title: "ضبط طابعة الفواتير والتقارير",
          steps: [
            "في إعدادات الطباعة، حدد نوع الورق (A4 للتقارير والسندات / 80mm للفواتير الحرارية).",
            "اضغط على 'طباعة نموذج تجريبي' للتأكد من المحاذاة والوضوح قبل بدء العمل الفعلي."
          ]
        }
      ]
    },
    {
      id: "security_license",
      title: "6. الأمان، التراخيص، وتغير كلمات المرور",
      icon: KeyRound,
      color: "bg-red-500",
      description: "إرشادات حماية الحسابات، تفعيل الترخيص السنوي، وتعديل كلمات المرور.",
      topics: [
        {
          title: "تغيير كلمة المرور الخاصة بك",
          steps: [
            "من شاشة تسجيل الدخول أو من 'المستخدمين والصلاحيات'، حدد خيار 'تغيير كلمة المرور'.",
            "أدخل اسم المستخدم، كلمة المرور الحالية، ثم كلمة المرور الجديدة (3 أحرف على الأقل).",
            "اضغط 'تغيير كلمة المرور الآن'، وسيمكنك تسجيل الدخول بالرمز الجديد مباشرة."
          ]
        },
        {
          title: "إدارة تراخيص النظام وحماية المطور",
          steps: [
            "حساب المطور (developer) يمتلك صلاحية الدخول لشاشة 'إدارة التراخيص والتفعيل'.",
            "يمكن للمطور تمديد الترخيص السنوي أو إعادة قفل/فتح النظام عند اللزوم.",
            "عند انتهاء الترخيص، يقفل النظام بوضع الأمان لحماية ملكية البرنامج."
          ]
        }
      ]
    }
  ];

  const filteredSections = guideSections.map((sec) => ({
    ...sec,
    topics: sec.topics.filter(
      (top) =>
        top.title.includes(searchQuery) ||
        top.steps.some((s) => s.includes(searchQuery)) ||
        sec.title.includes(searchQuery)
    ),
  })).filter((sec) => sec.topics.length > 0);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto font-sans text-right" dir="rtl">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-blue-800/40 relative overflow-hidden">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block">
            <BookOpen className="w-56 h-56 text-blue-300" />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-amber-500 text-slate-950 font-black px-3 py-1 text-xs shadow-md">
                <Sparkles className="w-3.5 h-3.5 ml-1 inline" />
                الدليل التشغيلي الموحد
              </Badge>
              <span className="text-xs text-blue-200 font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                Omni System Pro v4.5
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              دليل استخدام وإدارة نظام Omni System Pro التفصيلي
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed font-medium">
              مرحباً بك في مرجع النظام الشامل. يوضح هذا الدليل كافة الخطوات والإجراءات التشغيلية
              لإدارة نقاط البيع، الموارد البشرية، الحسابات المالية، شجرة الصلاحيات، وإعدادات الطباعة والأمان.
            </p>

            {/* Quick Search Bar */}
            <div className="pt-2 max-w-xl">
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="ابحث عن أي وظيفة أو خطوة في الدليل (مثال: تغيير كلمة المرور، وردية، رواتب...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-white/10 text-white placeholder:text-slate-400 border-blue-400/30 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50 rounded-xl font-bold text-xs h-11"
                />
              </div>
            </div>
          </div>
        </div>

        {/* System Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-blue-950">نقطة البيع POS</h3>
                <p className="text-[11px] text-blue-700 font-semibold">مبيعات وورديات فورية</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-amber-950">Omni ERP Hub</h3>
                <p className="text-[11px] text-amber-700 font-semibold">8 إدارات متكاملة</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-indigo-950">الموارد البشرية</h3>
                <p className="text-[11px] text-indigo-700 font-semibold">رواتب وحضور وسلف</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-xs">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-emerald-950">المحاسبة المالية</h3>
                <p className="text-[11px] text-emerald-700 font-semibold">سندات وشجرة حسابات</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Guide Navigator */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full space-y-4">
          <TabsList className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex flex-wrap gap-1 h-auto justify-start">
            {guideSections.map((sec) => {
              const IconComp = sec.icon;
              return (
                <TabsTrigger
                  key={sec.id}
                  value={sec.id}
                  className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <IconComp className="w-4 h-4 text-blue-600" />
                  <span>{sec.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {guideSections.map((sec) => {
            const IconComp = sec.icon;
            return (
              <TabsContent key={sec.id} value={sec.id} className="space-y-4 mt-0">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50/80 border-b border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl text-white ${sec.color} shadow-sm`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-black text-slate-900">
                          {sec.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium">
                          {sec.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-6">
                    {sec.topics.map((topic, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-all space-y-3"
                      >
                        <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          {topic.title}
                        </h4>
                        <div className="pr-8 space-y-2">
                          {topic.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-2.5 text-xs text-slate-700 font-medium leading-relaxed">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AdminLayout>
  );
}
