"use client";

import React from "react";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  Users,
  LogOut,
  UserPlus,
  X,
  Info,
  LeafIcon as LeaveIcon,
  Bell,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, UserIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { th } from "date-fns/locale";

// Import Redux hooks and actions
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  connectWebSocket,
  sendMessage,
  createRoom,
  inviteUser,
  setActivateRoom,
  selectRooms,
  selectActiveRoom,
  selectActiveRoomData,
  selectMessagesForRoom,
  selectIsConnected,
  selectIsConnecting,
  selectOnlineUsers,
  getRooms,
  getMessages,
  leaveGroup,
  selectWebSocket,
  getGroupRooms,
  joinGroupRoom,
  selectGroupRooms,
} from "@/lib/features/chat/chatSlice";

import {
  selectSearchUser,
  selectCurrentUser,
  searchUser,
} from "@/lib/features/user/userSlice";
import { getPendingInvites } from "@/lib/features/invite/inviteSlice";

// Add these imports at the top of the file
import {
  selectIsAuthenticated,
  selectUser,
  setUser,
} from "@/lib/features/auth/authSlice";

// Import the logout action
import { logout } from "@/lib/features/auth/authSlice";

export default function ChatPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Redux state
  const groupRooms = useAppSelector(selectGroupRooms);
  const rooms = useAppSelector(selectRooms);
  const activeRoomId = useAppSelector(selectActiveRoom);
  const activeRoomData = useAppSelector(selectActiveRoomData);
  const isConnected = useAppSelector(selectIsConnected);
  const isConnecting = useAppSelector(selectIsConnecting);

  // Add these lines to get auth state
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const authUser = useAppSelector(selectUser);
  const currentUser = useAppSelector(selectCurrentUser);

  // Add this effect to redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Local state for UI
  const [newMessage, setNewMessage] = useState("");
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("group");
  const [directUsername, setDirectUsername] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const currentUserId = authUser?.id;

  // Get messages for the active room
  const messages = useAppSelector(selectMessagesForRoom);
  const [memoizedMessageGroups, setMemoizedMessageGroups] = useState<ReturnType<typeof groupMessagesByDate>>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      const user = JSON.parse(storedUser)
      dispatch(setUser(user)) // You’ll need to add this reducer
    }
  }, [])

  // Connect to WebSocket
  useEffect(() => {
    if (!authUser) return;
    dispatch(connectWebSocket());
    dispatch(getRooms());
    dispatch(getGroupRooms());
    return;
  }, [dispatch, authUser]);

  useEffect(() => {
    if (messages.length > 0 && activeRoomId && chatContainerRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.room_id === activeRoomId) {
        setTimeout(() => {
          if(chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 50); // Adjust the delay (in milliseconds) as needed
      }
    }
  }, [messages, activeRoomId]);

  useEffect(() => {
    if (activeRoomData) {
        setMemoizedMessageGroups(groupMessagesByDate());
    } else {
        setMemoizedMessageGroups([]); // Clear messages if no active room data
    }
}, [messages, activeRoomData]);

const isMessageUnread = (message: any) => {
  if (!activeRoomData?.lastReadAt) return false;
  const lastReadAt = activeRoomData.lastReadAt;
  const messageCreatedAt = message.created_at;
  return new Date(messageCreatedAt) > new Date(lastReadAt) && currentUserId !== message.user_id;
};

  // Filter users based on search term and exclude already selected users
  const filteredUsers = useAppSelector(selectSearchUser);

  // Handle direct message validation
  const isValidDirectMessage = (): boolean => {
    if (newRoomType !== "direct") return true;
    return directUsername.trim() !== "";
  };

  // Handle group validation
  const isValidGroup = () => {
    if (newRoomType !== "group") return true;
    return newRoomName.trim() !== "";
  };

  // Reset form when room type changes
  useEffect(() => {
    if (newRoomType === "direct") {
      setNewRoomName("");
    } else {
      setDirectUsername("");
    }
  }, [newRoomType]);

  // Handle creating a new room
  const handleCreateRoom = () => {
    if (!isValidDirectMessage() || !isValidGroup()) return;

    if (newRoomType === "direct" && currentUserId) {
      // For direct messages
      dispatch(
        createRoom({
          name: directUsername,
          type: "direct",
          user_ids: [], // Add the current user's ID
        })
      );
    } else {
      // For groups
      dispatch(
        createRoom({
          name: newRoomName,
          type: "group",
          user_ids: [], // Add user IDs if needed
        })
      );
    }

    // Reset form
    setNewRoomName("");
    setNewRoomType("group");
    setDirectUsername("");
    setIsCreateRoomOpen(false);
  };

  // Handle inviting users to a group
  const handleInviteUsers = () => {
    if (
      !activeRoomId ||
      !activeRoomData ||
      activeRoomData.room.type !== "group" ||
      selectedUsers.length === 0
    )
      return;

    selectedUsers.map((user) => {
      dispatch(inviteUser(activeRoomId, user));
    });

    setSelectedUsers([]);
    setIsInviteDialogOpen(false);
  };

  // Handle selecting a user to invite
  const handleSelectUser = (user: string) => {
    setSelectedUsers([...selectedUsers, user]);
    setSearchTerm("");
  };

  // Handle removing a selected user
  const handleRemoveUser = (user: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u !== user));
  };

  // Handle search term change
  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.trim()) {
      console.log("Searching for users:", term.trim());
      dispatch(searchUser(term.trim()));
    }
  };

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Sending message:", newMessage);
    console.log("Active room ID:", activeRoomId);
    if (!newMessage.trim() || !activeRoomId) return;

    dispatch(sendMessage(activeRoomId, newMessage));
    setNewMessage("");
  };

  // Handle changing the active room
  const handleRoomChange = async (roomId: number) => {
    console.log("Changing room to:", roomId);
    await dispatch(setActivateRoom(roomId));
    await dispatch(getMessages(roomId));
    console.log(messages);
  };

  // Handle navigating to pending invites
  const handleViewPendingInvites = () => {
    console.log("Navigating to pending invites page");
    router.push("/invite");

    // For now, just log and fetch the pending invites
    dispatch(getPendingInvites());
  };

  // Then update the logout handler
  const handleLogout = () => {
    dispatch(logout());
    router.push("/");
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = "";
    let currentGroup: typeof messages = [];

    messages.forEach((message) => {
      const messageDate = message.created_at.split("T")[0]; // Extract date part

      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  };

  // Format date for display
  const formatMessageDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);

      if (isToday(date)) {
        return "Today";
      } else if (isYesterday(date)) {
        return "Yesterday";
      } else {
        return format(date, "dd MMMM yyyy", { locale: th });
      }
    } catch (error) {
      return dateString;
    }
  };

  // Check if a user is online (for demo purposes, randomly determine status)
  // const isUserOnline = (userId: number) => {
  //   // In a real app, this would come from your backend or WebSocket
  //   // For demo purposes, we'll use a simple algorithm based on user ID
  //   return userId % 2 === 0
  // }
  const handleLeaveGroup = () => {
    if (!activeRoomId) return;
    dispatch(leaveGroup(activeRoomId));
  };

  const ws = useAppSelector(selectWebSocket);

  // once we have a WS and a non‑empty rooms list, re‑send "online"
  useEffect(() => {
    if (!ws || rooms.length === 0) return;

    ws.send(
      JSON.stringify({
        type: "status",
        payload: "online",
      })
    );
  }, [ws, rooms]);

  //OnlineStatus
  const onlineUsers = useAppSelector(selectOnlineUsers);
  const isUserOnline = (userId: number) =>
    // always show yourself as online…
    userId === authUser?.id ? true : onlineUsers.includes(userId);

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-[#D1D5DB] flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#D1D5DB] flex items-center justify-between h-[5rem]">
          <div className="flex items-center">
            <h1 className="font-bold text-[#111827]">Chat App</h1>
            {currentUser && (
              <span className="ml-2 text-sm text-[#6B7280]">
                {currentUser.username}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewPendingInvites}
              className="text-[#6B7280] hover:text-[#111827]"
              title="View pending invites"
            >
              <Bell size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-[#6B7280] hover:text-[#111827]"
              title="Logout"
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>

        {/* Chat Rooms */}
        <div className="p-2 flex items-center justify-between">
          <h2 className="px-2 py-1 text-sm font-medium text-[#6B7280] flex items-center">
            <Users size={16} className="mr-2" />
            Chat Rooms
          </h2>
          <Dialog open={isCreateRoomOpen} onOpenChange={setIsCreateRoomOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Plus size={16} className="text-[#3B82F6]" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Room</DialogTitle>
                <DialogDescription>
                  Create a new chat room or direct message.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Type</Label>
                  <RadioGroup
                    value={newRoomType}
                    onValueChange={setNewRoomType}
                    className="col-span-3 flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="group" id="group" />
                      <Label htmlFor="group" className="flex items-center">
                        <Users size={16} className="mr-1" />
                        Group
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="direct" id="direct" />
                      <Label htmlFor="direct" className="flex items-center">
                        <UserIcon size={16} className="mr-1" />
                        Direct
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Conditional fields based on room type */}
                {newRoomType === "group" ? (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Group Name
                    </Label>
                    <Input
                      id="name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="col-span-3"
                      placeholder="Enter group name"
                    />
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="username" className="text-right">
                        Username
                      </Label>
                      <Input
                        id="username"
                        value={directUsername}
                        onChange={(e) => setDirectUsername(e.target.value)}
                        className="col-span-3"
                        placeholder="Enter username"
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleCreateRoom}
                  className="bg-[#3B82F6] hover:bg-[#2563EB]"
                  disabled={!isValidDirectMessage() || !isValidGroup()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rooms.map((room) => (
            <button
              key={room.room.id}
              className={`w-full text-left px-4 py-2 flex items-center justify-between ${
                activeRoomId === room.room.id
                  ? "bg-[#E0F2FE] text-[#3B82F6]"
                  : "hover:bg-gray-50 text-[#111827]"
              }`}
              onClick={() => handleRoomChange(room.room.id)}
            >
              <div className="flex items-center">
                {room.room.type === "direct" ? (
                  <>
                    <div className="relative">
                      <UserIcon size={16} className="mr-2" />
                      {/* Online status indicator for direct messages */}
                      {room.room.users &&
                        room.room.users.length > 0 &&
                        room.room.users.some(
                          (user) => user.id !== authUser?.id
                        ) && (
                          <span
                            className={`absolute bottom-0 right-1 h-2 w-2 rounded-full ${
                              isUserOnline(
                                room.room.users.find(
                                  (user) => user.id !== authUser?.id
                                )?.id || 0
                              )
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                        )}
                    </div>
                    <span>{room.room.name}</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={16} className="mr-2" />
                    <span>{room.room.name}</span>
                    {/* Show member count for group chats */}
                    {room.room.users && (
                      <span className="ml-2 text-xs text-gray-500">
                        {room.room.users.length} คน
                      </span>
                    )}
                  </>
                )}
              </div>
              {room.unreadCount > 0 && (
                <span className="bg-[#3B82F6] text-white text-xs px-2 py-0.5 rounded-full">
                  {room.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-gray-200 p-2">
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Available Groups
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {groupRooms
              .filter((gr) => !rooms.some((rw) => rw.room.id === gr.id))
              .map((gr) => (
                <div
                  key={gr.id}
                  className="px-2 py-1 flex justify-between items-center hover:bg-gray-50 rounded"
                >
                  <span className="flex items-center">
                    <MessageSquare size={16} className="mr-2" />
                    {gr.name}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => dispatch(joinGroupRoom(gr.id))}
                  >
                    Join
                  </Button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header - Fixed width with flex properties */}
        <div className="p-4 border-b border-[#D1D5DB] bg-white flex items-center h-[5rem]">
          <h2 className="font-medium text-[#111827] flex-grow flex items-center">
            {activeRoomData?.room.name}

            {/* Room info button */}
            {activeRoomData && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-2 h-8 w-8">
                    <Info size={16} className="text-gray-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <h3 className="font-medium">Room Members</h3>
                    <div className="max-h-[200px] overflow-y-auto">
                      {activeRoomData.room.users?.map((user) => (
                        <div key={user.id} className="flex items-center py-2">
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarFallback className="bg-[#6366F1] text-white text-xs">
                              {user.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-grow">{user.username}</span>
                          {/* Show online status for users */}
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isUserOnline(user.id)
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Leave group button for group chats */}
                    {activeRoomData.room.type === "group" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full mt-2"
                        onClick={handleLeaveGroup}
                      >
                        <LeaveIcon size={14} className="mr-1" />
                        Leave Group
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </h2>

          {/* Connection status indicator with fixed width */}
          <div className="flex items-center gap-2 min-w-[180px] justify-end">
            {isConnecting ? (
              <span className="text-sm text-[#6B7280]">Connecting...</span>
            ) : isConnected ? (
              <span className="flex items-center text-sm text-green-500">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                Connected
              </span>
            ) : (
              <span className="flex items-center text-sm text-red-500">
                <span className="h-2 w-2 rounded-full bg-red-500 mr-1"></span>
                Disconnected
              </span>
            )}

            {/* Invite button for group chats */}
            {activeRoomData?.room.type === "group" && (
              <Dialog
                open={isInviteDialogOpen}
                onOpenChange={setIsInviteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 ml-2"
                  >
                    <UserPlus size={14} />
                    <span>Invite</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      Invite to {activeRoomData.room.name}
                    </DialogTitle>
                    <DialogDescription>
                      Add users to this group chat.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Selected users */}
                    {selectedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedUsers.map((user) => (
                          <Badge
                            key={user}
                            variant="secondary"
                            className="flex items-center gap-1 px-3 py-1"
                          >
                            {user}
                            <button
                              onClick={() => handleRemoveUser(user)}
                              className="ml-1"
                            >
                              <X size={14} />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Search input */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={handleSearchTermChange}
                      />
                    </div>

                    {/* User list */}
                    <div className="max-h-[200px] overflow-y-auto border rounded-md">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <button
                            key={`${user.username}`}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center"
                            onClick={() => handleSelectUser(`${user.username}`)}
                          >
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarFallback className="bg-[#6366F1] text-white text-xs">
                                {user.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{user.username}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-[#6B7280]">
                          {searchTerm
                            ? "No users found"
                            : "Type to search users"}
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={handleInviteUsers}
                      className="bg-[#3B82F6] hover:bg-[#2563EB]"
                      disabled={selectedUsers.length === 0}
                    >
                      Invite
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          ref={chatContainerRef}
        >
          {memoizedMessageGroups.map((group, groupIndex) => (
            <div key={group.date + groupIndex} className="space-y-4">
              {/* Date Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-xs text-gray-500 bg-[#F9FAFB] px-2">
                  {formatMessageDate(group.date)}
                </span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>

              {/* Messages for this date */}
              {group.messages.map((msg, msgIndex) => {
                // Check if this message is the first unread message
                const isFirstUnread =
                  msgIndex > 0 &&
                  !isMessageUnread(group.messages[msgIndex - 1]) &&
                  isMessageUnread(msg);

                return (
                  <React.Fragment key={msg.id}>
                    {/* Unread Messages Divider */}
                    {isFirstUnread && (
                      <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-red-500"></div>
                        <span className="flex-shrink mx-4 text-xs text-red-500 bg-[#F9FAFB] px-2 font-medium">
                          ใหม่
                        </span>
                        <div className="flex-grow border-t border-red-500"></div>
                      </div>
                    )}

                    {/* Message */}
                    <div
                      className={`flex ${
                        msg.user_id == authUser?.id
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex max-w-[70%] ${
                          msg.user_id == authUser?.id
                            ? "flex-row-reverse"
                            : "flex-row"
                        }`}
                      >
                        {!(msg.user_id == authUser?.id) && (
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarFallback className="bg-[#6366F1] text-white">
                              {msg.user.username.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          <div
                            className={`px-4 py-2 rounded-lg ${
                              msg.user_id == authUser?.id
                                ? "bg-[#E0F2FE] text-[#111827]"
                                : "bg-[#E5E7EB] text-[#111827]"
                            }`}
                          >
                            {!(msg.user_id == authUser?.id) && (
                              <div className="font-medium text-sm text-[#6366F1] mb-1">
                                {msg.user.username}
                              </div>
                            )}
                            <p>{msg.content}</p>
                          </div>
                          <div
                            className={`text-xs text-[#6B7280] mt-1 ${
                              msg.user_id == authUser?.id
                                ? "text-right"
                                : "text-left"
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-[#D1D5DB] bg-white">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border-[#D1D5DB]"
            />
            <Button
              type="submit"
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
              disabled={!newMessage.trim() || !isConnected}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
