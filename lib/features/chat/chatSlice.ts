// features/chat/chatSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../store";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export interface User {
  id?: number;
  name: string;
  tag: string;
}

export interface Message {
  id: number;
  roomId: number;
  sender: string;
  content: string;
  timestamp: string; // ISO‑8601 string
  isUser: boolean;
}

export interface Room {
  id: number;
  name: string;
  unread: number;
  type: "group" | "direct";
  members: string[];
  directUser?: User;
}

interface ChatState {
  socket: WebSocket | null;
  connected: boolean;
  connecting: boolean;
  rooms: Room[];
  messages: Message[];
  activeRoom: number | null;
  error: string | null;
}

/* -------------------------------------------------------------------------- */
/*                           ENV & HELPER CONSTANTS                           */
/* -------------------------------------------------------------------------- */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";
// Convert http://host:8080/api → ws://host:8080/ws

//Prod version
// const WS_URL = API_BASE.replace(/^http/, "ws").replace(/\/api$/, "/ws");

//Test version
const wsUrl = (state: RootState) => {
  const base = API_BASE.replace(/^http/, "ws").replace(/\/api$/, "/ws");
  const uid = (state as any).auth.user?.id || 0; // 0‑guest fallback
  return `${base}?user_id=${uid}`;
};

const authHeaders = (state: RootState): HeadersInit => {
  const token = (state as any).auth?.token as string | undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* -------------------------------------------------------------------------- */
/*                               INITIAL STATE                                */
/* -------------------------------------------------------------------------- */

const initialState: ChatState = {
  socket: null,
  connected: false,
  connecting: false,
  rooms: [],
  messages: [],
  activeRoom: null,
  error: null,
};

/* -------------------------------------------------------------------------- */
/*                              HELPER FUNCTIONS                              */
/* -------------------------------------------------------------------------- */

function deserializeMessage(raw: any, fallbackSender = "unknown"): Message {
  return {
    id: raw.id,
    roomId: raw.room_id ?? raw.roomId,
    sender: raw.sender ?? fallbackSender,
    content: raw.content,
    timestamp: raw.timestamp ?? raw.created_at ?? new Date().toISOString(),
    isUser: false,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 THUNKS                                     */
/* -------------------------------------------------------------------------- */

// ----------------------------- WebSocket ----------------------------------
// export const connectWebSocket = createAsyncThunk<
//   WebSocket,
//   void,
//   { state: RootState }
// >("chat/connectWebSocket", async (_, { dispatch }) => {
//   return new Promise<WebSocket>((resolve, reject) => {
//     const ws = new WebSocket(WS_URL);

//Test version
export const connectWebSocket = createAsyncThunk<
  WebSocket,
  void,
  { state: RootState }
>("chat/connectWebSocket", async (_, { dispatch, getState }) => {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(wsUrl(getState())); // ← use helper
    /* -------------------------------------------------------------------------- */
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("WebSocket connection error"));

    ws.onmessage = (evt) => {
      try {
        const { type, payload } = JSON.parse(evt.data) as {
          type: string;
          payload: any;
        };
        switch (type) {
          case "message":
            dispatch(receiveMessage(deserializeMessage(payload)));
            break;
          case "room_created":
            dispatch(addRoom(payload as Room));
            break;
          case "room_updated":
            dispatch(updateRoom(payload as Room));
            break;
          default:
            break; // ignore other event types for now
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    ws.onclose = () => dispatch(setConnected(false));
  });
});

// ------------------------------- Rooms ------------------------------------
export const fetchRooms = createAsyncThunk<Room[], void, { state: RootState }>(
  "chat/fetchRooms",
  async (_, { getState }) => {
    const res = await fetch(`${API_BASE}/rooms`, {
      headers: authHeaders(getState()),
    });
    if (!res.ok) throw new Error("Failed to fetch rooms");

    // Backend returns { rooms: [{ lastReadAt, room: {...}, unreadCount }, ...] }
    const json = (await res.json()) as {
      rooms: Array<{
        lastReadAt: string;
        room: {
          id: number;
          name: string;
          created_by: number;
          created_at: string;
          updated_at: string;
        };
        unreadCount: number;
      }>;
    };

    // Map to client Room[] shape
    return json.rooms.map((entry) => ({
      id: entry.room.id,
      name: entry.room.name,
      unread: entry.unreadCount,
      type: "group",
      members: [],
      directUser: undefined,
    }));
  }
);

export const createRoom = createAsyncThunk<
  Room,
  { name: string; userIds?: number[] },
  { state: RootState }
>("chat/createRoom", async ({ name, userIds }, { getState }) => {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(getState()),
    },
    body: JSON.stringify({ name, user_ids: userIds ?? [] }),
  });
  if (!res.ok) throw new Error("Failed to create room");
  // unwrap created room
  const data = (await res.json()) as { room?: Room; rooms?: Room[] };
  return (data.room ?? data.rooms?.[0] ?? data) as Room;
});

