import { useQuery, useMutation } from "@tanstack/react-query";

// ─────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  name: string;
  role: "admin" | "cashier";
  active: boolean;
  createdAt?: string;
  [key: string]: any;
}

export interface UserInput {
  username: string;
  name: string;
  role: "admin" | "cashier";
  password?: string;
  active: boolean;
  [key: string]: any;
}

export interface UserUpdate {
  username?: string;
  name?: string;
  role?: "admin" | "cashier";
  password?: string | null;
  active?: boolean;
  [key: string]: any;
}

export interface Category {
  id: number;
  name: string;
  color?: string;
  [key: string]: any;
}

export interface CategoryInput {
  name: string;
  color?: string;
  [key: string]: any;
}

export interface Product {
  id: number;
  name: string;
  number: number;
  price: number;
  cost?: number | null;
  barcode?: string | null;
  categoryId?: number | null;
  active: boolean;
  stock?: number | null;
  [key: string]: any;
}

export interface ProductInput {
  name: string;
  number: number;
  price: number;
  cost?: number | null;
  barcode?: string | null;
  categoryId?: number | null;
  active: boolean;
  stock?: number | null;
  [key: string]: any;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  [key: string]: any;
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  [key: string]: any;
}

export interface OrderItemInput {
  productId: number;
  quantity: number;
  price?: number;
  [key: string]: any;
}

export interface Order {
  id: number;
  invoiceNumber: string;
  createdAt: string;
  createdBy: string;
  paymentMethod: "cash" | "card" | "mixed";
  total: number;
  discount: number;
  tax: number;
  subtotal: number;
  items: any[];
  [key: string]: any;
}

export interface SettingsInput {
  restaurantName?: string;
  businessName?: string;
  logoUrl?: string | null;
  taxRate: number;
  currency: string;
  masterCopiesCount: number;
  receiptMessage?: string;
  receiptPaperSize?: string;
  showNotes?: boolean;
  autoPrintTrigger?: string;
  maxReprintCount?: number;
  printLogo?: boolean;
  printQr?: boolean;
  showCashier?: boolean;
  showCustomer?: boolean;
  showOrderNumber?: boolean;
  showTableNumber?: boolean;
  showDateTime?: boolean;
  [key: string]: any;
}

export interface ReceiptCopyConfig {
  id: number;
  label: string;
  enabled: boolean;
  copyNumber?: number;
  [key: string]: any;
}

export interface DepartmentPrintConfig {
  id: number;
  categoryName: string;
  printerName: string;
  categoryId?: number;
  copies?: number;
  enabled?: boolean;
  printOrder?: number;
  [key: string]: any;
}

export interface PrinterSettingsInput {
  mainPrinterName?: string | null;
  paperWidth?: number;
  leftMargin?: number;
  rightMargin?: number;
  topMargin?: number;
  bottomMargin?: number;
  fontSize?: number;
  lineSpacing?: number;
  charactersPerLine?: number;
  [key: string]: any;
}

// ─────────────────────────────────────────────
// Fetch Engine
// ─────────────────────────────────────────────

let _baseUrl = "";
let _tokenGetter: (() => string | null) | null = null;

export function setBaseUrl(url: string) {
  _baseUrl = url;
}

export function setAuthTokenGetter(getter: () => string | null) {
  _tokenGetter = getter;
}

async function apiFetch(path: string, init?: RequestInit): Promise<any> {
  const url = `${_baseUrl}${path}`;
  const token = _tokenGetter ? _tokenGetter() : null;
  
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return response.json();
}

// ─────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────

export const getGetMeQueryKey = () => ["getMe"];
export const getGetCustomersQueryKey = () => ["customers"];
export const getGetCategoriesQueryKey = () => ["categories"];
export const getGetProductsQueryKey = () => ["products"];
export const getGetOrdersQueryKey = () => ["orders"];
export const getGetUsersQueryKey = () => ["users"];
export const getGetSettingsQueryKey = () => ["settings"];
export const getGetReceiptCopyConfigsQueryKey = () => ["receiptCopyConfigs"];
export const getGetDepartmentPrintConfigsQueryKey = () => ["departmentPrintConfigs"];
export const getGetPrinterSettingsQueryKey = () => ["printerSettings"];

