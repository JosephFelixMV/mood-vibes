import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProducts } from "@/lib/supabase-queries";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onEdit: (id: string) => void;
}

export default function ProductList({ onEdit }: Props) {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => getProducts({ activeOnly: false }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("products").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product deleted");
    },
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Vibe</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="px-4 py-3">
                <div>
                  <span className="font-medium">{p.name}</span>
                  {p.company_name && (
                    <span className="ml-2 text-xs text-muted-foreground">{p.company_name}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{p.category}</Badge>
              </td>
              <td className="px-4 py-3">
                {p.vibe_category ? (
                  <Badge variant="outline">{p.vibe_category}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3">{p.price}</td>
              <td className="px-4 py-3">
                <Switch
                  checked={p.is_active}
                  onCheckedChange={(checked) =>
                    toggleMut.mutate({ id: p.id, is_active: checked })
                  }
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(p.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm("Delete this product?")) deleteMut.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                No products yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
