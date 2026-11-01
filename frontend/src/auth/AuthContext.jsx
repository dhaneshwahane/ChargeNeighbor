import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('chargeneighbor_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/users/me')
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('chargeneighbor_token', res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (name, email, phone, password, role) => {
    const res = await api.post('/auth/register', { name, email, phone, password, role });
    localStorage.setItem('chargeneighbor_token', res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('chargeneighbor_token');
    setToken(null);
    setUser(null);
  };

  const becomeHost = async () => {
    const res = await api.post('/users/me/become-host');
    const updated = await api.get('/users/me');
    setUser(updated.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, becomeHost, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
