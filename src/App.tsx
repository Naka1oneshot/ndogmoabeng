import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ColorModeProvider } from "@/contexts/ColorModeContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { GlobalChatPanel } from "@/components/chat/GlobalChatPanel";
import { SessionExpirationHandler } from "@/components/auth/SessionExpirationHandler";
import { LoadingFallback } from "@/components/common/LoadingFallback";
import { lazy, Suspense, memo } from "react";

// Lazy load all pages for better code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Login = lazy(() => import("./pages/Login"));
const MJ = lazy(() => import("./pages/MJ"));
const MJGameManage = lazy(() => import("./pages/MJGameManage"));
const Presentation = lazy(() => import("./pages/Presentation"));
const JoinAnonymous = lazy(() => import("./pages/JoinAnonymous"));
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard"));
const AdminGames = lazy(() => import("./pages/AdminGames"));
const AdminGameDetails = lazy(() => import("./pages/AdminGameDetails"));
const AdminMeetups = lazy(() => import("./pages/AdminMeetups"));
const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const AdminEventManagement = lazy(() => import("./pages/AdminEventManagement"));
const WatchList = lazy(() => import("./pages/WatchList"));
const WatchGame = lazy(() => import("./pages/WatchGame"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Shop = lazy(() => import("./pages/Shop"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus by default (reduces unnecessary requests)
      refetchOnWindowFocus: false,
      // Keep data fresh for 30 seconds
      staleTime: 30 * 1000,
      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests 2 times
      retry: 2,
      // Exponential backoff for retries
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Memoized route wrapper for performance
const AppRoutes = memo(function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Login />} />
        <Route path="/mj" element={<MJ />} />
        <Route path="/mj/:gameId" element={<MJGameManage />} />
        <Route path="/join/:code" element={<JoinAnonymous />} />
        <Route path="/player/:gameId" element={<PlayerDashboard />} />
        <Route path="/play/:gameId" element={<PlayerDashboard />} />
        <Route path="/admin/games" element={<AdminGames />} />
        <Route path="/admin/games/:gameId" element={<AdminGameDetails />} />
        <Route path="/admin/meetups" element={<AdminMeetups />} />
        <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
        <Route path="/admin/event-management" element={<AdminEventManagement />} />
        <Route path="/watch" element={<WatchList />} />
        <Route path="/watch/:gameId" element={<WatchGame />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<PublicProfile />} />
        <Route path="/boutique" element={<Shop />} />
        <Route path="/presentation/:gameId" element={<Presentation />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
});

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ColorModeProvider>
            <ChatProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ThemeProvider>
                  <SessionExpirationHandler />
                  <AppRoutes />
                  <GlobalChatPanel />
                </ThemeProvider>
              </BrowserRouter>
            </ChatProvider>
          </ColorModeProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
