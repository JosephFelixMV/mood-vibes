import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductForm from "./ProductForm";
import ProductList from "./ProductList";

export default function AdminDashboard() {
  const [tab, setTab] = useState("list");
  const [editId, setEditId] = useState<string | null>(null);

  const handleEdit = (id: string) => {
    setEditId(id);
    setTab("form");
  };

  const handleDone = () => {
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
        </TabsList>
        <TabsContent value="list">
          <ProductList onEdit={handleEdit} />
        </TabsContent>
        <TabsContent value="form">
          <ProductForm editId={editId} onDone={handleDone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
