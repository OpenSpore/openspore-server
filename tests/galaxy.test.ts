import { describe, it, expect, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { galaxyRoutes } from "../src/routes/galaxy"
import { empireRoutes } from "../src/routes/empire"
import { empireStore } from "../src/store/empire"
import type { Empire } from "../src/types"

interface PaginatedResponse {
  empires: Empire[]
  total: number
  page: number
  limit: number
}

const app = new Elysia().use(empireRoutes).use(galaxyRoutes)

const makeEmpire = (playerId: string, name: string) =>
  app.handle(
    new Request("http://localhost/empire/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        name,
        homeWorld: "Some World",
        color: [255, 0, 0],
      }),
    })
  )

beforeEach(() => {
  empireStore.clear()
})

describe("GET /galaxy/empires", () => {
  it("пустой стор → пустой массив", async () => {
    const res = await app.handle(
      new Request("http://localhost/galaxy/empires")
    )
    expect(res.status).toBe(200)
    const data = await res.json() as PaginatedResponse
    expect(data.empires).toEqual([])
    expect(data.total).toBe(0)
    expect(data.page).toBe(1)
  })

  it("1 империя после регистрации", async () => {
    await makeEmpire("p1", "Zorgons")
    const res = await app.handle(
      new Request("http://localhost/galaxy/empires")
    )
    const data = await res.json() as PaginatedResponse
    expect(data.empires).toHaveLength(1)
    expect(data.empires[0]!.name).toBe("Zorgons")
    expect(data.total).toBe(1)
  })

  it("2 империи после двух регистраций", async () => {
    await makeEmpire("p1", "Zorgons")
    await makeEmpire("p2", "Krakons")
    const res = await app.handle(
      new Request("http://localhost/galaxy/empires")
    )
    const data = await res.json() as PaginatedResponse
    expect(data.empires).toHaveLength(2)
    expect(data.total).toBe(2)
  })

  it("offline империи тоже возвращаются", async () => {
    await makeEmpire("p1", "Zorgons")
    const empire = empireStore.getAll()[0]!
    empireStore.setOffline(empire.id)
    const res = await app.handle(
      new Request("http://localhost/galaxy/empires")
    )
    const data = await res.json() as PaginatedResponse
    expect(data.empires).toHaveLength(1)
    expect(data.empires[0]!.online).toBe(false)
  })
})

describe("GET /galaxy/empires — пагинация", () => {
  it("limit=2 возвращает 2 из 3", async () => {
    await makeEmpire("p1", "A")
    await makeEmpire("p2", "B")
    await makeEmpire("p3", "C")

    const res = await app.handle(
      new Request("http://localhost/galaxy/empires?page=1&limit=2")
    )
    expect(res.status).toBe(200)
    const data = await res.json() as PaginatedResponse
    expect(data.empires).toHaveLength(2)
    expect(data.total).toBe(3)
    expect(data.page).toBe(1)
    expect(data.limit).toBe(2)
  })

  it("page=2&limit=2 возвращает оставшуюся 1", async () => {
    await makeEmpire("p1", "A")
    await makeEmpire("p2", "B")
    await makeEmpire("p3", "C")

    const res = await app.handle(
      new Request("http://localhost/galaxy/empires?page=2&limit=2")
    )
    const data = await res.json() as PaginatedResponse
    expect(data.empires).toHaveLength(1)
    expect(data.total).toBe(3)
    expect(data.page).toBe(2)
  })

  it("page за пределами → пустой массив, total не 0", async () => {
    await makeEmpire("p1", "A")

    const res = await app.handle(
      new Request("http://localhost/galaxy/empires?page=99&limit=10")
    )
    const data = await res.json() as PaginatedResponse
    expect(data.empires).toHaveLength(0)
    expect(data.total).toBe(1)
  })
})
