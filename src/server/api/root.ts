import { accountRouter } from "@/server/api/routers/account";
import { mailRouter } from "@/server/api/routers/mail";
import { postRouter } from "@/server/api/routers/post";
import { searchRouter } from "@/server/api/routers/search";
import { integrationsRouter } from "@/server/api/routers/integrations";
import { calendarRouter } from "@/server/api/routers/calendar";
import { labelsRouter } from "@/server/api/routers/labels";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  account: accountRouter,
  mail: mailRouter,
  search: searchRouter,
  integrations: integrationsRouter,
  calendar: calendarRouter,
  labels: labelsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
