"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Users, LogOut, UserPlus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Plus, UserIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// Import Redux hooks and actions
import { useAppDispatch, useAppSelector } from "@/lib/hooks"
import {
  connectWebSocket,
  sendMessage,
  createRoom,
  inviteUsers,
  setActiveRoom,
  initializeDummyData,
  selectRooms,
  selectMessagesByRoom,
  selectActiveRoom,
  selectActiveRoomData,
  selectCurrentUser,
  selectIsConnected,
  selectIsConnecting,
  type Room,
  type Message,
} from "@/lib/features/chat/chatSlice"

// Add these imports at the top of the file
import { selectIsAuthenticated, selectUser, logout } from "@/lib/features/auth/authSlice"

// Dummy data for initial state
const dummyRooms: Room[] = [
  { id: 1, name: "General", unread: 3, type: "group", members: ["alice#dev", "bob#designer", "charlie#pm"] },
  { id: 2, name: "Design Team", unread: 0, type: "group", members: ["bob#designer", "david#qa"] },
  { id: 3, name: "Development", unread: 5, type: "group", members: ["alice#dev", "charlie#pm", "eve#admin"] },
  { id: 4, name: "Marketing", unread: 0, type: "group", members: ["david#qa", "eve#admin"] },
  { id: 5, name: "Support", unread: 1, type: "group", members: ["alice#dev", "eve#admin"] },
  {
    id: 6,
    name: "Alice",
    unread: 0,
    type: "direct",
    members: ["alice#dev"],
    directUser: { name: "alice", tag: "dev" },
  },
]

const dummyMessages: Message[] = [
  { id: 1, roomId: 1, sender: "Alice", content: "Hey everyone! How's it going?", timestamp: "10:30 AM", isUser: false },
  {
    id: 2,
    roomId: 1,
    sender: "Bob",
    content: "Pretty good, working on the new design system.",
    timestamp: "10:32 AM",
    isUser: false,
  },
  {
    id: 3,
    roomId: 1,
    sender: "You",
    content: "I'm just setting up the new project structure.",
    timestamp: "10:33 AM",
    isUser: true,
  },
  {
    id: 4,
    roomId: 1,
    sender: "Charlie",
    content: "Can someone help me with the API integration?",
    timestamp: "10:35 AM",
    isUser: false,
  },
  {
    id: 5,
    roomId: 1,
    sender: "You",
    content: "Sure, I can help with that. What specifically are you stuck on?",
    timestamp: "10:36 AM",
    isUser: true,
  },
  {
    id: 6,
    roomId: 1,
    sender: "Charlie",
    content: "Thanks! I'm having trouble with the authentication flow.",
    timestamp: "10:38 AM",
    isUser: false,
  },
  {
    id: 7,
    roomId: 1,
    sender: "Alice",
    content: "I implemented something similar last week. I can share my code.",
    timestamp: "10:40 AM",
    isUser: false,
  },
  { id: 8, roomId: 1, sender: "You", content: "That would be great, Alice!", timestamp: "10:41 AM", isUser: true },

  {
    id: 9,
    roomId: 2,
    sender: "David",
    content: "Has anyone reviewed the latest mockups?",
    timestamp: "09:15 AM",
    isUser: false,
  },
  {
    id: 10,
    roomId: 2,
    sender: "You",
    content: "I did, they look great! Just a few minor tweaks needed.",
    timestamp: "09:20 AM",
    isUser: true,
  },

  {
    id: 11,
    roomId: 3,
    sender: "Eve",
    content: "The new feature is ready for testing.",
    timestamp: "Yesterday",
    isUser: false,
  },
  {
    id: 12,
    roomId: 3,
    sender: "Frank",
    content: "I'll test it this afternoon.",
    timestamp: "Yesterday",
    isUser: false,
  },

  {
    id: 13,
    roomId: 4,
    sender: "Grace",
    content: "Campaign stats are in - 24% increase in conversions!",
    timestamp: "Monday",
    isUser: false,
  },

  {
    id: 14,
    roomId: 5,
    sender: "Henry",
    content: "Customer reported an issue with login on mobile.",
    timestamp: "Tuesday",
    isUser: false,
  },

  {
    id: 15,
    roomId: 6,
    sender: "Alice",
    content: "Hey John, do you have time to review my PR?",
    timestamp: "11:20 AM",
    isUser: false,
  },
]

