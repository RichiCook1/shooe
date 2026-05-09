import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import NotFound from "./pages/NotFound";

// Heavy / less-frequent routes are code-split to shrink the initial bundle.
const Review = lazy(() => import("./pages/Review"));
const Profile = lazy(() => import("./pages/Profile"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const Messages = lazy(() => import("./pages/Messages"));
const SavedReviews = lazy(() => import("./pages/SavedReviews"));
const Sherpa = lazy(() => import("./pages/Sherpa"));
const Model = lazy(() => import("./pages/Model"));
const Brand = lazy(() => import("./pages/Brand"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminCatalog = lazy(() => import("./pages/admin/Catalog"));
const AdminCatalogHealth = lazy(() => import("./pages/admin/CatalogHealth"));
const AdminQueue = lazy(() => import("./pages/admin/Queue"));
const AdminFields = lazy(() => import("./pages/admin/Fields"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminModeration = lazy(() => import("./pages/admin/Moderation"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

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
            <Route path="/brand/:brandId" element={<Brand />} />
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
