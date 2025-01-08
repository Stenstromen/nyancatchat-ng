"use client";

export const runtime = "edge";

import { useState } from "react";

interface UsernameModalProps {
  isOpen: boolean;
  onSubmit: (username: string) => void;
}

  export default function UsernameModal({ isOpen, onSubmit }: UsernameModalProps) {
    const [username, setUsername] = useState("");
  
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (username.trim()) {
        onSubmit(username.trim());
      }
    };
  
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-white mb-4">Enter Your Username</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full p-2 border rounded bg-gray-700 text-white border-gray-600"
              autoFocus
            />
            <button
              type="submit"
              className="w-full p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded transition"
            >
              Join Chat
            </button>
          </form>
        </div>
      </div>
    );
  }