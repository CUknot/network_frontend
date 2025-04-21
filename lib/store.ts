import { configureStore } from "@reduxjs/toolkit"
import chatReducer from "./features/chat/chatSlice"
import authReducer from "./features/auth/authSlice"
import userReducer from "./features/user/userSlice"
import invitesReducer from "./features/invite/inviteSlice"

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    auth: authReducer,
    user: userReducer,
    invite: invitesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in the WebSocket instance
        ignoredActions: ["chat/setWebSocket"],
        ignoredPaths: ["chat.ws"],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
