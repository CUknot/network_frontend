import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
  createSelector,
} from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";
import apiClient from "@/lib/axios";

interface User {
  id: number;
  username: string;
  email: string;
}

interface Room {
  id: number;
  name: string;
  type: "direct" | "group";
  created_by: number;
  created_at: string;
  updated_at: string;
  users: User[];
}

interface Message {
  id: number;
  content: string;
  room_id: number;
  user_id: number;
  user: User; // ← required
  created_at: string;
  updated_at: string; // ← required
  system?: boolean;
}

interface RoomWithMeta {
  lastReadAt: string;
  room: Room;
  unreadCount: number;
}
interface SystemPayload {
  room_id: number;
  user_id: number;
  username: string;
  action: "join" | "leave";
  timestamp: string;
}

type ChatItem = Message | SystemMessage;

interface SystemMessage {
  id: number;
  room_id: number;
  content: string;
  created_at: string;
  system: true;
}

interface ChatState {
  rooms: RoomWithMeta[];
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  ws: WebSocket | null;
  connected: boolean;
  connecting: boolean;
  activeRoom: number | null;
  onlineUsers: number[];
  groupRooms: Room[];
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
  onlineUsers: [],
  groupRooms: [],
};

// GET /rooms
export const getRooms = createAsyncThunk(
  "chat/getRooms",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const res = await apiClient.get("/rooms");
      const roomsWithMeta = res.data.rooms as RoomWithMeta[];

      // Dispatch joinRoom for each room's ID after successfully fetching the rooms
      roomsWithMeta.forEach((room) => {
        dispatch(joinRoom(room.room.id.toString()));
      });

      return roomsWithMeta; // Return the rooms data to update the state
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch rooms"
      );
    }
  }
);

// POST /rooms
// lib/features/chat/chatSlice.ts

export const createRoom = createAsyncThunk(
  "chat/createRoom",
  async (
    {
      name,
      type,
      user_ids,
    }: { name: string; type: "direct" | "group"; user_ids: number[] },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await apiClient.post("/rooms", { name, type, user_ids });
      const room = res.data.room as Room;

      // 1) subscribe your WS client to this room:
      dispatch(joinRoom(room.id.toString()));

      // 2) re-fetch all rooms (this list comes back with room.users populated,
      //    so you’ll immediately see yourself in the new room’s users[])
      dispatch(getRooms());

      return room;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to create room"
      );
    }
  }
);

// GET /messages?room_id=1
export const getMessages = createAsyncThunk(
  "chat/getMessages",
  async (room_id: number, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(`/messages?room_id=${room_id}`);
      console.log("Messages:", res.data.messages);
      return res.data.messages as Message[];
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch messages"
      );
    }
  }
);

// POST /rooms/set-activate-room
export const setActivateRoom = createAsyncThunk(
  "chat/setActivateRoom",
  async (room_id: number, { dispatch, rejectWithValue }) => {
    dispatch(setActiveRoom(room_id)); // ✅ dispatch properly here
    dispatch(resetUnreadCount(room_id)); // Reset unread count when room is activated
    try {
      const res = await apiClient.post("/rooms/set-activate-room", { room_id });
      return res.data.room as Room;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to set active room"
      );
    }
  }
);

// Fetch *all* group‑type rooms
export const getGroupRooms = createAsyncThunk(
  "chat/getGroupRooms",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/rooms/groups");

      console.log(res);
      return res.data.rooms as Room[]; // must match your backend payload
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch group rooms"
      );
    }
  }
);

export const joinGroupRoom = createAsyncThunk(
  "chat/joinGroupRoom",
  async (roomId: number, { dispatch, rejectWithValue }) => {
    try {
      // 1) Persist membership
      await apiClient.post(`/rooms/${roomId}/join`);
      // 2) Subscribe WS so you start receiving messages
      dispatch(joinRoom(roomId.toString()));
      // 3) Refresh your joined rooms list
      dispatch(getRooms());
      return roomId;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to join group"
      );
    }
  }
);

// Leave group thunk
export const leaveGroup = createAsyncThunk<
  number, // return value = roomId
  number, // arg = roomId
  { rejectValue: string }
>("chat/leaveGroup", async (roomId, { dispatch, rejectWithValue }) => {
  try {
    // 1) hit your new leave-room API
    await apiClient.post(`/rooms/${roomId}/leave`);
    // 2) tell WS to drop you from that room channel
    dispatch(leaveRoom(roomId.toString()));
    // 3) refresh both your joined list and available groups
    dispatch(getRooms());
    dispatch(getGroupRooms());
    return roomId;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || "Failed to leave group"
    );
  }
});

