"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Syringe } from "lucide-react";
import { useMyVaccinations } from "@/hooks/useOwnerData";
import { isOnOrBeforeTodayPH } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function UserVaccinations() {
  const { data: vaccinations = [] } = useMyVaccinations();

  return (
    <div className="page-container">
      <PageHeader
        title="Vaccinations"
        description="Track your pets' vaccination records and upcoming due dates"
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pet</TableHead>
                <TableHead>Vaccine</TableHead>
                <TableHead>Date Given</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vaccinations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={Syringe}
                      title="No vaccination records yet."
                      description="Clinic vaccination history for your pets will appear here."
                    />
                  </TableCell>
                </TableRow>
              )}
              {vaccinations.map((v: any) => {
                const isDue = v.next_due && isOnOrBeforeTodayPH(v.next_due);
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.pets?.name}</TableCell>
                    <TableCell>{v.vaccine_type}</TableCell>
                    <TableCell>{v.date_given}</TableCell>
                    <TableCell>{v.next_due}</TableCell>
                    <TableCell>
                      <Badge variant={isDue ? "destructive" : "success"}>
                        {isDue ? "Due" : "Up to date"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
