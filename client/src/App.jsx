import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";

// The app shell is intentionally thin: routing lives in BrowserRouter and
// authentication state is shared through AuthProvider so every page can access
// the same user session without prop-drilling.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

