import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import apiClient from '@/lib/axios'

// Define user types
export interface User {
  id: number
  username: string
  tag: string
}

interface UserState {
  currentUser: User | null
  searchedUsers: User[]
  loading: boolean
  error: string | null
}

const initialState: UserState = {
  currentUser: null,
  searchedUsers: [],
  loading: false,
  error: null,
}

// GET /users/me
export const getMe = createAsyncThunk('user/getMe', async (_, { rejectWithValue }) => {
  try {
    const res = await apiClient.get('/users/me')
    return res.data as User
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch current user')
  }
})

// GET /users?username=
export const searchUser = createAsyncThunk(
  'user/searchUser',
  async (username: string, { rejectWithValue }) => {
    try {
      const res = await apiClient.get(`/users?username=${encodeURIComponent(username)}`)
      return res.data.users as User[]
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to search users')
    }
  }
)

// 🧠 Slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearSearchedUsers: (state) => {
      state.searchedUsers = []
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getMe.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getMe.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false
        state.currentUser = action.payload
      })
      .addCase(getMe.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(searchUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(searchUser.fulfilled, (state, action: PayloadAction<User[]>) => {
        state.loading = false
        state.searchedUsers = action.payload
      })
      .addCase(searchUser.rejected, (state, action: PayloadAction<any>) => {
        state.loading = false
        state.error = action.payload
      })
  },
})

export const { clearSearchedUsers } = userSlice.actions

// Export selectors
export const selectSearchUser = (state: { user: UserState }) => state.user.searchedUsers
export const selectCurrentUser = (state: { user: UserState }) => state.user.currentUser

export default userSlice.reducer
