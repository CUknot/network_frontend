import { createSlice, createAsyncThunk, type PayloadAction, createSelector } from '@reduxjs/toolkit'
import type { RootState } from '@/lib/store'
import apiClient from "@/lib/axios"

interface User {
  id: number
  username: string
  email: string
}

interface Room {
  id: number
  name: string
  type: 'direct' | 'group'
  created_by: number
  created_at: string
  updated_at: string
  users: User[]
}

interface Message {
  id: number
  content: string
  room_id: number
  user_id: number
  user: User
  created_at: string
  updated_at: string
}

interface RoomWithMeta {
  lastReadAt: string
  room: Room
  unreadCount: number
}

interface ChatState {
  rooms: RoomWithMeta[]
  messages: Message[]
  isLoading: boolean
  error: string | null
  ws: WebSocket | null
  connected: boolean
  connecting: boolean
  activeRoom: number | null
}

const initialState: ChatState = {
  rooms: [],
  messages: [],
  isLoading: false,
  error: null,
  ws: null,
  connected: false,
  connecting: false,
  activeRoom: null,
}

// GET /rooms
export const getRooms = createAsyncThunk('chat/getRooms', async (_, { dispatch, rejectWithValue }) => {
  try {
    const res = await apiClient.get('/rooms');
    const roomsWithMeta = res.data.rooms as RoomWithMeta[];
    
    // Dispatch joinRoom for each room's ID after successfully fetching the rooms
    roomsWithMeta.forEach(room => {
      dispatch(joinRoom(room.room.id.toString()));
    });

    return roomsWithMeta; // Return the rooms data to update the state
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch rooms');
  }
});

// POST /rooms
export const createRoom = createAsyncThunk(
  'chat/createRoom',
  async (
    { name, type, user_ids }: { name: string; type: 'direct' | 'group'; user_ids: number[] },
    { rejectWithValue }
  ) => {
    try {
      const res = await apiClient.post('/rooms', { name, type, user_ids })
      return res.data.room as Room
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create room')
    }
  }
)

// GET /messages?room_id=1
export const getMessages = createAsyncThunk(
  'chat/getMessages',
  async (room_id: number, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(`/messages?room_id=${room_id}`)
      console.log('Messages:', res.data.messages)
      return res.data.messages as Message[]
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch messages')
    }
  }
)

// POST /rooms/set-activate-room
export const setActivateRoom = createAsyncThunk(
  'chat/setActivateRoom',
  async (room_id: number, { dispatch, rejectWithValue }) => {
    dispatch(setActiveRoom(room_id)) // ✅ dispatch properly here
    try {
      const res = await apiClient.post('/rooms/set-activate-room', { room_id })
      return res.data.room as Room
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to set active room')
    }
  }
)


