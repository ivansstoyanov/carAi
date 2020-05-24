import * as express from 'express'

import { statusRoutes } from './status-routes'

export const registerApiRoutes = (mainRoutesPath: string, app: any) => {
    app.use(`${mainRoutesPath}/status`, statusRoutes(express))
}
