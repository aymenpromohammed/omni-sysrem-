import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Link } from "wouter";
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
  ShoppingBag,
  ExternalLink,
  RotateCcw,
  BarChart4,
  Tags,
  Package,
  Truck,
  Wallet,
  Coins,
  History,
  ShieldAlert,
  TrendingUp,
  Landmark,
  FileSpreadsheet,
  Calendar,
  Warehouse,
  ClipboardList,
  FileCheck
} from "lucide-react";

export default function SystemGuidePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("getting-started");

  const guideSections = [
    {
      id: "getting-started",
      title: "البداية السريعة (هام جداً)",
      icon: Sparkles,
      color: "bg-amber-500",
      description: "أهم الخطوات لبدء العمل على النظام فوراً، بما في ذلك إضافة المنتجات والأصناف التي يبحث عنها المستخدمون عادةً.",
      topics: [
        {
          title: "كيفية إضافة أقسام (تصنيفات) المنتجات",
          path: "/categories",
          steps: [
            "من القائمة الجانبية، انتقل إلى 'نظام المخازن والمستودعات'.",
            "اختر 'إدارة أقسام المنتجات'.",
            "اضغط على زر 'إضافة قسم جديد' في أعلى الصفحة.",
            "أدخل اسم القسم (مثل: المشروبات الباردة، الوجبات الرئيسية، المعجنات).",
            "يمكنك تفعيل أو تعطيل القسم ليظهر أو يختفي من شاشة الكاشير، ثم اضغط حفظ."
          ]
        },
        {
          title: "كيفية إضافة منتجات ومواد جديدة للبيع",
          path: "/products",
          steps: [
            "من القائمة الجانبية، انتقل إلى 'نظام المخازن والمستودعات'.",
            "اختر 'إدارة المنتجات والمواد'.",
            "اضغط على زر 'إضافة منتج' في الزاوية العلوية.",
            "أدخل بيانات المنتج: الاسم (عربي/إنجليزي)، سعر البيع للجمهور، وتكلفة الشراء التقديرية.",
            "قم بإدخال الباركود يدوياً أو عبر ماسح الباركود، أو اتركه فارغاً ليقوم النظام بتوليد رقم تلقائي.",
            "هام: اختر 'القسم' الصحيح الذي أنشأته مسبقاً من القائمة المنسدلة ليظهر المنتج تحت تبويبه الصحيح في شاشة البيع.",
            "اضغط حفظ لتفعيل المنتج فوراً في النظام."
          ]
        },
        {
          title: "فتح الوردية وبدء العمل اليومي",
          path: "/shifts",
          steps: [
            "قبل إصدار أي فاتورة، يجب على الكاشير 'فتح وردية'.",
            "أدخل مبلغ 'العهدة الافتتاحية' (المبلغ الموجود في الدرج عند استلامك له).",
            "الآن يمكنك الذهاب لشاشة البيع (POS) وبدء العمل."
          ]
        }
      ]
    },
    {
      id: "pos",
      title: "نقطة البيع والمبيعات (POS)",
      icon: Receipt,
      color: "bg-blue-500",
      description: "دليل كامل لعمليات البيع اليومية، إدارة الطاولات، والتحصيل النقدي.",
      topics: [
        {
          title: "إجراء عملية بيع كاملة",
          path: "/pos",
          steps: [
            "اختر المنتجات من الأقسام الموجودة في الأعلى أو ابحث عنها بالاسم أو الباركود.",
            "تعديل الكمية: اضغط على المنتج في الفاتورة لزيادة العدد، أو استخدم أزرار (+) و (-) لتعديل دقيق.",
            "تطبيق خصم: يمكنك تطبيق خصم (مبلغ أو نسبة) على صنف معين أو على كامل الفاتورة (حسب الصلاحيات).",
            "إنهاء الطلب: اضغط على 'دفع'، اختر وسيلة السداد (كاش، شبكة، أو مختلط) ثم 'تأكيد وطباعة'."
          ]
        },
        {
          title: "إدارة الطاولات (للمطاعم والمقاهي)",
          path: "/tables",
          steps: [
            "في شاشة الـ POS، اضغط على 'الطاولات'.",
            "اختر الصالة ثم الطاولة المفتوحة لتعديل طلبها، أو طاولة فارغة لبدء طلب جديد.",
            "يمكنك 'نقل الطلب' من طاولة إلى أخرى أو 'دمج طاولات' عبر الخيارات المتاحة."
          ]
        },
        {
          title: "إغلاق الوردية (End of Shift)",
          path: "/shifts",
          steps: [
            "في نهاية الدوام، اذهب إلى 'الورديات وإغلاق الصندوق'.",
            "اختر الوردية النشطة واضغط 'إغلاق'.",
            "أدخل المبلغ النقدي الفعلي الموجود في الدرج (Cash Count).",
            "سيقوم النظام بمقارنة المبلغ الفعلي مع المبيعات المسجلة وإظهار 'العجز أو الزيادة' وطباعة تقرير الإغلاق."
          ]
        },
        {
          title: "المرتجعات وإلغاء الفواتير",
          path: "/returns",
          steps: [
            "لإرجاع صنف، اذهب لشاشة المرتجعات.",
            "أدخل رقم الفاتورة أو ابحث عنها في 'سجل الطلبات'.",
            "اختر الأصناف المراد إرجاعها وسبب الإرجاع.",
            "عند التأكيد، يتم خصم المبلغ من الخزينة وإعادة الأصناف للمخزن تلقائياً."
          ]
        }
      ]
    },
    {
      id: "inventory",
      title: "إدارة المخازن والمستودعات",
      icon: Boxes,
      color: "bg-cyan-600",
      description: "متابعة أرصدة الأصناف، الجرد الدوري، والتحويلات بين المخازن.",
      topics: [
        {
          title: "متابعة الأرصدة والنواقص",
          path: "/inventory?tab=stocks",
          steps: [
            "تعرض شاشة 'أرصدة الأصناف' الكميات الحالية لكل منتج.",
            "الأصناف التي تظهر باللون الأحمر تعني أنها وصلت لـ 'حد إعادة الطلب' ويجب شراؤها فوراً.",
            "يمكنك الضغط على 'سجل الحركة' لأي صنف لمعرفة مصدر دخوله وخروجه."
          ]
        },
        {
          title: "عمليات الجرد الدوري والتسوية",
          path: "/inventory?tab=stocktake",
          steps: [
            "ابدأ 'عملية جرد جديدة' واختر القسم أو المخزن.",
            "أدخل الكميات التي وجدتها فعلياً على الرف.",
            "سيحسب النظام 'الفارق الدفتري'؛ اضغط على 'اعتماد التسوية' ليقوم النظام بتصحيح الأرصدة وتسجيل العجز أو الزيادة كقيد محاسبي."
          ]
        },
        {
          title: "التحويلات المخزنية",
          path: "/inventory?tab=vouchers",
          steps: [
            "لنقل بضاعة من مخزن إلى آخر، أنشئ 'سند تحويل مخزني'.",
            "حدد المخزن المحول منه والمحول إليه والأصناف.",
            "لا تتأثر الأرصدة فعلياً إلا بعد قيام المخزن المستلم بعمل 'تأكيد استلام'."
          ]
        }
      ]
    },
    {
      id: "purchases",
      title: "نظام المشتريات والموردين",
      icon: ShoppingBag,
      color: "bg-teal-600",
      description: "إدارة علاقات الموردين، أوامر الشراء، وفواتير المشتريات الآجلة والنقدية.",
      topics: [
        {
          title: "إضافة الموردين وكشوف الحساب",
          path: "/suppliers?tab=suppliers",
          steps: [
            "قم بتعريف الموردين مع أرقام هواتفهم وأرقامهم الضريبية.",
            "يمكنك تحديد 'الرصيد الافتتاحي' للمورد إذا كان له مبالغ سابقة.",
            "من كشف حساب المورد، يمكنك رؤية جميع الفواتير والدفعات التي تمت له."
          ]
        },
        {
          title: "تسجيل فاتورة مشتريات",
          path: "/suppliers?tab=invoices",
          steps: [
            "أدخل رقم فاتورة المورد وتاريخها.",
            "اختر الأصناف، الكميات، وسعر الشراء (تلقائياً يقوم النظام بتحديث متوسط تكلفة الصنف).",
            "إذا كانت الفاتورة 'آجلة'، ستضاف لرصيد المورد. إذا كانت 'نقدية'، سيطلب منك النظام تحديد الصندوق الذي تم الصرف منه."
          ]
        }
      ]
    },
    {
      id: "accounting",
      title: "النظام المالي والمحاسبي",
      icon: Calculator,
      color: "bg-emerald-600",
      description: "شجرة الحسابات، قيود اليومية، سندات الصرف والقبض، والتقارير المالية.",
      topics: [
        {
          title: "شجرة الحسابات (دليل الحسابات)",
          path: "/accounting?tab=chart",
          steps: [
            "يتكون النظام من شجرة حسابات مرنة (أصول، خصوم، مصروفات، إيرادات).",
            "يمكنك إضافة حسابات فرعية (مثل: بنك الراجحي، صندوق الفرع الرئيسي) تحت الحسابات الأب.",
            "احذر من حذف الحسابات التي عليها حركات مالية مسجلة."
          ]
        },
        {
          title: "سندات الصرف والقبض",
          path: "/accounting?tab=vouchers",
          steps: [
            "سند صرف: لإخراج مبالغ من الصندوق أو البنك (مثال: دفع إيجار، مصروفات صيانة).",
            "سند قبض: لاستلام مبالغ خارجية (مثال: استلام دفعة من عميل آجل).",
            "يتم إنشاء قيد محاسبي تلقائي لكل سند لضمان توازن الحسابات."
          ]
        },
        {
          title: "المصروفات اليومية",
          path: "/expenses",
          steps: [
            "هذه الشاشة مخصصة لتسجيل المصاريف النثرية السريعة (بنزين، أدوات نظافة، ضيافة).",
            "اربط كل مصروف بـ 'بند المصروف' الصحيح لسهولة التحليل لاحقاً.",
            "يمكنك إرفاق صورة للفاتورة الورقية للتوثيق الرقمي."
          ]
        }
      ]
    },
    {
      id: "hr",
      title: "الموارد البشرية والرواتب (HR)",
      icon: Users,
      color: "bg-indigo-600",
      description: "إدارة بيانات الموظفين، الحضور، مسير الرواتب، والسلف والعهد.",
      topics: [
        {
          title: "إضافة موظف جديد",
          path: "/hr?view=employees",
          steps: [
            "أدخل بيانات الموظف: الاسم، المهنة، وتاريخ التعيين.",
            "هام: أدخل 'الراتب الأساسي' والبدلات (سكن، مواصلات) بدقة لأن النظام يعتمد عليها في حساب المسير الشهري.",
            "سجل أرقام الهوية والإقامات وتواريخ انتهائها للحصول على تنبيهات."
          ]
        },
        {
          title: "مسير الرواتب الشهري",
          path: "/hr?view=salaries",
          steps: [
            "في نهاية كل شهر، قم بإنشاء 'مسير رواتب جديد'.",
            "يقوم النظام آلياً بتجميع الرواتب وخصم السلف والجزاءات المسجلة خلال الشهر.",
            "بعد المراجعة، اضغط 'اعتماد وصرف' ليقوم النظام بإصدار سندات الصرف والقيود المحاسبية تلقائياً."
          ]
        }
      ]
    },
    {
      id: "reports",
      title: "التقارير والمؤشرات",
      icon: BarChart4,
      color: "bg-slate-700",
      description: "استخراج البيانات والتقارير التحليلية لاتخاذ القرارات.",
      topics: [
        {
          title: "تقارير المبيعات",
          path: "/reports?tab=sales",
          steps: [
            "يمكنك استخراج تقارير المبيعات حسب: الفرع، الكاشير، الصنف، أو القسم.",
            "تقرير 'الأصناف الأكثر مبيعاً' يساعدك في معرفة المنتجات الرابحة.",
            "يمكن تصدير كافة التقارير بصيغة Excel أو PDF."
          ]
        },
        {
          title: "القوائم المالية",
          path: "/accounting?tab=financials",
          steps: [
            "ميزان المراجعة: للتأكد من توازن العمليات المحاسبية.",
            "قائمة الدخل: لمعرفة صافي الأرباح والخسائر خلال فترة معينة.",
            "الميزانية العمومية: لمعرفة ما للمؤسسة وما عليها في لحظة زمنية معينة."
          ]
        }
      ]
    }
  ];

  // Logic for accurate character-by-character search across all fields
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return guideSections;
    
    const query = searchQuery.toLowerCase().trim();
    
    return guideSections.map(sec => {
      // Check if section header matches
      const secHeaderMatch = 
        sec.title.toLowerCase().includes(query) || 
        sec.description.toLowerCase().includes(query);
      
      // Filter topics within the section
      const matchingTopics = sec.topics.filter(topic =>
        topic.title.toLowerCase().includes(query) ||
        topic.steps.some(step => step.toLowerCase().includes(query))
      );

      // If header matches, keep all topics, otherwise only matching topics
      if (secHeaderMatch) {
        return sec;
      } else if (matchingTopics.length > 0) {
        return { ...sec, topics: matchingTopics };
      }
      
      return null;
    }).filter(Boolean) as typeof guideSections;
  }, [searchQuery]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-amber-950 px-0.5 rounded-sm font-black underline decoration-amber-500">
              {part}
            </mark>
          ) : part
        )}
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-20" dir="rtl">
        {/* Modern Header Section */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl overflow-hidden relative border border-white/10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-48 -mt-48 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -ml-48 -mb-48 animate-pulse"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3.5 bg-blue-500/20 rounded-2xl border border-blue-400/20 shadow-inner">
                  <BookOpen className="w-8 h-8 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                    دليل الاستخدام <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">الشامل والتفصيلي</span>
                  </h1>
                  <p className="text-blue-200/80 text-sm md:text-base font-bold mt-1.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    مرجعك المعتمد لجميع وظائف ومهام Omni System Pro
                  </p>
                </div>
              </div>

              {/* Enhanced Search Bar */}
              <div className="max-w-2xl w-full">
                <div className="relative group">
                  <Search className="w-5 h-5 absolute right-4 top-4 text-slate-400 group-focus-within:text-amber-400 transition-colors" />
                  <Input
                    type="text"
                    placeholder="ابحث بدقة بالحرف (مثال: إضافة صنف، الباركود، الموردين، الراتب...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-12 bg-white/10 backdrop-blur-md text-white placeholder:text-slate-500 border-white/20 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 rounded-2xl font-bold text-base h-14 transition-all shadow-xl"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute left-4 top-4 text-slate-400 hover:text-white"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden lg:block bg-white/5 backdrop-blur-xs p-4 rounded-2xl border border-white/10 text-right">
              <p className="text-[10px] uppercase tracking-widest text-amber-400 font-black mb-1">حالة النظام</p>
              <p className="text-sm font-bold text-white">الإصدار المحدث 2026.8</p>
              <p className="text-[11px] text-blue-200/60 mt-0.5 font-medium">تم تحديث الدليل اليوم</p>
            </div>
          </div>
        </div>

        {/* Categories Quick Nav */}
        <div className="flex flex-wrap gap-2 py-2">
          {guideSections.map(sec => (
            <Button
              key={sec.id}
              variant={activeCategory === sec.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(sec.id)}
              className={cn(
                "rounded-full px-4 h-9 text-xs font-bold transition-all",
                activeCategory === sec.id 
                  ? "bg-slate-900 text-white shadow-md scale-105" 
                  : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
              )}
            >
              <sec.icon className={cn("w-3.5 h-3.5 ml-1.5", activeCategory === sec.id ? "text-amber-400" : "text-slate-400")} />
              {sec.title}
            </Button>
          ))}
        </div>

        {/* Content Section */}
        {filteredSections.length > 0 ? (
          <div className="grid grid-cols-1 gap-8">
            {filteredSections.map((sec) => {
              if (searchQuery && !sec.topics.length) return null;
              
              const IconComp = sec.icon;
              return (
                <div key={sec.id} id={sec.id} className="space-y-4 scroll-mt-6">
                  <div className="flex items-center gap-3 px-2">
                    <div className={cn("p-2 rounded-xl text-white shadow-lg", sec.color)}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">{highlightText(sec.title, searchQuery)}</h2>
                      <p className="text-sm text-slate-500 font-bold">{highlightText(sec.description, searchQuery)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sec.topics.map((topic, idx) => (
                      <Card 
                        key={idx} 
                        className="border-slate-200 shadow-sm hover:shadow-xl hover:border-amber-400/50 transition-all group overflow-hidden bg-white"
                      >
                        <CardHeader className="p-5 pb-2">
                          <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-base font-black text-slate-800 leading-tight">
                              {highlightText(topic.title, searchQuery)}
                            </CardTitle>
                            {topic.path && (
                              <Link href={topic.path}>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all">
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                          <CardDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                            الخطوات الإجرائية التنفيذية
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 pt-2 space-y-3">
                          <div className="space-y-2.5">
                            {topic.steps.map((step, sIdx) => (
                              <div 
                                key={sIdx} 
                                className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl group-hover:bg-amber-50/30 group-hover:border-amber-100 transition-colors"
                              >
                                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 mt-0.5 shadow-xs">
                                  {sIdx + 1}
                                </div>
                                <p className="text-xs text-slate-700 font-bold leading-relaxed">
                                  {highlightText(step, searchQuery)}
                                </p>
                              </div>
                            ))}
                          </div>
                          
                          {topic.path && (
                            <Link href={topic.path}>
                              <button className="w-full mt-2 py-2.5 text-[11px] font-black text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                <Search className="w-3.5 h-3.5" />
                                اذهب إلى الشاشة المعنية الآن
                              </button>
                            </Link>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-xl border border-slate-100">
                <Search className="w-10 h-10 text-slate-300 animate-bounce" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">عذراً، لم نجد نتائج لـ "{searchQuery}"</h3>
              <p className="text-slate-500 font-bold max-w-sm">
                تأكد من كتابة الكلمة بشكل صحيح، أو جرب البحث عن كلمات عامة مثل (مخزون، بيع، فاتورة، موظف).
              </p>
              <Button 
                variant="outline" 
                className="mt-8 rounded-xl border-slate-200 font-bold h-11 px-8 shadow-sm"
                onClick={() => setSearchQuery("")}
              >
                مسح البحث وعرض الدليل بالكامل
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Help Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
          <Card className="bg-slate-900 text-white border-none shadow-xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <ShieldCheck className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <p className="text-xs text-amber-400 font-black">الدعم الفني المباشر</p>
                <p className="text-sm font-bold">متصلون لخدمتكم 24/7</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <Printer className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-black">تحميل الدليل</p>
                <p className="text-sm font-bold text-slate-900">تحميل نسخة PDF للطباعة</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-black">مركز التحديثات</p>
                <p className="text-sm font-bold text-slate-900">آخر التحسينات في النظام</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");
