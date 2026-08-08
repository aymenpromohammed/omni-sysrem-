دليل نظام إدارة المطعم - Restaurant ERP + POS
شرح مبسط شامل للنظام
📌 ما هو هذا النظام؟
نظام إدارة مطعم متكامل يشمل:

لوحة تحكم تعرض إحصائيات المبيعات في الوقت الفعلي
نقطة بيع (POS) لاستقبال الطلبات ودفع الفواتير
شاشة مطبخ (KDS) لعرض الطلبات للطاهين
إدارة الطاولات، المنتجات، العملاء، الموظفين، المخزون، والتقارير
🏗️ كيف يتكون النظام؟
النظام يتكون من جزأين رئيسيين:
┌─────────────────────────────────────────┐
│           الواجهة الأمامية               │
│     (React + Vite - المتصفح)            │
│  ما يراه المستخدم ويتفاعل معه           │
└──────────────┬──────────────────────────┘
               │ يتواصل عبر HTTP/API
┌──────────────▼──────────────────────────┐
│            الخادم الخلفي                 │
│        (Node.js + Express)              │
│   يعالج الطلبات ويحفظ البيانات          │
└──────────────┬──────────────────────────┘
               │ يخزن ويسترجع البيانات
┌──────────────▼──────────────────────────┐
│          قاعدة البيانات                  │
│           (PostgreSQL)                  │
│    تخزن جميع بيانات النظام              │
└─────────────────────────────────────────┘

🗄️ قاعدة البيانات
الجداول الموجودة:
اسم الجدول	الوصف	أهم الحقول
categories	تصنيفات المنتجات	id, name_ar, color, icon
products	المنتجات والأصناف	id, name_ar, price, category_id
restaurant_tables	الطاولات	id, number, capacity, status
customers	العملاء	id, name, phone, loyalty_points
orders	الطلبات	id, order_number, type, status, total
order_items	تفاصيل كل طلب	id, order_id, product_id, quantity, unit_price
inventory	المخزون	id, name_ar, current_stock, min_stock
employees	الموظفون	id, name, role, salary
العلاقات بين الجداول:
categories ─────────┐
                    ↓
                products
                    │
orders ─────────────┼──── order_items
   │                │
   ├── restaurant_tables
   └── customers

🚀 تشغيل النظام (على هذه المنصة)
لا تحتاج لتثبيت أي شيء - النظام يعمل تلقائياً. لكن إذا احتجت إعادة التشغيل:

# تشغيل الخادم الخلفي (API)
pnpm --filter @workspace/api-server run dev
# تشغيل الواجهة الأمامية
pnpm --filter @workspace/restaurant-pos run dev

💻 تشغيل النظام على جهازك المحلي (Windows/Mac/Linux)
الخطوة 1: المتطلبات
قم بتثبيت هذه البرامج أولاً:

Node.js (الإصدار 20 أو أحدث)

حمّله من: https://nodejs.org
تحقق بكتابة: node --version
pnpm (مدير الحزم)

بعد تثبيت Node.js، اكتب في الطرفية:
npm install -g pnpm

PostgreSQL (قاعدة البيانات)

حمّله من: https://www.postgresql.org/download
أثناء التثبيت احفظ كلمة السر التي تضعها
الخطوة 2: تحضير المشروع
# 1. انسخ المشروع إلى جهازك
git clone [رابط_المشروع]
cd [اسم_المجلد]
# 2. ثبّت جميع المكتبات
pnpm install

الخطوة 3: إعداد قاعدة البيانات
# 1. افتح PostgreSQL وأنشئ قاعدة بيانات جديدة
# في pgAdmin أو psql اكتب:
CREATE DATABASE restaurant_db;
# 2. أنشئ ملف إعداد البيئة
# في المجلد الرئيسي أنشئ ملف اسمه .env واكتب فيه:
DATABASE_URL=postgresql://postgres:كلمة_السر@localhost:5432/restaurant_db
# 3. أنشئ جداول قاعدة البيانات تلقائياً
pnpm --filter @workspace/db run push

الخطوة 4: تشغيل النظام
افتح نافذتين في الطرفية:

النافذة الأولى - الخادم الخلفي:

