import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import type { RootState } from "@/lib/store"
import apiClient from "@/lib/axios"

export interface User {
  id: number
  username: string
  email: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

let parsedUser: User | null = null
if (typeof window !== "undefined") {
  const storedUser = localStorage.getItem("user")
  parsedUser = storedUser ? JSON.parse(storedUser) : null
}

const initialState: AuthState = {
  user: parsedUser,
  isAuthenticated: !!parsedUser,
  isLoading: false,
  error: null,
}

// Async login thunk
export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await apiClient.post("/login", { email, password })

      const { user, token } = res.data

      if (typeof window !== "undefined") {
        localStorage.setItem("token", token)
        localStorage.setItem("user", JSON.stringify(user))
      }

      return user
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Login failed")
    }
  }
)

// Async register thunk
export const register = createAsyncThunk(
  "auth/register",
  async (
    { username, email, password }: { username: string; email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await apiClient.post("/register", { username, email, password })

      const { user, token } = res.data

      if (typeof window !== "undefined") {
        localStorage.setItem("token", token)
        localStorage.setItem("user", JSON.stringify(user))
      }

      return user
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Registration failed")
    }
  }
)

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.isAuthenticated = false
      state.error = null
      localStorage.removeItem("user")
      localStorage.removeItem("token")
    },
    clearError(state) {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false
        state.user = action.payload
        state.isAuthenticated = true
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      .addCase(register.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false
        state.user = action.payload
        state.isAuthenticated = true
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export const { logout, clearError } = authSlice.actions

// Export selectors
export const selectUser = (state: RootState) => state.auth.user
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated
export const selectIsLoading = (state: RootState) => state.auth.isLoading
export const selectError = (state: RootState) => state.auth.error

export default authSlice.reducer
