import React from "react";
import { Switch, Route } from "wouter";
import GeneratedWebsitePage from "@/pages/GeneratedWebsitePage";
import ReviewShieldPage from "@/pages/ReviewShieldPage";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import UserDashboard from "@/pages/UserDashboard";
import AdminPanel from "@/pages/AdminPanel";
import CRM from "@/pages/CRM";
import Report from "@/pages/Report";
import AffiliateHunter from "@/pages/AffiliateHunter";

export default function App() {
  return (
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
  );
}
