"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMyVaccinations } from "@/hooks/useOwnerData";
import { isOnOrBeforeTodayPH } from "@/lib/datetime";

export default function UserVaccinations() {
  const { data: vaccinations = [] } = useMyVaccinations();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl font-bold">Vaccinations</h2>
        <p className="text-muted-foreground text-sm">Track your pets' vaccination records</p>
      </div>
      <Card className="shadow-sm">
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
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No vaccination records yet.</TableCell></TableRow>
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
                      <Badge variant={isDue ? "destructive" : "default"}>
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