PORT=5000 BASE_PATH=/api pnpm --filter @workspace/api-server run dev

النافذة الثانية - الواجهة الأمامية:

PORT=3000 BASE_PATH=/ pnpm --filter @workspace/restaurant-pos run dev

ثم افتح المتصفح على: http://localhost:3000

🖥️ تطبيق سطح المكتب (Desktop App)
لتحويل النظام إلى تطبيق سطح مكتب يعمل بدون متصفح:

الخيار 1: باستخدام Electron (الأسهل)
الخطوة 1: ثبّت Electron

npm install -g electron
pnpm add -D electron --filter @workspace/restaurant-pos

الخطوة 2: أنشئ ملف electron-main.js في مجلد artifacts/restaurant-pos:

const { app, BrowserWindow } = require('electron')
const path = require('path')
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false
    },
    // شعار النظام
    icon: path.join(__dirname, 'public/favicon.ico'),
    title: 'نظام إدارة المطعم',
    // بدء ممتلئ الشاشة
    fullscreen: false,
    maximize: true
  })
  
  // في وضع التطوير: افتح من السيرفر المحلي
  win.loadURL('http://localhost:3000')
  
  // في وضع الإنتاج: افتح من الملفات المبنية
  // win.loadFile(path.join(__dirname, 'dist/public/index.html'))
}
app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

الخطوة 3: شغّل التطبيق

# تأكد أن النظام يعمل أولاً (الخادم والواجهة)
# ثم في نافذة ثالثة:
electron artifacts/restaurant-pos/electron-main.js

الخيار 2: باستخدام Tauri (أخف وأسرع)
# تثبيت Rust أولاً من: https://rustup.rs
# ثم:
npm install -g @tauri-apps/cli
cd artifacts/restaurant-pos
npx tauri init
npx tauri dev

الخيار 3: تحويل إلى PWA (الأبسط)
المتصفح الحديث يدعم تثبيت المواقع كتطبيقات:

افتح الموقع في Chrome أو Edge
انقر على أيقونة "تثبيت" في شريط العنوان
سيظهر النظام في قائمة التطبيقات كأي تطبيق آخر
🌐 نقاط الـ API (للمطورين)
الخادم يعمل على: http://localhost:5000/api

لوحة التحكم
الطريقة	الرابط	الوصف
GET	/api/dashboard/summary	ملخص اليوم
GET	/api/dashboard/sales-chart?period=daily	رسم بياني (daily/weekly/monthly/yearly)
GET	/api/dashboard/top-products	أفضل المنتجات
GET	/api/dashboard/recent-orders	آخر الطلبات
التصنيفات
الطريقة	الرابط	الوصف
GET	/api/categories	جميع التصنيفات
POST	/api/categories	إضافة تصنيف
PATCH	/api/categories/:id	تعديل تصنيف
DELETE	/api/categories/:id	حذف تصنيف
المنتجات
الطريقة	الرابط	الوصف
GET	/api/products?categoryId=1&search=قهوة	قائمة المنتجات مع فلترة
POST	/api/products	إضافة منتج
PATCH	/api/products/:id	تعديل منتج
DELETE	/api/products/:id	حذف منتج
الطاولات
الطريقة	الرابط	الوصف
GET	/api/tables?status=available	الطاولات (فلترة: available/occupied/reserved)
POST	/api/tables	إضافة طاولة
PATCH	/api/tables/:id	تعديل حالة طاولة
الطلبات
الطريقة	الرابط	الوصف
GET	/api/orders?status=pending&type=dine_in	جميع الطلبات
POST	/api/orders	إنشاء طلب جديد
PATCH	/api/orders/:id/status	تحديث حالة الطلب
POST	/api/orders/:id/pay	دفع فاتورة
GET	/api/orders/kitchen	طلبات المطبخ النشطة
مثال: إنشاء طلب جديد
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "type": "dine_in",
    "tableId": 1,
    "customerId": 1,
    "items": [
      {"productId": 2, "quantity": 2, "notes": "بدون سكر"},
      {"productId": 10, "quantity": 1}
    ],
    "discount": 10
  }'

