import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

// ==========================================
// 1. PASSENGERS MANAGEMENT (المسافرين)
// ==========================================
router.get("/travel/passengers", (req, res) => {
  const { customer_id, search } = req.query;
  let sql = `
    SELECT p.*, c.name as customer_name, c.customer_type
    FROM travel_passengers p
    LEFT JOIN customers c ON c.id = p.customer_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (customer_id) {
    sql += ` AND p.customer_id = ?`;
    params.push(customer_id);
  }
  if (search) {
    sql += ` AND (p.name_ar LIKE ? OR p.name_en LIKE ? OR p.passport_number LIKE ? OR p.phone LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  sql += ` ORDER BY p.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/passengers", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    customer_id, name_ar, name_en, title, dob, gender, nationality,
    passport_number, passport_issue_date, passport_expiry_date,
    passport_issue_place, passport_type, national_id, phone, email, special_notes
  } = req.body;

  if (!name_ar || !name_en) {
    res.status(400).json({ error: "الاسم بالعربية والإنجليزية مطلوبة حسب جواز السفر" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_passengers (
      customer_id, name_ar, name_en, title, dob, gender, nationality,
      passport_number, passport_issue_date, passport_expiry_date,
      passport_issue_place, passport_type, national_id, phone, email, special_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    customer_id || null, name_ar, name_en, title || 'Mr', dob || null, gender || null, nationality || null,
    passport_number || null, passport_issue_date || null, passport_expiry_date || null,
    passport_issue_place || null, passport_type || 'عادي', national_id || null, phone || null, email || null, special_notes || null
  );

  const newPax = db.prepare(`
    SELECT p.*, c.name as customer_name
    FROM travel_passengers p
    LEFT JOIN customers c ON c.id = p.customer_id
    WHERE p.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(newPax);
});

router.put("/travel/passengers/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    customer_id, name_ar, name_en, title, dob, gender, nationality,
    passport_number, passport_issue_date, passport_expiry_date,
    passport_issue_place, passport_type, national_id, phone, email, special_notes
  } = req.body;

  db.prepare(`
    UPDATE travel_passengers SET
      customer_id = ?, name_ar = ?, name_en = ?, title = ?, dob = ?, gender = ?, nationality = ?,
      passport_number = ?, passport_issue_date = ?, passport_expiry_date = ?,
      passport_issue_place = ?, passport_type = ?, national_id = ?, phone = ?, email = ?, special_notes = ?
    WHERE id = ?
  `).run(
    customer_id || null, name_ar, name_en, title || 'Mr', dob || null, gender || null, nationality || null,
    passport_number || null, passport_issue_date || null, passport_expiry_date || null,
    passport_issue_place || null, passport_type || 'عادي', national_id || null, phone || null, email || null, special_notes || null,
    req.params.id
  );

  const updatedPax = db.prepare(`
    SELECT p.*, c.name as customer_name
    FROM travel_passengers p
    LEFT JOIN customers c ON c.id = p.customer_id
    WHERE p.id = ?
  `).get(req.params.id);

  res.json(updatedPax);
});

router.delete("/travel/passengers/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_passengers WHERE id = ?").run(req.params.id);
  res.status(204).send();
});


