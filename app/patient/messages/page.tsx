"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatWindow } from "@/components/chat/chat-window"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  // Handle both response formats: array directly or error object
  if (Array.isArray(data)) {
    return data
  }
  // If error response, return empty array to prevent crashes
  return []
}

interface Conversation {
  id: string | null
  other_user_id: string
  other_user_name: string
  other_user_role: string
  specialization: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

export default function PatientMessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [creatingConversation, setCreatingConversation] = useState(false)

  const { data: conversations = [], mutate: mutateConversations } = useSWR<Conversation[]>("/api/conversations", fetcher, {
    refreshInterval: 10000,
  })

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.user) {
          setCurrentUser(data.data.user)
        }
      })
      .catch((error) => console.error("Error fetching user:", error))
  }, [])

  const formatTime = (date: string | null) => {
    if (!date) return ""
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)

    if (days === 0) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    } else if (days === 1) {
      return "Yesterday"
    } else if (days < 7) {
      return d.toLocaleDateString("en-US", { weekday: "short" })
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const handleSelectConversation = async (conv: Conversation) => {
    // If conversation doesn't exist (id is null), create it first
    if (!conv.id && conv.other_user_id) {
      setCreatingConversation(true)
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doctorId: conv.other_user_id }),
        })
        
        if (res.ok) {
          const newConversation = await res.json()
          if (newConversation && newConversation.id) {
            // Update the conversation with the new id
            const updatedConv = { ...conv, id: newConversation.id }
            setSelectedConversation(updatedConv)
            // Refresh conversations list
            mutateConversations()
          } else {
            console.error("Invalid conversation response:", newConversation)
            alert("Failed to create conversation. Please try again.")
          }
        } else {
          let errorData
          try {
            errorData = await res.json()
          } catch (jsonError) {
            errorData = { error: `HTTP ${res.status}: ${res.statusText}` }
          }
          console.error("Failed to create conversation - Status:", res.status)
          console.error("Failed to create conversation - Response:", errorData)
          alert(`Failed to create conversation: ${errorData.error || "Unknown error"}`)
        }
      } catch (error) {
        console.error("Error creating conversation:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
        console.error("Full error details:", error)
        alert(`An error occurred while creating the conversation: ${errorMessage}. Please try again.`)
      } finally {
        setCreatingConversation(false)
      }
    } else {
      setSelectedConversation(conv)
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex h-full gap-4">
        <Card className={cn("w-full md:w-80 flex-shrink-0", selectedConversation && "hidden md:flex md:flex-col")}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No conversations yet</p>
                  <p className="text-sm">Start a conversation with a doctor</p>
                </div>
              ) : (
                conversations.map((conv, index) => (
                  <button
                    key={conv.id || `contact-${conv.other_user_id}-${index}`}
                    onClick={() => handleSelectConversation(conv)}
                    disabled={creatingConversation}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left border-b",
                      selectedConversation?.id === conv.id && "bg-muted",
                      creatingConversation && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {conv.other_user_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{conv.other_user_name}</p>
                        <span className="text-xs text-muted-foreground">{formatTime(conv.last_message_at)}</span>
                      </div>
                      {conv.specialization && <p className="text-xs text-muted-foreground">{conv.specialization}</p>}
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.last_message || (conv.id ? "No messages yet" : "Start conversation")}
                      </p>
                    </div>
                    {conv.unread_count > 0 && <Badge className="ml-2">{conv.unread_count}</Badge>}
                    {!conv.id && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        New
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className={cn("flex-1 flex flex-col h-full p-0 overflow-hidden", !selectedConversation && "hidden md:flex")}>
          {selectedConversation && currentUser && selectedConversation.id ? (
            <ChatWindow
              conversationId={selectedConversation.id}
              otherUserName={selectedConversation.other_user_name}
              currentUserId={currentUser.id}
              onBack={() => setSelectedConversation(null)}
            />
          ) : creatingConversation ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
              <div className="text-center">
                <p>Creating conversation...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
