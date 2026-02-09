import { useState } from 'react';

interface ResetPasswordFormProps {
  onSwitchToLogin: () => void;
}

export default function ResetPasswordForm({ onSwitchToLogin }: ResetPasswordFormProps) {
  const [step, setStep] = useState<'username' | 'answer'>('username');
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const res = await fetch(`/api/auth/security-question?username=${encodeURIComponent(username)}`);
    const data = await res.json();

    if (!data.question) {
      setError('Username not found');
    } else {
      setQuestion(data.question);
      setStep('answer');
    }
    setIsSubmitting(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, securityAnswer, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Reset failed');
    } else {
      setSuccess(true);
    }
    setIsSubmitting(false);
  };

  if (success) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-purple-800 mb-4">Password Reset</h1>
        <p className="text-green-600 mb-6">Your password has been reset successfully.</p>
        <button
          onClick={onSwitchToLogin}
          className="bg-gradient-to-r from-pink-300 to-purple-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-purple-400 transition-all shadow-lg"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold text-purple-800 mb-2 text-center">Reset Password</h1>
      <p className="text-purple-500 mb-8 text-center">
        {step === 'username' ? 'Enter your username to get started' : 'Answer your security question'}
      </p>

      {step === 'username' ? (
        <form onSubmit={handleLookup} className="space-y-4">
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

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-pink-300 to-purple-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-purple-400 transition-all shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Looking up...' : 'Next'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="bg-purple-50 p-4 rounded-xl">
            <p className="text-sm text-purple-700 font-medium">{question}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Answer</label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-pink-300 to-purple-300 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-purple-400 transition-all shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center">
        <button
          onClick={onSwitchToLogin}
          className="text-purple-500 hover:text-purple-700 text-sm"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
