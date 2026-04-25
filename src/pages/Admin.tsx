import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy-loaded so the entire admin bundle (ProductForm, BrandManager, AIDashboard,
// AnalyticsDashboard, BulkUpload, etc.) is only fetched AFTER ProtectedRoute has
// confirmed an authenticated session. Unauthenticated visitors never download
// the admin chunk.
const AdminDashboard = lazy(() => import("@/components/admin/AdminDashboard"));

export default function Admin() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
