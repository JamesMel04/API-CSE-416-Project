"use client";

import { useState } from "react";
import Link from "next/link";
import { validateEmail } from "@/utils/validation";
import { useRouter } from "next/navigation";
import { registerUser } from "@/_lib/api";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [emailError, setEmailError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const router = useRouter();
    const [submitError, setSubmitError] = useState("");


    // Password match validation
    const validatePasswords = () => {
        if (!password) return "Password is required";
        if (password !== confirmPassword) return "Passwords do not match";
        return "";
    };

    // Call when Create Account is pressed
    const handleRegister = async () => {
        const eError = validateEmail(email);
        const pError = validatePasswords();
      
        setEmailError(eError);
        setPasswordError(pError);
        setSubmitError("");
      
        if (eError || pError) return;
      
        try {
          await registerUser({
            email,
            password,
          });
      
          // Navigate to login page
          router.push("/login");
        } catch (error) {
          setSubmitError(
            error instanceof Error ? error.message : "Failed to create account"
          );
        }
    };
        

    return (
        <div className="min-h-screen bg-linear-to-b from-blue-900 to-emerald-700 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl px-12 py-14 w-full max-w-md">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-10">Create Account</h1>

                <div className="flex flex-col gap-5">
                    {/* Email */}
                    <div>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (emailError) setEmailError("");
                            }}
                            className="w-full px-4 py-4 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                        />
                        {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                    </div>

                    {/* Password */}
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (passwordError) setPasswordError("");
                        }}
                        className="w-full px-4 py-4 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                    />

                    {/* Confirm Password */}
                    <div>
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                if (passwordError) setPasswordError("");
                            }}
                            className="w-full px-4 py-4 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                        />
                        {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}
                    </div>
                </div>

                {submitError && (
                    <p className="mt-4 text-center text-sm text-red-500">
                        {submitError}
                    </p>
                )}

                {/* Create Account Button */}
                <button
                    type="button"
                    className="w-full mt-8 py-4 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
                    onClick={handleRegister}
                >
                    Create Account
                </button>

                {/* Login Link */}
                <p className="mt-6 text-center text-sm text-gray-500">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="text-blue-600 underline font-medium hover:text-blue-700"
                    >
                        Log In
                    </Link>
                </p>
            </div>
        </div>
    );
}