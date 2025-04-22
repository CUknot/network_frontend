import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";
import apiClient from "@/lib/axios";

// Define types
interface User {
  id: number;
  username: string;
  email: string;
}

interface Room {
  id: number;
  name: string;
  type: "direct" | "group";
}

interface Invite {
  id: number;
  room_id: number;
  user_id: number;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
  room: Room;
  sender: User;
}

interface InvitesState {
  pendingInvites: Invite[];
  isLoading: boolean;
  error: string | null;
}

const initialState: InvitesState = {
  pendingInvites: [],
  isLoading: false,
  error: null,
};

// Get pending invites
export const getPendingInvites = createAsyncThunk(
  "invites/getPendingInvites",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/invites/pending");
      return res.data.invites as Invite[];
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch pending invites"
      );
    }
  }
);

// Accept invite
export const acceptInvite = createAsyncThunk(
  "invites/acceptInvite",
  async (inviteId: number, { rejectWithValue }) => {
    try {
      const res = await apiClient.post(`/invites/${inviteId}/accept`);
      return res.data.invite as Invite;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to accept invite"
      );
    }
  }
);

// Reject invite
export const rejectInvite = createAsyncThunk(
  "invites/rejectInvite",
  async (inviteId: number, { rejectWithValue }) => {
    try {
      const res = await apiClient.post(`/invites/${inviteId}/reject`);
      return res.data.invite as Invite;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to reject invite"
      );
    }
  }
);

const invitesSlice = createSlice({
  name: "invites",
  initialState,
  reducers: {
    clearInvitesError(state) {
      state.error = null;
    },
    removeInvite(state, action: PayloadAction<number>) {
      state.pendingInvites = state.pendingInvites.filter(
        (i) => i.id !== action.payload
      );
    },
  },
  // remove a single invite by ID

  extraReducers: (builder) => {
    builder
      .addCase(getPendingInvites.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        getPendingInvites.fulfilled,
        (state, action: PayloadAction<Invite[]>) => {
          state.isLoading = false;
          state.pendingInvites = action.payload;
        }
      )
      .addCase(getPendingInvites.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      .addCase(
        acceptInvite.fulfilled,
        (state, action: PayloadAction<Invite>) => {
          state.pendingInvites = state.pendingInvites.filter(
            (invite) => invite.id !== action.payload.id
          );
        }
      )

      .addCase(
        rejectInvite.fulfilled,
        (state, action: PayloadAction<Invite>) => {
          state.pendingInvites = state.pendingInvites.filter(
            (invite) => invite.id !== action.payload.id
          );
        }
      );
  },
});

export const { clearInvitesError, removeInvite } = invitesSlice.actions;

// Selectors
export const selectPendingInvites = (state: RootState) =>
  state.invite.pendingInvites;
export const selectInvitesLoading = (state: RootState) =>
  state.invite.isLoading;
export const selectInvitesError = (state: RootState) => state.invite.error;

export default invitesSlice.reducer;