// Setup WebSocket connection
const createWebSocketConnection = (
  dispatch: any,
  getState: () => RootState
) => {
  const user_id = getState().auth.user?.id;
  if (!user_id) {
    console.error(
      "User ID not found in state. Cannot establish WebSocket connection."
    );
    return null;
  }
  const ws = new WebSocket(
    `${process.env.NEXT_PUBLIC_WS_URL}?user_id=${user_id}`
  );

  // Set up WebSocket event handlers
  ws.onopen = () => {
    console.log("WebSocket connected");
    dispatch(setConnected(true));

    // tell the server we're online
    ws.send(JSON.stringify({ type: "status", payload: "online" }));

    // report offline when tab/window closes
    window.addEventListener("beforeunload", () => {
      ws.send(JSON.stringify({ type: "status", payload: "offline" }));
    });
  };

  ws.onmessage = (event) => {
    // split on lines, ignore blanks
    for (const line of event.data.split("\n").filter((l: any) => l.trim())) {
      const message = JSON.parse(line);
      dispatch(handleIncomingMessage(message));
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error", error);
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected");
  };

  return ws;
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    clearChatError(state) {
      state.error = null;
    },
    clearMessages(state) {
      state.messages = [];
    },
    setWebSocket(state, action: PayloadAction<WebSocket>) {
      state.ws = action.payload;
    },
    setActiveRoom(state, action: PayloadAction<number>) {
      state.activeRoom = action.payload;
    },
    setConnecting(state, action: PayloadAction<boolean>) {
      state.connecting = action.payload;
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },
    handleIncomingMessage(state, action: PayloadAction<any>) {
      const message = action.payload;
      const currentUserId = (state as any).auth?.user?.id;

      if (message.type === "status_update" && message.payload) {
        const { user_id, status } = message.payload as {
          user_id: number;
          status: string;
        };

        if (status === "online") {
          if (!state.onlineUsers.includes(user_id)) {
            state.onlineUsers.push(user_id);
          }
        } else if (status === "offline") {
          state.onlineUsers = state.onlineUsers.filter((id) => id !== user_id);
        }
        return;
      }

      // Handle the incoming message based on its type
      if (message.type === "message" && message.payload) {
        const newMessage = message.payload as Message;
        state.messages.push(newMessage);

        // Increment unread count for the room if the message is not from the current user
        if (
          newMessage.room_id &&
          newMessage.user_id !== currentUserId &&
          state.activeRoom !== newMessage.room_id
        ) {
          state.rooms = state.rooms.map((roomWithMeta) => {
            if (roomWithMeta.room.id === newMessage.room_id) {
              return {
                ...roomWithMeta,
                unreadCount: roomWithMeta.unreadCount + 1,
              };
            }
            return roomWithMeta;
          });
        }
      } else {
        // Handle other types of messages (e.g., system messages, notifications, etc.)
        console.log("System message or other message type", message);
      }

      if (message.type === "system" && message.payload) {
        // Destructure exactly what your backend broadcasted
        const {
          id,
          room_id,
          user_id,
          username,
          content,
          created_at,
          updated_at,
        } = message.payload as {
          id: number;
          room_id: number;
          user_id: number;
          username: string;
          content: string;
          created_at: string;
          updated_at: string;
          action: string;
        };

        const systemMessage: Message = {
          id,
          room_id,
          user_id,
          // satisfy the required User field
          user: { id: user_id, username, email: "" },
          content,
          created_at,
          updated_at,
          system: true,
        };

        state.messages.push(systemMessage);
        return;
      }

      console.log("Incoming message", action.payload);
    },
    resetUnreadCount(state, action: PayloadAction<number>) {
      const roomId = action.payload;
      state.rooms = state.rooms.map((roomWithMeta) => {
        if (roomWithMeta.room.id === roomId) {
          return { ...roomWithMeta, unreadCount: 0 };
        }
        return roomWithMeta;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // — getRooms (your joined rooms) —
      .addCase(getRooms.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        getRooms.fulfilled,
        (state, action: PayloadAction<RoomWithMeta[]>) => {
          state.isLoading = false;
          state.rooms = action.payload;
        }
      )
      .addCase(getRooms.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // — createRoom —
      .addCase(createRoom.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createRoom.fulfilled, (state, action: PayloadAction<Room>) => {
        state.isLoading = false;
        state.rooms.push({
          lastReadAt: new Date().toISOString(),
          room: action.payload,
          unreadCount: 0,
        });
      })
      .addCase(createRoom.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // — getMessages —
      .addCase(getMessages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        getMessages.fulfilled,
        (state, action: PayloadAction<Message[]>) => {
          state.isLoading = false;
          const existingIds = new Set(state.messages.map((m) => m.id));

          // 1) map each message to possibly add system: true
          const processed = action.payload.map((m) => ({
            ...m,
            system:
              m.content.includes("has joined the room") ||
              m.content.includes("has left the room") ||
              false,
          }));

          // 2) only keep ones we haven't seen yet
          const unique = processed.filter((m) => !existingIds.has(m.id));

          // 3) append
          state.messages.push(...unique);
        }
      )

      .addCase(getMessages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // — getGroupRooms (all groups in system) —
      .addCase(getGroupRooms.pending, (state) => {
        // you might choose not to set isLoading here to avoid spinner clashes
      })
      .addCase(
        getGroupRooms.fulfilled,
        (state, action: PayloadAction<Room[]>) => {
          state.groupRooms = action.payload;
        }
      )
      .addCase(getGroupRooms.rejected, (state, action) => {
        console.error("Failed to load group rooms:", action.payload);
      })

      .addCase(leaveGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(leaveGroup.fulfilled, (state, action: PayloadAction<number>) => {
        state.isLoading = false;
        const leftRoomId = action.payload;

        // Remove from joined rooms
        state.rooms = state.rooms.filter((rw) => rw.room.id !== leftRoomId);

        // If it was the active room, clear it
        if (state.activeRoom === leftRoomId) {
          state.activeRoom = null;
        }
      })
      .addCase(leaveGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // — joinGroupRoom (join a public group) —
      .addCase(joinGroupRoom.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        joinGroupRoom.fulfilled,
        (state, action: PayloadAction<number>) => {
          state.isLoading = false;
          // remove the joined room from the public list
          state.groupRooms = state.groupRooms.filter(
            (r) => r.id !== action.payload
          );
        }
      )
      .addCase(joinGroupRoom.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearChatError,
  clearMessages,
  setWebSocket,
  setActiveRoom,
  setConnecting,
  setConnected,
  handleIncomingMessage,
  resetUnreadCount,
} = chatSlice.actions;

export const connectWebSocket =
  () => (dispatch: any, getState: () => RootState) => {
    console.log("Connecting to WebSocket...");

    // Access the WebSocket from the chat state
    const { ws, connected, connecting } = getState().chat;

    console.log("WebSocket state:", ws);
    console.log("Is connected:", connected);
    console.log("Is connecting:", connecting);

    // Check if the WebSocket is already established
    if (!ws && !connecting) {
      // Only create a new WebSocket if one is not already established
      console.log("No WebSocket connection found. Creating a new one...");

      dispatch(setConnecting(true)); // Set connecting to true while we establish the connection

      const newWs = createWebSocketConnection(dispatch, getState);

      if (!newWs) {
        console.error("Failed to create WebSocket connection");
        dispatch(setConnecting(false)); // Set connecting to false on failure
        return;
      }

      dispatch(setWebSocket(newWs)); // Set the new WebSocket connection in the state
      dispatch(setConnecting(false)); // Reset connecting state
    } else if (ws) {
      console.log("WebSocket is already established.");
    }
  };

// WebSocket actions (send messages)
export const joinRoom = (roomId: string) => (dispatch: any, getState: any) => {
  const { ws } = getState().chat;
  if (ws) {
    ws.send(JSON.stringify({ type: "join_room", payload: roomId }));
  }
};
export const leaveRoom = (roomId: string) => (dispatch: any, getState: any) => {
  const { ws } = getState().chat;
  if (ws) {
    ws.send(JSON.stringify({ type: "leave_room", payload: roomId }));
  }
};

export const sendMessage =
  (roomId: number, content: string) => (dispatch: any, getState: any) => {
    const { ws } = getState().chat;
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "message",
          payload: { room_id: roomId, content },
        })
      );
    }
  };

export const inviteUser =
  (roomId: number, username: string) => (dispatch: any, getState: any) => {
    const { ws } = getState().chat;
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "invite_users",
          payload: { room_id: roomId, username },
        })
      );
    }
  };

export const acceptInvite =
  (roomId: number) => (dispatch: any, getState: any) => {
    const { ws } = getState().chat;
    if (ws) {
      ws.send(
        JSON.stringify({
          type: "accept_invite",
          payload: String(roomId), // ← force it to be a string
        })
      );
    }
  };

export const rejectInvite =
  (roomId: number) => (dispatch: any, getState: any) => {
    const { ws } = getState().chat;
    if (ws) {
      ws.send(JSON.stringify({ type: "reject_invite", payload: roomId }));
    }
  };
export const selectChat = (state: RootState) => state.chat;

export const selectRooms = (state: RootState) => state.chat.rooms;
export const selectMessages = (state: RootState) => state.chat.messages;
export const selectActiveRoom = (state: RootState) => state.chat.activeRoom;
export const selectIsConnected = (state: RootState) => state.chat.connected;
export const selectIsConnecting = (state: RootState) => state.chat.connecting;
export const selectError = (state: RootState) => state.chat.error;
export const selectOnlineUsers = (state: RootState) => state.chat.onlineUsers;
export const selectGroupRooms = (state: RootState) => state.chat.groupRooms;
export const selectWebSocket = (state: RootState) => state.chat.ws;

export const selectMessagesForRoom = createSelector(
  [selectMessages, selectActiveRoom],
  (messages, activeRoom) => {
    return messages.filter((msg) => msg.room_id === activeRoom);
  }
);
export const selectActiveRoomData = (state: RootState) =>
  state.chat.rooms.find((room) => room.room.id === state.chat.activeRoom);

export default chatSlice.reducer;
