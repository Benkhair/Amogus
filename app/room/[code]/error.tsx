'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function RoomErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to console for debugging
    console.error('Room page error:', error);
  }, [error]);

  const handleGoHome = () => {
    router.push('/');
  };

  const handleRetry = () => {
    reset();
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-red-600/20 blur-3xl rounded-full" />
          <div className="relative w-24 h-24 mx-auto rounded-full bg-gray-900 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-2xl font-bold text-white mb-3">
          Something went wrong
        </h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          We couldn&apos;t load the room. This might be due to a network issue or the room no longer exists.
        </p>

        {/* Error details (collapsed) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 rounded-xl bg-gray-900/50 border border-gray-800 text-left">
            <p className="text-red-400 text-xs font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleRetry}
            className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          
          <button
            onClick={handleGoHome}
            className="w-full py-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
