
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import { JewelryItem } from './types';

const App: React.FC = () => {
  const [jewelryItems, setJewelryItems] = useState<JewelryItem[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoadingJewelry, setIsLoadingJewelry] = useState(true);

  useEffect(() => {
    const fetchJewelry = async () => {
      setIsLoadingJewelry(true);
      try {
        const response = await fetch(`/rajaJewellers/api/get_jewelry.php?t=${Date.now()}`);
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          setJewelryItems(data);
        } catch (jsonErr) {
          // Sync issue with server
        }
      } catch (e) {
        // Handled by UI state (isLoadingJewelry)
      } finally {
        setIsLoadingJewelry(false);
      }
    };

    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/rajaJewellers/api/check_auth.php');
        const data = await response.json();
        setIsAuthenticated(data.authenticated === true);
      } catch (e) {
        setIsAuthenticated(false);
      }
    };

    fetchJewelry();
    checkAuthStatus();
  }, []);

  // Shared fetch function
  const refreshJewelry = async () => {
    try {
      const response = await fetch(`/rajaJewellers/api/get_jewelry.php?t=${Date.now()}`);
      const data = await response.json();
      setJewelryItems(data);
    } catch (e) {
      // Refresh failed silently
    }
  };

  const handleAddJewelry = async (newItem: JewelryItem) => {
    try {
      const response = await fetch('/rajaJewellers/api/add_jewelry.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (response.ok) {
        await refreshJewelry();
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to add jewelry');
      }
    } catch (e) {
      throw e;
    }
  };

  const handleDeleteJewelry = async (id: string) => {
    try {
      const response = await fetch(`/rajaJewellers/api/delete_jewelry.php?id=${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await refreshJewelry();
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete jewelry');
      }
    } catch (e) {
      // UI will handle via lack of refresh
    }
  };

  const handleUpdateJewelry = async (updatedItem: JewelryItem) => {
    try {
      const response = await fetch('/rajaJewellers/api/update_jewelry.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem)
      });
      if (response.ok) {
        await refreshJewelry();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // Protected Route Wrapper
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();

    if (isAuthenticated === null || isLoadingJewelry) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 border-4 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing with Hostinger...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
  };

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <BrowserRouter basename="/rajaJewellers">
        <Routes>
          <Route path="/" element={<LandingPage jewelryItems={jewelryItems} />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard
                  jewelryItems={jewelryItems}
                  onAdd={handleAddJewelry}
                  onDelete={handleDeleteJewelry}
                  onUpdate={handleUpdateJewelry}
                />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
};

export default App;
