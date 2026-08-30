"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { useRows } from "@/hooks/useRows";
import { useMyOwner, useMyPets } from "@/hooks/useOwnerData";
import { formatDate } from "@/lib/age";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";

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
        return <Badge className="bg-brand-navy text-white">Email + SMS + In-App</Badge>;
      case "EMAIL_SMS":
        return <Badge className="bg-brand-teal text-white">Email + SMS</Badge>;
      case "EMAIL":
        return <Badge variant="outline" className="bg-brand-navy-light text-brand-navy border-brand-navy/20">Email</Badge>;
      case "SMS":
        return <Badge variant="outline" className="bg-brand-teal-light text-brand-teal border-brand-teal/30">SMS</Badge>;
      default:
        return <Badge variant="secondary">In-App</Badge>;
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="My Messages"
        description="Clinic notices, email logs, SMS reminders, and in-app notifications"
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <PageSkeleton rows={6} />
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
                        {m.subject ? <strong className="block text-brand-navy">{m.subject}</strong> : null}
                        <span className="text-muted-foreground">{m.body}</span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        icon={MessageSquare}
                        title="No messages found."
                        description="Clinic communications sent to you will appear here."
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
