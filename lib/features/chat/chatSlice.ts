import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import type { RootState } from "../../store"

// Define types for our state
export interface User {
  name: string
  tag: string
}

export interface Message {
  id: number
  roomId: number
  sender: string
  content: string
  timestamp: string
  isUser: boolean
}

export interface Room {
  id: number
  name: string
  unread: number
  type: "group" | "direct"
  members: string[]
  directUser?: User
}

interface ChatState {
  socket: WebSocket | null
  connected: boolean
  connecting: boolean
  rooms: Room[]
  messages: Message[]
  activeRoom: number | null
  currentUser: User | null
  error: string | null
}

// Initial state
const initialState: ChatState = {
  socket: null,
  connected: false,
  connecting: false,
  rooms: [],
  messages: [],
  activeRoom: null,
  currentUser: null,
  error: null,
}

// WebSocket connection thunk
export const connectWebSocket = createAsyncThunk("chat/connectWebSocket", async (_, { dispatch, getState }) => {
  const state = getState() as RootState

  // Close existing connection if any
  if (state.chat.socket) {
    state.chat.socket.close()
  }

  // For demo purposes, we'll simulate WebSocket behavior instead of connecting to a real server
  // This avoids issues with echo servers or other test WebSocket endpoints
  const mockWebSocket = {
    send: (data: string) => {
      try {
        // Parse the sent data
        const parsedData = JSON.parse(data)

        // Simulate server response after a short delay
        setTimeout(() => {
          if (mockWebSocket.onmessage) {
            // Echo back the same data as a proper JSON string
            mockWebSocket.onmessage({ data: JSON.stringify(parsedData) } as MessageEvent)
          }
        }, 500)
      } catch (error) {
        console.error("Error parsing message to send:", error)
      }
    },
    close: () => {
      if (mockWebSocket.onclose) {
        mockWebSocket.onclose({} as CloseEvent)
      }
    },
    onopen: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
  }

  // Simulate connection delay
  return new Promise<WebSocket>((resolve, reject) => {
    setTimeout(() => {
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen({} as Event)
      }
      resolve(mockWebSocket as unknown as WebSocket)
    }, 1000)
  })
})

// Send message thunk
export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (message: { roomId: number; content: string }, { getState, dispatch }) => {
    const state = getState() as RootState
    const { socket, currentUser } = state.chat

    if (!socket || !currentUser) {
      throw new Error("WebSocket not connected or user not set")
    }

    const newMessage = {
      id: Date.now(),
      roomId: message.roomId,
      sender: "You",
      content: message.content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isUser: true,
    }

    // Send the message to the server
    socket.send(
      JSON.stringify({
        type: "message",
        payload: newMessage,
      }),
    )

    // Optimistically add the message to the state
    dispatch(addMessage(newMessage))

    return newMessage
  },
)

// Create room thunk
export const createRoom = createAsyncThunk(
  "chat/createRoom",
  async (room: { name: string; type: "group" | "direct"; directUser?: User }, { getState, dispatch }) => {
    const state = getState() as RootState
    const { socket } = state.chat

    if (!socket) {
      throw new Error("WebSocket not connected")
    }

    const newRoom = {
      id: Date.now(),
      name: room.name,
      unread: 0,
      type: room.type,
      members: [],
      directUser: room.directUser,
    }

    // Send the room creation to the server
    socket.send(
      JSON.stringify({
        type: "create_room",
        payload: newRoom,
      }),
    )

    // Optimistically add the room to the state
    dispatch(addRoom(newRoom))

    return newRoom
  },
)

// Invite users thunk
export const inviteUsers = createAsyncThunk(
  "chat/inviteUsers",
  async ({ roomId, users }: { roomId: number; users: string[] }, { getState, dispatch }) => {
    const state = getState() as RootState
    const { socket, rooms } = state.chat

    if (!socket) {
      throw new Error("WebSocket not connected")
    }

    const room = rooms.find((r) => r.id === roomId)
    if (!room) {
      throw new Error("Room not found")
    }

    const updatedRoom = {
      ...room,
      members: [...room.members, ...users],
    }

    // Send the invite to the server
    socket.send(
      JSON.stringify({
        type: "invite_users",
        payload: {
          roomId,
          users,
        },
      }),
    )

    // Optimistically update the room in the state
    dispatch(updateRoom(updatedRoom))

    return updatedRoom
  },
)

// Create the slice
const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setSocket: (state, action: PayloadAction<WebSocket | null>) => {
      state.socket = action.payload
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload
      state.connecting = false
    },
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload
    },
    setActiveRoom: (state, action: PayloadAction<number>) => {
      state.activeRoom = action.payload

      // Mark messages as read
      if (state.rooms.length > 0) {
        state.rooms = state.rooms.map((room) => (room.id === action.payload ? { ...room, unread: 0 } : room))
      }
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload)

      // Increment unread count if not the active room
      if (state.activeRoom !== action.payload.roomId && !action.payload.isUser) {
        state.rooms = state.rooms.map((room) =>
          room.id === action.payload.roomId ? { ...room, unread: room.unread + 1 } : room,
        )
      }
    },
    receiveMessage: (state, action: PayloadAction<Message>) => {
      // Only add if not already in the messages array
      if (!state.messages.some((msg) => msg.id === action.payload.id)) {
        state.messages.push(action.payload)

        // Increment unread count if not the active room
        if (state.activeRoom !== action.payload.roomId) {
          state.rooms = state.rooms.map((room) =>
            room.id === action.payload.roomId ? { ...room, unread: room.unread + 1 } : room,
          )
        }
      }
    },
    addRoom: (state, action: PayloadAction<Room>) => {
      state.rooms.push(action.payload)
    },
    updateRoom: (state, action: PayloadAction<Room>) => {
      state.rooms = state.rooms.map((room) => (room.id === action.payload.id ? action.payload : room))
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    // Initialize with dummy data for demo purposes
    initializeDummyData: (state, action: PayloadAction<{ rooms: Room[]; messages: Message[]; currentUser: User }>) => {
      state.rooms = action.payload.rooms
      state.messages = action.payload.messages
      state.currentUser = action.payload.currentUser
      state.activeRoom = action.payload.rooms[0]?.id || null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(connectWebSocket.pending, (state) => {
        state.connecting = true
        state.error = null
      })
      .addCase(connectWebSocket.fulfilled, (state, action) => {
        state.socket = action.payload
        state.connected = true
        state.connecting = false
      })
      .addCase(connectWebSocket.rejected, (state, action) => {
        state.connecting = false
        state.connected = false
        state.error = action.error.message || "Failed to connect to WebSocket"
      })
  },
})

// Export actions
export const {
  setSocket,
  setConnected,
  setCurrentUser,
  setActiveRoom,
  addMessage,
  receiveMessage,
  addRoom,
  updateRoom,
  setError,
  initializeDummyData,
} = chatSlice.actions

// Export selectors
export const selectRooms = (state: RootState) => state.chat.rooms
export const selectMessages = (state: RootState) => state.chat.messages
export const selectActiveRoom = (state: RootState) => state.chat.activeRoom
export const selectCurrentUser = (state: RootState) => state.chat.currentUser
export const selectIsConnected = (state: RootState) => state.chat.connected
export const selectIsConnecting = (state: RootState) => state.chat.connecting
export const selectError = (state: RootState) => state.chat.error
export const selectMessagesByRoom = (state: RootState, roomId: number) =>
  state.chat.messages.filter((message) => message.roomId === roomId)
export const selectActiveRoomData = (state: RootState) =>
  state.chat.rooms.find((room) => room.id === state.chat.activeRoom)

export default chatSlice.reducer
