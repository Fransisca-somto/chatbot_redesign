import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./DashboardClient";

export default function AdminPage() {
  const cookieStore = cookies();
  const isAdminAuthenticated = cookieStore.get("admin_auth")?.value === "true";

  if (!isAdminAuthenticated) {
    redirect("/admin/login");
  }

  return <AdminDashboardClient />;
}
