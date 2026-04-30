import dotenv from 'dotenv';
dotenv.config();
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

type RegisterUserInput = {
    email: string;
    password: string;
};

type LoginUserInput = {
    email: string;
    password: string;
};

// Creates an account
export async function registerUser(input: RegisterUserInput) {
    const response = await fetch(`${BACKEND_URL}/auth/register`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error ?? "Failed to create account");
    }

    return data;
}

// Log in behavior
export async function loginUser(input: LoginUserInput) {
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error ?? "Failed to log in");
    }

    return data;
}

// gets local token
function getAuthHeaders() {
    const token = localStorage.getItem("apiAuthToken");

    return {
        Authorization: `Bearer ${token}`,
    };
}
// pass token so backend can identify the user
export async function generateApiKey() { 
    const response = await fetch(`${BACKEND_URL}/api-keys`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(),
        },
    });
  
    const data = await response.json();
  
    if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate API key");
    }
  
    return data.apiKey as string;
}

// Used for displaying API key if already exists
export async function getApiKey() { 
    const response = await fetch(`${BACKEND_URL}/api-keys`, {
        headers: {
            ...getAuthHeaders(),
        },
    });
  
    const data = await response.json(); 
  
    if (!response.ok) { 
        throw new Error(data.error ?? "Failed to load API key"); 
    } 
  
    return data.apiKey as string; 
}
