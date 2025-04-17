"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

// Import Redux hooks and actions
import { useAppDispatch, useAppSelector } from "@/lib/hooks"
import {
  login,
  register,
  clearError,
  selectIsAuthenticated,
  selectIsLoading,
  selectError,
} from "@/lib/features/auth/authSlice"

export default function AuthPage() {
  const router = useRouter()
  const dispatch = useAppDispatch()

  // Redux state
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isLoading = useAppSelector(selectIsLoading)
  const error = useAppSelector(selectError)

  // Form state
  const [activeTab, setActiveTab] = useState("login")
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  })
  const [registerForm, setRegisterForm] = useState({
    username: "",
    tag: "",
    email: "",
    password: "",
  })

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat")
    }
  }, [isAuthenticated, router])

  // Clear errors when switching tabs
  useEffect(() => {
    dispatch(clearError())
  }, [activeTab, dispatch])

  // Handle login form submission
  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log("Login form submitted:", loginForm)
    dispatch(login(loginForm))
  }

  // Handle register form submission
  const handleRegisterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    dispatch(register(registerForm))
  }

  // Handle login form changes
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setLoginForm((prev) => ({ ...prev, [name]: value }))
  }

  // Handle register form changes
  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setRegisterForm((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-[#111827]">Welcome</CardTitle>
          <CardDescription className="text-center text-[#6B7280]">
            Sign in or create an account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            {/* Error alert */}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    className="border-[#D1D5DB]"
                    value={loginForm.email}
                    onChange={handleLoginChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="border-[#D1D5DB]"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                  />
                </div>
                <Button type="submit" className="w-full bg-[#3B82F6] hover:bg-[#2563EB]" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-sm text-center text-[#6B7280]">
                  <p>Demo credentials: test@example.com / password</p>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegisterSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      name="username"
                      placeholder="john"
                      required
                      className="border-[#D1D5DB]"
                      value={registerForm.username}
                      onChange={handleRegisterChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tag">Tag</Label>
                    <Input
                      id="tag"
                      name="tag"
                      placeholder="doe"
                      required
                      className="border-[#D1D5DB]"
                      value={registerForm.tag}
                      onChange={handleRegisterChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    className="border-[#D1D5DB]"
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    name="password"
                    type="password"
                    required
                    className="border-[#D1D5DB]"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                  />
                </div>
                <Button type="submit" className="w-full bg-[#3B82F6] hover:bg-[#2563EB]" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-[#6B7280]">
            This is a demo app. Authentication is simulated for demonstration purposes.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
