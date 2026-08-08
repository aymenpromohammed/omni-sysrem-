import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  History,
  Plus,
  Edit,
  Trash2,
  Search,
  ShoppingCart,
  Check,
  Printer,
  X,
  TrendingUp,
  Coins,
  AlertTriangle,
  Layers,
  RefreshCw,
  Clock,
  User,
  Barcode
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('pos'); // pos, dashboard, inventory, history
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [stats, setStats] = useState({
    summary: { totalSales: 0, salesCount: 0, lowStockItems: 0, totalProducts: 0 },
    chartData: [],
    topSelling: []
  });
  const [salesHistory, setSalesHistory] = useState([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [time, setTime] = useState(new Date().toLocaleTimeString('ar-SA'));

  // Inventory forms state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category_name: 'مشروبات ساخنة',
    barcode: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('ar-SA'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const resItems = await fetch('/api/items');
      const dataItems = await resItems.json();
      setItems(dataItems);

      const resCats = await fetch('/api/categories');
      const dataCats = await resCats.json();
      setCategories(dataCats);

      const resStats = await fetch('/api/stats');
      const dataStats = await resStats.json();
      setStats(dataStats);

      const resHistory = await fetch('/api/sales');
      const dataHistory = await resHistory.json();
      setSalesHistory(dataHistory);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // POS Add to Cart
  const addToCart = (product) => {
    if (product.stock <= 0) {
      alert('عذراً، هذا المنتج غير متوفر في المخزون حالياً!');
      return;
    }
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert('لا يمكنك إضافة كمية أكبر من المتوفرة في المخزون!');
        return;
      }
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateCartQuantity = (id, change) => {
    const item = cart.find(i => i.id === id);
    const product = items.find(i => i.id === id);
    if (!item || !product) return;

    const newQty = item.quantity + change;
    if (newQty <= 0) {
      setCart(cart.filter(i => i.id !== id));
    } else if (newQty > product.stock) {
      alert('الكمية المطلوبة تتجاوز المخزون المتوفر!');
    } else {
      setCart(cart.map(i => i.id === id ? { ...i, quantity: newQty } : i));
    }
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTax = cartSubtotal * 0.15; // 15% VAT
  const cartTotal = cartSubtotal + cartTax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'cash') {
      const cashVal = parseFloat(cashReceived);
      if (isNaN(cashVal) || cashVal < cartTotal) {
        alert('الرجاء إدخال مبلغ نقدي صحيح يغطي قيمة الفاتورة!');
        return;
      }
    }

    const payload = {
      items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
      payment_method: paymentMethod,
      cash_received: paymentMethod === 'cash' ? parseFloat(cashReceived) : cartTotal,
      change_given: paymentMethod === 'cash' ? parseFloat(cashReceived) - cartTotal : 0,
      total: cartTotal
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setLastReceipt({
          id: data.saleId,
          date: new Date().toLocaleString('ar-SA'),
          items: [...cart],
          subtotal: cartSubtotal,
          tax: cartTax,
          total: cartTotal,
          paymentMethod,
          cashReceived: payload.cash_received,
          changeGiven: payload.change_given
        });
        setShowReceipt(true);
        setCart([]);
        setCashReceived('');
        fetchData();
      }
    } catch (err) {
      console.error('Error during checkout:', err);
    }
  };

  // Manage Inventory actions
  const openAddModal = (item = null) => {
    if (item) {
      setIsEditing(true);
      setSelectedItem(item);
      setFormData({
        name: item.name,
        price: item.price,
        stock: item.stock,
        category_name: item.category_name || 'مشروبات ساخنة',
        barcode: item.barcode || ''
      });
    } else {
      setIsEditing(false);
      setSelectedItem(null);
      setFormData({
        name: '',
        price: '',
        stock: '',
        category_name: categories[0]?.name || 'مشروبات ساخنة',
        barcode: ''
      });
    }
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const url = isEditing ? `/api/items/${selectedItem.id}` : '/api/items';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setMessage(isEditing ? 'تم تعديل الصنف بنجاح!' : 'تم إضافة الصنف بنجاح!');
        setShowAddModal(false);
        fetchData();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error submitting form:', err);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage('تم حذف الصنف بنجاح!');
        fetchData();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'الكل' || item.category_name === selectedCategory;
    const matchesSearch = item.name.includes(searchQuery) || (item.barcode && item.barcode.includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  return (
    <div class="min-h-screen flex flex-col bg-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Upper Navigation Header */}
      <header class="bg-slate-900 text-white shadow-md px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl tracking-tight shadow">
            O
          </div>
          <div>
            <h1 class="text-lg font-bold tracking-tight">أومني سيستم برو</h1>
            <p class="text-xs text-slate-400">نظام المبيعات ونقاط البيع المحلي المتكامل</p>
          </div>
        </div>

        {/* Local time and Server Status */}
        <div class="flex items-center gap-6 text-sm text-slate-300">
          <div class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
            <Clock size={16} class="text-blue-400" />
            <span>{time}</span>
          </div>
          <div class="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>السيرفر المحلي متصل (Port 3000)</span>
          </div>
        </div>
      </header>

      {/* Main Container Grid */}
      <div class="flex-1 flex flex-col lg:flex-row">
        
        {/* Right Sidebar Nav */}
        <nav class="lg:w-64 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-row lg:flex-col p-2 lg:p-4 gap-2 text-slate-400 overflow-x-auto lg:overflow-x-visible">
          <button
            onClick={() => setActiveTab('pos')}
            class={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium w-full transition-all shrink-0 ${
              activeTab === 'pos' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShoppingBag size={18} />
            <span>نقطة البيع (POS)</span>
          </button>
          
          <button
            onClick={() => setActiveTab('dashboard')}
            class={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium w-full transition-all shrink-0 ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={18} />
            <span>لوحة التحكم والإحصائيات</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            class={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium w-full transition-all shrink-0 ${
              activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Package size={18} />
            <span>المستودع والمخزون</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            class={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium w-full transition-all shrink-0 ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <History size={18} />
            <span>سجل الفواتير والمبيعات</span>
          </button>

          <div class="hidden lg:block mt-auto pt-6 border-t border-slate-800 text-center">
            <p class="text-xs text-slate-500">تم دمج قاعدة بيانات SQLite محلياً</p>
            <button 
              onClick={fetchData}
              class="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 mx-auto py-1 px-2 rounded hover:bg-slate-800 transition"
            >
              <RefreshCw size={12} class={loading ? 'animate-spin' : ''} />
              تحديث البيانات
            </button>
          </div>
        </nav>

        {/* Content Region */}
        <main class="flex-1 p-4 lg:p-6 overflow-y-auto">
          {message && (
            <div class="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm flex items-center justify-between shadow-sm animate-bounce">
              <span>{message}</span>
              <button onClick={() => setMessage('')}><X size={16} /></button>
            </div>
          )}

          {/* TAB 1: POS SYSTEM */}
          {activeTab === 'pos' && (
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Product selector catalog */}
              <div class="xl:col-span-2 flex flex-col gap-4">
                {/* Search and Filters */}
                <div class="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-center">
                  <div class="relative w-full md:w-72">
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو الباركود..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      class="w-full pr-10 pl-4 py-2 rounded-lg bg-slate-100 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <Search class="absolute right-3 top-2.5 text-slate-400" size={18} />
                  </div>

                  {/* Categories Pills */}
                  <div class="flex gap-2 overflow-x-auto w-full pb-1 md:pb-0">
                    <button
                      onClick={() => setSelectedCategory('الكل')}
                      class={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${
                        selectedCategory === 'الكل' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      الكل
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.name)}
                        class={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${
                          selectedCategory === cat.name ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Products Grid */}
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredItems.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      class="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between h-44 group"
                    >
                      <div>
                        <div class="flex justify-between items-start mb-1.5">
                          <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {prod.category_name}
                          </span>
                          {prod.stock <= 10 && (
                            <span class={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${prod.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {prod.stock === 0 ? 'نفذ' : `متبقي ${prod.stock}`}
                            </span>
                          )}
                        </div>
                        <h3 class="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition line-clamp-2">
                          {prod.name}
                        </h3>
                        {prod.barcode && (
                          <p class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                            <Barcode size={10} /> {prod.barcode}
                          </p>
                        )}
                      </div>

                      <div class="flex justify-between items-center mt-3">
                        <span class="text-blue-600 font-extrabold text-sm">
                          {prod.price.toFixed(2)} <span class="text-[10px] font-normal text-slate-500">ر.س</span>
                        </span>
                        <div class="w-7 h-7 rounded-lg bg-blue-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-blue-600 transition">
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredItems.length === 0 && (
                    <div class="col-span-full bg-white py-12 rounded-xl text-center text-slate-400">
                      لا يوجد أي منتجات تطابق البحث والفلترة حالياً.
                    </div>
                  )}
                </div>
              </div>

              {/* Shopping Cart Drawer */}
              <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between h-[650px]">
                <div>
                  <div class="flex items-center gap-2 pb-4 border-b border-slate-100">
                    <ShoppingCart size={20} class="text-slate-600" />
                    <h2 class="font-bold text-slate-800">سلة المبيعات الحالية</h2>
                    <span class="mr-auto text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
                      {cart.reduce((sum, i) => sum + i.quantity, 0)} عناصر
                    </span>
                  </div>

                  {/* Cart items list */}
                  <div class="overflow-y-auto max-h-[300px] py-3 flex flex-col gap-3">
                    {cart.map(item => (
                      <div key={item.id} class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-sm">
                        <div class="flex-1">
                          <h4 class="font-bold text-slate-800">{item.name}</h4>
                          <span class="text-xs text-slate-500">
                            {(item.price * item.quantity).toFixed(2)} ر.س
                          </span>
                        </div>
                        
                        <div class="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            class="w-6 h-6 rounded bg-slate-200 flex items-center justify-center font-bold hover:bg-slate-300"
                          >
                            -
                          </button>
                          <span class="font-bold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            class="w-6 h-6 rounded bg-slate-200 flex items-center justify-center font-bold hover:bg-slate-300"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div class="text-center py-12 text-slate-400">
                        السلة فارغة. انقر على المنتجات لإضافتها!
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing & Checkout */}
                <div class="border-t border-slate-100 pt-4 flex flex-col gap-3">
                  <div class="flex justify-between text-sm text-slate-500">
                    <span>المجموع الفرعي:</span>
                    <span class="font-bold">{cartSubtotal.toFixed(2)} ر.س</span>
                  </div>
                  <div class="flex justify-between text-sm text-slate-500">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span class="font-bold">{cartTax.toFixed(2)} ر.س</span>
                  </div>
                  <div class="flex justify-between text-lg font-black text-slate-800 border-t border-slate-100 pt-2">
                    <span>الإجمالي الكلي:</span>
                    <span class="text-blue-600">{cartTotal.toFixed(2)} ر.س</span>
                  </div>

                  {/* Payment selection */}
                  <div class="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      class={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        paymentMethod === 'cash' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Coins size={14} />
                      دفع نقدي
                    </button>
                    <button
                      onClick={() => {
                        setPaymentMethod('card');
                        setCashReceived(cartTotal.toFixed(2));
                      }}
                      class={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        paymentMethod === 'card' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Check size={14} />
                      دفع بالشبكة
                    </button>
                  </div>

                  {paymentMethod === 'cash' && cart.length > 0 && (
                    <div class="mt-2 text-sm">
                      <label class="block text-xs font-semibold text-slate-500 mb-1">المبلغ النقدي المستلم:</label>
                      <input
                        type="number"
                        placeholder="أدخل المبلغ المقبوض..."
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        class="w-full px-3 py-2 rounded-lg bg-slate-100 border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {parseFloat(cashReceived) >= cartTotal && (
                        <div class="text-xs text-emerald-600 font-bold mt-1 text-left">
                          المتبقي للعميل: {(parseFloat(cashReceived) - cartTotal).toFixed(2)} ر.س
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    disabled={cart.length === 0}
                    onClick={handleCheckout}
                    class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:bg-slate-200 disabled:text-slate-400 mt-2 flex items-center justify-center gap-2 shadow"
                  >
                    <Check size={18} />
                    إنشاء وحفظ الفاتورة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div class="flex flex-col gap-6">
              {/* Stat boxes */}
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 font-semibold">إجمالي المبيعات</p>
                    <h3 class="text-xl font-black text-slate-800 mt-1">
                      {stats.summary.totalSales.toFixed(2)} <span class="text-xs font-normal">ر.س</span>
                    </h3>
                  </div>
                </div>

                <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 font-semibold">عدد فواتير البيع</p>
                    <h3 class="text-xl font-black text-slate-800 mt-1">
                      {stats.summary.salesCount} <span class="text-xs font-normal">فاتورة</span>
                    </h3>
                  </div>
                </div>

                <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 font-semibold">منتجات منخفضة المخزون</p>
                    <h3 class="text-xl font-black text-slate-800 mt-1">
                      {stats.summary.lowStockItems} <span class="text-xs font-normal">أصناف</span>
                    </h3>
                  </div>
                </div>

                <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-inner">
                    <Package size={24} />
                  </div>
                  <div>
                    <p class="text-xs text-slate-500 font-semibold">إجمالي الأصناف المتاحة</p>
                    <h3 class="text-xl font-black text-slate-800 mt-1">
                      {stats.summary.totalProducts} <span class="text-xs font-normal">منتجات</span>
                    </h3>
                  </div>
                </div>
              </div>

              {/* Data Visualization / Grid split */}
              <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Sales Chart Panel */}
                <div class="xl:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
                  <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp size={18} class="text-slate-500" />
                    مخطط المبيعات اليومي (آخر 10 أيام)
                  </h3>
                  
                  {/* Custom rendered bar chart */}
                  <div class="h-64 flex items-end gap-4 pt-6 border-b border-slate-200 px-4">
                    {stats.chartData.map((data, idx) => {
                      const maxVal = Math.max(...stats.chartData.map(d => d.amount), 1);
                      const heightPercent = (data.amount / maxVal) * 80; // Scale to 80% max
                      return (
                        <div key={idx} class="flex-1 flex flex-col items-center gap-2 group relative">
                          {/* Tooltip */}
                          <div class="absolute bottom-full mb-1 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                            {data.amount.toFixed(2)} ر.س ({data.count} طلب)
                          </div>
                          
                          <div
                            style={{ height: `${heightPercent}%` }}
                            class="w-full bg-blue-600 hover:bg-blue-700 rounded-t-md transition-all cursor-pointer min-h-[10px]"
                          ></div>
                          
                          <span class="text-[9px] text-slate-500 font-mono mt-1 rotate-45 md:rotate-0">
                            {data.sale_date.split('-').slice(1).join('/')}
                          </span>
                        </div>
                      );
                    })}
                    {stats.chartData.length === 0 && (
                      <div class="w-full h-full flex items-center justify-center text-slate-400">
                        لا توجد بيانات مخطط كافية للرسم حالياً.
                      </div>
                    )}
                  </div>
                </div>

                {/* Best Selling Products */}
                <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
                  <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Layers size={18} class="text-slate-500" />
                    أفضل 5 منتجات مبيعاً
                  </h3>
                  
                  <div class="flex flex-col gap-4">
                    {stats.topSelling.map((prod, idx) => (
                      <div key={idx} class="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                        <div class="flex items-center gap-3">
                          <span class="w-6 h-6 rounded bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 class="font-bold text-slate-800 text-xs">{prod.name}</h4>
                            <span class="text-[10px] text-slate-400">تم بيع {prod.quantity} قطعة</span>
                          </div>
                        </div>
                        <span class="text-blue-600 text-xs font-black">
                          {prod.total.toFixed(2)} ر.س
                        </span>
                      </div>
                    ))}
                    {stats.topSelling.length === 0 && (
                      <div class="text-center py-12 text-slate-400">
                        لا توجد بيانات مبيعات كافية لعرض المنتجات الأكثر طلباً.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === 'inventory' && (
            <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 class="font-bold text-lg text-slate-800">إدارة المستودع وقائمة المنتجات</h2>
                  <p class="text-xs text-slate-500">قم بإضافة وتعديل وحذف الأصناف مع تحديث فوري للمخزون</p>
                </div>
                <button
                  onClick={() => openAddModal(null)}
                  class="bg-blue-600 text-white hover:bg-blue-700 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md"
                >
                  <Plus size={16} />
                  إضافة صنف جديد
                </button>
              </div>

              {/* Items Table list */}
              <div class="overflow-x-auto">
                <table class="w-full text-right text-sm">
                  <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
                    <tr>
                      <th class="py-3 px-4 font-bold border-b">كود الصنف</th>
                      <th class="py-3 px-4 font-bold border-b">اسم الصنف</th>
                      <th class="py-3 px-4 font-bold border-b">التصنيف</th>
                      <th class="py-3 px-4 font-bold border-b">سعر البيع</th>
                      <th class="py-3 px-4 font-bold border-b">المخزون الحالي</th>
                      <th class="py-3 px-4 font-bold border-b">الرمز الشريطي</th>
                      <th class="py-3 px-4 font-bold border-b text-center">العمليات</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    {items.map(item => (
                      <tr key={item.id} class="hover:bg-slate-50/50 transition">
                        <td class="py-3 px-4 font-mono text-xs text-slate-500">#{item.id}</td>
                        <td class="py-3 px-4 font-bold text-slate-800">{item.name}</td>
                        <td class="py-3 px-4">
                          <span class="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">
                            {item.category_name}
                          </span>
                        </td>
                        <td class="py-3 px-4 font-bold text-blue-600">{item.price.toFixed(2)} ر.س</td>
                        <td class="py-3 px-4">
                          <span class={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            item.stock === 0 
                              ? 'bg-red-50 text-red-700' 
                              : item.stock <= 10 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {item.stock === 0 ? 'منتهي المخزون' : `${item.stock} وحدات`}
                          </span>
                        </td>
                        <td class="py-3 px-4 font-mono text-xs text-slate-500">{item.barcode || 'غير محدد'}</td>
                        <td class="py-3 px-4 flex items-center justify-center gap-2">
                          <button
                            onClick={() => openAddModal(item)}
                            class="w-8 h-8 rounded bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition"
                            title="تعديل الصنف"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            class="w-8 h-8 rounded bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition"
                            title="حذف الصنف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan="7" class="text-center py-12 text-slate-400">
                          لا توجد أصناف في المستودع حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SALES HISTORY */}
          {activeTab === 'history' && (
            <div class="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h2 class="font-bold text-lg text-slate-800">سجل فواتير المبيعات السابقة</h2>
                  <p class="text-xs text-slate-500">راجع جميع المعاملات التي تمت عبر قاعدة البيانات المحلية</p>
                </div>
              </div>

              {/* Invoices List Table */}
              <div class="overflow-x-auto">
                <table class="w-full text-right text-sm">
                  <thead class="bg-slate-50 text-slate-500 uppercase text-xs">
                    <tr>
                      <th class="py-3 px-4 font-bold border-b">رقم الفاتورة</th>
                      <th class="py-3 px-4 font-bold border-b">التاريخ والوقت</th>
                      <th class="py-3 px-4 font-bold border-b">عدد الأصناف</th>
                      <th class="py-3 px-4 font-bold border-b">طريقة الدفع</th>
                      <th class="py-3 px-4 font-bold border-b">المبلغ الإجمالي</th>
                      <th class="py-3 px-4 font-bold border-b text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    {salesHistory.map(sale => (
                      <tr key={sale.id} class="hover:bg-slate-50/50 transition">
                        <td class="py-3 px-4 font-bold font-mono text-xs text-slate-700">INV-#{sale.id}</td>
                        <td class="py-3 px-4 font-mono text-xs text-slate-500">
                          {new Date(sale.created_at).toLocaleString('ar-SA')}
                        </td>
                        <td class="py-3 px-4">{sale.items_count} عناصر</td>
                        <td class="py-3 px-4">
                          <span class={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            sale.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {sale.payment_method === 'cash' ? 'نقدي' : 'شبكة مدا'}
                          </span>
                        </td>
                        <td class="py-3 px-4 font-extrabold text-blue-600">{sale.total.toFixed(2)} ر.س</td>
                        <td class="py-3 px-4 text-center">
                          <button
                            onClick={async () => {
                              // Re-simulate receipt modal
                              try {
                                const res = await fetch('/api/items'); // Refresh mock array
                                const itemsArray = await res.json();
                                setLastReceipt({
                                  id: sale.id,
                                  date: new Date(sale.created_at).toLocaleString('ar-SA'),
                                  items: [], // Simplification
                                  subtotal: sale.total / 1.15,
                                  tax: sale.total - (sale.total / 1.15),
                                  total: sale.total,
                                  paymentMethod: sale.payment_method,
                                  cashReceived: sale.cash_received || sale.total,
                                  changeGiven: sale.change_given || 0,
                                  isRecreated: true
                                });
                                setShowReceipt(true);
                              } catch (e) {}
                            }}
                            class="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 mx-auto"
                          >
                            <Printer size={12} />
                            عرض الإيصال
                          </button>
                        </td>
                      </tr>
                    ))}
                    {salesHistory.length === 0 && (
                      <tr>
                        <td colSpan="6" class="text-center py-12 text-slate-400">
                          لم يتم تسجيل أي مبيعات بعد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {showAddModal && (
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div class="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <h3 class="font-bold text-sm">{isEditing ? 'تعديل صنف مخزون' : 'إضافة صنف مخزون جديد'}</h3>
              <button onClick={() => setShowAddModal(false)} class="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} class="p-5 flex flex-col gap-4 text-sm">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">اسم الصنف:</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="مثال: فلات وايت دوبل"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">السعر (ر.س):</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">الكمية بالمخزن:</label>
                  <input
                    type="number"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">التصنيف:</label>
                <select
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="مشروبات ساخنة">مشروبات ساخنة</option>
                  <option value="مشروبات باردة">مشروبات باردة</option>
                  <option value="حلويات ومخبوزات">حلويات ومخبوزات</option>
                  <option value="مأكولات وجبات">مأكولات وجبات</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">الرمز الشريطي / الباركود (اختياري):</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="Barcode / SKU"
                />
              </div>

              <div class="flex gap-3 justify-end mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINT RECEIPT SIMULATION */}
      {showReceipt && lastReceipt && (
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100">
            <div class="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center">
              <span class="text-xs font-bold flex items-center gap-1.5">
                <Printer size={14} />
                محاكي طابعة الفواتير الحرارية
              </span>
              <button onClick={() => setShowReceipt(false)} class="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Receipt Body */}
            <div class="p-6 bg-amber-50/20 text-slate-800 text-sm font-mono flex flex-col gap-3">
              <div class="text-center pb-3 border-b border-dashed border-slate-300">
                <h3 class="font-extrabold text-lg">أومني سيستم برو</h3>
                <p class="text-xs text-slate-500 mt-1">شارع العليا العام - الرياض</p>
                <p class="text-[11px] text-slate-400">الرقم الضريبي: 300054321110003</p>
              </div>

              <div class="text-xs flex flex-col gap-1 text-slate-600 border-b border-dashed border-slate-300 pb-2">
                <div class="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span class="font-bold">INV-#{lastReceipt.id}</span>
                </div>
                <div class="flex justify-between">
                  <span>التاريخ:</span>
                  <span>{lastReceipt.date}</span>
                </div>
                <div class="flex justify-between">
                  <span>الكاشير:</span>
                  <span>أدمن النظام</span>
                </div>
                <div class="flex justify-between">
                  <span>طريقة الدفع:</span>
                  <span class="font-bold">{lastReceipt.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة شبكة'}</span>
                </div>
              </div>

              {/* Receipt Items */}
              <div class="flex flex-col gap-2 pb-2 border-b border-dashed border-slate-300 text-xs">
                {lastReceipt.items.map((item, idx) => (
                  <div key={idx} class="flex justify-between">
                    <span class="flex-1 text-right">{item.name} x {item.quantity}</span>
                    <span class="font-bold">{(item.price * item.quantity).toFixed(2)} ر.س</span>
                  </div>
                ))}
                {lastReceipt.isRecreated && (
                  <div class="text-center py-2 text-slate-500 italic">
                    تمت طباعة تفاصيل الفاتورة من السجل الرئيسي لقاعدة البيانات بنجاح.
                  </div>
                )}
              </div>

              {/* Totals */}
              <div class="flex flex-col gap-1.5 text-xs">
                <div class="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{lastReceipt.subtotal.toFixed(2)} ر.س</span>
                </div>
                <div class="flex justify-between">
                  <span>الضريبة (15%):</span>
                  <span>{lastReceipt.tax.toFixed(2)} ر.س</span>
                </div>
                <div class="flex justify-between text-base font-black text-slate-800 border-t border-dashed border-slate-300 pt-2">
                  <span>المجموع النهائي:</span>
                  <span class="text-blue-600">{lastReceipt.total.toFixed(2)} ر.س</span>
                </div>
              </div>

              {lastReceipt.paymentMethod === 'cash' && (
                <div class="text-[11px] text-slate-500 flex flex-col gap-0.5 border-t border-dashed border-slate-200 pt-1.5">
                  <div class="flex justify-between">
                    <span>المدفوع نقداً:</span>
                    <span>{lastReceipt.cashReceived.toFixed(2)} ر.س</span>
                  </div>
                  <div class="flex justify-between">
                    <span>المتبقي للعميل:</span>
                    <span>{lastReceipt.changeGiven.toFixed(2)} ر.س</span>
                  </div>
                </div>
              )}

              <div class="text-center text-[10px] text-slate-400 mt-4">
                شكراً لزيارتكم - يسعدنا دائماً خدمتكم!
              </div>
            </div>

            <div class="p-4 bg-slate-50 flex gap-2 border-t border-slate-100">
              <button
                onClick={() => {
                  window.print();
                }}
                class="flex-1 bg-slate-800 text-white font-bold py-2 rounded-xl text-xs hover:bg-slate-900 transition flex items-center justify-center gap-1.5"
              >
                <Printer size={14} />
                طباعة الفاتورة الحقيقية
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
