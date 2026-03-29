import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import AdminDashboard from "@/components/admin/AdminDashboard";

const ADMIN_PASSWORD = "surpriseshopper2024";

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8">
          <div className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Lock className="h-5 w-5 text-primary" /> Admin Access
          </div>
          <Input
            type="password"
            placeholder="Enter password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">Incorrect password</p>}
          <Button type="submit" className="w-full rounded-full">Login</Button>
        </form>
      </div>
    );
  }

  return <AdminDashboard />;
}
