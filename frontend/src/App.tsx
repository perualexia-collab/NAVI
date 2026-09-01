import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context.js";
import { RequireAuth } from "./components/RequireAuth.js";
import { AppShell } from "./components/AppShell.js";
import { Login } from "./pages/Login.js";
import { Home } from "./pages/Home.js";
import { Portfolios } from "./pages/Portfolios.js";
import { CrmHealth } from "./pages/CrmHealth.js";
import { AskNavi } from "./pages/AskNavi.js";
import { Settings } from "./pages/Settings.js";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/portefeuilles" element={<Portfolios />} />
            <Route path="/crm-health" element={<CrmHealth />} />
            <Route path="/ask-navi" element={<AskNavi />} />
            <Route path="/parametres" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
