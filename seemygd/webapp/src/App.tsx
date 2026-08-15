import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { PortalGuard } from "@/components/PortalGuard";
import Root from "./pages/Root";
import {
  IndexPage,
  LoginPage,
  SignupPage,
  DashboardPage,
  VisualizerPage,
  PreviewPage,
  AdminPage,
  LegalPage,
  NotFoundPage,
} from "./pages/lazyPages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Root />} />
            <Route path="/tool" element={<IndexPage />} />
            <Route path="/login" element={<PortalGuard><LoginPage /></PortalGuard>} />
            <Route path="/signup" element={<PortalGuard><SignupPage /></PortalGuard>} />
            <Route path="/dashboard" element={<PortalGuard><DashboardPage /></PortalGuard>} />
            <Route path="/v/:companyId" element={<VisualizerPage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/admin" element={<PortalGuard><AdminPage /></PortalGuard>} />
            <Route path="/legal" element={<LegalPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
