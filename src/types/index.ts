export interface Empire {
  id: string
  playerId: string
  name: string
  homeWorld: string
  color: [number, number, number]
  online: boolean
  lastSeen: Date
}

export interface RegisterResponse {
  success: boolean
  empire: Empire
}

export type DiplomacyType = "alliance" | "war" | "trade"
export type DiplomacyStatus = "pending" | "accepted" | "rejected"

export interface DiplomacyOffer {
  id: string
  fromId: string
  toId: string
  type: DiplomacyType
  status: DiplomacyStatus
  createdAt: Date
}