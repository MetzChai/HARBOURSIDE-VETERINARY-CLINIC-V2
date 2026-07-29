"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Mail, Phone, Bell, Loader2 } from "lucide-react";
import { useRows } from "@/hooks/useRows";
import { useMyOwner, useMyPets } from "@/hooks/useOwnerData";
import { formatDate } from "@/lib/age";

export default function UserMessages() {
  const { data: owner } = useMyOwner();
  const { data: myPets = [] } = useMyPets();

  const { data: allMessages = [], isLoading } = useRows<any>("messages", {
    orderBy: "created_at",
    ascending: false,
  });

  const myPetIds = useMemo(() => new Set(myPets.map((p: any) => p.id)), [myPets]);

  const userMessages = useMemo(() => {
    if (!owner && myPets.length === 0) return [];
    return allMessages.filter((m: any) => {
      if (owner && m.owner_id === (owner as any).id) return true;
      if (m.pet_id && myPetIds.has(m.pet_id)) return true;
      return false;
    });
  }, [allMessages, owner, myPets, myPetIds]);

  const petMap = useMemo(() => new Map(myPets.map((p: any) => [p.id, p])), [myPets]);

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case "ALL":
        return <Badge className="bg-purple-600 text-white">Email + SMS + In-App</Badge>;
      case "EMAIL_SMS":
        return <Badge className="bg-blue-600 text-white">Email + SMS</Badge>;
      case "EMAIL":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Email</Badge>;
      case "SMS":
        return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">SMS</Badge>;
      default:
        return <Badge variant="secondary">In-App</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> My Message History
        </h1>
        <p className="text-muted-foreground text-sm">
          View all clinic notices, email logs, SMS reminders, and in-app notifications
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Subject / Content</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userMessages.length ? (
                  userMessages.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">
                        {formatDate(m.sent_at || m.created_at)}
                      </TableCell>
                      <TableCell className="font-semibold text-xs">
                        {petMap.get(m.pet_id)?.name || "General"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {m.message_type || "Notice"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getChannelBadge(m.channel)}</TableCell>
                      <TableCell className="text-xs max-w-[300px]">
                        {m.subject ? <strong className="block text-primary">{m.subject}</strong> : null}
                        <span className="text-muted-foreground">{m.body}</span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No message history recorded yet.
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
