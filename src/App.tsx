import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { RegisterForm } from './components/Auth/RegisterForm';
import { Dashboard } from './components/Dashboard/Dashboard';
import { AdminPanel } from './components/Admin/AdminPanel';
import { ShareCategoryModal } from './components/Modals/ShareCategoryModal';

function AppContent() {
  const { user, loading, profile } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [shareCategoryId, setShareCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile?.theme]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#f05a28] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Načítání...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return showRegister ? (
      <RegisterForm onToggleForm={() => setShowRegister(false)} />
    ) : (
      <LoginForm onToggleForm={() => setShowRegister(true)} />
    );
  }

  return (
    <>
      <Dashboard />
      {profile?.role === 'admin' && (
        <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} />
      )}
      {shareCategoryId && (
        <ShareCategoryModal
          isOpen={true}
          categoryId={shareCategoryId}
          onClose={() => setShareCategoryId(null)}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
