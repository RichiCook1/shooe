import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Review from "./pages/Review";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Messages from "./pages/Messages";
import SavedReviews from "./pages/SavedReviews";
import Sherpa from "./pages/Sherpa";
import Model from "./pages/Model";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminOverview from "./pages/admin/Overview";
import AdminCatalog from "./pages/admin/Catalog";
import AdminCatalogHealth from "./pages/admin/CatalogHealth";
import AdminQueue from "./pages/admin/Queue";
import AdminFields from "./pages/admin/Fields";
import AdminUsers from "./pages/admin/Users";
import AdminModeration from "./pages/admin/Moderation";
import AdminAnalytics from "./pages/admin/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/review" element={<Review />} />
            <Route path="/login" element={<Login />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><SavedReviews /></ProtectedRoute>} />
            <Route path="/sherpa" element={<Sherpa />} />
            <Route path="/model/:modelId" element={<Model />} />
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminOverview />} />
              <Route path="catalog" element={<AdminCatalog />} />
              <Route path="catalog/health" element={<AdminCatalogHealth />} />
              <Route path="queue" element={<AdminQueue />} />
              <Route path="fields" element={<AdminFields />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="moderation" element={<AdminModeration />} />
              <Route path="analytics" element={<AdminAnalytics />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
