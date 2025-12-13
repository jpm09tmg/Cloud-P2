"use client";

export const dynamic = "force-dynamic";


import { useState, useEffect } from "react";
import { useUserAuth } from "../_utils/auth-context";
import { redirect } from "next/navigation";

export default function CreateAccount() {
  const { user, createAccount } = useUserAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect away
  useEffect(() => {
    if (user) redirect("/Dashboard");
  }, [user]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      await createAccount(email, password, username);
      redirect("/Dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex justify-center items-center h-screen">
      <main className="bg-gray-600 max-w-sm w-full rounded-2xl border text-center p-4">
        <h1 className="text-2xl font-serif underline mb-4">Create Account</h1>

        <form onSubmit={handleSignup} className="flex flex-col items-center">
          
          {/* Username Field */}
          <input
            type="text"
            placeholder="Username"
            className="m-2 p-1 rounded text-black border-2 border-neutral-50 w-3/4"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email"
            className="m-2 p-1 rounded text-black border-2 border-neutral-50 w-3/4"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="m-2 p-1 rounded text-black border-2 border-neutral-50 w-3/4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Confirm Password"
            className="m-2 p-1 rounded text-black border-2 border-neutral-50 w-3/4"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 mt-2"
          >
            {loading ? "Creating…" : "Create Account"}
          </button>

          {error && <p className="text-red-300 mt-2">{error}</p>}
        </form>

        <p className="mt-4">
          Already have an account?{" "}
          <a href="/" className="underline">
            Sign in
          </a>
        </p>
      </main>
    </section>
  );
}
