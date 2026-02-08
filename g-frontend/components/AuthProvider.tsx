"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuthContextType = {
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check localStorage when the app starts
    const session = localStorage.getItem("repoSortUser");
    if (session === "logged-in") {
      setIsLoggedIn(true);
    }
  }, []);

  const login = () => {
    localStorage.setItem("repoSortUser", "logged-in");
    setIsLoggedIn(true);
    router.refresh(); // Refresh to ensure all components update
  };

  const logout = () => {
    localStorage.removeItem("repoSortUser");
    setIsLoggedIn(false);
    router.push("/"); // Force redirect to home
    router.refresh(); // Clear any cached data
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);