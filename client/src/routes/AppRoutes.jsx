import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import Loader from "../components/common/Loader";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";

const HomePage = lazy(() => import("../pages/Home/HomePage"));
const LoginPage = lazy(() => import("../pages/Auth/LoginPage"));
const RegisterPage = lazy(() => import("../pages/Auth/RegisterPage"));
const DashboardPage = lazy(() => import("../pages/Dashboard/DashboardPage"));
const ProfilePage = lazy(() => import("../pages/Profile/ProfilePage"));

const lazyGenericPage = (name) =>
  lazy(() =>
    import("../pages/GenericPages").then((pages) => ({
      default: pages[name],
    })),
  );

const Communities = lazyGenericPage("Communities");
const Events = lazyGenericPage("Events");
const Businesses = lazyGenericPage("Businesses");
const Opportunities = lazyGenericPage("Opportunities");
const CreateCommunity = lazyGenericPage("CreateCommunity");
const CreateEvent = lazyGenericPage("CreateEvent");
const CreateBusiness = lazyGenericPage("CreateBusiness");
const CreateOpportunity = lazyGenericPage("CreateOpportunity");
const CommunityDetail = lazyGenericPage("CommunityDetail");
const EventDetail = lazyGenericPage("EventDetail");
const BusinessDetail = lazyGenericPage("BusinessDetail");
const OpportunityDetail = lazyGenericPage("OpportunityDetail");
const Applications = lazyGenericPage("Applications");
const Notifications = lazyGenericPage("Notifications");
const AdminDashboard = lazyGenericPage("AdminDashboard");
const GenericNotFound = lazyGenericPage("NotFound");

function PageFallback() {
  return <Loader label="Loading page..." />;
}

export default function AppRoutes() {
  const guard = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="communities" element={<Communities />} />
          <Route path="communities/:id" element={<CommunityDetail />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="businesses" element={<Businesses />} />
          <Route path="businesses/:id" element={<BusinessDetail />} />
          <Route path="opportunities" element={<Opportunities />} />
          <Route path="opportunities/:id" element={<OpportunityDetail />} />
          <Route path="dashboard" element={guard(<DashboardPage />)} />
          <Route path="profile" element={guard(<ProfilePage />)} />
          <Route
            path="communities/create"
            element={guard(<CreateCommunity />)}
          />
          <Route path="events/create" element={guard(<CreateEvent />)} />
          <Route
            path="businesses/create"
            element={guard(<CreateBusiness />)}
          />
          <Route
            path="opportunities/create"
            element={guard(<CreateOpportunity />)}
          />
          <Route path="applications" element={guard(<Applications />)} />
          <Route path="notifications" element={guard(<Notifications />)} />
          <Route
            path="admin"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<GenericNotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
