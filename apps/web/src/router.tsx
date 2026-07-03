import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "./routes/RootLayout";
import { Heute } from "./routes/Heute";
import { Regal } from "./routes/Regal";
import { BeanDetail } from "./routes/BeanDetail";
import { Setup } from "./routes/Setup";
import { Bruehen } from "./routes/Bruehen";
import { Kompass } from "./routes/Kompass";
import { Moderation } from "./routes/Moderation";

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Heute });
const regalRoute = createRoute({ getParentRoute: () => rootRoute, path: "/regal", component: Regal });
const beanDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/regal/$beanId",
  component: BeanDetail,
});
const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: "/setup", component: Setup });
const bruehenRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bruehen", component: Bruehen });
const kompassRoute = createRoute({ getParentRoute: () => rootRoute, path: "/kompass", component: Kompass });
// Unlisted — reachable only by URL, not in the tab bar. See Moderation.tsx for the auth caveat.
const moderationRoute = createRoute({ getParentRoute: () => rootRoute, path: "/moderation", component: Moderation });

const routeTree = rootRoute.addChildren([
  indexRoute,
  regalRoute,
  beanDetailRoute,
  setupRoute,
  bruehenRoute,
  kompassRoute,
  moderationRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
