import { AlertTriangle, Loader2 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto" />
        <p className="mt-4 text-gray-500">Loading form...</p>
      </div>
    </div>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Available</h1>
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}
