import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import TableManagement from "./pages/TableManagement";
import Menu from "./pages/Menu";
import CategoriesManagement from "./pages/CategoriesManagement";
import ModifiersManagement from "./pages/ModifiersManagement";
import MenuItemsManagement from "./pages/MenuItemsManagement";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          
          <Route path="/*" element={
            <ProtectedRoute roles={['admin', 'super_admin']}>
              <AdminLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/tables" element={<TableManagement />} />
                  <Route path="/menu" element={<Menu />} />
                  <Route path="/categories" element={<CategoriesManagement />} />
                  <Route path="/modifiers" element={<ModifiersManagement />} />
                  <Route path="/items" element={<MenuItemsManagement />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
