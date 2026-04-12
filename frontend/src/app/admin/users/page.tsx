"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, BadgeCheck, Plus, Check } from "lucide-react";
import { adminApi } from "@/lib/api";
import toast from "react-hot-toast";

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  plan: string;
  creditBalance: number;
  emailVerified: boolean;
  createdAt: string;
}

interface UserDetail extends AdminUser {
  updatedAt: string;
  jobCount: number;
  totalSpentCents: number;
}

const PLANS = ["free", "starter", "pro", "enterprise"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  // Expanded user detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Credit form
  const [creditAmount, setCreditAmount] = useState("");
  const [creditLoading, setCreditLoading] = useState(false);

  // Plan form
  const [planValue, setPlanValue] = useState("");
  const [planLoading, setPlanLoading] = useState(false);

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.users(page, search);
      setUsers(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await adminApi.userDetail(id);
      setDetail(res.data);
      setPlanValue(res.data.plan);
    } catch {
      toast.error("Failed to load user details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddCredits = async (userId: string) => {
    const amount = parseInt(creditAmount, 10);
    if (!amount || isNaN(amount)) {
      toast.error("Enter a valid credit amount");
      return;
    }
    setCreditLoading(true);
    try {
      const res = await adminApi.addCredits(userId, amount);
      toast.success(`Credits updated. New balance: ${res.data.creditBalance}`);
      setCreditAmount("");
      // Refresh detail and list
      const detailRes = await adminApi.userDetail(userId);
      setDetail(detailRes.data);
      fetchUsers();
    } catch {
      toast.error("Failed to add credits");
    } finally {
      setCreditLoading(false);
    }
  };

  const handleChangePlan = async (userId: string) => {
    if (!planValue) return;
    setPlanLoading(true);
    try {
      await adminApi.updatePlan(userId, planValue);
      toast.success(`Plan updated to ${planValue}`);
      const detailRes = await adminApi.userDetail(userId);
      setDetail(detailRes.data);
      fetchUsers();
    } catch {
      toast.error("Failed to update plan");
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-900/70 text-zinc-400 text-left">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium text-right">Credits</th>
              <th className="px-4 py-3 font-medium text-center">Verified</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <>
                  <tr
                    key={u.id}
                    onClick={() => toggleExpand(u.id)}
                    className="hover:bg-zinc-900/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">{u.displayName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 capitalize">
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{u.creditBalance}</td>
                    <td className="px-4 py-3 text-center">
                      {u.emailVerified ? (
                        <BadgeCheck className="w-4 h-4 text-green-400 mx-auto" />
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                  {expandedId === u.id && (
                    <tr key={`${u.id}-detail`}>
                      <td colSpan={6} className="px-4 py-4 bg-zinc-900/40">
                        {detailLoading ? (
                          <div className="flex justify-center py-4">
                            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : detail ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Stats */}
                            <div className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                                Details
                              </h3>
                              <p className="text-sm">
                                <span className="text-zinc-400">Jobs:</span>{" "}
                                {detail.jobCount}
                              </p>
                              <p className="text-sm">
                                <span className="text-zinc-400">Total spent:</span>{" "}
                                ${(detail.totalSpentCents / 100).toFixed(2)}
                              </p>
                              <p className="text-sm">
                                <span className="text-zinc-400">Updated:</span>{" "}
                                {new Date(detail.updatedAt).toLocaleString()}
                              </p>
                            </div>

                            {/* Add Credits */}
                            <div>
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                                Add Credits
                              </h3>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  placeholder="Amount"
                                  value={creditAmount}
                                  onChange={(e) => setCreditAmount(e.target.value)}
                                  className="w-24 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddCredits(u.id);
                                  }}
                                  disabled={creditLoading}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add
                                </button>
                              </div>
                            </div>

                            {/* Change Plan */}
                            <div>
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                                Change Plan
                              </h3>
                              <div className="flex gap-2">
                                <select
                                  value={planValue}
                                  onChange={(e) => setPlanValue(e.target.value)}
                                  className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                >
                                  {PLANS.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChangePlan(u.id);
                                  }}
                                  disabled={planLoading}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-zinc-500">
          {total} user{total !== 1 ? "s" : ""} total
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
