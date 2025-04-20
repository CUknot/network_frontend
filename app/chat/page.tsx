"use client"

import type React from "react"

import { use, useState } from "react"
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
  inviteUser,
  setActivateRoom,
  selectRooms,
  selectActiveRoom,
  selectActiveRoomData,
  selectMessagesForRoom,
  selectIsConnected,
  selectIsConnecting,
  getRooms,
  getMessages,
  // selectMessages,
  // selectError,

  // type Room,
  // type Message,
} from "@/lib/features/chat/chatSlice"

import { selectSearchUser, selectCurrentUser, searchUser} from "@/lib/features/user/userSlice"

// Add these imports at the top of the file
import { useEffect } from "react"
import { selectIsAuthenticated, selectUser } from "@/lib/features/auth/authSlice"

// Import the logout action
import { logout } from "@/lib/features/auth/authSlice"
  
export default function ChatPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()

  // Redux state
  const rooms = useAppSelector(selectRooms)
  const activeRoomId = useAppSelector(selectActiveRoom)
  const activeRoomData = useAppSelector(selectActiveRoomData)
  const isConnected = useAppSelector(selectIsConnected)
  const isConnecting = useAppSelector(selectIsConnecting)

  // Add these lines to get auth state
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
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  // Get messages for the active room
  const messages = useAppSelector(selectMessagesForRoom)

  useEffect(() => {
    console.log("isConnected:", isConnected)
  }, [isConnected])
  
  //connect to WebSocket
  useEffect(() => {
    if (!authUser) return
    dispatch(connectWebSocket())
    dispatch(getRooms())
    return 
  }, [dispatch, authUser])

  // Filter users based on search term and exclude already selected users
  const filteredUsers = useAppSelector(selectSearchUser)

  useEffect(() => {
    console.log("Filtered users:", filteredUsers)
  }
  , [filteredUsers])

  // Handle direct message validation
  const isValidDirectMessage = (): boolean => {
    if (newRoomType !== "direct") return true
    return directUsername.trim() !== ""
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
          user_ids: [], // Add the current user's ID
        }),
      )
    } else {
      // For groups
      dispatch(
        createRoom({
          name: newRoomName,
          type: "group",
          user_ids: [], // Add user IDs if needed
        }),
      )
    }

    // Reset form
    setNewRoomName("")
    setNewRoomType("group")
    setDirectUsername("")
    setIsCreateRoomOpen(false)
  }

  // Handle inviting users to a group
  const handleInviteUsers = () => {
    if (!activeRoomId || !activeRoomData || activeRoomData.room.type !== "group" || selectedUsers.length === 0) return

      selectedUsers.map((user) => {
        dispatch(inviteUser(
          activeRoomId,
          user
        ))
      })

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

  // Handle search term change
  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (term.trim()) {
      console.log("Searching for users:", term.trim())
      dispatch(searchUser(term.trim())); 
    }
  };

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log("Sending message:", newMessage)
    console.log("Active room ID:", activeRoomId)
    if (!newMessage.trim() || !activeRoomId) return

    dispatch(
      sendMessage(
        activeRoomId,
        newMessage,
      ),
    )
    setNewMessage("")
  }

  // Handle changing the active room
  const handleRoomChange = async (roomId: number) => {
    console.log("Changing room to:", roomId)
    await dispatch(setActivateRoom(roomId))
    await dispatch(getMessages(roomId))
    console.log(messages)
  }

  // Then update the logout handler
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
                {currentUser.username}
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
                activeRoomId === room.room.id ? "bg-[#E0F2FE] text-[#3B82F6]" : "hover:bg-gray-50 text-[#111827]"
              }`}
              onClick={() => handleRoomChange(room.room.id)}
            >
              <div className="flex items-center">
                {room.room.type === "direct" ? (
                  <UserIcon size={16} className="mr-2" />
                ) : (
                  <MessageSquare size={16} className="mr-2" />
                )}
                <span>{room.room.name}</span>
              </div>
              {room.unreadCount > 0 && (
                <span className="bg-[#3B82F6] text-white text-xs px-2 py-0.5 rounded-full">{room.unreadCount}</span>
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
            {activeRoomData?.room.name}
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
            {activeRoomData?.room.type === "group" && (
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <UserPlus size={14} />
                    <span>Invite</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Invite to {activeRoomData.room.name}</DialogTitle>
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
                        onChange={handleSearchTermChange}
                      />
                    </div>

                    {/* User list */}
                    <div className="max-h-[200px] overflow-y-auto border rounded-md">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <button
                            key={`${user.username}#${user.tag}`}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center"
                            onClick={() => handleSelectUser(`${user.username}`)}
                          >
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarFallback className="bg-[#6366F1] text-white text-xs">
                                {user.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {user.username}
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
            <div key={msg.id} className={`flex ${msg.user_id == authUser?.id ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[70%] ${msg.user_id == authUser?.id ? "flex-row-reverse" : "flex-row"}`}>
                {!(msg.user_id == authUser?.id) && (
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarFallback className="bg-[#6366F1] text-white">{msg.user.username.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      msg.user_id == authUser?.id ? "bg-[#E0F2FE] text-[#111827]" : "bg-[#E5E7EB] text-[#111827]"
                    }`}
                  >
                    {!(msg.user_id == authUser?.id) && <div className="font-medium text-sm text-[#6366F1] mb-1">{msg.user.username}</div>}
                    <p>{msg.content}</p>
                  </div>
                  <div className={`text-xs text-[#6B7280] mt-1 ${msg.user_id == authUser?.id ? "text-right" : "text-left"}`}>
                    {msg.created_at}
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
