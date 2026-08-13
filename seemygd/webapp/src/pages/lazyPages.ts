import { lazy } from "react"

/**
 * Lazy-loaded route components, declared once and shared between App (routes)
 * and Root (host resolver) so each page is a single split chunk.
 *
 * This is what keeps the public visualizer fast: opening /v/:id only downloads
 * the Visualizer chunk + shared vendor code, never the heavy Dashboard/Admin
 * bundles.
 */
export const IndexPage = lazy(() => import("./Index"))
export const LandingPage = lazy(() => import("./Landing"))
export const LoginPage = lazy(() => import("./Login"))
export const SignupPage = lazy(() => import("./Signup"))
export const DashboardPage = lazy(() => import("./Dashboard"))
export const VisualizerPage = lazy(() => import("./Visualizer"))
export const PreviewPage = lazy(() => import("./Preview"))
export const AdminPage = lazy(() => import("./Admin"))
export const LegalPage = lazy(() => import("./Legal"))
export const NotFoundPage = lazy(() => import("./NotFound"))
