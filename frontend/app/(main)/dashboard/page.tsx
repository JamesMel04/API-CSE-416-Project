"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { generateApiKey, getApiKey } from "@/_lib/api"; 

export default function DashboardPage() {
  const router = useRouter();

  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showRegenerateWarning, setShowRegenerateWarning] = useState(false);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [keyLoadFailed, setKeyLoadFailed] = useState(false);

  const hasGeneratedKey = apiKey.length > 0;

  // Display the key automatically if user has one
  useEffect(() => {
    const loadExistingKey = async () => {
      const token  = localStorage.getItem("apiAuthToken");
  
      if (!token) {
        router.push("/login");
        return;
      }
  
      try {
        const existingKey = await getApiKey();
        setApiKey(existingKey);
      } catch {
        setKeyLoadFailed(true);
        setError("Failed to load your existing API key. Do not generate a new key until this is fixed.");
      } finally {
        setIsLoadingKey(false);
      }
      
    };
  
    loadExistingKey();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("apiAuthToken");
    setApiKey("");
    setStatus("");
    setError("");
    router.replace("/login");
  };
  

  // create a brand new key
  const createKey = async () => {
    const token = localStorage.getItem("apiAuthToken"); 

    if (!token) { 
      router.push("/login"); 
      return; 
    } 

    setStatus("");
    setError("");

    try {
      const key = await generateApiKey(); 
      setApiKey(key);
      setStatus("API key generated. Copy it now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API key");
    }
  };

  // Checks if already has a key and display appropriate log
  const handleGenerateKey = async () => {
    if (hasGeneratedKey) {
      setShowRegenerateWarning(true);
      return;
    }
  
    await createKey();
  };
  
  const handleConfirmRegenerate = async () => {
    setShowRegenerateWarning(false);
    await createKey();
  };

  const handleCopyKey = async () => {
    if (!apiKey) return;

    try {
      await navigator.clipboard.writeText(apiKey);
      setStatus("Copied to clipboard.");
    } catch {
      setError("Could not copy API key.");
    }
  };

  return (
    <main className="relative min-h-screen bg-linear-to-b from-blue-900 to-emerald-700 flex items-center justify-center px-6">
      <button
        type="button"
        onClick={handleLogout}
        className="absolute top-6 right-6 px-4 py-2 rounded-lg bg-white text-gray-800 font-bold text-sm hover:bg-gray-100 transition-colors"
      >
        Logout
      </button>


      <section className="bg-white rounded-2xl shadow-2xl px-12 py-14 w-full max-w-2xl">
        
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-3">
          API License Key
        </h1>

        <p className="text-center text-sm text-gray-500 mb-8">
          Generate a key for your application to access the MLB API.
        </p>

        <button
          type="button"
          onClick={handleGenerateKey}
          disabled={isLoadingKey || keyLoadFailed}
          className="w-full py-4 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoadingKey
            ? "Loading API Key..."
            : hasGeneratedKey
              ? "Regenerate API Key"
              : "Generate API Key"}
        </button>


        {apiKey && (
          <div className="mt-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your API Key
            </label>

            <div className="flex gap-3">
              <input
                readOnly
                value={apiKey}
                className="w-full px-4 py-4 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800"
              />

              <button
                type="button"
                onClick={handleCopyKey}
                className="px-5 py-4 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {status && (
          <p className="mt-4 text-center text-sm text-emerald-600">{status}</p>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-500">{error}</p>
        )}
      </section>

        {showRegenerateWarning && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-6">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md px-8 py-7">
                <h2 className="text-xl font-bold text-gray-800 mb-3">
                    Regenerate API Key?
                </h2>

                <p className="text-sm text-gray-600 leading-6">
                    Regenerating this key will revoke the current key. Any application
                    using the old key, including DraftKit, will stop working until its
                    backend environment variable is updated.
                </p>

                <div className="mt-7 flex gap-3 justify-end">
                    <button
                    type="button"
                    onClick={() => setShowRegenerateWarning(false)}
                    className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-colors"
                    >
                    Cancel
                    </button>

                    <button
                    type="button"
                    onClick={handleConfirmRegenerate}
                    className="px-5 py-3 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
                    >
                    Regenerate Key
                    </button>
                </div>
                </div>
            </div>
        )}

    </main>
  );
}
