import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Auth } from "./pages/Auth";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { Patients } from "./pages/Patients";
import { AddPatient } from "./pages/AddPatient";
import { ManagePatient } from "./pages/ManagePatient";
import { Doctors } from "./pages/Doctors";
import { AddDoctor } from "./pages/AddDoctor";
import { ManageDoctor } from "./pages/ManageDoctor";
import { Appointments } from "./pages/Appointments";
import AppointmentRequestsPage from "./pages/AppointmentRequests";
import { Billing } from "./pages/Billing";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { Toaster } from "./components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/new" element={<AddPatient />} />
            <Route path="patients/:id/manage" element={<ManagePatient />} />
            <Route path="doctors" element={<Doctors />} />
            <Route path="doctors/new" element={<AddDoctor />} />
            <Route path="doctors/:id/manage" element={<ManageDoctor />} />
            <Route
              path="doctors/:id/edit"
              element={<Navigate to="../manage" replace />}
            />
            <Route path="appointments" element={<Appointments />} />
            <Route
              path="appointment-requests"
              element={<AppointmentRequestsPage />}
            />
            <Route path="billing" element={<Billing />} />
            <Route path="reports" element={<Reports />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
