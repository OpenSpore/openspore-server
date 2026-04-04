import { Elysia, t } from "elysia"
import { empireStore } from "../store/empire"

export const galaxyRoutes = new Elysia({ prefix: "/galaxy" })
  .get(
    "/empires",
    ({ query }) => {
      const page = query.page ?? 1
      const limit = query.limit ?? 50
      const total = empireStore.count()
      const empires = empireStore.getAll({ page, limit })
      return { empires, total, page, limit }
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      }),
    }
  )
