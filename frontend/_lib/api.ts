export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

type RegisterUserInput = {
    email: string;
    password: string;
};

type LoginUserInput = {
    email: string;
    password: string;
};

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

export async function generateApiKey(email: string) { 
    const response = await fetch(`${BACKEND_URL}/api-keys`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
        }, 
        body: JSON.stringify({ email }), 
    });
  
    const data = await response.json();
  
    if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate API key");
    }
  
    return data.apiKey as string;
}
  
export async function getApiKey(email: string) { 
    const response = await fetch( 
        `${BACKEND_URL}/api-keys?email=${encodeURIComponent(email)}` 
    ); 
  
    const data = await response.json(); 
  
    if (!response.ok) { 
        throw new Error(data.error ?? "Failed to load API key"); 
    } 
  
    return data.apiKey as string; 
} 
