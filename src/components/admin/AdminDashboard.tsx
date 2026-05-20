import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/contexts/UserRoleContext";
import ProductForm from "./ProductForm";
import ProductList from "./ProductList";
import AnalyticsDashboard from "./AnalyticsDashboard";
import BulkUpload from "./BulkUpload";
import AIDashboard from "./AIDashboard";
import SiteConfiguration from "./SiteConfiguration";
import BrandManager from "./BrandManager";
import FlaggedProductsDashboard from "./FlaggedProductsDashboard";
import BlogPostList from "./BlogPostList";
import BlogPostForm from "./BlogPostForm";

export default function AdminDashboard() {
  const role = useUserRole();
  const isAdmin = role === "admin";
  const [tab, setTab] = useState("list");
  const [editId, setEditId] = useState<string | null>(null);
  const formStateRef = useRef<Record<string, any> | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const [blogTab, setBlogTab] = useState<"list" | "form">("list");
  const [blogEditId, setBlogEditId] = useState<string | null>(null);

  // Reset to a visible tab if the current tab is not accessible for this role
  useEffect(() => {
    const adminOnlyTabs = ["brands", "bulk", "analytics", "ai", "flagged", "config", "blog"];
    if (!isAdmin && adminOnlyTabs.includes(tab)) {
      setTab("list");
    }
  }, [isAdmin, tab]);

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
          {isAdmin && <TabsTrigger value="brands">Brands</TabsTrigger>}
          {isAdmin && <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>}
          {isAdmin && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
          {isAdmin && <TabsTrigger value="ai">AI Discover</TabsTrigger>}
          {isAdmin && <TabsTrigger value="flagged">Flagged Links</TabsTrigger>}
          {isAdmin && <TabsTrigger value="config">Configuration</TabsTrigger>}
          {isAdmin && <TabsTrigger value="blog">Blog Posts</TabsTrigger>}
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
        <TabsContent value="blog" forceMount className={tab !== "blog" ? "hidden" : ""}>
          {blogTab === "list" ? (
            <BlogPostList
              onEdit={(id) => { setBlogEditId(id); setBlogTab("form"); }}
              onNew={() => { setBlogEditId(null); setBlogTab("form"); }}
            />
          ) : (
            <BlogPostForm
              editId={blogEditId}
              onClose={() => { setBlogEditId(null); setBlogTab("list"); }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
