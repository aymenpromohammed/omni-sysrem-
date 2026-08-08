import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/components/auth-provider";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Pos from "@/pages/pos";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Categories from "@/pages/categories";
import Orders from "@/pages/orders";
import Customers from "@/pages/customers";
import Users from "@/pages/users";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import PrintLog from "@/pages/print-log";
import HR from "@/pages/hr";
import Returns from "@/pages/returns";
import Accounting from "@/pages/accounting";
import DocumentPrintSettingsPage from "@/pages/document-print-settings";
import OnyxErp from "@/pages/onyx-erp";
import Licenses from "@/pages/licenses";
import Suppliers from "@/pages/suppliers";
import Expenses from "@/pages/expenses";
import Inventory from "@/pages/inventory";
import Branches from "@/pages/branches";
import Tables from "@/pages/tables";
import Shifts from "@/pages/shifts";
import Currencies from "@/pages/currencies";
import Audit from "@/pages/audit";
import SystemGuidePage from "@/pages/system-guide";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/pos">
        <ProtectedRoute><Pos /></ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/products">
        <ProtectedRoute requireAdmin><Products /></ProtectedRoute>
      </Route>
      <Route path="/categories">
        <ProtectedRoute requireAdmin><Categories /></ProtectedRoute>
      </Route>
      <Route path="/orders">
        <ProtectedRoute requireAdmin><Orders /></ProtectedRoute>
      </Route>
      <Route path="/customers">
        <ProtectedRoute requireAdmin><Customers /></ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute requireAdmin><Users /></ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute requireAdmin><Reports /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute requireAdmin><Settings /></ProtectedRoute>
      </Route>
      <Route path="/print-log">
        <ProtectedRoute requireAdmin><PrintLog /></ProtectedRoute>
      </Route>
      <Route path="/hr">
        <ProtectedRoute requireAdmin><HR /></ProtectedRoute>
      </Route>
      <Route path="/accounting">
        <ProtectedRoute requireAdmin><Accounting /></ProtectedRoute>
      </Route>
      <Route path="/document-print-settings">
        <ProtectedRoute requireAdmin><DocumentPrintSettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/returns">
        <ProtectedRoute requireAdmin><Returns /></ProtectedRoute>
      </Route>
      <Route path="/onyx-erp">
        <ProtectedRoute requireAdmin><OnyxErp /></ProtectedRoute>
      </Route>
      <Route path="/licenses">
        <ProtectedRoute requireAdmin><Licenses /></ProtectedRoute>
      </Route>
      <Route path="/suppliers">
        <ProtectedRoute requireAdmin><Suppliers /></ProtectedRoute>
      </Route>
      <Route path="/expenses">
        <ProtectedRoute requireAdmin><Expenses /></ProtectedRoute>
      </Route>
      <Route path="/inventory">
        <ProtectedRoute requireAdmin><Inventory /></ProtectedRoute>
      </Route>
      <Route path="/branches">
        <ProtectedRoute requireAdmin><Branches /></ProtectedRoute>
      </Route>
      <Route path="/tables">
        <ProtectedRoute requireAdmin><Tables /></ProtectedRoute>
      </Route>
      <Route path="/shifts">
        <ProtectedRoute requireAdmin><Shifts /></ProtectedRoute>
      </Route>
      <Route path="/currencies">
        <ProtectedRoute requireAdmin><Currencies /></ProtectedRoute>
      </Route>
      <Route path="/audit">
        <ProtectedRoute requireAdmin><Audit /></ProtectedRoute>
      </Route>
      <Route path="/system-guide">
        <ProtectedRoute><SystemGuidePage /></ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute><Pos /></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={((import.meta as any).env?.BASE_URL || "").replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
