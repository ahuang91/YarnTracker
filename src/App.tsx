import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import AuthScreen from './components/AuthScreen';
import AdminPage from './components/AdminPage';
import YarnTracker from './components/YarnTracker';
import { LogOut, Shield } from 'lucide-react';

function AppContent() {
  const { user, isLoading, logout } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <p className="text-purple-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (showAdmin && user.isAdmin) {
    return <AdminPage onBack={() => setShowAdmin(false)} />;
  }

  return (
    <div className="relative">
      <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
        {user.isAdmin && (
          <button
            onClick={() => setShowAdmin(true)}
            className="flex items-center gap-1 bg-white/80 backdrop-blur text-purple-600 hover:text-purple-800 px-3 py-1.5 rounded-lg text-sm shadow"
          >
            <Shield size={14} />
            Admin
          </button>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1 bg-white/80 backdrop-blur text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-sm shadow"
        >
          <LogOut size={14} />
          {user.username}
        </button>
      </div>
      <YarnTracker />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App
