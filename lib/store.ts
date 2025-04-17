import { configureStore } from "@reduxjs/toolkit"
import chatReducer from "./features/chat/chatSlice"
import authReducer from "./features/auth/authSlice"

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in the WebSocket instance
        ignoredActions: ["chat/setSocket"],
        ignoredPaths: ["chat.socket"],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
