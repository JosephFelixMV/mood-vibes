import { createContext, useContext } from "react";

export type UserRole = "admin" | "content";

const UserRoleContext = createContext<UserRole | null>(null);

export function UserRoleProvider({ role, children }: { role: UserRole; children: React.ReactNode }) {
  return <UserRoleContext.Provider value={role}>{children}</UserRoleContext.Provider>;
}

export function useUserRole(): UserRole {
  const role = useContext(UserRoleContext);
  if (role === null) throw new Error("useUserRole must be used within UserRoleProvider");
  return role;
}
