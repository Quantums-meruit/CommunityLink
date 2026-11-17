
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../services/api";

// AuthContext is the single source of truth for the logged-in user state.
// Every authenticated page, route guard, and dashboard reads from this context,
// so a login/logout in one place updates the whole app consistently.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore the current session on page load by asking the backend who the
    // authenticated user is. A 401 means there is no active cookie/session.
    api
      .get("/auth/me")
      .then((response) => setUser(response.data.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,

      async login(credentials) {
        // Sign in, then store the returned user object in shared app state so
        // protected routes can immediately re-render for the logged-in user.
        const response = await api.post("/auth/login", credentials);
        setUser(response.data.data.user);
        return response.data.data.user;
      },

      async register(data) {
        // Registration follows the same pattern: create the user on the server,
        // store the new session user, and return that profile to the caller.
        const response = await api.post("/auth/register", data);
        setUser(response.data.data.user);
        return response.data.data.user;
      },

      async logout() {
        // The API clears the HTTP-only cookie, and the client clears local
        // app state so all guarded routes immediately redirect to public pages.
        await api.post("/auth/logout");
        setUser(null);
      },
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
