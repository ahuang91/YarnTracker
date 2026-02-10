import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

interface AdminPageProps {
  onBack: () => void;
}

export default function AdminPage({ onBack }: AdminPageProps) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resetUsername, setResetUsername] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/admin?action=users')
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setIsLoading(false));
  }, []);

  const handleReset = async (username: string) => {
    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-password', username, newPassword }),
    });

    if (res.ok) {
      setMessage(`Password reset for ${username}`);
      setResetUsername(null);
      setNewPassword('');
    } else {
      const data = await res.json();
      setMessage(data.error ?? 'Reset failed');
    }
    setIsSubmitting(false);
  };

  const handleToggleAdmin = async (userId: string, username: string, newIsAdmin: boolean) => {
    setTogglingUserId(userId);
    setMessage('');
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-admin', userId, isAdmin: newIsAdmin }),
    });

    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isAdmin: newIsAdmin } : u)),
      );
      setMessage(`User ${username} was ${newIsAdmin ? 'promoted to admin' : 'demoted to member'}`);
    } else {
      const data = await res.json();
      setMessage(data.error ?? 'Failed to update role');
    }
    setTogglingUserId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-800 mb-6"
        >
          <ArrowLeft size={20} />
          Back to Projects
        </button>

        <h1 className="text-2xl font-bold text-purple-800 mb-6">Admin Dashboard</h1>

        {message && (
          <div className="bg-white rounded-xl p-4 mb-4 text-sm text-purple-700 shadow">
            {message}
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-500">Loading users...</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-xl p-4 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-800">{u.username}</span>
                    {u.isAdmin && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        admin
                      </span>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentUser?.id !== u.id && (
                      <button
                        onClick={() => handleToggleAdmin(u.id, u.username, !u.isAdmin)}
                        disabled={togglingUserId === u.id}
                        className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg transition-all disabled:opacity-50 ${
                          u.isAdmin
                            ? 'text-orange-600 hover:bg-orange-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {u.isAdmin ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                        {u.isAdmin ? 'Demote' : 'Promote'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setResetUsername(resetUsername === u.username ? null : u.username);
                        setNewPassword('');
                        setMessage('');
                      }}
                      className="text-sm text-purple-500 hover:text-purple-700"
                    >
                      Reset Password
                    </button>
                  </div>
                </div>

                {resetUsername === u.username && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                    <button
                      onClick={() => handleReset(u.username)}
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-pink-300 to-purple-300 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:from-pink-400 hover:to-purple-400 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? '...' : 'Reset'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
