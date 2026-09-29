"use client";

import { useState } from "react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Simulate API call to backend or Supabase
    setTimeout(() => {
      setLoading(false);
      setMessage("⚡ Registration successful! Welcome to X Chatter.");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center p-4">
      {/* Background Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#FF007F] opacity-10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#00F0FF] opacity-10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md bg-[#0d0d16] border border-[#232338] p-8 rounded-2xl shadow-[0_0_40px_rgba(255,0,127,0.1)]">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-[#FF007F] to-[#00F0FF] p-[2px] mb-4">
            <div className="w-full h-full bg-[#0a0a10] rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF007F] to-[#00F0FF]">XC</span>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
            Join X Chatter
          </h1>
          <p className="text-xs text-[#00F0FF] font-mono mt-2">Initialize your secure E2EE identity.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Username</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#151522] border border-[#232338] focus:border-[#FF007F] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none transition shadow-inner"
              placeholder="e.g. NeonCyber"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Email (Optional)</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#151522] border border-[#232338] focus:border-[#00F0FF] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none transition shadow-inner"
              placeholder="operator@grid.net"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Master Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#151522] border border-[#232338] focus:border-[#FF007F] rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none transition shadow-inner"
              placeholder="••••••••••••"
            />
          </div>

          {message && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-lg text-emerald-400 text-xs font-bold text-center">
              {message}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-[#FF007F] to-[#00F0FF] text-black font-extrabold text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition shadow-[0_0_20px_rgba(255,0,127,0.3)] disabled:opacity-50"
          >
            {loading ? "Encrypting Identity..." : "Access The Grid"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Already registered? <a href="/login" className="text-[#FF007F] hover:underline font-bold">Log in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