// Dummy users for invites
const dummyUsers = [
  { name: "alice", tag: "dev" },
  { name: "bob", tag: "designer" },
  { name: "charlie", tag: "pm" },
  { name: "david", tag: "qa" },
  { name: "eve", tag: "admin" },
]

export default function ChatPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()

  // Redux state
  const rooms = useAppSelector(selectRooms)
  const activeRoomId = useAppSelector(selectActiveRoom)
  const activeRoomData = useAppSelector(selectActiveRoomData)
  const isConnected = useAppSelector(selectIsConnected)
  const isConnecting = useAppSelector(selectIsConnecting)

  // Auth state
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const authUser = useAppSelector(selectUser)
  const currentUser = useAppSelector(selectCurrentUser)

  // Add this effect to redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

  // Local state for UI
  const [newMessage, setNewMessage] = useState("")
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomType, setNewRoomType] = useState("group")
  const [directUsername, setDirectUsername] = useState("")
  const [directUserTag, setDirectUserTag] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  // Get messages for the active room
  const messages = useAppSelector((state) => (activeRoomId ? selectMessagesByRoom(state, activeRoomId) : []))

  // Initialize the app with dummy data and connect to WebSocket
  useEffect(() => {
    if (!authUser) return

    // Initialize with dummy data
    dispatch(
      initializeDummyData({
        rooms: dummyRooms,
        messages: dummyMessages,
        currentUser: authUser,
      }),
    )

    // Connect to WebSocket
    dispatch(connectWebSocket())

    // Cleanup WebSocket on unmount
    return () => {
      // No need to explicitly close the WebSocket as it's handled in the connectWebSocket thunk
    }
  }, [dispatch, authUser])

  // Filter users based on search term and exclude already selected users
  const filteredUsers = dummyUsers.filter(
    (user) =>
      (user.name.includes(searchTerm.toLowerCase()) || user.tag.includes(searchTerm.toLowerCase())) &&
      !selectedUsers.includes(`${user.name}#${user.tag}`),
  )

  // Handle direct message validation
  const isValidDirectMessage = () => {
    if (newRoomType !== "direct") return true
    return directUsername.trim() !== "" && directUserTag.trim() !== ""
  }

  // Handle group validation
  const isValidGroup = () => {
    if (newRoomType !== "group") return true
    return newRoomName.trim() !== ""
  }

  // Reset form when room type changes
  useEffect(() => {
    if (newRoomType === "direct") {
      setNewRoomName("")
    } else {
      setDirectUsername("")
      setDirectUserTag("")
    }
  }, [newRoomType])

  // Handle creating a new room
  const handleCreateRoom = () => {
    if (!isValidDirectMessage() || !isValidGroup()) return

    if (newRoomType === "direct") {
      // For direct messages
      dispatch(
        createRoom({
          name: directUsername,
          type: "direct",
          directUser: { name: directUsername, tag: directUserTag },
        }),
      )
    } else {
      // For groups
      dispatch(
        createRoom({
          name: newRoomName,
          type: "group",
        }),
      )
    }

    // Reset form
    setNewRoomName("")
    setNewRoomType("group")
    setDirectUsername("")
    setDirectUserTag("")
    setIsCreateRoomOpen(false)
  }

  // Handle inviting users to a group
  const handleInviteUsers = () => {
    if (!activeRoomId || !activeRoomData || activeRoomData.type !== "group" || selectedUsers.length === 0) return

    dispatch(
      inviteUsers({
        roomId: activeRoomId,
        users: selectedUsers,
      }),
    )

    setSelectedUsers([])
    setIsInviteDialogOpen(false)
  }

  // Handle selecting a user to invite
  const handleSelectUser = (user: string) => {
    setSelectedUsers([...selectedUsers, user])
    setSearchTerm("")
  }

  // Handle removing a selected user
  const handleRemoveUser = (user: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u !== user))
  }

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeRoomId) return

    dispatch(
      sendMessage({
        roomId: activeRoomId,
        content: newMessage,
      }),
    )

    setNewMessage("")
  }

  // Handle changing the active room
  const handleRoomChange = (roomId: number) => {
    dispatch(setActiveRoom(roomId))
  }

  // Handle logout
  const handleLogout = () => {
    dispatch(logout())
    router.push("/")
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-[#D1D5DB] flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#D1D5DB] flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="font-bold text-[#111827]">Chat App</h1>
            {currentUser && (
              <span className="ml-2 text-sm text-[#6B7280]">
                {currentUser.name}#{currentUser.tag}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-[#6B7280] hover:text-[#111827]">
            <LogOut size={18} />
          </Button>
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
                <DialogDescription>Create a new chat room or direct message.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Type</Label>
                  <RadioGroup value={newRoomType} onValueChange={setNewRoomType} className="col-span-3 flex space-x-4">
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
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="tag" className="text-right">
                        Tag
                      </Label>
                      <Input
                        id="tag"
                        value={directUserTag}
                        onChange={(e) => setDirectUserTag(e.target.value)}
                        className="col-span-3"
                        placeholder="Enter tag"
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
              key={room.id}
              className={`w-full text-left px-4 py-2 flex items-center justify-between ${
                activeRoomId === room.id ? "bg-[#E0F2FE] text-[#3B82F6]" : "hover:bg-gray-50 text-[#111827]"
              }`}
              onClick={() => handleRoomChange(room.id)}
            >
              <div className="flex items-center">
                {room.type === "direct" ? (
                  <UserIcon size={16} className="mr-2" />
                ) : (
                  <MessageSquare size={16} className="mr-2" />
                )}
                <span>{room.name}</span>
              </div>
              {room.unread > 0 && (
                <span className="bg-[#3B82F6] text-white text-xs px-2 py-0.5 rounded-full">{room.unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-[#D1D5DB] bg-white flex justify-between items-center">
          <h2 className="font-medium text-[#111827]">
            {activeRoomData?.name}
            {activeRoomData?.type === "direct" && activeRoomData.directUser && (
              <span className="ml-2 text-sm text-[#6B7280]">#{activeRoomData.directUser.tag}</span>
            )}
          </h2>

          {/* Connection status indicator */}
          <div className="flex items-center gap-2">
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
            {activeRoomData?.type === "group" && (
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <UserPlus size={14} />
                    <span>Invite</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Invite to {activeRoomData.name}</DialogTitle>
                    <DialogDescription>Add users to this group chat.</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Selected users */}
                    {selectedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedUsers.map((user) => (
                          <Badge key={user} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                            {user}
                            <button onClick={() => handleRemoveUser(user)} className="ml-1">
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
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    {/* User list */}
                    <div className="max-h-[200px] overflow-y-auto border rounded-md">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <button
                            key={`${user.name}#${user.tag}`}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center"
                            onClick={() => handleSelectUser(`${user.name}#${user.tag}`)}
                          >
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarFallback className="bg-[#6366F1] text-white text-xs">
                                {user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {user.name}#{user.tag}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-[#6B7280]">
                          {searchTerm ? "No users found" : "Type to search users"}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[70%] ${msg.isUser ? "flex-row-reverse" : "flex-row"}`}>
                {!msg.isUser && (
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarFallback className="bg-[#6366F1] text-white">{msg.sender.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      msg.isUser ? "bg-[#E0F2FE] text-[#111827]" : "bg-[#E5E7EB] text-[#111827]"
                    }`}
                  >
                    {!msg.isUser && <div className="font-medium text-sm text-[#6366F1] mb-1">{msg.sender}</div>}
                    <p>{msg.content}</p>
                  </div>
                  <div className={`text-xs text-[#6B7280] mt-1 ${msg.isUser ? "text-right" : "text-left"}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
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
  )
}
