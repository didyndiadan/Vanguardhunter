import React, { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";

const GeneratedWebsitePage = lazy(() => import("@/pages/GeneratedWebsitePage"));
const ReviewShieldPage = lazy(() => import("@/pages/ReviewShieldPage"));
const UserDashboard = lazy(() => import("@/pages/UserDashboard"));
const AdminPanel = lazy(() => import("@/pages/AdminPanel"));
const CRM = lazy(() => import("@/pages/CRM"));
const Report = lazy(() => import("@/pages/Report"));
const AffiliateHunter = lazy(() => import("@/pages/AffiliateHunter"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 text-sm font-medium">
          Loading workspace…
        </div>
      }
    >
      <Switch>
        <Route path="/site/:siteId" component={GeneratedWebsitePage} />
        <Route path="/review/:siteId" component={ReviewShieldPage} />
        <Route path="/" component={LandingPage} />
        <Route path="/landing" component={LandingPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/login" component={AuthPage} />
        <Route path="/register" component={AuthPage} />
        <Route path="/verify-email" component={AuthPage} />
        <Route path="/dashboard" component={UserDashboard} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/owner" component={AdminPanel} />
        <Route path="/crm" component={CRM} />
        <Route path="/affiliate" component={AffiliateHunter} />
        <Route path="/report/:reportId" component={Report} />
        <Route component={LandingPage} />
      </Switch>
    </Suspense>
  );
}
