import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductForm from "./ProductForm";
import ProductList from "./ProductList";
import AnalyticsDashboard from "./AnalyticsDashboard";
import BulkUpload from "./BulkUpload";
import AIDashboard from "./AIDashboard";
import SiteConfiguration from "./SiteConfiguration";
import BrandManager from "./BrandManager";
import FlaggedProductsDashboard from "./FlaggedProductsDashboard";

export default function AdminDashboard() {
  const [tab, setTab] = useState("list");
  const [editId, setEditId] = useState<string | null>(null);
  const formStateRef = useRef<Record<string, any> | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  const handleEdit = (id: string) => {
    formStateRef.current = null;
    setEditId(id);
    setTab("form");
  };

  const handleDone = () => {
    formStateRef.current = null;
    setEditId(null);
    setTab("list");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">Admin Panel</h1>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="list">Products</TabsTrigger>
          <TabsTrigger value="form">{editId ? "Edit Product" : "Add Product"}</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="ai">AI Discover</TabsTrigger>
          <TabsTrigger value="flagged">Flagged Links</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="list" forceMount className={tab !== "list" ? "hidden" : ""}>
          <ProductList onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="form" forceMount className={tab !== "form" ? "hidden" : ""}>
          <ProductForm editId={editId} onDone={handleDone} savedState={formStateRef} />
        </TabsContent>
        <TabsContent value="brands" forceMount className={tab !== "brands" ? "hidden" : ""}>
          <BrandManager />
        </TabsContent>
        <TabsContent value="bulk" forceMount className={tab !== "bulk" ? "hidden" : ""}>
          <BulkUpload />
        </TabsContent>
        <TabsContent value="analytics" forceMount className={tab !== "analytics" ? "hidden" : ""}>
          <AnalyticsDashboard />
        </TabsContent>
        <TabsContent value="ai" forceMount className={tab !== "ai" ? "hidden" : ""}>
          <AIDashboard />
        </TabsContent>
        <TabsContent value="flagged" forceMount className={tab !== "flagged" ? "hidden" : ""}>
          <FlaggedProductsDashboard />
        </TabsContent>
        <TabsContent value="config" forceMount className={tab !== "config" ? "hidden" : ""}>
          <SiteConfiguration />
        </TabsContent>
      </Tabs>
    </div>
  );
}