// ─────────────────────────────────────────────
// Auth Hooks
// ─────────────────────────────────────────────

export function useGetMe(options?: { query?: any }) {
  return useQuery<any>({
    queryKey: getGetMeQueryKey(),
    queryFn: () => apiFetch("/api/auth/me"),
    ...options?.query,
  });
}

export function useLogin(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useLogout(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: () => apiFetch("/api/auth/logout", { method: "POST" }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Customer Hooks
// ─────────────────────────────────────────────

export function useGetCustomers(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: getGetCustomersQueryKey(),
    queryFn: () => apiFetch("/api/customers"),
    ...options?.query,
  });
}

export function useCreateCustomer(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/customers", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateCustomer(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number; data: any }) => apiFetch(`/api/customers/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteCustomer(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number }) => apiFetch(`/api/customers/${variables.id}`, {
      method: "DELETE",
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Category Hooks
// ─────────────────────────────────────────────

export function useGetCategories(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: getGetCategoriesQueryKey(),
    queryFn: () => apiFetch("/api/categories"),
    ...options?.query,
  });
}

export function useCreateCategory(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateCategory(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number; data: any }) => apiFetch(`/api/categories/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteCategory(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number }) => apiFetch(`/api/categories/${variables.id}`, {
      method: "DELETE",
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Product Hooks
// ─────────────────────────────────────────────

export function useGetProducts(params?: { search?: string }, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: [getGetProductsQueryKey(), params?.search],
    queryFn: () => {
      const queryStr = params?.search ? `?search=${encodeURIComponent(params.search)}` : "";
      return apiFetch(`/api/products${queryStr}`);
    },
    ...options?.query,
  });
}

export function useCreateProduct(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/products", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateProduct(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number; data: any }) => apiFetch(`/api/products/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteProduct(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number }) => apiFetch(`/api/products/${variables.id}`, {
      method: "DELETE",
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Order Hooks
// ─────────────────────────────────────────────

export function useGetOrders(params?: { startDate?: string; endDate?: string }, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: [getGetOrdersQueryKey(), params?.startDate, params?.endDate],
    queryFn: () => {
      const qParams = [];
      if (params?.startDate) qParams.push(`startDate=${encodeURIComponent(params.startDate)}`);
      if (params?.endDate) qParams.push(`endDate=${encodeURIComponent(params.endDate)}`);
      const queryStr = qParams.length ? `?${qParams.join("&")}` : "";
      return apiFetch(`/api/orders${queryStr}`);
    },
    ...options?.query,
  });
}

export function useCreateOrder(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteOrder(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number }) => apiFetch(`/api/orders/${variables.id}`, {
      method: "DELETE",
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// User Hooks
// ─────────────────────────────────────────────

export function useGetUsers(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: getGetUsersQueryKey(),
    queryFn: () => apiFetch("/api/users"),
    ...options?.query,
  });
}

export function useCreateUser(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useUpdateUser(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number; data: any }) => apiFetch(`/api/users/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteUser(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number }) => apiFetch(`/api/users/${variables.id}`, {
      method: "DELETE",
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Settings Hooks
// ─────────────────────────────────────────────

export function useGetSettings(params?: any, options?: { query?: any }) {
  return useQuery<any>({
    queryKey: getGetSettingsQueryKey(),
    queryFn: () => apiFetch("/api/settings"),
    ...options?.query,
  });
}

export function useUpdateSettings(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Receipt Copy Config Hooks
// ─────────────────────────────────────────────

export function useGetReceiptCopyConfigs(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: getGetReceiptCopyConfigsQueryKey(),
    queryFn: () => apiFetch("/api/print-config/receipt-copies"),
    ...options?.query,
  });
}

export function useUpdateReceiptCopyConfig(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number; data: any }) => apiFetch(`/api/print-config/receipt-copies/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useCreateReceiptCopyConfig(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/print-config/receipt-copies", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteReceiptCopyConfig(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number }) => apiFetch(`/api/print-config/receipt-copies/${variables.id}`, {
      method: "DELETE",
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Department Print Config Hooks
// ─────────────────────────────────────────────

export function useGetDepartmentPrintConfigs(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: getGetDepartmentPrintConfigsQueryKey(),
    queryFn: () => apiFetch("/api/print-config/departments"),
    ...options?.query,
  });
}

