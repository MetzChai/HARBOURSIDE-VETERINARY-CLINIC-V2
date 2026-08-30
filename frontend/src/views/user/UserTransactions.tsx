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
    return userTransactions
      .filter((t: any) => (t.payment_status || t.status) === "Paid")
      .reduce((sum: number, t: any) => sum + Number(t.total_amount || t.total || 0), 0);
  }, [userTransactions]);

  const pendingAmount = useMemo(() => {
    return userTransactions
      .filter((t: any) => (t.payment_status || t.status) !== "Paid")
      .reduce((sum: number, t: any) => sum + Number(t.total_amount || t.total || 0), 0);
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
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #1B3A5C; margin-bottom: 2px; }
            .badge { background: #e8eef4; color: #1B3A5C; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #E8EEF4; color: #1B3A5C; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 20px; }
            .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Payment Statement</h2>
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
    <div className="page-container">
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-navy" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Txn #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Services Rendered</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userTransactions.length ? (
                  userTransactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs font-bold text-brand-navy">
                        {t.transaction_number || `TXN-${t.id.slice(0, 6)}`}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(t.date || t.created_at)}</TableCell>
                      <TableCell className="font-semibold text-xs">
                        {petMap.get(t.pet_id)?.name || "Pet"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {t.services_rendered || "Veterinary Medical Service"}
                      </TableCell>
                      <TableCell className="font-bold text-xs">
                        ₱{Number(t.total_amount || t.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {t.payment_method || "Cash"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            (t.payment_status || t.status) === "Paid"
                              ? "bg-brand-green-light text-brand-green border-brand-green/30"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }
                        >
                          {t.payment_status || t.status || "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handlePrintReceipt(t)}
                          title="Print Receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
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
