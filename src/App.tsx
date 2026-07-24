import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider, useNotificationContext } from "@/contexts/NotificationContext";
import { CallProvider } from "@/contexts/CallContext";
import GlobalCallOverlay from "@/components/GlobalCallOverlay";
import InAppBanner from "@/components/InAppBanner";
import CookieConsent from "@/components/CookieConsent";
import InstallAndNotifyPrompt from "@/components/InstallAndNotifyPrompt";


// Lazy-loaded pages
const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SetupProfilePage = lazy(() => import("./pages/SetupProfilePage"));
const ChatRoomPage = lazy(() => import("./pages/ChatRoomPage"));
const CreateRoomPage = lazy(() => import("./pages/CreateRoomPage"));
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const DMsPage = lazy(() => import("./pages/DMsPage"));
const AddFriendPage = lazy(() => import("./pages/AddFriendPage"));
const FriendRequestsPage = lazy(() => import("./pages/FriendRequestsPage"));
const RoomMembersPage = lazy(() => import("./pages/RoomMembersPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const RanksPage = lazy(() => import("./pages/RanksPage"));
const TreasuresPage = lazy(() => import("./pages/TreasuresPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SuperAdminPage = lazy(() => import("./pages/SuperAdminPage"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const ContestsPage = lazy(() => import("./pages/ContestsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CookiesPolicyPage = lazy(() => import("./pages/CookiesPolicyPage"));
const FounderPage = lazy(() => import("./pages/FounderPage"));
const DailyActivityPage = lazy(() => import("./pages/DailyActivityPage"));
const InviteContactsPage = lazy(() => import("./pages/InviteContactsPage"));
const MentionsPage = lazy(() => import("./pages/MentionsPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const PagesListPage = lazy(() => import("./pages/PagesListPage"));
const CreatePagePage = lazy(() => import("./pages/CreatePagePage"));
const PageProfilePage = lazy(() => import("./pages/PageProfilePage"));
const PageDashboardPage = lazy(() => import("./pages/PageDashboardPage"));
const SavedLibraryPage = lazy(() => import("./pages/SavedLibraryPage"));
const PagePostViewPage = lazy(() => import("./pages/PagePostViewPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const PostRedirect = lazy(() => import("./pages/PostRedirect"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const IncomingCallPage = lazy(() => import("./pages/IncomingCallPage"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GlobalBanner() {
  const { pendingBanner, dismissBanner } = useNotificationContext();
  return <InAppBanner banner={pendingBanner} onDismiss={dismissBanner} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <CallProvider>
            <GlobalCallOverlay />
            <GlobalBanner />
            <CookieConsent />
            <InstallAndNotifyPrompt />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/setup-profile" element={<ProtectedRoute><SetupProfilePage /></ProtectedRoute>} />
              <Route path="/room/:roomId" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />
              <Route path="/create-room" element={<ProtectedRoute><CreateRoomPage /></ProtectedRoute>} />
              <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/dms" element={<ProtectedRoute><DMsPage /></ProtectedRoute>} />
              <Route path="/add-friend" element={<ProtectedRoute><AddFriendPage /></ProtectedRoute>} />
              <Route path="/friend-requests" element={<ProtectedRoute><FriendRequestsPage /></ProtectedRoute>} />
              <Route path="/room/:roomId/members" element={<ProtectedRoute><RoomMembersPage /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/ranks" element={<ProtectedRoute><RanksPage /></ProtectedRoute>} />
              <Route path="/treasures" element={<ProtectedRoute><TreasuresPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/super-admin" element={<ProtectedRoute><SuperAdminPage /></ProtectedRoute>} />
              <Route path="/referrals" element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
              <Route path="/contests" element={<ProtectedRoute><ContestsPage /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/founder" element={<FounderPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/cookies" element={<CookiesPolicyPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/daily-activity" element={<ProtectedRoute><DailyActivityPage /></ProtectedRoute>} />
              <Route path="/invite-contacts" element={<ProtectedRoute><InviteContactsPage /></ProtectedRoute>} />
              <Route path="/mentions" element={<ProtectedRoute><MentionsPage /></ProtectedRoute>} />
              <Route path="/pages" element={<ProtectedRoute><PagesListPage /></ProtectedRoute>} />
              <Route path="/pages/new" element={<ProtectedRoute><CreatePagePage /></ProtectedRoute>} />
              <Route path="/pages/:pageId" element={<ProtectedRoute><PageProfilePage /></ProtectedRoute>} />
              <Route path="/pages/:pageId/dashboard" element={<ProtectedRoute><PageDashboardPage /></ProtectedRoute>} />
              <Route path="/saved" element={<ProtectedRoute><SavedLibraryPage /></ProtectedRoute>} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/post/:postId" element={<PostRedirect />} />
              <Route path="/page-post/:postId" element={<PagePostViewPage />} />
              <Route path="/status" element={<ProtectedRoute><StatusPage /></ProtectedRoute>} />
              <Route path="/call/:callId" element={<ProtectedRoute><IncomingCallPage /></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
              <Route path="/verification" element={<ProtectedRoute><VerificationPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </CallProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