// Setup WebSocket connection
const createWebSocketConnection = (dispatch: any, getState: () => RootState) => {
  const user_id = getState().auth.user?.id;
  if (!user_id) {
    console.error('User ID not found in state. Cannot establish WebSocket connection.')
    return null
  }
  const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}?user_id=${user_id}`);

  // Set up WebSocket event handlers
  ws.onopen = () => {
    console.log('WebSocket connected')
    dispatch(setConnected(true))
  }

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    // Handle incoming WebSocket message (for example, updates on rooms or messages)
    dispatch(handleIncomingMessage(message))
  }

  ws.onerror = (error) => {
    console.error('WebSocket error', error)
  }

  ws.onclose = () => {
    console.log('WebSocket disconnected')
  }

  return ws
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    clearChatError(state) {
      state.error = null
    },
    clearMessages(state) {
      state.messages = []
    },
    setWebSocket(state, action: PayloadAction<WebSocket>) {
      state.ws = action.payload
    },
    setActiveRoom(state, action: PayloadAction<number>) {
      state.activeRoom = action.payload
    },
    setConnecting(state, action: PayloadAction<boolean>) {
      state.connecting = action.payload
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload
    },
    handleIncomingMessage(state, action: PayloadAction<any>) {
      const message = action.payload

      // Handle the incoming message based on its type
      if (message.type === 'message') {
        // If the message type is 'message', add it to the messages array
        state.messages.push(message.payload) // Assuming 'message.payload' contains the message data
      } else {
        // Handle other types of messages (e.g., system messages, notifications, etc.)
        // You can add logic here if needed, for example, updating a room's unread count.
        console.log('System message or other message type', message)
      }
      console.log('Incoming message', action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getRooms.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(getRooms.fulfilled, (state, action: PayloadAction<RoomWithMeta[]>) => {
        state.isLoading = false
        state.rooms = action.payload
      })
      .addCase(getRooms.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      .addCase(createRoom.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createRoom.fulfilled, (state, action: PayloadAction<Room>) => {
        state.isLoading = false
        state.rooms.push({ lastReadAt: new Date().toISOString(), room: action.payload, unreadCount: 0 })
      })
      .addCase(createRoom.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

      .addCase(getMessages.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(getMessages.fulfilled, (state, action: PayloadAction<Message[]>) => {
        state.isLoading = false
        const newMessages = action.payload
      
        // Only add messages that aren't already in state.messages
        const existingIds = new Set(state.messages.map(m => m.id))
        const uniqueNewMessages = newMessages.filter(m => !existingIds.has(m.id))
      
        state.messages.push(...uniqueNewMessages)
      })
      .addCase(getMessages.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export const { clearChatError, clearMessages, setWebSocket, setActiveRoom, 
  setConnecting, setConnected, handleIncomingMessage } = chatSlice.actions

  export const connectWebSocket = () => (dispatch: any, getState: () => RootState) => {
    console.log('Connecting to WebSocket...')
    
    // Access the WebSocket from the chat state
    const { ws, connected, connecting } = getState().chat
  
    console.log('WebSocket state:', ws)
    console.log('Is connected:', connected)
    console.log('Is connecting:', connecting)
  
    // Check if the WebSocket is already established
    if (!ws && !connecting) { // Only create a new WebSocket if one is not already established
      console.log('No WebSocket connection found. Creating a new one...')
      
      dispatch(setConnecting(true)) // Set connecting to true while we establish the connection
      
      const newWs = createWebSocketConnection(dispatch, getState)
      
      if (!newWs) {
        console.error('Failed to create WebSocket connection')
        dispatch(setConnecting(false)) // Set connecting to false on failure
        return
      }
  
      dispatch(setWebSocket(newWs)) // Set the new WebSocket connection in the state
      dispatch(setConnecting(false)) // Reset connecting state
    } else if (ws) {
      console.log('WebSocket is already established.')
    }
  }
  

// WebSocket actions (send messages)
export const joinRoom = (roomId: string) => (dispatch: any, getState: any) => {
  const { ws } = getState().chat
  if (ws) {
    ws.send(JSON.stringify({ type: 'join_room', payload: roomId }))
  }
}

export const sendMessage = (roomId: number, content: string) => (dispatch: any, getState: any) => {
  const { ws } = getState().chat
  if (ws) {
    ws.send(JSON.stringify({ type: 'message', payload: { room_id: roomId, content } }))
  }
}

export const inviteUser = (roomId: number, username: string) => (dispatch: any, getState: any) => {
  const { ws } = getState().chat
  if (ws) {
    ws.send(JSON.stringify({ type: 'invite_users', payload: { room_id: roomId, username } }))
  }
}

export const acceptInvite = (roomId: number) => (dispatch: any, getState: any) => {
  const { ws } = getState().chat
  if (ws) {
    ws.send(JSON.stringify({ type: 'accept_invite', payload: roomId }))
  }
}

export const rejectInvite = (roomId: number) => (dispatch: any, getState: any) => {
  const { ws } = getState().chat
  if (ws) {
    ws.send(JSON.stringify({ type: 'reject_invite', payload: roomId }))
  }
}

export const selectChat = (state: RootState) => state.chat

export const selectRooms = (state: RootState) => state.chat.rooms
export const selectMessages = (state: RootState) => state.chat.messages
export const selectActiveRoom = (state: RootState) => state.chat.activeRoom
export const selectIsConnected = (state: RootState) => state.chat.connected
export const selectIsConnecting = (state: RootState) => state.chat.connecting
export const selectError = (state: RootState) => state.chat.error

export const selectMessagesForRoom = createSelector(
  [selectMessages, selectActiveRoom],
  (messages, activeRoom) => {
    return messages.filter(msg => msg.room_id === activeRoom)
  }
)
export const selectActiveRoomData = (state: RootState) =>
  state.chat.rooms.find((room) => room.room.id === state.chat.activeRoom)

export default chatSlice.reducer
