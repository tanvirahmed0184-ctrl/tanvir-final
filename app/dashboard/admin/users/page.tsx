"use client";

import { useEffect, useMemo, useState } from "react";

type UserRole = "GUEST" | "STUDENT" | "INSTRUCTOR" | "ADMIN" | "SUPER_ADMIN";
type SubscriptionPlan = "free" | "pro" | "premium";
type SubscriptionStatus =
  | "active"
  | "inactive"
  | "cancelled"
  | "past_due"
  | "trialing";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  createdAt: string;
  testsTaken: number;
  avgBand: number;
};

const PAGE_SIZE = 10;

function toCsv(rows: UserRow[]) {
  const header = [
    "id",
    "name",
    "email",
    "role",
    "plan",
    "subscriptionStatus",
    "createdAt",
    "testsTaken",
    "avgBand",
  ];
  const body = rows.map((r) => [
    r.id,
    r.name,
    r.email,
    r.role,
    r.plan || "free",
    r.subscriptionStatus || "active",
    r.createdAt,
    String(r.testsTaken),
    String(r.avgBand),
  ]);

  return [header, ...body]
    .map((row) =>
      row
        .map((cell) => {
          const escaped = String(cell).replace(/"/g, '""');
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [planFilter, setPlanFilter] = useState<"ALL" | SubscriptionPlan>("ALL");
  const [page, setPage] = useState(1);
  const [dbTotalUsers, setDbTotalUsers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadUsers(showSkeleton = false) {
    if (showSkeleton) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/admin/users?page=1&pageSize=500", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load users");
      const data = (await res.json()) as {
        users?: UserRow[];
        pagination?: { total?: number };
      };
      const rows = Array.isArray(data.users) ? data.users : [];
      setUsers(rows);
      setDbTotalUsers(
        typeof data.pagination?.total === "number"
          ? data.pagination.total
          : rows.length,
      );
    } catch (err) {
      setUsers([]);
      setDbTotalUsers(0);
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      if (showSkeleton) setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadUsers(true);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((u) => {
      const byRole = roleFilter === "ALL" ? true : u.role === roleFilter;
      const byPlan = planFilter === "ALL" ? true : (u.plan || "free") === planFilter;
      const byQuery =
        !term ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term);
      return byRole && byPlan && byQuery;
    });
  }, [users, query, roleFilter, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, planFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const planCounts = useMemo(() => {
    const totals = { free: 0, pro: 0, premium: 0 };
    for (const user of users) {
      const plan = (user.plan || "free") as SubscriptionPlan;
      totals[plan] += 1;
    }
    return totals;
  }, [users]);

  async function updateUserAccess(
    userId: string,
    updates: Partial<{
      role: UserRole;
      plan: SubscriptionPlan;
      subscriptionStatus: SubscriptionStatus;
    }>,
  ) {
    setError(null);
    setNotice(null);
    setBusyUserId(userId);

    const previous = users;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              ...(updates.role ? { role: updates.role } : {}),
              ...(updates.plan ? { plan: updates.plan } : {}),
              ...(updates.subscriptionStatus
                ? { subscriptionStatus: updates.subscriptionStatus }
                : {}),
            }
          : u,
      ),
    );

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;
        const details = [data?.error, data?.detail].filter(Boolean).join(" - ");
        throw new Error(details || "Unable to update user access right now.");
      }

      setNotice("User access updated successfully.");
    } catch (err) {
      setUsers(previous);
      setError(err instanceof Error ? err.message : "Access update failed.");
    } finally {
      setBusyUserId(null);
    }
  }

  function exportFilteredCsv() {
    if (!filtered.length) {
      setNotice("No rows to export for the current filters.");
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const csv = toCsv(filtered);
    downloadCsv(`ielts-flow-users-${stamp}.csv`, csv);
    setNotice(`Exported ${filtered.length} users to CSV.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-dash-text">User Management</h1>
        <p className="mt-1 text-sm text-dash-text-muted">Search users, change roles, paginate large lists, and export filtered
          records.</p>
      </div>

      <section className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-dash-bg px-3 py-1 text-xs font-semibold text-dash-text">
              Total DB Users: {dbTotalUsers.toLocaleString()}
            </span>
            <span className="rounded-lg bg-dash-bg px-3 py-1 text-xs font-semibold text-dash-text">
              Free: {planCounts.free}
            </span>
            <span className="rounded-lg bg-dash-bg px-3 py-1 text-xs font-semibold text-dash-text">
              Pro: {planCounts.pro}
            </span>
            <span className="rounded-lg bg-dash-bg px-3 py-1 text-xs font-semibold text-dash-text">
              Premium: {planCounts.premium}
            </span>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-dash-text">
                Search
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, or ID"
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm outline-none focus:border-dash-accent focus:ring-2 focus:ring-dash-accent/10"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-dash-text">
                Role Filter
              </span>
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as "ALL" | UserRole)
                }
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                <option value="ALL">All Roles</option>
                <option value="GUEST">Guest</option>
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-[13px] font-medium text-dash-text">
                Plan Filter
              </span>
              <select
                value={planFilter}
                onChange={(e) =>
                  setPlanFilter(e.target.value as "ALL" | SubscriptionPlan)
                }
                className="w-full rounded-lg border border-dash-border px-3 py-2 text-sm"
              >
                <option value="ALL">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="premium">Premium</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void loadUsers(false)}
            disabled={refreshing || loading}
            className="rounded-xl border border-dash-border bg-dash-surface px-4 py-2 text-sm font-semibold text-dash-text disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={exportFilteredCsv}
            className="rounded-xl border border-dash-accent/30 bg-dash-accent-muted/10 px-4 py-2 text-sm font-semibold text-dash-accent hover:bg-dash-accent-muted/20"
          >
            Export CSV
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 h-52 animate-pulse rounded-xl bg-dash-border/50" />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-dash-border text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Tests</th>
                  <th className="px-3 py-2 text-left">Avg Band</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Plan</th>
                  <th className="px-3 py-2 text-left">Subscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {paged.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-dash-text">{u.name}</p>
                      <p className="text-xs text-dash-text-muted">{u.id}</p>
                    </td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2">{u.createdAt}</td>
                    <td className="px-3 py-2">{u.testsTaken}</td>
                    <td className="px-3 py-2">
                      {u.avgBand > 0 ? u.avgBand.toFixed(1) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={u.role}
                        disabled={busyUserId === u.id}
                        onChange={(e) =>
                          updateUserAccess(u.id, {
                            role: e.target.value as UserRole,
                          })
                        }
                        className="rounded-lg border border-dash-border px-2 py-1 text-xs font-semibold"
                      >
                        <option value="GUEST">Guest</option>
                        <option value="STUDENT">Student</option>
                        <option value="INSTRUCTOR">Instructor</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={u.plan || "free"}
                        disabled={busyUserId === u.id}
                        onChange={(e) =>
                          updateUserAccess(u.id, {
                            plan: e.target.value as SubscriptionPlan,
                          })
                        }
                        className="rounded-lg border border-dash-border px-2 py-1 text-xs font-semibold"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={u.subscriptionStatus || "active"}
                        disabled={busyUserId === u.id}
                        onChange={(e) =>
                          updateUserAccess(u.id, {
                            subscriptionStatus: e.target
                              .value as SubscriptionStatus,
                          })
                        }
                        className="rounded-lg border border-dash-border px-2 py-1 text-xs font-semibold"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="trialing">Trialing</option>
                        <option value="past_due">Past Due</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}

                {!paged.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-8 text-center text-dash-text-muted"
                    >
                      No users found for current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-dash-text-muted">
            Showing{" "}
            {(paged.length ? (page - 1) * PAGE_SIZE + 1 : 0).toLocaleString()}-
            {((page - 1) * PAGE_SIZE + paged.length).toLocaleString()} of{" "}
            {filtered.length.toLocaleString()}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-dash-border px-3 py-1 text-xs font-semibold text-dash-text disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-dash-text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-dash-border px-3 py-1 text-xs font-semibold text-dash-text disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
