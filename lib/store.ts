import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@/lib/features/auth/authSlice'
import userReducer from '@/lib/features/user/userSlice'
import chatReducer from '@/lib/features/chat/chatSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    chat: chatReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