export function useUpdateDepartmentPrintConfig(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number; data: any }) => apiFetch(`/api/print-config/departments/${variables.id}`, {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useCreateDepartmentPrintConfig(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/print-config/departments", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

export function useDeleteDepartmentPrintConfig(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { id: number }) => apiFetch(`/api/print-config/departments/${variables.id}`, {
      method: "DELETE",
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Printer Settings Hooks
// ─────────────────────────────────────────────

export function useGetPrinterSettings(params?: any, options?: { query?: any }) {
  return useQuery<any>({
    queryKey: getGetPrinterSettingsQueryKey(),
    queryFn: () => apiFetch("/api/printer-settings"),
    ...options?.query,
  });
}

export function useUpdatePrinterSettings(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/printer-settings", {
      method: "PUT",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Print Log Hooks
// ─────────────────────────────────────────────

export function useGetPrintLogs(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: ["printLogs"],
    queryFn: () => apiFetch("/api/print-log"),
    ...options?.query,
  });
}

export function useCreatePrintLog(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: any }) => apiFetch("/api/print-log", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Print Direct Hook
// ─────────────────────────────────────────────

export function usePrintReceiptDirect(options?: { mutation?: any }) {
  return useMutation<any, any, any>({
    mutationFn: (variables: { data: { printerName: string; content: string; copies: number } }) => apiFetch("/api/printers/print-direct", {
      method: "POST",
      body: JSON.stringify(variables.data),
    }),
    ...options?.mutation,
  });
}

// ─────────────────────────────────────────────
// Dashboard Hooks
// ─────────────────────────────────────────────

export function useGetDashboardSummary(params?: any, options?: { query?: any }) {
  return useQuery<any>({
    queryKey: ["dashboardSummary"],
    queryFn: () => apiFetch("/api/dashboard/summary"),
    ...options?.query,
  });
}

export function useGetTopProducts(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: ["dashboardTopProducts"],
    queryFn: () => apiFetch("/api/dashboard/top-products"),
    ...options?.query,
  });
}

export function useGetSalesByHour(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: ["dashboardSalesByHour"],
    queryFn: () => apiFetch("/api/dashboard/sales-by-hour"),
    ...options?.query,
  });
}

// ─────────────────────────────────────────────
// Reports Hook
// ─────────────────────────────────────────────

export function useGetSalesReport(params?: { startDate?: string; endDate?: string; groupBy?: string; [key: string]: any }, options?: { query?: any }) {
  return useQuery<any>({
    queryKey: ["salesReport", params?.startDate, params?.endDate, params?.groupBy],
    queryFn: () => {
      const qParams = [];
      if (params?.startDate) qParams.push(`startDate=${encodeURIComponent(params.startDate)}`);
      if (params?.endDate) qParams.push(`endDate=${encodeURIComponent(params.endDate)}`);
      if (params?.groupBy) qParams.push(`groupBy=${encodeURIComponent(params.groupBy)}`);
      const queryStr = qParams.length ? `?${qParams.join("&")}` : "";
      return apiFetch(`/api/reports/sales${queryStr}`);
    },
    ...options?.query,
  });
}

// ─────────────────────────────────────────────
// Printers List Hook
// ─────────────────────────────────────────────

export function useGetPrintersList(params?: any, options?: { query?: any }) {
  return useQuery<any[]>({
    queryKey: ["printersList"],
    queryFn: () => apiFetch("/api/printers/list"),
    ...options?.query,
  });
}
