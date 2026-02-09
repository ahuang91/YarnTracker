import { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ResetPasswordForm from './ResetPasswordForm';

type AuthView = 'login' | 'signup' | 'reset';

export default function AuthScreen() {
  const [view, setView] = useState<AuthView>('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-blue-50 to-purple-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {view === 'login' && (
          <LoginForm
            onSwitchToSignup={() => setView('signup')}
            onSwitchToReset={() => setView('reset')}
          />
        )}
        {view === 'signup' && (
          <SignupForm onSwitchToLogin={() => setView('login')} />
        )}
        {view === 'reset' && (
          <ResetPasswordForm onSwitchToLogin={() => setView('login')} />
        )}
      </div>
    </div>
  );
}
