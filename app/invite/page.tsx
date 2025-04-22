"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, X, ArrowLeft } from "lucide-react";

// Import Redux hooks and actions
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

import { selectIsAuthenticated } from "@/lib/features/auth/authSlice";

// ↓ instead, import:
import {
  getPendingInvites,
  removeInvite,
  selectPendingInvites,
  selectInvitesLoading,
} from "@/lib/features/invite/inviteSlice";

// ↓ add your WebSocket‐based accept/reject and the getRooms thunk
import {
  acceptInvite as acceptInviteWS,
  rejectInvite as rejectInviteWS,
  getRooms,
} from "@/lib/features/chat/chatSlice";

export default function InvitesPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Redux state
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const pendingInvites = useAppSelector(selectPendingInvites);
  const isLoading = useAppSelector(selectInvitesLoading);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Fetch pending invites on mount
  useEffect(() => {
    dispatch(getPendingInvites());
  }, [dispatch]);

  // Handle accepting an invite
  const handleAcceptInvite = (inviteId: number) => {
    // find the full invite object
    const inv = pendingInvites.find((i) => i.id === inviteId);
    if (!inv) return;

    // 1) tell the server (WS)
    dispatch(acceptInviteWS(inv.room.id));

    // 2) optimistically add the new room to your sidebar
    dispatch(getRooms());

    // 3) optimistically remove that invite from your list
    dispatch(removeInvite(inviteId));
  };

  // Handle rejecting an invite
  const handleRejectInvite = (inviteId: number) => {
    const inv = pendingInvites.find((i) => i.id === inviteId);
    if (!inv) return;

    dispatch(rejectInviteWS(inv.room.id));
    dispatch(removeInvite(inviteId));
  };

  // Handle going back to chat
  const handleBackToChat = () => {
    router.push("/chat");
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#F9FAFB] p-4">
      <div className="w-full max-w-3xl">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBackToChat} className="mr-2">
            <ArrowLeft size={16} className="mr-1" />
            Back to Chat
          </Button>
          <h1 className="text-2xl font-bold">Pending Invites</h1>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading invites...</div>
        ) : pendingInvites.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-500">No pending invites</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingInvites.map((invite) => (
              <Card key={invite.id}>
                <CardHeader>
                  <CardTitle>{invite.room.name}</CardTitle>
                  <CardDescription>
                    {invite.room.type === "direct"
                      ? "Direct Message"
                      : "Group Chat"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>
                    You've been invited to join this{" "}
                    {invite.room.type === "direct" ? "conversation" : "group"}{" "}
                    by{" "}
                    <span className="font-medium">
                      {invite.sender.username}
                    </span>
                  </p>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectInvite(invite.id)}
                    className="text-red-500 border-red-200 hover:bg-red-50"
                  >
                    <X size={16} className="mr-1" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(invite.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check size={16} className="mr-1" />
                    Accept
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