مثال: دفع فاتورة
curl -X POST http://localhost:5000/api/orders/1/pay \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "cash",
    "amountPaid": 120
  }'

📱 صفحات النظام
الصفحة	الرابط	الاستخدام
لوحة التحكم	/	مشرف المطعم
نقطة البيع	/pos	الكاشير
الطلبات	/orders	المدير
شاشة المطبخ	/kitchen	الطاهي
إدارة الطاولات	/tables	النادل/المدير
قائمة الطعام	/menu	المدير
العملاء	/customers	الكاشير/المدير
المخزون	/inventory	مدير المخزون
الموظفون	/employees	المدير
التقارير	/reports	المدير
⚙️ إعدادات مهمة
نسبة الضريبة (VAT)
الضريبة محددة بـ 15% في ملف: artifacts/api-server/src/routes/orders.ts

const TAX_RATE = 0.15;  // غيّر هذا لتعديل نسبة الضريبة

نقاط الولاء
العميل يكسب نقطة واحدة لكل 10 ريال ينفقها. يمكن تعديل هذا في: artifacts/api-server/src/routes/orders.ts

const points = Math.floor(total / 10);  // 1 نقطة لكل 10 ريال

🔧 إضافة جدول جديد لقاعدة البيانات
مثال: إضافة جدول "الموردين"

أنشئ الملف lib/db/src/schema/suppliers.ts:
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

أضفه في lib/db/src/schema/index.ts:
export * from "./suppliers";

طبّق التغيير على قاعدة البيانات:
pnpm --filter @workspace/db run push

🛡️ الأمان والصلاحيات (المرحلة القادمة)
النظام حالياً مفتوح للجميع. لإضافة تسجيل الدخول:

Replit Auth - الأسهل والمدمج مع المنصة
Clerk - يدعم Google, Apple, Email
لإضافة المصادقة:

# اقرأ الدليل في الدردشة واطلب:
"أضف تسجيل دخول للنظام"

❓ أسئلة شائعة
س: كيف أغير اسم المطعم؟ ج: ابحث في ملفات الواجهة عن "مطعمي" واستبدله باسم مطعمك.

س: كيف أضيف صور للمنتجات؟ ج: يمكن إضافة رابط URL للصورة في حقل image عند إضافة المنتج.

س: كيف أطبع الفواتير؟ ج: يمكن استخدام window.print() في المتصفح، أو ربط طابعة 80mm عبر مكتبة escpos.

س: كيف أصدّر التقارير Excel؟ ج: يمكن إضافة مكتبة xlsx وتحميل البيانات من API.

س: هل يدعم النظام فروع متعددة؟ ج: حالياً فرع واحد. لدعم فروع متعددة يحتاج إضافة جدول branches وربطه بجميع الجداول.

📊 نتائج اختبار النظام
تم اختبار جميع نقاط الـ API وهي تعمل بشكل صحيح:

النقطة	الحالة
لوحة التحكم - الملخص	✅ يعمل
لوحة التحكم - الرسم البياني	✅ يعمل
لوحة التحكم - أفضل المنتجات	✅ يعمل
لوحة التحكم - آخر الطلبات	✅ يعمل
التصنيفات - قراءة/إضافة/تعديل/حذف	✅ يعمل
المنتجات - قراءة/إضافة/تعديل/حذف/فلترة	✅ يعمل
الطاولات - قراءة/إضافة/تعديل/حذف	✅ يعمل
الطلبات - إنشاء/تحديث الحالة/دفع	✅ يعمل
شاشة المطبخ	✅ يعمل
العملاء - بحث/إضافة/تعديل	✅ يعمل
المخزون - قراءة/تنبيه منخفض	✅ يعمل
الموظفون - قراءة/فلترة بالدور	✅ يعمل
التقارير - المبيعات/المنتجات	✅ يعمل
نقاط الولاء (تحديث عند الدفع)	✅ يعمل
تحديث الطاولة عند إنشاء/إغلاق الطلب	✅ يعمل
النتيجة: جميع وظائف النظام تعمل بشكل صحيح ✅

📞 للمساعدة
إذا واجهت أي مشكلة، اكتب في الدردشة وصف المشكلة وسأساعدك فور