import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductForm from "./ProductForm";
import ProductList from "./ProductList";
import AnalyticsDashboard from "./AnalyticsDashboard";
import BulkUpload from "./BulkUpload";

export default function AdminDashboard() {
  const [tab, setTab] = useState("list");
  const [editId, setEditId] = useState<string | null>(null);
  const formStateRef = useRef<Record<string, any> | null>(null);

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

  return (
    <div className="container py-8">
      <h1 className="mb-6 font-heading text-2xl font-bold">Admin Panel</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">Products</TabsTrigger>
          <TabsTrigger value="form">{editId ? "Edit Product" : "Add Product"}</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="list" forceMount className={tab !== "list" ? "hidden" : ""}>
          <ProductList onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="form" forceMount className={tab !== "form" ? "hidden" : ""}>
          <ProductForm editId={editId} onDone={handleDone} savedState={formStateRef} />
        </TabsContent>
        <TabsContent value="analytics" forceMount className={tab !== "analytics" ? "hidden" : ""}>
          <AnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
