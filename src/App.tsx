import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ColorModeProvider } from "@/contexts/ColorModeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import MJ from "./pages/MJ";
import JoinAnonymous from "./pages/JoinAnonymous";
import PlayerDashboard from "./pages/PlayerDashboard";
import AdminGames from "./pages/AdminGames";
import AdminGameDetails from "./pages/AdminGameDetails";
import AdminMeetups from "./pages/AdminMeetups";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import WatchList from "./pages/WatchList";
import WatchGame from "./pages/WatchGame";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ColorModeProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ThemeProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Login />} />
                <Route path="/mj" element={<MJ />} />
                <Route path="/mj/:gameId" element={<MJ />} />
                <Route path="/join/:code" element={<JoinAnonymous />} />
                <Route path="/player/:gameId" element={<PlayerDashboard />} />
                <Route path="/play/:gameId" element={<PlayerDashboard />} />
                <Route path="/admin/games" element={<AdminGames />} />
                <Route path="/admin/games/:gameId" element={<AdminGameDetails />} />
                <Route path="/admin/meetups" element={<AdminMeetups />} />
                <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                <Route path="/watch" element={<WatchList />} />
                <Route path="/watch/:gameId" element={<WatchGame />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ThemeProvider>
          </BrowserRouter>
        </ColorModeProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
