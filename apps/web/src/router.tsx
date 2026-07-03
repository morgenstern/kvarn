import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "./routes/RootLayout";
import { Heute } from "./routes/Heute";
import { Regal } from "./routes/Regal";
import { Setup } from "./routes/Setup";
import { Bruehen } from "./routes/Bruehen";
import { Kompass } from "./routes/Kompass";

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Heute });
const regalRoute = createRoute({ getParentRoute: () => rootRoute, path: "/regal", component: Regal });
const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: "/setup", component: Setup });
const bruehenRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bruehen", component: Bruehen });
const kompassRoute = createRoute({ getParentRoute: () => rootRoute, path: "/kompass", component: Kompass });

const routeTree = rootRoute.addChildren([indexRoute, regalRoute, setupRoute, bruehenRoute, kompassRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