// ------------------------------ Invites -----------------------------------
export const inviteUser = createAsyncThunk<
  Room,
  { roomId: number; username: string },
  { state: RootState }
>("chat/inviteUser", async ({ roomId, username }, { getState }) => {
  const res = await fetch(`${API_BASE}/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(getState()),
    },
    body: JSON.stringify({ room_id: roomId, username }),
  });
  if (!res.ok) throw new Error("Failed to invite user");
  const data = (await res.json()) as { room?: Room; [key: string]: any };
  return (data.room ?? data) as Room;
});

// ----------------------------- Messages -----------------------------------
export const fetchMessages = createAsyncThunk<
  { roomId: number; messages: Message[] },
  number,
  { state: RootState }
>("chat/fetchMessages", async (roomId, { getState }) => {
  const res = await fetch(`${API_BASE}/messages?room_id=${roomId}`, {
    headers: authHeaders(getState()),
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  return { roomId, messages: data.map(deserializeMessage) };
});

export const sendMessage = createAsyncThunk<
  Message,
  { roomId: number; content: string },
  { state: RootState }
>("chat/sendMessage", async ({ roomId, content }, { getState }) => {
  const state = getState();
  const currentUser = (state as any).auth.user as User | null;

  const res = await fetch(`${API_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(state),
    },
    body: JSON.stringify({ room_id: roomId, content }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  const raw = await res.json();
  return { ...deserializeMessage(raw, currentUser?.name), isUser: true };
});

/* -------------------------------------------------------------------------- */
/*                                   SLICE                                    */
/* -------------------------------------------------------------------------- */

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
      state.connecting = false;
    },
    setActiveRoom(state, action: PayloadAction<number>) {
      state.activeRoom = action.payload;
      state.rooms = state.rooms.map((r) =>
        r.id === action.payload ? { ...r, unread: 0 } : r
      );
    },
    addRoom(state, action: PayloadAction<Room>) {
      state.rooms.push(action.payload);
    },
    updateRoom(state, action: PayloadAction<Room>) {
      state.rooms = state.rooms.map((r) =>
        r.id === action.payload.id ? action.payload : r
      );
    },
    receiveMessage(state, action: PayloadAction<Message>) {
      state.messages.push(action.payload);
      if (state.activeRoom !== action.payload.roomId) {
        state.rooms = state.rooms.map((r) =>
          r.id === action.payload.roomId ? { ...r, unread: r.unread + 1 } : r
        );
      }
    },
  },
  extraReducers: (builder) => {
    builder
      /* WebSocket ---------------------------------------------------------- */
      .addCase(connectWebSocket.pending, (state) => {
        state.connecting = true;
        state.error = null;
      })
      .addCase(connectWebSocket.fulfilled, (state, action) => {
        state.socket = action.payload;
        state.connected = true;
        state.connecting = false;
      })
      .addCase(connectWebSocket.rejected, (state, action) => {
        state.error = action.error.message ?? "WebSocket connection failed";
        state.connecting = false;
      })
      /* Rooms -------------------------------------------------------------- */
      .addCase(fetchRooms.fulfilled, (state, action) => {
        state.rooms = action.payload;
        if (state.activeRoom === null && action.payload.length) {
          state.activeRoom = action.payload[0].id;
        }
      })
      .addCase(createRoom.fulfilled, (state, action) => {
        state.rooms.push(action.payload);
      })
      .addCase(inviteUser.fulfilled, (state, action) => {
        state.rooms = state.rooms.map((r) =>
          r.id === action.payload.id ? action.payload : r
        );
      })
      /* Messages ----------------------------------------------------------- */
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messages = state.messages
          .filter((m) => m.roomId !== action.payload.roomId)
          .concat(action.payload.messages);
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.messages.push(action.payload);
      });
  },
});

/* -------------------------------------------------------------------------- */
/*                                 SELECTORS                                  */
/* -------------------------------------------------------------------------- */

export const selectRooms = (state: RootState) => state.chat.rooms;
export const selectActiveRoom = (state: RootState) => state.chat.activeRoom;
export const selectCurrentUser = (state: RootState) =>
  (state as any).auth.user as User | null;
export const selectIsConnected = (state: RootState) => state.chat.connected;
export const selectIsConnecting = (state: RootState) => state.chat.connecting;
export const selectError = (state: RootState) => state.chat.error;
export const selectMessagesByRoom = (state: RootState, roomId: number) =>
  state.chat.messages.filter((m) => m.roomId === roomId);
export const selectActiveRoomData = (state: RootState) =>
  state.chat.rooms.find((r) => r.id === state.chat.activeRoom);

/* -------------------------------------------------------------------------- */
/*                                   EXPORTS                                  */
/* -------------------------------------------------------------------------- */

export const {
  setConnected,
  setActiveRoom,
  addRoom,
  updateRoom,
  receiveMessage,
} = chatSlice.actions;

export default chatSlice.reducer;
