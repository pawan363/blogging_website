import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";
const AuthContext = createContext(null);

axios.defaults.withCredentials = true;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    axios.get(`${API_URL}/auth/me`)
      .then((response) => {
        if (isCurrent) setUser(response.data.user);
      })
      .catch((error) => {
        if (isCurrent && error.response?.status !== 401) {
          console.error("Unable to restore the sign-in session:", error);
          setAuthError("Could not connect to the account service. Please refresh and try again.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, []);

  const signIn = async (credentials) => {
    const response = await axios.post(`${API_URL}/auth/login`, credentials);
    setUser(response.data.user);
    setAuthError("");
  };

  const signUp = async (credentials) => {
    const response = await axios.post(`${API_URL}/auth/signup`, credentials);
    setUser(response.data.user);
    setAuthError("");
  };

  const signOut = async () => {
    await axios.post(`${API_URL}/auth/logout`);
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    isLoading,
    authError,
    signIn,
    signUp,
    signOut
  }), [user, isLoading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
