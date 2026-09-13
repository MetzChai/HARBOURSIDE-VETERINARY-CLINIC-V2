"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Printer, Clock, CheckCircle, Loader2 } from "lucide-react";
import { useRows } from "@/hooks/useRows";
import { useMyOwner, useMyPets } from "@/hooks/useOwnerData";
import { formatDate } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";

export default function UserTransactions() {
  const { data: owner } = useMyOwner();
  const { data: myPets = [] } = useMyPets();

  const { data: allTransactions = [], isLoading } = useRows<any>("lab_transactions", {
    orderBy: "created_at",
    ascending: false,
  });

  const myPetIds = useMemo(() => new Set(myPets.map((p: any) => p.id)), [myPets]);

  const userTransactions = useMemo(() => {
    if (!owner && myPets.length === 0) return [];
    return allTransactions.filter((t: any) => {
      if (owner && t.owner_id === (owner as any).id) return true;
      if (t.pet_id && myPetIds.has(t.pet_id)) return true;
      return false;
    });
  }, [allTransactions, owner, myPets, myPetIds]);

  const petMap = useMemo(() => new Map(myPets.map((p: any) => [p.id, p])), [myPets]);

  const totalSpent = useMemo(() => {
    return userTransactions.reduce((sum: number, t: any) => {
      const tot = Number(t.total_amount || t.total || 0);
      const paid = Number(t.amount_paid ?? ((t.payment_status || t.status) === "Paid" ? tot : 0));
      return sum + paid;
    }, 0);
  }, [userTransactions]);

  const pendingAmount = useMemo(() => {
    return userTransactions.reduce((sum: number, t: any) => {
      const tot = Number(t.total_amount || t.total || 0);
      const paid = Number(t.amount_paid ?? ((t.payment_status || t.status) === "Paid" ? tot : 0));
      return sum + Math.max(0, tot - paid);
    }, 0);
  }, [userTransactions]);

  const handlePrintReceipt = (t: any) => {
    const pet = petMap.get(t.pet_id);
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <head>
          <title>Clinic Receipt - ${t.transaction_number || "TXN"}</title>
          <style>
            h1 { color: #7F1D1D; margin-bottom: 2px; }
            .badge { background: #fee2e2; color: #7F1D1D; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #FEE2E2; color: #7F1D1D; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 20px; }
            .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <img src="/logo.png" style="height:44px;width:44px;object-fit:contain;border-radius:6px;" alt="HVS" />
            <div>
              <h1 style="margin:0;font-size:20px;color:#7F1D1D;">Harbourside Veterinary Clinic</h1>
              <h2 style="margin:2px 0 0;font-size:14px;color:#E5192C;">Payment Statement</h2>
            </div>
          </div>
          <div class="info-grid">
            <div><strong>Transaction #:</strong> ${t.transaction_number || `TXN-${t.id.slice(0, 6)}`}</div>
            <div><strong>Date:</strong> ${formatDate(t.date || t.created_at)}</div>
            <div><strong>Pet Name:</strong> ${pet?.name || "Pet"}</div>
            <div><strong>Payment Method:</strong> ${t.payment_method || "Cash"}</div>
            <div><strong>Status:</strong> ${t.payment_status || "Pending"}</div>
          </div>
          <table>
            <thead><tr><th>Services Rendered</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>
              <tr><td>${t.services_rendered || "Veterinary Medical Service"}</td><td style="text-align:right">₱${Number(t.total_amount || t.total || 0).toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div class="footer">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic</div>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="page-container space-y-6 pb-10">
      <PageHeader
        title="My Transactions"
        description="Clinic payment history, services rendered, and payment status"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Total Paid Amount"
          value={`₱${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Pending Payment Amount"
          value={`₱${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Clock}
          variant="warning"
        />
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#E5192C]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FEE2E2] hover:bg-[#FEE2E2]">
                  <TableHead className="text-[#7F1D1D] font-bold text-xs">Txn #</TableHead>
                  <TableHead className="text-[#7F1D1D] font-bold text-xs">Date</TableHead>
                  <TableHead className="text-[#7F1D1D] font-bold text-xs">Pet</TableHead>
                  <TableHead className="text-[#7F1D1D] font-bold text-xs">Services Rendered</TableHead>
                  <TableHead className="text-[#7F1D1D] font-bold text-xs">Amount</TableHead>
                  <TableHead className="text-[#7F1D1D] font-bold text-xs">Method</TableHead>
                  <TableHead className="text-[#7F1D1D] font-bold text-xs">Status</TableHead>
                  <TableHead className="text-[#7F1D1D] font-bold text-xs text-right pr-6">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userTransactions.length ? (
                  userTransactions.map((t: any) => (
                    <TableRow key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-[#7F1D1D]">
                        {t.transaction_number || `TXN-${t.id.slice(0, 6)}`}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(t.date || t.created_at)}</TableCell>
                      <TableCell className="font-semibold text-xs text-[#7F1D1D]">
                        {petMap.get(t.pet_id)?.name || "Pet"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {t.services_rendered || "Veterinary Medical Service"}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-[#7F1D1D]">
                        ₱{Number(t.total_amount || t.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs border-[#E5192C]/30 text-[#7F1D1D] bg-[#FFF1F2]">
                          {t.payment_method || "Cash"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            (t.payment_status || t.status) === "Paid"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold text-xs"
                              : "bg-amber-50 text-amber-900 border-amber-300 font-semibold text-xs"
                          }
                        >
                          {t.payment_status || t.status || "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[#7F1D1D] hover:bg-[#FEE2E2]"
                          onClick={() => handlePrintReceipt(t)}
                          title="Print Receipt"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <EmptyState
                        icon={DollarSign}
                        title="No transactions found."
                        description="Clinic charges linked to your pets will appear here."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