// ==========================================
// 2. BOOKINGS & FLIGHT TICKETS (الحجوزات والتذاكر)
// ==========================================
router.get("/travel/bookings", (req, res) => {
  const { customer_id, status, service_type, search } = req.query;
  let sql = `
    SELECT b.*, c.name as customer_name, c.phone as customer_phone,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (customer_id) { sql += ` AND b.customer_id = ?`; params.push(customer_id); }
  if (status) { sql += ` AND b.status = ?`; params.push(status); }
  if (service_type) { sql += ` AND b.service_type = ?`; params.push(service_type); }
  if (search) {
    sql += ` AND (b.booking_number LIKE ? OR b.ticket_number LIKE ? OR b.pnr LIKE ? OR c.name LIKE ? OR p.name_ar LIKE ? OR p.name_en LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s);
  }

  sql += ` ORDER BY b.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/bookings", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    booking_number, service_type, customer_id, passenger_id, airline_supplier, flight_number,
    origin_city, destination_city, departure_date, return_date, ticket_number, pnr,
    status, issue_date, cost_price, selling_price, payment_status, payment_method, notes, missing_docs
  } = req.body;

  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = sell - cost;
  const num = booking_number || `BK-${Date.now().toString().slice(-6)}`;

  const stmt = db.prepare(`
    INSERT INTO travel_bookings (
      booking_number, service_type, customer_id, passenger_id, airline_supplier, flight_number,
      origin_city, destination_city, departure_date, return_date, ticket_number, pnr,
      status, issue_date, cost_price, selling_price, commission, payment_status, payment_method,
      user_id, user_name, notes, missing_docs
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    num, service_type || 'flight', customer_id || null, passenger_id || null, airline_supplier || null, flight_number || null,
    origin_city || null, destination_city || null, departure_date || null, return_date || null, ticket_number || null, pnr || null,
    status || 'confirmed', issue_date || new Date().toISOString().slice(0, 10), cost, sell, comm, payment_status || 'paid', payment_method || 'cash',
    user.id, user.name, notes || null, missing_docs || null
  );

  const newBooking = db.prepare(`
    SELECT b.*, c.name as customer_name, p.name_ar as passenger_name_ar
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(newBooking);
});

router.put("/travel/bookings/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    service_type, customer_id, passenger_id, airline_supplier, flight_number,
    origin_city, destination_city, departure_date, return_date, ticket_number, pnr,
    status, issue_date, cost_price, selling_price, payment_status, payment_method, notes, missing_docs
  } = req.body;

  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = sell - cost;

  db.prepare(`
    UPDATE travel_bookings SET
      service_type = ?, customer_id = ?, passenger_id = ?, airline_supplier = ?, flight_number = ?,
      origin_city = ?, destination_city = ?, departure_date = ?, return_date = ?, ticket_number = ?, pnr = ?,
      status = ?, issue_date = ?, cost_price = ?, selling_price = ?, commission = ?, payment_status = ?, payment_method = ?,
      notes = ?, missing_docs = ?
    WHERE id = ?
  `).run(
    service_type || 'flight', customer_id || null, passenger_id || null, airline_supplier || null, flight_number || null,
    origin_city || null, destination_city || null, departure_date || null, return_date || null, ticket_number || null, pnr || null,
    status || 'confirmed', issue_date || null, cost, sell, comm, payment_status || 'paid', payment_method || 'cash',
    notes || null, missing_docs || null, req.params.id
  );

  const updated = db.prepare(`
    SELECT b.*, c.name as customer_name, p.name_ar as passenger_name_ar
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.id = ?
  `).get(req.params.id);

  res.json(updated);
});

router.delete("/travel/bookings/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_bookings WHERE id = ?").run(req.params.id);
  res.status(204).send();
});


// ==========================================
// 3. VISAS MANAGEMENT (التأشيرات)
// ==========================================
router.get("/travel/visas", (req, res) => {
  const { customer_id, status } = req.query;
  let sql = `
    SELECT v.*, c.name as customer_name, p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number
    FROM travel_visas v
    LEFT JOIN customers c ON c.id = v.customer_id
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (customer_id) { sql += ` AND v.customer_id = ?`; params.push(customer_id); }
  if (status) { sql += ` AND v.status = ?`; params.push(status); }

  sql += ` ORDER BY v.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/visas", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { customer_id, passenger_id, country, visa_type, status, application_date, expiry_date, cost_price, selling_price, missing_docs, notes } = req.body;
  const vNum = `VSA-${Date.now().toString().slice(-6)}`;

  const stmt = db.prepare(`
    INSERT INTO travel_visas (visa_number, customer_id, passenger_id, country, visa_type, status, application_date, expiry_date, cost_price, selling_price, missing_docs, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    vNum, customer_id || null, passenger_id || null, country, visa_type || 'سياحية', status || 'under_process',
    application_date || new Date().toISOString().slice(0, 10), expiry_date || null,
    Number(cost_price || 0), Number(selling_price || 0), missing_docs || null, notes || null
  );

  const newVisa = db.prepare(`SELECT * FROM travel_visas WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(newVisa);
});

router.put("/travel/visas/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { country, visa_type, status, application_date, expiry_date, cost_price, selling_price, missing_docs, notes } = req.body;
  db.prepare(`
    UPDATE travel_visas SET country=?, visa_type=?, status=?, application_date=?, expiry_date=?, cost_price=?, selling_price=?, missing_docs=?, notes=?
    WHERE id=?
  `).run(
    country, visa_type, status, application_date, expiry_date,
    Number(cost_price || 0), Number(selling_price || 0), missing_docs, notes, req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_visas WHERE id = ?").get(req.params.id);
  res.json(updated);
});


// ==========================================
// 4. HOTELS MANAGEMENT (الفنادق)
// ==========================================
router.get("/travel/hotels", (req, res) => {
  const { customer_id } = req.query;
  let sql = `
    SELECT h.*, c.name as customer_name, p.name_ar as passenger_name_ar
    FROM travel_hotels h
    LEFT JOIN customers c ON c.id = h.customer_id
    LEFT JOIN travel_passengers p ON p.id = h.passenger_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (customer_id) { sql += ` AND h.customer_id = ?`; params.push(customer_id); }

  sql += ` ORDER BY h.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/hotels", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { customer_id, passenger_id, hotel_name, city_country, check_in, check_out, room_type, nights, cost_price, selling_price, status, notes } = req.body;
  const ref = `HTL-${Date.now().toString().slice(-6)}`;

  const stmt = db.prepare(`
    INSERT INTO travel_hotels (booking_ref, customer_id, passenger_id, hotel_name, city_country, check_in, check_out, room_type, nights, cost_price, selling_price, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    ref, customer_id || null, passenger_id || null, hotel_name, city_country,
    check_in || null, check_out || null, room_type || 'مزدوجة', Number(nights || 1),
    Number(cost_price || 0), Number(selling_price || 0), status || 'confirmed', notes || null
  );

  const newHtl = db.prepare("SELECT * FROM travel_hotels WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newHtl);
});


// ==========================================
// 5. CONTACT LOGS (سجل التواصل)
// ==========================================
router.get("/travel/contact-logs", (req, res) => {
  const { customer_id } = req.query;
  if (!customer_id) { res.json([]); return; }
  const rows = db.prepare("SELECT * FROM travel_contact_logs WHERE customer_id = ? ORDER BY id DESC").all(customer_id);
  res.json(rows);
});

router.post("/travel/contact-logs", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { customer_id, contact_type, summary } = req.body;
  if (!customer_id || !summary) {
    res.status(400).json({ error: "العميل والملخص مطلوبان" });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO travel_contact_logs (customer_id, contact_type, summary, user_name)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(customer_id, contact_type || 'اتصال', summary, user.name);
  const newLog = db.prepare("SELECT * FROM travel_contact_logs WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newLog);
});


// ==========================================
// 6. DETAILED CLIENT PROFILE (ملف العميل الموحد)
// ==========================================
router.get("/travel/customer-profile/:id", (req, res) => {
  const custId = req.params.id;

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(custId);
  if (!customer) {
    res.status(404).json({ error: "العميل غير موجود" });
    return;
  }

  const passengers = db.prepare("SELECT * FROM travel_passengers WHERE customer_id = ? ORDER BY id DESC").all(custId);
  const bookings = db.prepare(`
    SELECT b.*, p.name_ar as passenger_name
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.customer_id = ? ORDER BY b.id DESC
  `).all(custId);

  const visas = db.prepare(`
    SELECT v.*, p.name_ar as passenger_name
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    WHERE v.customer_id = ? ORDER BY v.id DESC
  `).all(custId);

  const hotels = db.prepare(`
    SELECT h.*, p.name_ar as passenger_name
    FROM travel_hotels h
    LEFT JOIN travel_passengers p ON p.id = h.passenger_id
    WHERE h.customer_id = ? ORDER BY h.id DESC
  `).all(custId);

  const contactLogs = db.prepare("SELECT * FROM travel_contact_logs WHERE customer_id = ? ORDER BY id DESC").all(custId);

  // Financial Statement calculation
  const totalSales = (bookings as any[]).reduce((s, b) => s + (b.selling_price || 0), 0) +
                     (visas as any[]).reduce((s, v) => s + (v.selling_price || 0), 0) +
                     (hotels as any[]).reduce((s, h) => s + (h.selling_price || 0), 0);

  const paidBookings = (bookings as any[]).filter(b => b.payment_status === 'paid').reduce((s, b) => s + (b.selling_price || 0), 0);
  const dueAmount = totalSales - paidBookings;

  res.json({
    customer,
    passengers,
    bookings,
    visas,
    hotels,
    contactLogs,
    summary: {
      totalBookingsCount: bookings.length,
      totalVisasCount: visas.length,
      totalHotelsCount: hotels.length,
      totalSales,
      paidAmount: paidBookings,
      dueAmount
    }
  });
});


// ==========================================
// 7. COMPREHENSIVE TRAVEL DASHBOARD KPIS & CHARTS
// ==========================================
router.get("/travel/dashboard-stats", (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  // Today sales
  const todaySalesRow = db.prepare(`
    SELECT COALESCE(SUM(selling_price), 0) as total, COALESCE(SUM(commission), 0) as comm, COUNT(*) as cnt
    FROM travel_bookings WHERE issue_date = ?
  `).get(today) as any;

  // Month sales
  const monthSalesRow = db.prepare(`
    SELECT COALESCE(SUM(selling_price), 0) as total, COALESCE(SUM(commission), 0) as comm, COUNT(*) as cnt
    FROM travel_bookings WHERE issue_date >= ?
  `).get(monthStart) as any;

  // Expenses
  const monthExpRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE expense_date >= ?
  `).get(monthStart) as any;

  // Safe and Bank Balances
  const safes = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM safes WHERE active=1").get() as any;

  // Travel Counts
  const ticketCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_bookings WHERE service_type='flight' AND status='issued'").get() as any;
  const cancelledTicketCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_bookings WHERE status='cancelled'").get() as any;
  const visaCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_visas").get() as any;
  const hotelCount = db.prepare("SELECT COUNT(*) as cnt FROM travel_hotels").get() as any;

  // Due from customers & Due to suppliers
  const customerDebts = db.prepare("SELECT COALESCE(SUM(selling_price), 0) as total FROM travel_bookings WHERE payment_status='unpaid' OR payment_status='partial'").get() as any;

  // Recharts: Sales by Airline
  const airlineStats = db.prepare(`
    SELECT airline_supplier as name, COUNT(*) as count, SUM(selling_price) as value
    FROM travel_bookings
    WHERE airline_supplier IS NOT NULL AND airline_supplier != ''
    GROUP BY airline_supplier ORDER BY value DESC LIMIT 6
  `).all();

  // Recharts: Top Destinations
  const destStats = db.prepare(`
    SELECT destination_city as name, COUNT(*) as count
    FROM travel_bookings
    WHERE destination_city IS NOT NULL AND destination_city != ''
    GROUP BY destination_city ORDER BY count DESC LIMIT 6
  `).all();

  // Recharts: Sales by Service Type
  const serviceTypeStats = db.prepare(`
    SELECT service_type as name, SUM(selling_price) as value, COUNT(*) as count
    FROM travel_bookings
    GROUP BY service_type
  `).all();

  // Smart Alerts
  // 1. Expiring Passports (within 6 months)
  const expiringPassports = db.prepare(`
    SELECT id, name_ar, passport_number, passport_expiry_date
    FROM travel_passengers
    WHERE passport_expiry_date IS NOT NULL AND passport_expiry_date != '' AND passport_expiry_date <= date('now', '+6 months')
    LIMIT 10
  `).all();

  // 2. Visas Under Process
  const pendingVisas = db.prepare(`
    SELECT v.*, c.name as customer_name, p.name_ar as passenger_name
    FROM travel_visas v
    LEFT JOIN customers c ON c.id = v.customer_id
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    WHERE v.status = 'under_process' OR v.status = 'pending_docs'
  `).all();

  // 3. Upcoming Flight Departures (Next 7 days)
  const upcomingFlights = db.prepare(`
    SELECT b.*, c.name as customer_name, p.name_ar as passenger_name
    FROM travel_bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    WHERE b.departure_date >= date('now') AND b.departure_date <= date('now', '+7 days')
  `).all();

  res.json({
    kpis: {
      todaySales: todaySalesRow?.total || 0,
      todayBookings: todaySalesRow?.cnt || 0,
      monthSales: monthSalesRow?.total || 0,
      monthCommission: monthSalesRow?.comm || 0,
      netProfit: (monthSalesRow?.comm || 0) - (monthExpRow?.total || 0),
      monthExpenses: monthExpRow?.total || 0,
      safeBalance: safes?.total || 0,
      issuedTickets: ticketCount?.cnt || 0,
      cancelledTickets: cancelledTicketCount?.cnt || 0,
      visaTransactions: visaCount?.cnt || 0,
      hotelBookings: hotelCount?.cnt || 0,
      customerDebts: customerDebts?.total || 0
    },
    charts: {
      airlineStats,
      destStats,
      serviceTypeStats
    },
    alerts: {
      expiringPassports,
      pendingVisas,
      upcomingFlights
    }
  });
});

export default router;
