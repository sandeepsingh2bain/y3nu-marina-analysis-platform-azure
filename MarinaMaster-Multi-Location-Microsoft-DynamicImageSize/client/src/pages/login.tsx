import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="flex min-h-screen">
      <div className="w-1/2 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6">Marina Analysis Platform</h1>
          <h2 className="text-xl mb-6">Sign in to continue</h2>

          <p className="mb-8 text-gray-600">
            Sign in with your Microsoft account to access the marina analysis tools and manage your vessel detection projects.
          </p>

          <Button
            onClick={() => window.location.href = '/auth/login'}
            className="w-full"
          >
            Sign in with Microsoft
          </Button>
        </div>
      </div>

      <div className="w-1/2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center p-8">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold mb-6">Advanced Marina Analytics</h2>
          <p className="mb-4">
            Leverage satellite imagery and AI-powered computer vision to analyze marina occupancy and detect vessels with precision.
          </p>
          <ul className="space-y-2 mb-6">
            <li className="flex items-center">
              <span className="mr-2">✓</span> Satellite Image Analysis
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span> AI-Powered Boat Detection
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span> Batch Processing & Export
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span> Precise Coordinate Mapping
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}