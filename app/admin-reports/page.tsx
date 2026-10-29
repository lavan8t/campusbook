import CampusBookPage from "../page";
import { APP_USERS } from "@/data/schema";

export default function AdminReportsPage() {
  return <CampusBookPage initialTab="admin-reports" initialUser={APP_USERS[2]} />;
}
