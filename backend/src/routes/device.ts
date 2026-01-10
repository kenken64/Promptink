import { getDeviceInfo } from "../services"

export const deviceRoutes = {
  "/api/device": {
    GET: () => {
      return Response.json(getDeviceInfo())
    },
  },
}
