import { Switch, Route } from "wouter";
import LandingPage from "@/pages/LandingPage";
import UserDashboard from "@/pages/UserDashboard";
import AdminPanel from "@/pages/AdminPanel";
import CRM from "@/pages/CRM";
import Report from "@/pages/Report";
import AffiliateHunter from "@/pages/AffiliateHunter";
import GeneratedWebsitePage from "@/pages/GeneratedWebsitePage";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/dashboard" component={UserDashboard} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/crm" component={CRM} />
      <Route path="/affiliate" component={AffiliateHunter} />
      <Route path="/report/:reportId" component={Report} />
      <Route path="/site/:siteId" component={GeneratedWebsitePage} />
      <Route component={LandingPage} />
    </Switch>
  );
}
