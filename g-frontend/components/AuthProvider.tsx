"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  login: () => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isLoading: true,
  login: () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check localStorage when the app starts
    try {
      const session = localStorage.getItem("repoSortUser");
      if (session === "logged-in") {
        setIsLoggedIn(true);
      }
    } catch (error) {
      // localStorage access failed or is disabled
      console.warn("Failed to access localStorage:", error);
    }
    setIsLoading(false);
  }, []);

  const login = (): boolean => {
    try {
      localStorage.setItem("repoSortUser", "logged-in");
      setIsLoggedIn(true);
      router.refresh(); // Refresh to ensure all components update
      return true;
    } catch (error) {
      console.warn("Failed to set localStorage:", error);
      return false;
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem("repoSortUser");
    } catch (error) {
      console.warn("Failed to remove from localStorage:", error);
    }
    setIsLoggedIn(false);
    router.push("/"); // Force redirect to home
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);