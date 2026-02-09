import { useState } from 'react';
import { useAuth } from '../lib/auth-context';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onSwitchToReset: () => void;
}

export default function LoginForm({ onSwitchToSignup, onSwitchToReset }: LoginFormProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const result = await login(username, password);
    if (!result.ok) {
      setError(result.error ?? 'Login failed');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold text-purple-800 mb-2 text-center">Yarn Tracker</h1>
      <p className="text-purple-500 mb-8 text-center">Sign in to track your projects</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
            required
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-pink-300 to-purple-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-purple-400 transition-all shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center space-y-2">
        <button
          onClick={onSwitchToSignup}
          className="text-purple-500 hover:text-purple-700 text-sm"
        >
          Create an account
        </button>
        <br />
        <button
          onClick={onSwitchToReset}
          className="text-purple-400 hover:text-purple-600 text-sm"
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}
