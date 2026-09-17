import React, { useState } from 'react';

export const SettingsDangerZone: React.FC = () => {
  const [step, setStep] = useState<'idle' | 'confirm' | 'final'>('idle');
  const [typedText, setTypedText] = useState('');

  const handleWipe = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleCancel = () => {
    setStep('idle');
    setTypedText('');
  };

  return (
    <div>
      <h2 className="font-title-sm text-title-sm text-red-500 mt-4 mb-3">Danger Zone</h2>
      <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-6 flex flex-col items-start gap-4">
        <div>
          <h3 className="font-body-md font-medium text-red-500">Factory Reset</h3>
          <p className="text-body-sm opacity-70">This will permanently delete all shortcuts, blocked triggers, and custom settings.</p>
        </div>

        {/* Step 1: Initial button */}
        {step === 'idle' && (
          <button
            onClick={() => setStep('confirm')}
            className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-6 py-2 rounded-lg transition-colors font-body-sm font-semibold"
          >
            Wipe All Data
          </button>
        )}

        {/* Step 2: First confirmation */}
        {step === 'confirm' && (
          <div className="flex flex-col gap-3 w-full max-w-md">
            <p className="text-body-sm text-red-400 font-medium">Are you sure? This cannot be undone.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('final')}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-body-sm font-semibold"
              >
                Yes, I'm sure
              </button>
              <button
                onClick={handleCancel}
                className="border border-border text-foreground hover:bg-muted px-4 py-2 rounded-lg transition-colors font-body-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Type DELETE to confirm */}
        {step === 'final' && (
          <div className="flex flex-col gap-3 w-full max-w-md">
            <p className="text-body-sm text-red-400 font-medium">
              Type <code className="bg-red-500/10 px-2 py-0.5 rounded text-red-500 font-bold">DELETE</code> to confirm:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && typedText === 'DELETE') handleWipe(); }}
                placeholder='Type DELETE here'
                className="flex-1 bg-background border border-red-500/30 rounded-lg px-4 py-2 font-body-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-red-500 focus:border-red-500 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleWipe}
                disabled={typedText !== 'DELETE'}
                className={`px-4 py-2 rounded-lg transition-colors font-body-sm font-semibold ${
                  typedText === 'DELETE'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                Wipe Everything
              </button>
            </div>
            <button
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground font-body-sm text-left transition-colors"
            >
              ← Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};