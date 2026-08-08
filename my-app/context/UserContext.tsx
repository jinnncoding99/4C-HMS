'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext<{ 
  username: string; 
  setUsername: (name: string) => void 
}>({ 
  username: "User", 
  setUsername: () => {} 
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState("User");

  useEffect(() => {
    const saved = localStorage.getItem("app_username");
    if (saved) setUsername(saved);
  }, []);

  const updateUsername = (name: string) => {
    setUsername(name);
    localStorage.setItem("app_username", name);
  };

  return (
    <UserContext.Provider value={{ username, setUsername: updateUsername }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);